from typing import List, Optional, Union
from pydantic import BaseModel, Field

class TokenUsage(BaseModel):
    prompt_tokens: int = 1280
    completion_tokens: int = 460
    total_tokens: int = 1740
    model: str = "gpt-5"
    latency_ms: Optional[float] = 2180.0

class InvoiceItem(BaseModel):
    itemNo: str = "1"
    productName: str = ""
    productDesc: str = ""
    hsnCode: str = ""
    quantity: str = "0"
    qtyUnit: str = "PCS"
    taxableAmount: str = "0"
    cgstRate: str = "0"
    sgstRate: str = "0"
    igstRate: str = "0"
    cessRate: str = "0"

    class Config:
        # Allow internal _ prefixed fields to be passed but ignore them in serialization
        extra = "ignore"

class EWayBillInvoiceData(BaseModel):
    supplyType: str = "O"
    subSupplyType: str = "1"
    docType: str = "INV"
    docNo: str = ""
    docDate: str = ""
    fromGstin: str = ""
    fromTrdName: str = ""
    fromAddr1: str = ""
    fromPlace: str = ""
    fromPincode: str = ""
    actFromStateCode: str = ""
    toGstin: str = ""
    toTrdName: str = ""
    toAddr1: str = ""
    toPlace: str = ""
    toPincode: str = ""
    actToStateCode: str = ""
    transactionType: str = "1"
    dispatchFromPincode: str = ""
    shipToPincode: str = ""
    totalValue: str = "0"
    cgstValue: str = "0"
    sgstValue: str = "0"
    igstValue: str = "0"
    cessValue: str = "0"
    totInvValue: str = "0"
    extraFields: Optional[str] = ""
    handwrittenNotes: Optional[str] = ""
    itemList: List[InvoiceItem] = []
    transMode: str = "1"
    distance: str = "0"
    transporterId: str = ""
    transporterName: str = ""
    transDocNo: str = ""
    transDocDate: str = ""
    vehicleNo: str = ""
    vehicleType: str = "R"
    token_usage: Optional[TokenUsage] = None

    class Config:
        extra = "ignore"

class DocumentMeta(BaseModel):
    filename: str
    pages: int = 1
    dpi_normalized: int = 200
    model_used: str = "gpt-5"
    is_digital_pdf: bool = False
    processing_time_ms: Optional[float] = None
    page_width: Optional[int] = None
    page_height: Optional[int] = None
    preview_image_base64: Optional[str] = None
    token_usage: Optional[TokenUsage] = None

class ExtractedRegion(BaseModel):
    region_id: str
    reading_order_index: int
    region_class: str = Field(..., alias="class")
    bbox: List[float]  # [x0, y0, x1, y1]
    text_content: str
    is_handwritten: bool = False
    confidence: Optional[float] = 1.0

    class Config:
        populate_by_name = True

class ProcessResponse(BaseModel):
    document_meta: DocumentMeta
    extracted_regions: List[ExtractedRegion]
    structured_invoice_data: Optional[EWayBillInvoiceData] = None

    class Config:
        populate_by_name = True


# ==============================================================================
# Canvas Scribble Models
# ==============================================================================

class CanvasChallanItem(BaseModel):
    sr_no: Optional[str] = "1"
    item_no: Optional[str] = ""
    description: Optional[str] = ""
    material_type: Optional[str] = ""   # PLATE, NPB, ISA, ISMB, ISMC, OTHER
    thickness_mm: Optional[str] = ""    # e.g. "8", "50"
    width_mm: Optional[str] = ""        # e.g. "1250"
    height_mm: Optional[str] = ""       # depth for sections e.g. "350"
    length_mm: Optional[str] = ""       # e.g. "6300", "12000"
    quantity: Optional[str] = ""
    unit: Optional[str] = "NOS"
    weight_mt: Optional[str] = "0.000"

    class Config:
        extra = "ignore"

class CanvasChallanData(BaseModel):
    challan_no: Optional[str] = ""
    date: Optional[str] = ""
    your_order_no: Optional[str] = ""
    order_date: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    eway_bill_no: Optional[str] = ""
    party_name: Optional[str] = ""
    address: Optional[str] = ""
    gstin: Optional[str] = ""
    items: List[CanvasChallanItem] = []
    computed_weight_mt: Optional[str] = "0.000"
    total_weight_override: Optional[str] = ""
    total_value_incl_tax: Optional[str] = ""
    remarks: Optional[str] = ""
    extra_fields: Optional[str] = ""
    customer_signature: Optional[str] = ""
    authorised_signatory: Optional[str] = ""

    class Config:
        extra = "ignore"

class CanvasProcessRequest(BaseModel):
    image_base64: str
    user_id: Optional[Union[str, int]] = "admin@optimo.com"
    role: Optional[str] = "admin"
    creator_name: Optional[str] = "Admin"

class CanvasProcessResponse(BaseModel):
    success: bool
    data: CanvasChallanData
    preview_image_base64: Optional[str] = None
    raw_text: Optional[str] = ""
    saved_record: Optional[dict] = None

class CanvasChallanUpdate(BaseModel):
    challan_no: Optional[str] = None
    date: Optional[str] = None
    your_order_no: Optional[str] = None
    order_date: Optional[str] = None
    vehicle_no: Optional[str] = None
    eway_bill_no: Optional[str] = None
    party_name: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    items: Optional[List[CanvasChallanItem]] = None
    computed_weight_mt: Optional[str] = None
    total_weight_override: Optional[str] = None
    total_value_incl_tax: Optional[str] = None
    remarks: Optional[str] = None
    extra_fields: Optional[str] = None
    customer_signature: Optional[str] = None
    authorised_signatory: Optional[str] = None
    preview_image_base64: Optional[str] = None
    saved_at: Optional[str] = None

