export type RegionClass =
  | "Company Name"
  | "Extra Fields"
  | "Extra Fields 2"
  | "Title"
  | "Text"
  | "Table"
  | "Header"
  | string;

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
  model_used: "gpt-5" | "gemini" | string;
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

export interface SavedChallan {
  id: string;
  savedAt: string;
  previewImageBase64?: string;
  data: ChallanData;
}
