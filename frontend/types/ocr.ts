export type RegionClass =
  | "Company Name"
  | "Extra Fields"
  | "Extra Fields 2"
  | "Title"
  | "Text"
  | "Table"
  | "Header"
  | (string & {});

export interface ExtractedRegion {
  region_id: string;
  reading_order_index: number;
  class: RegionClass;
  bbox: [number, number, number, number]; // [x0, y0, x1, y1]
  text_content: string;
  is_handwritten: boolean;
  confidence?: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  latency_ms?: number;
}

export interface DocumentMeta {
  filename: string;
  pages: number;
  dpi_normalized: number;
  model_used: "gpt-5" | "gemini" | (string & {});
  is_digital_pdf: boolean;
  processing_time_ms?: number;
  page_width?: number;
  page_height?: number;
  preview_image_base64?: string;
  token_usage?: TokenUsage;
}

export interface InvoiceItem {
  itemNo: string;
  productName: string;
  productDesc: string;
  hsnCode: string;
  materialType?: string;
  thicknessMm?: string;
  widthMm?: string;
  heightMm?: string;
  lengthMm?: string;
  quantity: string;
  qtyUnit: string;
  taxableAmount: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  cessRate: string;
}

export interface EWayBillInvoiceData {
  supplyType: string;
  subSupplyType: string;
  docType: string;
  docNo: string;
  docDate: string;
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: string;
  actFromStateCode: string;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: string;
  actToStateCode: string;
  transactionType: string;
  dispatchFromPincode: string;
  shipToPincode: string;
  totalValue: string;
  cgstValue: string;
  sgstValue: string;
  igstValue: string;
  cessValue: string;
  totInvValue: string;
  extraFields?: string;
  handwrittenNotes?: string;
  itemList: InvoiceItem[];
  transMode: string;
  distance: string;
  transporterId: string;
  transporterName: string;
  transDocNo: string;
  transDocDate: string;
  vehicleNo: string;
  vehicleType: string;
  token_usage?: TokenUsage;
}

export interface ProcessResponse {
  document_meta: DocumentMeta;
  extracted_regions: ExtractedRegion[];
  structured_invoice_data?: EWayBillInvoiceData;
}

// ─── Challan-specific types ────────────────────────────────────────────────

export interface ChallanItem {
  slNo: string;
  itemNo: string;        // HSN code
  description: string;
  materialType?: string; // PLATE, NPB, ISA, ISMB, ISMC, OTHER
  thicknessMm?: string;  // e.g. "8", "50"
  widthMm?: string;      // e.g. "1250"
  heightMm?: string;     // depth for sections e.g. "350"
  lengthMm?: string;     // e.g. "6300", "12000"
  qty: string;
  unit: string;          // NOS, MT, KG, etc.
  weightMT: string;      // weight in MT
  taxableAmount?: string;
  cgstRate?: string;
  sgstRate?: string;
  igstRate?: string;
}

export interface ChallanData {
  // Header
  challanNo: string;
  date: string;
  yourOrderNo: string;
  vehicleNo: string;
  ewayBillNo: string;

  // Consignee
  partyName: string;
  gstin: string;
  address: string;

  // Items
  items: ChallanItem[];

  // Totals
  computedWeightMT: string;
  totalWeightOverride: string;
  totalValueInclTax: string;

  // Remarks / Extra
  remarks: string;
  extraFields?: string;
  handwrittenNotes?: string;

  // E-Way Bill mapping fields (for API submission)
  fromGstin?: string;
  fromTrdName?: string;
  fromAddr1?: string;
  fromPlace?: string;
  fromPincode?: string;
  actFromStateCode?: string;
  toGstin?: string;
  toPlace?: string;
  toPincode?: string;
  actToStateCode?: string;
  transMode?: string;
  distance?: string;
  transporterId?: string;
  transporterName?: string;
  transDocNo?: string;
  transDocDate?: string;
  vehicleType?: string;

  token_usage?: TokenUsage;
}

export interface AuthUser {
  id?: number;
  email: string;
  name: string;
  role: "admin" | "employee" | (string & {});
}

export interface SavedChallan {
  id: string;
  savedAt: string;
  previewImageBase64?: string;
  source?: "manual" | "upload" | "voice" | "scribble";
  userId?: string;
  creatorName?: string;
  role?: string;
  data: ChallanData;
}

// ─── Canvas Scribble types ──────────────────────────────────────────────────

export interface CanvasChallanItem {
  sr_no: string;
  item_no?: string;
  description: string;
  material_type?: string; // PLATE, NPB, ISA, ISMB, ISMC, OTHER
  thickness_mm?: string;  // e.g. "8", "50"
  width_mm?: string;      // e.g. "1250"
  height_mm?: string;     // depth for sections e.g. "350"
  length_mm?: string;     // e.g. "6300", "12000"
  quantity: string;
  unit?: string;
  weight_mt?: string;
}

export interface CanvasChallanData {
  challan_no: string;
  date: string;
  your_order_no: string;
  order_date: string;
  vehicle_no?: string;
  eway_bill_no?: string;
  party_name: string;
  address: string;
  gstin: string;
  items: CanvasChallanItem[];
  computed_weight_mt?: string;
  total_weight_override?: string;
  total_value_incl_tax?: string;
  remarks?: string;
  extra_fields?: string;
  customer_signature: string;
  authorised_signatory: string;
}

export interface SavedCanvasChallan {
  id: string;
  challan_no: string;
  date: string;
  your_order_no: string;
  order_date: string;
  vehicle_no?: string;
  eway_bill_no?: string;
  party_name: string;
  address: string;
  gstin: string;
  items: CanvasChallanItem[];
  computed_weight_mt?: string;
  total_weight_override?: string;
  total_value_incl_tax?: string;
  remarks?: string;
  extra_fields?: string;
  customer_signature: string;
  authorised_signatory: string;
  preview_image_base64?: string;
  raw_ocr_text?: string;
  user_id?: string;
  role?: string;
  creator_name?: string;
  saved_at: string;
}

export interface CanvasProcessResponse {
  success: boolean;
  data: CanvasChallanData;
  preview_image_base64?: string;
  raw_text?: string;
  saved_record?: SavedCanvasChallan;
}

