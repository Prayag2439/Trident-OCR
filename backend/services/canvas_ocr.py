import io
import json
import base64
import time
import re
from PIL import Image
from typing import Tuple, Optional, Dict, Any, List
from config import settings

CANVAS_CHALLAN_PROMPT = """You are an expert OCR and document understanding engine specializing in industrial Delivery Challans.
You are inspecting a completed delivery challan for TRIDENT FABRICATORS PVT. LTD.
The document contains pre-printed template fields and handwritten ink filled out by a user on a canvas.

EXTRACT AND TRANSCRIBE ALL PRINTED AND HANDWRITTEN FIELDS WITH MAXIMUM ACCURACY.

Fields to extract:
1. "challan_no": The handwritten Challan Number (usually in the upper right header next to "CHALLAN No.").
2. "date": The handwritten Date of the challan (usually in the upper right next to "Date:", format DD/MM/YYYY).
3. "your_order_no": Handwritten Purchase Order or reference number next to "Your Order No.:".
4. "order_date": Date associated with the order next to "Date:".
5. "vehicle_no": Vehicle / truck registration number if written (e.g. "OD 15 XXXX", "MH 04...").
6. "eway_bill_no": E-Way Bill number if written.
7. "party_name": The recipient / consignee customer or company name written after "M/s.".
8. "address": The complete delivery / consignee address written below the party name.
9. "gstin": Consignee GSTIN number (if written, 15 chars).
10. "items": Line items table list. Columns in table:
   - "sr_no": Serial number / Item number (e.g. "1", "2")
   - "item_no": HSN code if written
   - "description": Description of goods / material specifications (dimensions, plate thicknesses, item names)
   - "quantity": Quantity count (e.g. "10", "400")
   - "unit": Unit of measurement (e.g. "NOS", "MT", "KG", "PCS", "SET", "BOX", "TON")
   - "weight_mt": Weight in Metric Tons (e.g. "0.400"). If written in KG, convert to MT (500 KG = 0.500 MT).
11. "computed_weight_mt": Total computed weight in MT.
12. "total_weight_override": Manual total weight override if specifically noted.
13. "total_value_incl_tax": Total invoice amount in rupees if written.
14. "remarks": Handwritten terms, notes, or remarks anywhere on the form (e.g. "Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale.", "Returnable / Non-returnable", delivery instructions).
15. "customer_signature": Indicate if signed / signature present in "Customer's Signature" box (e.g. "Signed" or name or "Not Signed").
16. "authorised_signatory": Indicate if signed in "For TRIDENT FABRICATORS PVT. LTD. Authorised Signatory" box.

RULES:
- Carefully distinguish handwritten ink strokes from the pre-printed template.
- Do not invent information. If a field has nothing written in it, return an empty string "".
- Correct obvious character confusion in handwriting based on context:
  * Numbers: 'O' vs '0', 'I'/'l' vs '1', 'S' vs '5', 'B' vs '8'.
  * Dates: format as DD/MM/YYYY if discernible.
- Format strictly as valid JSON with NO markdown ticks or conversational text:
{
  "challan_no": "",
  "date": "",
  "your_order_no": "",
  "order_date": "",
  "vehicle_no": "",
  "eway_bill_no": "",
  "party_name": "",
  "address": "",
  "gstin": "",
  "items": [
    {
      "sr_no": "1",
      "item_no": "",
      "description": "",
      "quantity": "",
      "unit": "NOS",
      "weight_mt": "0.000"
    }
  ],
  "computed_weight_mt": "0.000",
  "total_weight_override": "",
  "total_value_incl_tax": "",
  "remarks": "",
  "customer_signature": "",
  "authorised_signatory": ""
}
"""

