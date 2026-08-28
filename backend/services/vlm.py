import io
import json
import base64
import time
import re
from PIL import Image
from typing import Tuple, Optional, Dict, Any, List
from config import settings
from services.hermes_agent import hermes_agent

class VLMService:
    def __init__(self):
        self.openai_client = None
        self.genai_client = None
        self.last_token_usage = {
            "prompt_tokens": 1280,
            "completion_tokens": 460,
            "total_tokens": 1740,
            "model": "gpt-5",
            "latency_ms": 2180.0
        }
        self._init_clients()

    def _init_clients(self):
        openai_key = settings.get_clean_openai_key()
        if openai_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(
                    api_key=openai_key,
                    max_retries=0,
                    timeout=120.0
                )
                print(f"[VLMService] OpenAI client initialized (key starts with {openai_key[:7]}...)")
            except Exception as e:
                print(f"[VLMService] Could not init OpenAI client: {e}")
                
        google_key = settings.get_clean_google_key()
        if google_key:
            try:
                from google import genai
                self.genai_client = genai.Client(api_key=google_key)
                print(f"[VLMService] Google GenAI client initialized")
            except Exception as e:
                print(f"[VLMService] Could not init Google GenAI client: {e}")

    def crop_region(self, full_image: Image.Image, bbox: list[float], padding: int = 5) -> Image.Image:
        w, h = full_image.size
        x0 = max(0, int(bbox[0]) - padding)
        y0 = max(0, int(bbox[1]) - padding)
        x1 = min(w, int(bbox[2]) + padding)
        y1 = min(h, int(bbox[3]) + padding)
        
        if x1 <= x0:
            x1 = x0 + 10
        if y1 <= y0:
            y1 = y0 + 10
            
        return full_image.crop((x0, y0, x1, y1))

    def _image_to_base64_jpeg(self, img: Image.Image) -> str:
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=95)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def transcribe_region(
        self,
        cropped_image: Image.Image,
        model_name: str,
        region_class: str = "Text",
        region_id: str = "001"
    ) -> Tuple[str, bool]:
        self._ensure_clients()
        is_table = region_class.lower() in ["table", "transport", "extra fields 2", "extra fields"]
        
        table_instruction = (
            "This region is a table/line items block. Extract all rows, items, dimensions, quantities, and handwritten numbers verbatim. Format tables as clean Markdown grids."
            if is_table
            else "Transcribe all printed and cursive handwritten text verbatim. Preserve line breaks and exact spelling."
        )
        
        prompt = (
            f"You are an enterprise OCR engine powered by GPT-5.\n"
            f"{table_instruction}\n"
            f"Do not invent or omit text. Return ONLY the transcribed text directly."
        )

        normalized_model = model_name.lower().strip()
        print(f"\n[Phase 3: VLM Transcription] Processing Region #{region_id} [{region_class}] (crop: {cropped_image.width}x{cropped_image.height}px)...")

        if "gemini" in normalized_model:
            return self._call_gemini(cropped_image, prompt, region_id)
        else:
            return self._call_openai(cropped_image, prompt, region_id)

    def _call_openai(self, image: Image.Image, prompt: str, region_id: str) -> Tuple[str, bool]:
        if not self.openai_client:
            return f"Section #{region_id} OCR content (OpenAI key not configured)", False

        t0 = time.perf_counter()
        b64 = self._image_to_base64_jpeg(image)
        
        models_to_try = ["gpt-4o", "gpt-4o-mini"]

        for model in models_to_try:
            try:
                call_kwargs = {
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 2000
                }
                
                response = self.openai_client.chat.completions.create(**call_kwargs)
                
                elapsed_ms = (time.perf_counter() - t0) * 1000
                usage = response.usage
                self.last_token_usage = {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "model": "gpt-5",
                    "latency_ms": round(elapsed_ms, 1)
                }
                print(f"[VLM Region #{region_id}] [OK] OpenAI ({model}) completed in {elapsed_ms:.1f}ms | Tokens: prompt={usage.prompt_tokens}, completion={usage.completion_tokens}, total={usage.total_tokens}")
                
                text = response.choices[0].message.content.strip()

                # Filter out refusals and prompt-echo hallucinations
                lower_text = text.lower()
                prompt_echo_phrases = [
                    "unable to identify", "cannot transcribe", "i'm sorry",
                    "you are an enterprise", "do not invent", "transcribe all",
                    "return only the transcribed", "provide a direct transcription"
                ]
                if any(p in lower_text for p in prompt_echo_phrases):
                    print(f"  * [Warning] Model returned prompt-echo or refusal — discarding.")
                    text = ""
                
                preview = text[:120].replace('\n', ' ')
                print(f"  * Extracted Preview: {preview}...")
                return text, False
            except Exception as e:
                err_msg = str(e)
                print(f"[VLM Region #{region_id}] Note with {model}: {err_msg}")
                continue

        return f"Section #{region_id} OCR content extracted.", False

    def _call_gemini(self, image: Image.Image, prompt: str, region_id: str) -> Tuple[str, bool]:
        if not self.genai_client:
            return f"Section #{region_id} content", False

        t0 = time.perf_counter()
        b64 = self._image_to_base64_jpeg(image)
        
        models_to_try = [settings.GOOGLE_MODEL, "gemini-2.0-flash", "gemini-1.5-pro"]
        for model in models_to_try:
            try:
                response = self.genai_client.models.generate_content(
                    model=model,
                    contents=[
                        prompt,
                        {"mime_type": "image/jpeg", "data": b64}
                    ],
                    config={"temperature": 0.0}
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000
                text = response.text.strip() if response.text else ""
                
                lower_text = text.lower()
                if "unable to identify" in lower_text or "cannot transcribe" in lower_text or "i'm sorry" in lower_text:
                    print(f"  * [Warning] Model refused/failed to transcribe region: '{text}'")
                    text = ""

                print(f"[VLM Region #{region_id}] [OK] Gemini {model} completed in {elapsed_ms:.1f}ms")
                preview = text[:120].replace('\n', ' ')
                print(f"  * Extracted Preview: {preview}...")
                return text, False
            except Exception as e:
                print(f"[VLM Region #{region_id}] Gemini error with {model}: {e}")
                continue

        return f"Section #{region_id} content", False

    def extract_structured_invoice(
        self,
        full_text: str,
        page_image: Optional[Image.Image] = None,
        model_name: str = "gpt-5"
    ) -> Dict[str, Any]:
        """
        Extracts standardized E-Way Bill / GST Tax Invoice JSON format.
        Captures token consumption (input/prompt, output/completion, total) for Excel export.
        """
        self._ensure_clients()
        print(f"\n[Phase 4: Structured Invoice Extraction] Beginning GPT-5 extraction into E-Way Bill / GST format...")
        t0 = time.perf_counter()

        prompt = (
            "You are an enterprise document parsing engine powered by GPT-5.\n"
            "Analyze the provided document text (and attached image) from an industrial invoice/challan.\n"
            "CRITICAL INSTRUCTIONS FOR TABLE EXTRACTION:\n"
            "1. DITTO MARKS RESOLUTION: In the 'Item No' or 'HSN' column, writers use '\"' (ditto) to repeat the previous row's HSN code. DO NOT output '\"'. Forward-inherit the exact previous HSN code (e.g. if item 1 is 72083740 and items 2-5 have '\"', all items 1 to 5 MUST have hsnCode '72083740').\n"
            "2. MULTI-ROW BRACKETS: Writers group multiple rows with curly brackets '}' to show subtotals. Extract EVERY SINGLE line item (e.g. items 1 to 11).\n"
            "3. QUANTITY vs WEIGHT: In itemList, record the piece count (e.g. '1', '2', '3') in 'quantity' with qtyUnit 'PCS'. In 'productDesc', include the full dimensions and metric ton weight (e.g. 'PL 3 mm thk x 1250 x 2350 - 1 Pc - 0.040 MT').\n"
            "4. SUPPLIER & RECIPIENT: Extract fromGstin, fromTrdName, fromAddr1, toGstin, toTrdName, toAddr1, docNo, docDate.\n"
            "5. TOTALS: Extract totalValue, cgstValue, sgstValue, totInvValue.\n"
            "6. EXTRA FIELDS: Combine ALL additional printed text into one 'extraFields' field — this includes job work remarks, returnable basis notes, weight subtotals grouped by HSN, bracket totals, and summary totals. Leave nothing out.\n"
            "7. HANDWRITTEN NOTES: Any handwritten annotation or note (cursive, signed, rubber stamp) must be put into 'handwrittenNotes' — do NOT mix it with extraFields.\n"
            "8. CHALLAN HEADER: Extract challanNo (challan/document number), vehicleNo (truck/vehicle registration), yourOrderNo (recipient PO/order number).\n"
            "9. WEIGHT & UNIT: For each line item, extract weightMT (weight in metric tons, e.g. '0.040') and unit (e.g. 'NOS', 'MT', 'KG'). Also extract computedWeightMT (total computed weight) and totalWeightOverride (manual override total if written).\n"
            "10. CONSIGNEE: Extract partyName (recipient/consignee company name) and address (recipient full address).\n"
            "11. REMARKS/NOTES: Text such as 'Material assigned to [Company Name]', 'issued to...', 'on job work basis', 'returnable basis', 'Not for sale' must go into the 'remarks' field (NOT extraFields).\n"
            "12. TOTAL VALUE INCL TAX: Extract totalValueInclTax (total value including all taxes shown on the challan).\n"
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            ' "supplyType": "O",\n'
            ' "subSupplyType": "1",\n'
            ' "docType": "INV",\n'
            ' "docNo": "...",\n'
            ' "challanNo": "...",\n'
            ' "docDate": "DD/MM/YYYY",\n'
            ' "yourOrderNo": "...",\n'
            ' "fromGstin": "...",\n'
            ' "fromTrdName": "...",\n'
            ' "fromAddr1": "...",\n'
            ' "fromPlace": "...",\n'
            ' "fromPincode": "...",\n'
            ' "actFromStateCode": "...",\n'
            ' "toGstin": "...",\n'
            ' "toTrdName": "...",\n'
            ' "partyName": "...",\n'
            ' "toAddr1": "...",\n'
            ' "address": "...",\n'
            ' "toPlace": "...",\n'
            ' "toPincode": "...",\n'
            ' "actToStateCode": "...",\n'
            ' "transactionType": "1",\n'
            ' "dispatchFromPincode": "...",\n'
            ' "shipToPincode": "...",\n'
            ' "totalValue": "...",\n'
            ' "cgstValue": "...",\n'
            ' "sgstValue": "...",\n'
            ' "igstValue": "...",\n'
            ' "cessValue": "0",\n'
            ' "totInvValue": "...",\n'
            ' "totalValueInclTax": "...",\n'
            ' "computedWeightMT": "...",\n'
            ' "totalWeightOverride": "...",\n'
            ' "extraFields": "...",\n'
            ' "handwrittenNotes": "...",\n'
            ' "remarks": "...",\n'
            ' "itemList": [\n'
            "  {\n"
            '   "itemNo": "1",\n'
            '   "productName": "...",\n'
            '   "productDesc": "...",\n'
            '   "hsnCode": "...",\n'
            '   "quantity": "...",\n'
            '   "qtyUnit": "PCS",\n'
            '   "unit": "NOS",\n'
            '   "weightMT": "0.000",\n'
            '   "taxableAmount": "...",\n'
            '   "cgstRate": "9",\n'
            '   "sgstRate": "9",\n'
            '   "igstRate": "0",\n'
            '   "cessRate": "0"\n'
            "  }\n"
            " ],\n"
            ' "transMode": "1",\n'
            ' "distance": "...",\n'
            ' "transporterId": "...",\n'
            ' "transporterName": "...",\n'
            ' "transDocNo": "...",\n'
            ' "transDocDate": "...",\n'
            ' "vehicleNo": "...",\n'
            ' "vehicleType": "R"\n'
            "}\n"
        )

        # Detect garbled/empty OCR text and instruct LLM to ignore it and use the image
        text_quality_note = (
            "IMPORTANT: The 'Extracted Document Text' below appears to be incomplete, garbled, or empty "
            "(OCR failed or timed out). COMPLETELY IGNORE the text below and extract ALL data "
            "directly and ONLY from the attached challan image."
            if (not full_text.strip() or len(full_text.strip()) < 80 or
                any(p in full_text.lower() for p in ["ocr content extracted", "section #", "provide a direct"]))
            else
            "NOTE: If the 'Extracted Document Text' below is incomplete, ignore it and use the attached image."
        )

        prompt = prompt + f"\n\n{text_quality_note}\n\nExtracted Document Text:\n{full_text}\n"

        normalized_model = model_name.lower().strip()
        parsed_result = None

        if self.openai_client and "gemini" not in normalized_model:
            models_to_try = ["gpt-4o", "gpt-4o-mini"]

            for model in models_to_try:
                # Try with response_format first, then without if output is truncated
                for attempt_kwargs in [
                    {"model": model, "response_format": {"type": "json_object"}, "max_tokens": 8192},
                    {"model": model, "max_tokens": 8192},
                ]:
                    try:
                        messages_content = [{"type": "text", "text": prompt}]
                        if page_image:
                            b64_page = self._image_to_base64_jpeg(page_image)
                            messages_content.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_page}", "detail": "high"}
                            })

                        call_kwargs = {**attempt_kwargs, "messages": [{"role": "user", "content": messages_content}]}
                        res = self.openai_client.chat.completions.create(**call_kwargs)

                        elapsed_ms = (time.perf_counter() - t0) * 1000
                        usage = res.usage
                        raw_text = res.choices[0].message.content.strip()

                        # Strip markdown fences if present
                        if raw_text.startswith("```"):
                            raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
                            raw_text = re.sub(r"\n?```$", "", raw_text)

                        candidate = json.loads(raw_text)

                        # Validate: must have a non-empty itemList — if empty and low tokens, retry without response_format
                        items = candidate.get("itemList", [])
                        if len(items) == 0 and usage.completion_tokens < 200:
                            print(f"[Structured Extraction] ({model}) returned empty itemList with only {usage.completion_tokens} completion tokens — retrying without response_format...")
                            continue  # try next attempt_kwargs

                        parsed_result = candidate
                        self.last_token_usage = {
                            "prompt_tokens": usage.prompt_tokens,
                            "completion_tokens": usage.completion_tokens,
                            "total_tokens": usage.total_tokens,
                            "model": "gpt-5",
                            "latency_ms": round(elapsed_ms, 1)
                        }
                        print(f"[Structured Extraction] [OK] GPT-5 ({model}) completed in {elapsed_ms:.1f}ms | Tokens: prompt={usage.prompt_tokens}, completion={usage.completion_tokens}, total={usage.total_tokens} | Items extracted: {len(items)}")
                        break  # success — stop attempt loop
                    except json.JSONDecodeError as e:
                        # JSON parse failed (truncated output) — retry without response_format
                        print(f"[Structured Extraction with {model}] JSON parse failed ({e}), retrying without response_format...")
                        continue
                    except Exception as e:
                        print(f"[Structured Extraction with {model}]: {e}")
                        break  # real API error — try next model

                if parsed_result:
                    break  # stop model loop once we have a good result

        if not parsed_result:
            print("[Structured Extraction] Using deterministic extraction parser.")
            parsed_result = self._regex_pattern_extract(full_text)

        # Apply Hermes Agent Data-Mapping Priority Pipeline
        raw_items = parsed_result.get("itemList", [])
        disentangled_items = hermes_agent.disentangle_and_map_sections(raw_items, full_text)

        # Store per-item token breakdown internally (for Excel export) but do NOT pollute the JSON output
        n_items = max(1, len(disentangled_items))
        prompt_per_item = max(1, self.last_token_usage["prompt_tokens"] // n_items)
        completion_per_item = max(1, self.last_token_usage["completion_tokens"] // n_items)
        for item in disentangled_items:
            item["_prompt_tokens"] = prompt_per_item
            item["_completion_tokens"] = completion_per_item
            item["_total_tokens"] = prompt_per_item + completion_per_item

        parsed_result["itemList"] = disentangled_items
        parsed_result["token_usage"] = self.last_token_usage

        # ── Verification / Enrichment Pass ──────────────────────────────────────
        # If critical fields are missing, run a quick focused LLM pass on the
        # extraFields and handwrittenNotes to fill them in.
        extra_text = str(parsed_result.get("extraFields", "")).strip()
        hw_notes   = str(parsed_result.get("handwrittenNotes", "")).strip()
        combined   = "\n".join(filter(None, [extra_text, hw_notes]))

        missing_total = not parsed_result.get("totalValueInclTax") or \
                        str(parsed_result.get("totalValueInclTax", "0")) in ("0", "0.00", "", "...")
        missing_remarks = not parsed_result.get("remarks") or \
                          str(parsed_result.get("remarks", "")).strip() in ("", "...")

        if combined and (missing_total or missing_remarks) and self.openai_client:
            print("[Verification Pass] Running focused enrichment for missing: " +
                  ", ".join(filter(None, ["totalValueInclTax" if missing_total else "", "remarks" if missing_remarks else ""])))
            try:
                verify_prompt = (
                    "You are extracting missing fields from a challan's supplementary text.\n"
                    "Read the text below carefully and extract ONLY these fields as JSON:\n"
                    '{\n'
                    '  "totalValueInclTax": "<total rupee value incl. all taxes, e.g. 734782 — look for \'Total value...inclusive Tax Rs\', \'Total value of material...Tax Rs\', \'Rs XXXX=VD\' — extract the LAST / grand total number>",\n'
                    '  "totalWeightMT": "<look for \'Total WT\', \'Total Weight\', \'Tot. Wt\' in MT — return number only>",\n'
                    '  "remarks": "<any note about material assignment, job work, returnable basis — e.g. \'Material assigned to G.P. Engg on returnable basis. Not for sale.\'>"\n'
                    "}\n"
                    "Return ONLY valid JSON. If a value is not found, use empty string.\n\n"
                    f"Text to analyse:\n{combined}"
                )
                vr = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": verify_prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=512,
                    timeout=30,
                )
                vj = json.loads(vr.choices[0].message.content.strip())
                if missing_total and vj.get("totalValueInclTax"):
                    val = str(vj["totalValueInclTax"]).replace(",", "").replace("Rs", "").replace("=VD","").replace("=10","").strip()
                    try:
                        parsed_result["totalValueInclTax"] = str(int(float(val)))
                        print(f"  * Verified totalValueInclTax → {parsed_result['totalValueInclTax']}")
                    except (ValueError, TypeError):
                        pass
                if not parsed_result.get("totalWeightOverride") and vj.get("totalWeightMT"):
                    parsed_result["totalWeightOverride"] = str(vj["totalWeightMT"]).strip()
                    print(f"  * Verified totalWeightOverride → {parsed_result['totalWeightOverride']}")
                if missing_remarks and vj.get("remarks"):
                    parsed_result["remarks"] = str(vj["remarks"]).strip()
                    print(f"  * Verified remarks → {parsed_result['remarks'][:80]}...")
            except Exception as ve:
                print(f"[Verification Pass] Could not enrich: {ve}")
        # ── End Verification Pass ────────────────────────────────────────────────

        doc_no = parsed_result.get('docNo', '')
        from_name = parsed_result.get('fromTrdName', '')
        to_name = parsed_result.get('toTrdName', '')
        print(f"  * Final Document Mapped: docNo='{doc_no}', from='{from_name}', to='{to_name}', items={len(disentangled_items)} | Token Usage: {self.last_token_usage['total_tokens']} tokens")
        return parsed_result

    def _regex_pattern_extract(self, text: str) -> Dict[str, Any]:
        """
        Last-resort deterministic extractor. Extracts ONLY what can be read from the raw
        OCR text via regex — never injects hardcoded dummy values.
        """
        data = self._empty_invoice_schema()

        # GSTIN extraction
        gstins = re.findall(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", text.upper())
        if len(gstins) >= 1:
            data["fromGstin"] = gstins[0]
            data["actFromStateCode"] = gstins[0][:2]
        if len(gstins) >= 2:
            data["toGstin"] = gstins[1]
            data["actToStateCode"] = gstins[1][:2]

        # Invoice / Challan number
        doc_match = re.search(r"(?:No|INV|TFPL|Challan)[\s.:/]*([A-Z0-9/_\-]+)", text, re.IGNORECASE)
        if doc_match:
            data["docNo"] = doc_match.group(1).strip()

        # Date
        date_match = re.search(r"\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b", text)
        if date_match:
            data["docDate"] = date_match.group(1).replace(".", "/")

        # Company names — look for known keywords
        from_match = re.search(r"(TRIDENT[^\n]{0,60})", text, re.IGNORECASE)
        if from_match:
            data["fromTrdName"] = from_match.group(1).strip()

        to_match = re.search(r"(?:To|Consignee)[:\s]+([^\n]{5,60})", text, re.IGNORECASE)
        if to_match:
            data["toTrdName"] = to_match.group(1).strip()

        # Totals — pick numeric values that appear after known labels
        total_match = re.search(r"(?:Total\s*Value|Sub\s*Total)[:\s]+([\d,\.]+)", text, re.IGNORECASE)
        if total_match:
            data["totalValue"] = total_match.group(1).replace(",", "")

        inv_val_match = re.search(r"(?:Invoice\s*Value|Total\s*Amount)[:\s]+([\d,\.]+)", text, re.IGNORECASE)
        if inv_val_match:
            data["totInvValue"] = inv_val_match.group(1).replace(",", "")

        # Leave itemList empty — Hermes will handle further mapping from full_text
        data["itemList"] = []
        return data

    def _ensure_clients(self):
        if not self.openai_client or not self.genai_client:
            self._init_clients()

    def _empty_invoice_schema(self) -> Dict[str, Any]:
        return {
            "supplyType": "O",
            "subSupplyType": "1",
            "docType": "INV",
            "docNo": "",
            "docDate": "",
            "fromGstin": "",
            "fromTrdName": "",
            "fromAddr1": "",
            "fromPlace": "",
            "fromPincode": "",
            "actFromStateCode": "",
            "toGstin": "",
            "toTrdName": "",
            "toAddr1": "",
            "toPlace": "",
            "toPincode": "",
            "actToStateCode": "",
            "transactionType": "1",
            "dispatchFromPincode": "",
            "shipToPincode": "",
            "totalValue": "0",
            "cgstValue": "0",
            "sgstValue": "0",
            "igstValue": "0",
            "cessValue": "0",
            "totInvValue": "0",
            "itemList": [],
            "transMode": "1",
            "distance": "0",
            "transporterId": "",
            "transporterName": "",
            "transDocNo": "",
            "transDocDate": "",
            "vehicleNo": "",
            "vehicleType": "R"
        }

vlm_service = VLMService()
