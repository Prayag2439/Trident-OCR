import uuid
import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from models.schemas import (
    CanvasProcessRequest,
    CanvasProcessResponse,
    CanvasChallanUpdate,
    CanvasChallanData
)
from services.canvas_ocr import canvas_ocr_service
from database import (
    insert_canvas_challan,
    get_canvas_challans,
    get_canvas_challan_by_id,
    update_canvas_challan,
    delete_canvas_challan
)

router = APIRouter(prefix="/api/canvas-challans", tags=["Canvas Challans"])

@router.post("/process", response_model=CanvasProcessResponse)
def process_and_save_canvas(req: CanvasProcessRequest):
    """
    Takes the composited canvas drawing (template + handwritten ink),
    runs OCR via Gemini 2.5 Flash / Groq / OpenAI, saves the parsed challan
    record into the canvas_challans SQLite table, and returns the result.
    """
    try:
        parsed_data, raw_text = canvas_ocr_service.process_canvas_image(req.image_base64)
        
        record_id = f"canvas_{uuid.uuid4().hex[:12]}"
        now_str = datetime.datetime.now().isoformat()
        
        record = {
            "id": record_id,
            "challan_no": parsed_data.get("challan_no", ""),
            "date": parsed_data.get("date", ""),
            "your_order_no": parsed_data.get("your_order_no", ""),
            "order_date": parsed_data.get("order_date", ""),
            "vehicle_no": parsed_data.get("vehicle_no", ""),
            "eway_bill_no": parsed_data.get("eway_bill_no", ""),
            "party_name": parsed_data.get("party_name", ""),
            "address": parsed_data.get("address", ""),
            "gstin": parsed_data.get("gstin", ""),
            "items": parsed_data.get("items", []),
            "computed_weight_mt": parsed_data.get("computed_weight_mt", "0.000"),
            "total_weight_override": parsed_data.get("total_weight_override", ""),
            "total_value_incl_tax": parsed_data.get("total_value_incl_tax", ""),
            "remarks": parsed_data.get("remarks", ""),
            "extra_fields": parsed_data.get("extra_fields", ""),
            "customer_signature": parsed_data.get("customer_signature", ""),
            "authorised_signatory": parsed_data.get("authorised_signatory", ""),
            "preview_image_base64": req.image_base64,
            "raw_ocr_text": raw_text,
            "user_id": req.user_id or "admin@optimo.com",
            "role": req.role or "admin",
            "creator_name": req.creator_name or "Admin",
            "saved_at": now_str
        }
        
        saved = insert_canvas_challan(record)
        
        return CanvasProcessResponse(
            success=True,
            data=CanvasChallanData(**parsed_data),
            preview_image_base64=req.image_base64,
            raw_text=raw_text,
            saved_record=saved
        )
    except Exception as e:
        print(f"[CanvasRouter] Error processing canvas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def list_canvas_challans(user_id: Optional[str] = Query(None), role: Optional[str] = Query("admin")):
    """Fetch all canvas scribble challans."""
    try:
        return get_canvas_challans(user_id=user_id, role=role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{challan_id}")
def get_single_canvas_challan(challan_id: str):
    """Fetch a single canvas challan by ID."""
    challan = get_canvas_challan_by_id(challan_id)
    if not challan:
        raise HTTPException(status_code=404, detail="Canvas Challan not found")
    return challan

@router.put("/{challan_id}")
def edit_canvas_challan(challan_id: str, updates: CanvasChallanUpdate):
    """Update fields of an existing canvas challan."""
    existing = get_canvas_challan_by_id(challan_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Canvas Challan not found")
    
    update_dict = updates.model_dump(exclude_unset=True)
    if "saved_at" not in update_dict or not update_dict["saved_at"]:
        update_dict["saved_at"] = datetime.datetime.now().isoformat()
        
    success = update_canvas_challan(challan_id, update_dict)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update canvas challan")
    return {"success": True, "challan_id": challan_id}

@router.delete("/{challan_id}")
def remove_canvas_challan(challan_id: str):
    """Delete a canvas challan by ID."""
    existing = get_canvas_challan_by_id(challan_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Canvas Challan not found")
    
    success = delete_canvas_challan(challan_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete canvas challan")
    return {"success": True, "challan_id": challan_id}
