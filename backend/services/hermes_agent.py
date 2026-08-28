import os
import re
import json
import time
from typing import List, Dict, Any

MEMORY_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "hermes_memory.json")

class HermesAgent:
    """
    Hermes Self-Improving Agent for Document Layout & Quantity Disentanglement.
    Preserves all existing company and item data while mapping:
    - Extra Fields: Additional data from Description of Goods.
    - Extra Fields 2: Quantity & weight data mapped from Description and quantity area.
    """
    def __init__(self):
        self.memory = self._load_memory()

    def _load_memory(self) -> Dict[str, Any]:
        os.makedirs(os.path.dirname(MEMORY_FILE_PATH), exist_ok=True)
        if os.path.exists(MEMORY_FILE_PATH):
            try:
                with open(MEMORY_FILE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Hermes Agent] Initializing memory: {e}")
        
        return {
            "version": "1.3.0",
            "learned_skills": {
                "ditto_forward_fill": {
                    "active": True,
                    "symbols": ['"', "''", "”", "“", ",,", "do", "ditto", "““"],
                    "target_fields": ["hsnCode", "productName", "qtyUnit"]
                },
                "quantity_disentanglement": {
                    "active": True,
                    "target_sections": ["Extra Fields", "Extra Fields 2"]
                }
            },
            "documents_processed": 0,
            "patterns_evolved": []
        }

    def _save_memory(self):
        try:
            with open(MEMORY_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(self.memory, f, indent=2)
        except Exception as e:
            print(f"[Hermes Agent] Memory save note: {e}")

    def disentangle_and_map_sections(
        self,
        raw_items: List[Dict[str, Any]],
        full_text: str
    ) -> List[Dict[str, Any]]:
        """
        Extracts and maps:
        1. Clean item list with forward-filled HSN and piece count in quantity.
        2. Preserves weightMT and unit per item for challan display.
        """
        print(f"\n[Hermes Agent] Executing Data-Mapping Priority Pipeline on {len(raw_items)} items...")

        disentangled_items = []
        last_hsn = ""
        last_prod_name = "Industrial Steel Goods"
        ditto_symbols = set(self.memory["learned_skills"]["ditto_forward_fill"]["symbols"])

        for idx, item in enumerate(raw_items, start=1):
            hsn = str(item.get("hsnCode", "")).strip()
            prod_desc = str(item.get("productDesc", "")).strip()
            prod_name = str(item.get("productName", "")).strip()
            qty = str(item.get("quantity", "")).strip()
            qty_unit = str(item.get("qtyUnit", "")).strip()

            # 1. Forward-fill Ditto HSN
            if hsn in ditto_symbols or not hsn:
                if last_hsn:
                    hsn = last_hsn
                    print(f"  * Item #{idx}: Resolved ditto symbol -> inherited HSN '{hsn}'")
            else:
                clean_hsn = re.sub(r"[^\d]", "", hsn)
                if len(clean_hsn) >= 4:
                    last_hsn = clean_hsn
                    hsn = clean_hsn
                else:
                    last_hsn = hsn

            # 2. Derive category name
            if not prod_name or prod_name in ditto_symbols:
                if "PL" in prod_desc.upper() or "PLATE" in prod_desc.upper():
                    prod_name = "Structural Steel Plate"
                elif "ISA" in prod_desc.upper() or "ANGLE" in prod_desc.upper():
                    prod_name = "Steel Angle ISA"
                elif "NPB" in prod_desc.upper() or "BEAM" in prod_desc.upper():
                    prod_name = "NPB Heavy Beam"
                else:
                    prod_name = last_prod_name
            last_prod_name = prod_name

            # 3. Extract quantity from Description of Goods
            pcs_match = re.search(r"(\d+)\s*(?:Pc|Pcs|Nos|MT|TON)", prod_desc, re.IGNORECASE)
            if pcs_match and (qty == "0" or not qty or qty in ditto_symbols):
                qty = pcs_match.group(1)
                qty_unit = "PCS"
            elif not qty or qty == "0":
                qty = "1"
                qty_unit = "PCS"

            if not qty_unit:
                qty_unit = "PCS"

            taxable_amt = str(item.get("taxableAmount", "0")).replace(",", "")
            cgst_rate = str(item.get("cgstRate", "9"))
            sgst_rate = str(item.get("sgstRate", "9"))
            igst_rate = str(item.get("igstRate", "0"))
            cess_rate = str(item.get("cessRate", "0"))

            # 4. Preserve weight and unit fields from LLM extraction
            weight_mt = str(item.get("weightMT", item.get("weight", "0"))).strip()
            unit = str(item.get("unit", qty_unit or "NOS")).strip()

            # 5. If weight is still zero/missing, extract from description (e.g. "... - 0.640 MT")
            try:
                wt_val = float(weight_mt)
            except (ValueError, TypeError):
                wt_val = 0.0
            if wt_val == 0.0 and prod_desc:
                mt_match = re.search(
                    r'[-–]\s*(\d+\.?\d*)\s*MT\b', prod_desc, re.IGNORECASE
                )
                if mt_match:
                    try:
                        weight_mt = f"{float(mt_match.group(1)):.3f}"
                        print(f"  * Item #{idx}: weight extracted from description → {weight_mt} MT")
                    except (ValueError, TypeError):
                        pass

            disentangled_items.append({
                "itemNo": str(idx),
                "productName": prod_name,
                "productDesc": prod_desc if prod_desc else f"{prod_name} Item #{idx}",
                "hsnCode": hsn if hsn else "72083740",
                "quantity": qty,
                "qtyUnit": qty_unit,
                "unit": unit,
                "weightMT": weight_mt,
                "taxableAmount": taxable_amt,
                "cgstRate": cgst_rate,
                "sgstRate": sgst_rate,
                "igstRate": igst_rate,
                "cessRate": cess_rate
            })

        # Evolve Hermes Agent memory
        self.memory["documents_processed"] += 1
        self.memory["patterns_evolved"].append({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "items_standardized": len(disentangled_items),
            "extra_fields_mapped": True,
            "extra_fields_2_mapped": True
        })
        self.memory["patterns_evolved"] = self.memory["patterns_evolved"][-20:]
        self._save_memory()

        print(f"[Hermes Agent] Finished: Preserved {len(disentangled_items)} items.")
        
        return disentangled_items

hermes_agent = HermesAgent()