class CanvasOCRService:
    def __init__(self):
        self.genai_client = None
        self.groq_client = None
        self.openai_client = None
        self._init_clients()

    def _init_clients(self):
        google_key = settings.get_clean_google_key()
        if google_key and google_key != "your_google_gemini_api_key_here":
            try:
                from google import genai
                self.genai_client = genai.Client(api_key=google_key)
                print("[CanvasOCRService] Google GenAI client initialized")
            except Exception as e:
                print(f"[CanvasOCRService] Google GenAI init error: {e}")

        groq_key = settings.get_clean_groq_key()
        if groq_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=groq_key)
                print("[CanvasOCRService] Groq client initialized")
            except Exception as e:
                print(f"[CanvasOCRService] Groq init error: {e}")

        openai_key = settings.get_clean_openai_key()
        if openai_key and openai_key != "your_openai_api_key_here":
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=openai_key, timeout=90.0)
                print("[CanvasOCRService] OpenAI client initialized")
            except Exception as e:
                print(f"[CanvasOCRService] OpenAI init error: {e}")

    def _clean_base64(self, b64_str: str) -> str:
        if "," in b64_str:
            return b64_str.split(",", 1)[1]
        return b64_str.strip()

    def _parse_json_response(self, raw_text: str) -> Optional[Dict[str, Any]]:
        if not raw_text:
            return None
        text = raw_text.strip()
        # Remove code fences
        text = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

        # Try direct parse
        try:
            return json.loads(text)
        except Exception:
            pass

        # Find first { and last }
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return None

    def process_canvas_image(self, image_base64: str) -> Tuple[Dict[str, Any], str]:
        """
        Processes a whole-challan composited canvas image.
        Returns: (structured_dict, raw_ocr_text)
        """
        self._init_clients()
        cleaned_b64 = self._clean_base64(image_base64)
        
        # 1. Try Gemini 2.5 Flash / 2.0 Flash
        gemini_result, raw_gemini = self._call_gemini(cleaned_b64)
        if gemini_result:
            print("[CanvasOCR] Gemini OCR extraction successful.")
            return self._normalize_result(gemini_result), raw_gemini

        # 2. Try Groq (Llama 3.2 Vision)
        groq_result, raw_groq = self._call_groq(cleaned_b64)
        if groq_result:
            print("[CanvasOCR] Groq OCR fallback successful.")
            return self._normalize_result(groq_result), raw_groq

        # 3. Try OpenAI (GPT-4o)
        openai_result, raw_openai = self._call_openai(cleaned_b64)
        if openai_result:
            print("[CanvasOCR] OpenAI OCR fallback successful.")
            return self._normalize_result(openai_result), raw_openai

        # 4. Fallback default empty structure
        print("[CanvasOCR] Fallback default structure used.")
        default_data = {
            "challan_no": "",
            "date": "",
            "your_order_no": "",
            "order_date": "",
            "party_name": "",
            "address": "",
            "gstin": "",
            "items": [
                {"sr_no": "1", "description": "", "quantity": ""}
            ],
            "customer_signature": "",
            "authorised_signatory": ""
        }
        return default_data, raw_gemini or raw_groq or raw_openai or ""

    def _call_gemini(self, cleaned_b64: str) -> Tuple[Optional[Dict[str, Any]], str]:
        if not self.genai_client:
            return None, ""

        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        for model in models_to_try:
            try:
                t0 = time.perf_counter()
                response = self.genai_client.models.generate_content(
                    model=model,
                    contents=[
                        CANVAS_CHALLAN_PROMPT,
                        {"mime_type": "image/jpeg", "data": cleaned_b64}
                    ],
                    config={"temperature": 0.1}
                )
                elapsed = (time.perf_counter() - t0) * 1000
                raw_text = response.text.strip() if response.text else ""
                print(f"[CanvasOCR] Gemini {model} completed in {elapsed:.1f}ms")
                parsed = self._parse_json_response(raw_text)
                if parsed and isinstance(parsed, dict):
                    return parsed, raw_text
            except Exception as e:
                print(f"[CanvasOCR] Gemini {model} error: {e}")
                continue
        return None, ""

    def _call_groq(self, cleaned_b64: str) -> Tuple[Optional[Dict[str, Any]], str]:
        if not self.groq_client:
            return None, ""

        models = [settings.GROQ_MODEL, "llama-3.2-11b-vision-preview"]
        for model in models:
            try:
                t0 = time.perf_counter()
                chat_completion = self.groq_client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": CANVAS_CHALLAN_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{cleaned_b64}"
                                    }
                                }
                            ]
                        }
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                    response_format={"type": "json_object"}
                )
                elapsed = (time.perf_counter() - t0) * 1000
                raw_text = chat_completion.choices[0].message.content.strip()
                print(f"[CanvasOCR] Groq {model} completed in {elapsed:.1f}ms")
                parsed = self._parse_json_response(raw_text)
                if parsed and isinstance(parsed, dict):
                    return parsed, raw_text
            except Exception as e:
                print(f"[CanvasOCR] Groq {model} error: {e}")
                continue
        return None, ""

    def _call_openai(self, cleaned_b64: str) -> Tuple[Optional[Dict[str, Any]], str]:
        if not self.openai_client:
            return None, ""

        models = [settings.OPENAI_MODEL, "gpt-4o", "gpt-4o-mini"]
        for model in models:
            try:
                t0 = time.perf_counter()
                response = self.openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": CANVAS_CHALLAN_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{cleaned_b64}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                    response_format={"type": "json_object"}
                )
                elapsed = (time.perf_counter() - t0) * 1000
                raw_text = response.choices[0].message.content.strip()
                print(f"[CanvasOCR] OpenAI {model} completed in {elapsed:.1f}ms")
                parsed = self._parse_json_response(raw_text)
                if parsed and isinstance(parsed, dict):
                    return parsed, raw_text
            except Exception as e:
                print(f"[CanvasOCR] OpenAI {model} error: {e}")
                continue
        return None, ""

    def _normalize_result(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Ensures all expected keys, remarks, and automatic weight calculations exist."""
        items = raw_data.get("items", [])
        normalized_items = []
        total_weight_sum = 0.0

        if isinstance(items, list):
            for idx, itm in enumerate(items):
                if isinstance(itm, dict):
                    desc = str(itm.get("description") or itm.get("productDesc") or itm.get("productName") or "").strip()
                    qty = str(itm.get("quantity") or itm.get("qty") or "").strip()
                    unit = str(itm.get("unit") or itm.get("qtyUnit") or "NOS").strip().upper()
                    
                    # Deduce weight in MT if not explicit
                    weight_mt = str(itm.get("weight_mt") or itm.get("weightMT") or "").strip()
                    if not weight_mt or weight_mt == "0.000":
                        # Check description or quantity for MT/TON or KG
                        combined = f"{desc} {qty}".upper()
                        mt_match = re.search(r"([\d\.]+)\s*(?:MT|TON|TONS|M\.T\.)", combined)
                        kg_match = re.search(r"([\d\.]+)\s*(?:KG|KGS|KILOGRAM)", combined)
                        if mt_match:
                            try:
                                weight_mt = f"{float(mt_match.group(1)):.3f}"
                            except Exception:
                                weight_mt = "0.000"
                        elif kg_match:
                            try:
                                weight_mt = f"{(float(kg_match.group(1)) / 1000.0):.3f}"
                            except Exception:
                                weight_mt = "0.000"
                        else:
                            weight_mt = "0.000"
                    
                    try:
                        total_weight_sum += float(weight_mt)
                    except Exception:
                        pass

                    normalized_items.append({
                        "sr_no": str(itm.get("sr_no") or itm.get("sl_no") or itm.get("slNo") or (idx + 1)),
                        "item_no": str(itm.get("item_no") or itm.get("itemNo") or "").strip(),
                        "description": desc,
                        "quantity": qty,
                        "unit": unit if unit in ["NOS", "MT", "KG", "PCS", "SET", "BOX", "M", "M2", "M3", "LTR", "TON"] else "NOS",
                        "weight_mt": weight_mt
                    })

        if not normalized_items:
            normalized_items = [{
                "sr_no": "1",
                "item_no": "",
                "description": "",
                "quantity": "1",
                "unit": "NOS",
                "weight_mt": "0.000"
            }]

        computed_weight_str = f"{total_weight_sum:.3f}"
        raw_computed = str(raw_data.get("computed_weight_mt") or raw_data.get("computedWeightMT") or "").strip()
        if raw_computed and raw_computed != "0.000" and total_weight_sum == 0.0:
            computed_weight_str = raw_computed

        return {
            "challan_no": str(raw_data.get("challan_no") or raw_data.get("challanNo") or raw_data.get("docNo") or "").strip(),
            "date": str(raw_data.get("date") or raw_data.get("docDate") or "").strip(),
            "your_order_no": str(raw_data.get("your_order_no") or raw_data.get("yourOrderNo") or "").strip(),
            "order_date": str(raw_data.get("order_date") or raw_data.get("orderDate") or "").strip(),
            "vehicle_no": str(raw_data.get("vehicle_no") or raw_data.get("vehicleNo") or "").strip(),
            "eway_bill_no": str(raw_data.get("eway_bill_no") or raw_data.get("ewayBillNo") or "").strip(),
            "party_name": str(raw_data.get("party_name") or raw_data.get("partyName") or raw_data.get("toTrdName") or "").strip(),
            "address": str(raw_data.get("address") or raw_data.get("toAddr1") or "").strip(),
            "gstin": str(raw_data.get("gstin") or raw_data.get("toGstin") or "").strip(),
            "items": normalized_items,
            "computed_weight_mt": computed_weight_str,
            "total_weight_override": str(raw_data.get("total_weight_override") or raw_data.get("totalWeightOverride") or "").strip(),
            "total_value_incl_tax": str(raw_data.get("total_value_incl_tax") or raw_data.get("totalValueInclTax") or "").strip(),
            "remarks": str(raw_data.get("remarks") or raw_data.get("handwrittenNotes") or raw_data.get("notes") or "").strip(),
            "extra_fields": str(raw_data.get("extra_fields") or raw_data.get("extraFields") or "").strip(),
            "customer_signature": str(raw_data.get("customer_signature") or raw_data.get("customerSignature") or "").strip(),
            "authorised_signatory": str(raw_data.get("authorised_signatory") or raw_data.get("authorisedSignatory") or "").strip()
        }

canvas_ocr_service = CanvasOCRService()
