from typing import List, Optional
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
