"""
assistant.py — AI Assistant & Voice-Assisted Challan endpoints

POST /api/v1/assistant/voice
    Accepts an audio file (webm/wav/m4a), current challan JSON, and optional partial_context.
    1. Transcribes audio via OpenAI Whisper (speech-to-text).
    2. Combines with partial_context if continuing a multi-segment value.
    3. Passes the full transcript + challan state to GPT-5.
    4. Returns { transcript, updates, clarification, continueListening } JSON.

POST /api/v1/assistant/text
    Accepts a natural-language instruction + the current challan JSON.
    1. Passes instruction + challan state to GPT-5.
    2. Returns { updates, clarification } JSON.
"""

import json
import io
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from config import settings

router = APIRouter(prefix="/api/v1/assistant", tags=["AI Assistant"])

# ── System prompt shared between text and voice pipelines ────────────────────

SYSTEM_PROMPT = """You are an AI assistant that helps users fill out dispatch challans for TRIDENT FABRICATORS PVT. LTD., an industrial steel/metal fabricator.

The user will give you a natural-language instruction (possibly transcribed from speech) and the current state of the challan being edited.

YOUR TASK: Produce a JSON object describing ONLY the fields that should be changed. Do NOT include fields that are not mentioned or implied by the user's instruction.

The challan has the following field structure:
- challanNo (string)
- date (string, DD/MM/YYYY)
- yourOrderNo (string)
- vehicleNo (string)
- ewayBillNo (string)
- partyName (string) — the consignee/recipient company name
- gstin (string) — consignee GSTIN: EXACTLY 15 alphanumeric characters in format: 2 digits + 5 uppercase letters + 4 digits + 1 uppercase letter + 1 alphanumeric + Z + 1 alphanumeric (e.g. "27ABCDE1234F1Z5")
- address (string) — consignee full address (can be long and multi-line)
- totalValueInclTax (string) — total invoice value in rupees (numeric string)
- totalWeightOverride (string) — manual total weight in MT
- remarks (string)
- items (array of objects) — each item has:
    - slNo (string)
    - itemNo (string) — HSN code
    - description (string)
    - qty (string)
    - unit (string) — one of: NOS, MT, KG, PCS, SET, BOX, M, M2, M3, LTR, TON
    - weightMT (string) — weight in metric tons (e.g. "0.040")

FIELD-AWARENESS AND COMPLETENESS RULES:
A. GSTIN VALIDATION — A GSTIN is EXACTLY 15 characters. If the user dictates a GSTIN and the combined value (including any partial context already captured) is fewer than 15 alphanumeric characters, you MUST set "continueListening" to true so the system waits for the rest. Normalize by removing spaces before counting. Only populate the gstin field once you have 15 alphanumeric characters. Do not guess missing GSTIN characters.
B. ADDRESS — Addresses can be long and multi-part. Do not treat a short address as incomplete. If the user's instruction clearly provides an address (even a short one), populate it. Only set continueListening if the address seems obviously cut off mid-sentence (e.g., ends with a comma and a conjunction or preposition with nothing after it).
C. PHONE / NUMERIC STRUCTURED VALUES — Similar to GSTIN, if a value has a known fixed length (e.g., 10-digit phone) and the captured value is incomplete, set continueListening.
D. NORMAL FIELDS — For all other fields (partyName, vehicleNo, qty, date, etc.), do not request continuation. Accept the value as complete.

GSTIN NORMALIZATION RULES (when normalizing dictated GSTIN):
- Remove all spaces: "27 ABC DE 1234 F1Z5" → "27ABCDE1234F1Z5"
- Convert to uppercase
- The user may dictate letter by letter with spaces or pauses — concatenate them
- Only after normalization, check if length == 15

GENERAL RULES:
1. Only update fields explicitly mentioned or clearly implied by the instruction.
2. Never modify fields not mentioned by the user.
3. Never overwrite an existing non-empty field unless the user clearly instructs a change.
4. For items: if the user says "add 10 bags of cement", add a new item. If they say "change quantity of cement to 25", update that item's qty.
5. If the instruction is ambiguous (multiple items and user says "change quantity to 5" without specifying which), set "clarification" to a short question and "updates" to null.
6. If nothing to update, set "clarification" to a polite explanation and "updates" to null.
7. Return ONLY valid JSON in this exact format:
{
  "updates": {
    "challanNo": "...",    // only if changed
    "gstin": "...",        // only if COMPLETE (15 chars); otherwise continueListening=true
    "items": [...]         // full updated items array ONLY if items were changed
    // ... other changed fields only
  },
  "clarification": null,    // or a question string if clarification is needed
  "continueListening": false, // true ONLY if a structured value (e.g. GSTIN) is provably incomplete
  "continueReason": null    // e.g. "gstin_incomplete" — human-readable reason for continuation
}

IMPORTANT: If items are updated, always return the COMPLETE items array preserving all unchanged items exactly as they are.
IMPORTANT: "continueListening" should be true ONLY when you are CERTAIN the user is still in the middle of providing a specific structured value that has a known format requirement. Do not use it speculatively.
"""


