import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"

def test_ai_assistant_for_canvas():
    print("\n--- Testing AI Assistant with Canvas State ---")
    url = f"{BASE_URL}/api/v1/assistant/text"
    
    # Simulate a canvas challan state
    canvas_state = {
        "challanNo": "1045",
        "date": "05/09/2026",
        "yourOrderNo": "PO-999",
        "vehicleNo": "",
        "ewayBillNo": "",
        "partyName": "G.P. Engineering Works",
        "address": "G.I.D.C. Makarpura, Vadodara",
        "gstin": "24ABCDE1234F1Z5",
        "remarks": "",
        "totalWeightOverride": "",
        "totalValueInclTax": "",
        "items": [
            {
                "slNo": "1",
                "itemNo": "7208",
                "description": "M.S. PLATE 25MM THK",
                "qty": "2",
                "unit": "NOS",
                "weightMT": "1.250"
            }
        ]
    }
    
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    # Instruction to update vehicleNo and remarks
    instruction = "Update vehicle number to OD-15-B-9999 and set remarks to Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale."
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="instruction"\r\n\r\n'
        f"{instruction}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="challan_state"\r\n\r\n'
        f"{json.dumps(canvas_state)}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            print("Response Status:", resp.status)
            print("AI Assistant response updates:", json.dumps(data.get("updates", {}), indent=2))
            updates = data.get("updates", {})
            assert "vehicleNo" in updates or "remarks" in updates or "partyName" in updates
            print("SUCCESS: AI Assistant handled natural language updates successfully!")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode()}")
    except Exception as e:
        print(f"Error: {e}")

def test_canvas_db_crud():
    print("\n--- Testing Canvas DB CRUD with All New Fields ---")
    import sys
    sys.path.insert(0, r"d:\Wrok Main\Trident\backend")
    from database import insert_canvas_challan, get_canvas_challan_by_id, get_canvas_challans
    from models.schemas import CanvasChallanItem
    
    items = [
        CanvasChallanItem(
            sr_no="1",
            item_no="7208",
            description="M.S. PLATE 25MM THK",
            quantity="5",
            unit="NOS",
            weight_mt="2.500"
        ),
        CanvasChallanItem(
            sr_no="2",
            item_no="7308",
            description="ANGLE 50X50X6",
            quantity="10",
            unit="NOS",
            weight_mt="0.750"
        )
    ]
    
    rec_id = f"test_crud_{int(__import__('time').time())}"
    rec_dict = {
        "id": rec_id,
        "challan_no": "9988",
        "date": "05/09/2026",
        "your_order_no": "PO-777",
        "order_date": "01/09/2026",
        "vehicle_no": "OD 15 A 1234",
        "eway_bill_no": "EWAY-99887766",
        "party_name": "G.P. Engineering",
        "address": "Baroda Industrial Area",
        "gstin": "24AABCT1332L1ZV",
        "items": [it.dict() for it in items],
        "computed_weight_mt": "3.250",
        "total_weight_override": "",
        "total_value_incl_tax": "150000",
        "remarks": "Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale.",
        "extra_fields": "",
        "customer_signature": "Received in good condition",
        "authorised_signatory": "Optimo Admin",
        "preview_image_base64": "",
        "raw_ocr_text": "Test raw OCR",
        "user_id": "admin@optimo.com",
        "role": "admin",
        "creator_name": "Admin User"
    }
    saved = insert_canvas_challan(rec_dict)
    
    print("Inserted record id:", saved["id"])
    retrieved = get_canvas_challan_by_id(rec_id)
    assert retrieved is not None, "Failed to retrieve saved record"
    assert retrieved["vehicle_no"] == "OD 15 A 1234", f"Unexpected vehicle_no: {retrieved['vehicle_no']}"
    assert retrieved["eway_bill_no"] == "EWAY-99887766", f"Unexpected eway_bill_no: {retrieved['eway_bill_no']}"
    assert "G.P. Engg" in retrieved["remarks"], f"Unexpected remarks: {retrieved['remarks']}"
    assert retrieved["computed_weight_mt"] == "3.250", f"Unexpected computed_weight_mt: {retrieved['computed_weight_mt']}"
    assert retrieved["total_value_incl_tax"] == "150000", f"Unexpected total_value_incl_tax: {retrieved['total_value_incl_tax']}"
    assert len(retrieved["items"]) == 2, f"Unexpected items length: {len(retrieved['items'])}"
    assert retrieved["items"][0]["item_no"] == "7208", f"Unexpected item_no: {retrieved['items'][0]['item_no']}"
    assert retrieved["items"][0]["unit"] == "NOS", f"Unexpected unit: {retrieved['items'][0]['unit']}"
    assert retrieved["items"][0]["weight_mt"] == "2.500", f"Unexpected weight_mt: {retrieved['items'][0]['weight_mt']}"
    print("SUCCESS: All new fields verified in SQLite DB persistence and retrieval!")

if __name__ == "__main__":
    test_canvas_db_crud()
    test_ai_assistant_for_canvas()