def _get_openai_client():
    """Returns an initialized OpenAI client or raises HTTPException."""
    api_key = settings.get_clean_openai_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured on server.")
    try:
        import openai
        return openai.OpenAI(api_key=api_key, max_retries=0, timeout=60.0)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Could not initialize OpenAI client: {e}")


def _call_gpt5_for_updates(client, instruction: str, challan_state: dict, partial_context: str = "") -> dict:
    """Calls GPT-5 (gpt-4o) with the instruction and challan state. Returns parsed JSON."""
    # Build user message, including partial context if continuing a multi-segment value
    context_note = ""
    if partial_context:
        context_note = (
            f"\n\nNOTE: The user was previously dictating a value and the partial input captured so far is: "
            f'"{partial_context}"\n'
            f"The new transcript below continues from that partial. Combine them intelligently before determining field values.\n"
        )

    user_message = (
        f"Current challan state:\n{json.dumps(challan_state, indent=2)}\n"
        f"{context_note}\n"
        f"User instruction: {instruction}"
    )

    for model in ["gpt-4o", "gpt-4o-mini"]:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                max_tokens=2048,
                temperature=0.0,
            )
            raw = response.choices[0].message.content.strip()
            result = json.loads(raw)
            return result
        except json.JSONDecodeError:
            continue
        except Exception as e:
            if "model" in str(e).lower():
                continue
            raise HTTPException(status_code=500, detail=f"GPT-5 call failed: {e}")

    raise HTTPException(status_code=500, detail="All GPT-5 models failed to produce a valid response.")


@router.post("/voice")
async def voice_assistant(
    audio: UploadFile = File(...),
    challan_state: str = Form("{}"),
    partial_context: str = Form(""),
):
    """
    Accepts audio (webm/wav/m4a) + current challan JSON string + optional partial_context.
    Returns { transcript, updates, clarification, continueListening, continueReason }.
    """
    client = _get_openai_client()

    # 1. Transcribe audio via Whisper
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    # Determine file extension from content type or filename
    content_type = audio.content_type or "audio/webm"
    extension = "webm"
    if "wav" in content_type or (audio.filename or "").endswith(".wav"):
        extension = "wav"
    elif "mp4" in content_type or "m4a" in content_type or (audio.filename or "").endswith(".m4a"):
        extension = "mp4"
    elif "ogg" in content_type or (audio.filename or "").endswith(".ogg"):
        extension = "ogg"

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"recording.{extension}"

    try:
        transcript_response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
            response_format="text",
        )
        transcript = str(transcript_response).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech-to-text failed: {e}")

    if not transcript:
        return {
            "transcript": "",
            "updates": None,
            "clarification": "I couldn't hear anything. Please try again.",
            "continueListening": False,
            "continueReason": None,
        }

    # 2. Parse current challan state
    try:
        challan = json.loads(challan_state)
    except json.JSONDecodeError:
        challan = {}

    # 3. Get GPT-5 field updates (pass partial_context so GPT-5 can combine segments)
    result = _call_gpt5_for_updates(client, transcript, challan, partial_context=partial_context.strip())

    return {
        "transcript": transcript,
        "updates": result.get("updates"),
        "clarification": result.get("clarification"),
        "continueListening": bool(result.get("continueListening", False)),
        "continueReason": result.get("continueReason"),
    }


@router.post("/text")
async def text_assistant(
    instruction: str = Form(...),
    challan_state: str = Form("{}"),
):
    """
    Accepts a text instruction + current challan JSON string.
    Returns { updates, clarification }.
    """
    client = _get_openai_client()

    if not instruction.strip():
        raise HTTPException(status_code=400, detail="Instruction cannot be empty.")

    # Parse current challan state
    try:
        challan = json.loads(challan_state)
    except json.JSONDecodeError:
        challan = {}

    # Get GPT-5 field updates
    result = _call_gpt5_for_updates(client, instruction.strip(), challan)

    return {
        "updates": result.get("updates"),
        "clarification": result.get("clarification"),
    }
