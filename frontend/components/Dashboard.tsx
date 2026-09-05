"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Edit3,
  Printer,
  Code2,
  Trash2,
  Copy,
  Check,
  Send,
  Plus,
  Truck,
  Package,
  X,
  FileSpreadsheet,
  Settings,
  Search,
  AlertCircle,
  Mic,
  PenLine,
  Download,
  PenTool,
  Image as ImageIcon,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { SavedChallan, ChallanData, SavedCanvasChallan, CanvasChallanItem, AuthUser } from "@/types/ocr";

interface DashboardProps {
  challans: SavedChallan[];
  canvasChallans?: SavedCanvasChallan[];
  currentUser?: AuthUser | null;
  onUpload: () => void;
  onNewChallan: () => void;
  onNewVoiceChallan: () => void;
  onNewCanvasChallan: () => void;
  onEdit: (challan: SavedChallan) => void;
  onView: (data: ChallanData) => void;
  onDelete: (id: string) => void;
  onDeleteCanvasChallan?: (id: string) => void;
  onUpdateCanvasChallan?: (id: string, updates: Partial<SavedCanvasChallan>) => void;
  onUpdateChallan?: (id: string, updatedChallan: SavedChallan) => void;
}


interface JSONModalProps {
  data: object;
  challanNo: string;
  apiConfig: { endpoint: string; token: string };
  onClose: () => void;
}

function SettingsModal({ apiConfig, onClose, onSave }: { apiConfig: { endpoint: string; token: string }; onClose: () => void; onSave: (cfg: { endpoint: string; token: string }) => void }) {
  const [endpoint, setEndpoint] = useState(apiConfig.endpoint || "");
  const [token, setToken] = useState(apiConfig.token || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 id="settings-modal-title" className="text-sm font-bold text-gray-900">E-Way Bill API setup</h3>
          <button type="button" onClick={onClose} aria-label="Close settings" className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Point this at your own GSP (GST Suvidha Provider) or middleware endpoint that handles NIC
              authentication. This console never sends your credentials anywhere except your own browser's
              local storage for this app.
            </span>
          </div>
          <div>
            <label htmlFor="settings-endpoint-url" className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">API endpoint URL</label>
            <input
              id="settings-endpoint-url"
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-gsp-middleware.example.com/ewb/generate"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              aria-label="API endpoint URL"
            />
          </div>
          <div>
            <label htmlFor="settings-auth-token" className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Auth token / API key (optional)</label>
            <input
              id="settings-auth-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              aria-label="Auth token or API key"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onSave({ endpoint, token })} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] transition-colors shadow">
            <Check className="w-3.5 h-3.5" /> Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

function JSONModal({ data, challanNo, apiConfig, onClose }: JSONModalProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const jsonStr = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSend = async () => {
    setSending(true);
    setSendStatus(null);
    if (!apiConfig.endpoint) {
      setSendStatus("✗ No API endpoint configured. Add it in E-Way Bill setup.");
      setSending(false);
      return;
    }
    try {
      const res = await fetch(apiConfig.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiConfig.token ? { Authorization: "Bearer " + apiConfig.token } : {}) },
        body: jsonStr,
      });
      if (res.ok) {
        setSendStatus("✓ Sent to E-Way Bill system.");
      } else {
        setSendStatus("✗ Request failed (CORS or auth issue).");
      }
    } catch {
      setSendStatus("✗ Failed to connect to endpoint.");
    } finally {
      setSending(false);
      setTimeout(() => setSendStatus(null), 4000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`JSON Payload for ${challanNo}`}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">JSON Payload — {challanNo}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-lg bg-gray-900 border border-gray-700 p-4 max-h-96 overflow-y-auto mb-3">
            <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">{jsonStr}</pre>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors shadow disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Sending…" : "Send via API"}
            </button>
            {sendStatus && (
              <span className={`text-xs font-medium ${sendStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                {sendStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEWayJSON(data: ChallanData): object {
  return {
    supplyType: "O",
    subSupplyType: "1",
    docType: "INV",
    docNo: data.challanNo,
    challanNo: data.challanNo,
    docDate: data.date,
    yourOrderNo: data.yourOrderNo,
    vehicleNo: data.vehicleNo,
    fromGstin: data.fromGstin || "",
    fromTrdName: data.fromTrdName || "TRIDENT FABRICATORS PVT. LTD.",
    fromAddr1: data.fromAddr1 || "",
    toGstin: data.gstin,
    toTrdName: data.partyName,
    partyName: data.partyName,
    toAddr1: data.address,
    address: data.address,
    totalValue: data.totalValueInclTax,
    totInvValue: data.totalValueInclTax,
    totalValueInclTax: data.totalValueInclTax,
    computedWeightMT: data.computedWeightMT,
    totalWeightOverride: data.totalWeightOverride,
    remarks: data.remarks,
    extraFields: data.extraFields || "",
    handwrittenNotes: data.handwrittenNotes || "",
    itemList: data.items.map((item, i) => ({
      itemNo: String(i + 1),
      productDesc: item.description,
      hsnCode: item.itemNo,
      quantity: item.qty,
      unit: item.unit || "NOS",
      weightMT: item.weightMT,
      taxableAmount: item.taxableAmount || "0",
      cgstRate: item.cgstRate || "9",
      sgstRate: item.sgstRate || "9",
      igstRate: item.igstRate || "0",
      cessRate: "0",
    })),
    transMode: data.transMode || "1",
    vehicleType: data.vehicleType || "R",
  };
}

import * as XLSX from 'xlsx';

// ── Convert SavedCanvasChallan to standard ChallanData ────────
function mapCanvasToChallanData(canvas: SavedCanvasChallan): ChallanData {
  const computedWeight = (canvas.items || [])
    .reduce((sum, item) => sum + Number.parseFloat(item.weight_mt || "0"), 0)
    .toFixed(3);

  return {
    challanNo: canvas.challan_no || "",
    date: canvas.date || "",
    yourOrderNo: canvas.your_order_no || "",
    vehicleNo: canvas.vehicle_no || "",
    ewayBillNo: canvas.eway_bill_no || "",
    fromGstin: "21AACCT1555G1ZR",
    fromTrdName: "TRIDENT FABRICATORS PVT. LTD.",
    fromAddr1: "Plot No - 112, Industrial Estate, Kalunga, Sambalpur, Odisha - 768212",
    fromPlace: "Kalunga",
    fromPincode: "768212",
    actFromStateCode: "21",
    partyName: canvas.party_name || "",
    address: canvas.address || "",
    gstin: canvas.gstin || "",
    toPlace: "",
    toPincode: "",
    actToStateCode: "21",
    transMode: "1",
    distance: "",
    transporterId: "",
    transporterName: "",
    transDocNo: "",
    transDocDate: "",
    vehicleType: "R",
    computedWeightMT: canvas.computed_weight_mt || computedWeight,
    totalWeightOverride: canvas.total_weight_override || "",
    totalValueInclTax: canvas.total_value_incl_tax || "0",
    remarks: canvas.remarks || "",
    extraFields: canvas.extra_fields || "",
    handwrittenNotes: "",
    items: (canvas.items || []).map((it, idx) => ({
      slNo: it.sr_no || String(idx + 1),
      itemNo: it.item_no || "",
      description: it.description || "",
      qty: it.quantity || "1",
      unit: it.unit || "NOS",
      weightMT: it.weight_mt || "0.000",
      taxableAmount: "0",
      cgstRate: "9",
      sgstRate: "9",
      igstRate: "0",
      cessRate: "0",
    })),
  };
}

// ── Export a single challan to Excel in exact Challan Preview Window format ──────
function exportChallanExcel(data: ChallanData): void {
  const computedWeight = data.items
    .reduce((sum, item) => sum + Number.parseFloat(item.weightMT || "0"), 0)
    .toFixed(3);
  const displayWeight =
    data.totalWeightOverride && Number.parseFloat(data.totalWeightOverride) > 0
      ? data.totalWeightOverride
      : computedWeight;
  const totalAmt = data.totalValueInclTax || "0";

  // Exact reproduction of Challan Preview Window (ChallanPrintView)
  const rows: (string | number | boolean | null | undefined)[][] = [
    ["TRIDENT FABRICATORS PVT. LTD.", "", "", "", "", ""],
    ["Plot No - 112, Industrial Estate, Kalunga, Sambalpur, Odisha - 768212", "", "", "", "", ""],
    ["(An ISO 9001-2008 Certified Company)", "", "", "", "", ""],
    [`GSTIN: ${data.fromGstin || "21AACCT1555G1ZR"} | PAN: AACCT1555G`, "", "", "", "", ""],
    [],
    ["DELIVERY CHALLAN & DESPATCH NOTE", "", "", "", "", ""],
    [],
    ["Challan No.:", data.challanNo || "—", "Date:", data.date || "—", "Your Order No.:", data.yourOrderNo || "—"],
    ["Vehicle No.:", data.vehicleNo || "—", "E-Way Bill No.:", data.ewayBillNo || "—", "Order Date:", data.date || "—"],
    [],
    ["CONSIGNEE (TO):", "", "", "", "", ""],
    ["Party Name:", data.partyName || "—", "GSTIN:", data.gstin || "—", "", ""],
    ["Delivery Address:", data.address || "—", "", "", "", ""],
    [],
    ["Sl.", "Item No (HSN)", "Description of Goods", "QTY", "UNIT", "Weight (MT)"],
  ];

  data.items.forEach((it, idx) => {
    rows.push([
      it.slNo || String(idx + 1),
      it.itemNo || "—",
      it.description || "—",
      it.qty || "—",
      it.unit || "NOS",
      it.weightMT || "0.000",
    ]);
  });

  const totalsStartIdx = rows.length;
  rows.push(
    [],
    ["Total Computed Weight (MT):", computedWeight, "", "", "", ""],
    ["Total Weight Override (MT):", data.totalWeightOverride || "—", "", "", "", ""],
    ["Total Value (Incl. Tax) ₹:", totalAmt, "", "", "", ""],
    [],
    ["Remarks / Terms & Conditions:", "", "", "", "", ""],
    [data.remarks || "—", "", "", "", "", ""],
    [],
    ["Receiver's Signature", "", "", "For TRIDENT FABRICATORS PVT. LTD.", "", ""],
    ["", "", "", "Authorised Signatory", "", ""]
  );

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 8 },  // Sl.
    { wch: 18 }, // Item No (HSN)
    { wch: 45 }, // Description
    { wch: 12 }, // QTY
    { wch: 10 }, // UNIT
    { wch: 16 }, // Weight (MT)
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Header Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Address
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // ISO
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // GSTIN | PAN
    { s: { r: 5, c: 0 }, e: { r: 5, c: 5 } }, // DELIVERY CHALLAN & DESPATCH NOTE
    { s: { r: 10, c: 0 }, e: { r: 10, c: 5 } }, // CONSIGNEE (TO)
    { s: { r: 12, c: 1 }, e: { r: 12, c: 5 } }, // Address value
    { s: { r: totalsStartIdx + 4, c: 0 }, e: { r: totalsStartIdx + 4, c: 5 } }, // Remarks heading
    { s: { r: totalsStartIdx + 5, c: 0 }, e: { r: totalsStartIdx + 5, c: 5 } }, // Remarks value
    { s: { r: rows.length - 2, c: 0 }, e: { r: rows.length - 2, c: 2 } }, // Receiver's Signature
    { s: { r: rows.length - 2, c: 3 }, e: { r: rows.length - 2, c: 5 } }, // For Trident
    { s: { r: rows.length - 1, c: 3 }, e: { r: rows.length - 1, c: 5 } }, // Authorised Signatory
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Delivery Challan");
  XLSX.writeFile(wb, `Delivery_Challan_${(data.challanNo || "Challan").replaceAll(/[/\\?%*:|"<>]/g, "-")}.xlsx`);
}

function renderSourceBadge(source: string | undefined) {
  if (source === "upload") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
        📄 OCR
      </span>
    );
  }
  if (source === "voice") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
        🎙️ Voice
      </span>
    );
  }
  if (source === "scribble") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
        ✍️ Scribble
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
      ⌨️ Manual
    </span>
  );
}

const UNIT_OPTIONS = ["NOS", "MT", "KG", "PCS", "SET", "BOX", "M", "M2", "M3", "LTR", "TON"];

interface EditChallanModalProps {
  target: { type: "standard"; challan: SavedChallan } | { type: "canvas"; challan: SavedCanvasChallan };
  onClose: () => void;
  onSaveStandard?: (id: string, updated: SavedChallan) => void;
  onSaveCanvas?: (id: string, updates: Partial<SavedCanvasChallan>) => void;
  onViewChallan?: (data: ChallanData) => void;
  apiConfig?: { endpoint: string; token: string };
}

function EditChallanModal({
  target,
  onClose,
  onSaveStandard,
  onSaveCanvas,
  onViewChallan,
  apiConfig,
}: EditChallanModalProps) {
  const isStandard = target.type === "standard";
  const std = isStandard ? target.challan.data : null;
  const cvs = !isStandard ? target.challan : null;

  const rawPreview = isStandard ? target.challan.previewImageBase64 : target.challan.preview_image_base64;
  let previewImg: string | null = null;
  if (rawPreview) {
    previewImg = rawPreview.startsWith("data:") ? rawPreview : `data:image/jpeg;base64,${rawPreview}`;
  }

  const [showPreview, setShowPreview] = useState<boolean>(Boolean(previewImg));
  const [previewZoom, setPreviewZoom] = useState(1);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [sendingAPI, setSendingAPI] = useState(false);
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    challan_no: (isStandard ? std?.challanNo : cvs?.challan_no) || "",
    date: (isStandard ? std?.date : cvs?.date) || "",
    your_order_no: (isStandard ? std?.yourOrderNo : cvs?.your_order_no) || "",
    order_date: (isStandard ? std?.date : cvs?.order_date) || "",
    vehicle_no: (isStandard ? std?.vehicleNo : cvs?.vehicle_no) || "",
    eway_bill_no: (isStandard ? std?.ewayBillNo : cvs?.eway_bill_no) || "",
    party_name: (isStandard ? std?.partyName : cvs?.party_name) || "",
    address: (isStandard ? std?.address : cvs?.address) || "",
    gstin: (isStandard ? std?.gstin : cvs?.gstin) || "",
    remarks: (isStandard ? std?.remarks : cvs?.remarks) || "",
    total_weight_override: (isStandard ? std?.totalWeightOverride : cvs?.total_weight_override) || "",
    total_value_incl_tax: (isStandard ? std?.totalValueInclTax : cvs?.total_value_incl_tax) || "",
    customer_signature: cvs?.customer_signature || "",
    authorised_signatory: cvs?.authorised_signatory || "",
  });

  const [items, setItems] = useState<CanvasChallanItem[]>(() => {
    if (isStandard && std?.items && std.items.length > 0) {
      return std.items.map((it, idx) => ({
        sr_no: it.slNo || String(idx + 1),
        item_no: it.itemNo || "",
        description: it.description || "",
        quantity: it.qty || "1",
        unit: it.unit || "NOS",
        weight_mt: it.weightMT || "0.000",
      }));
    }
    if (!isStandard && cvs?.items && cvs.items.length > 0) {
      return cvs.items.map((it, idx) => ({
        sr_no: it.sr_no || String(idx + 1),
        item_no: it.item_no || "",
        description: it.description || "",
        quantity: it.quantity || "1",
        unit: it.unit || "NOS",
        weight_mt: it.weight_mt || "0.000",
      }));
    }
    return [{ sr_no: "1", item_no: "", description: "", quantity: "1", unit: "NOS", weight_mt: "0.000" }];
  });

  const handleItemChange = (idx: number, field: keyof CanvasChallanItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "unit" || field === "quantity") {
        const qVal = Number.parseFloat(item.quantity || "0");
        if (!Number.isNaN(qVal) && qVal > 0) {
          if (item.unit === "MT" || item.unit === "TON") {
            item.weight_mt = qVal.toFixed(3);
          } else if (item.unit === "KG") {
            item.weight_mt = (qVal / 1000).toFixed(3);
          }
        }
      }
      next[idx] = item;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { sr_no: String(prev.length + 1), item_no: "", description: "", quantity: "1", unit: "NOS", weight_mt: "0.000" },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sr_no: String(i + 1) }));
    });
  };

  const computedWeight = items
    .reduce((sum, it) => sum + Number.parseFloat(it.weight_mt || "0"), 0)
    .toFixed(3);

  const currentChallanData: ChallanData = {
    challanNo: formData.challan_no,
    date: formData.date,
    yourOrderNo: formData.your_order_no,
    vehicleNo: formData.vehicle_no,
    ewayBillNo: formData.eway_bill_no,
    fromGstin: "21AACCT1555G1ZR",
    fromTrdName: "TRIDENT FABRICATORS PVT. LTD.",
    fromAddr1: "Plot No - 112, Industrial Estate, Kalunga, Sambalpur, Odisha - 768212",
    fromPlace: "Kalunga",
    fromPincode: "768212",
    actFromStateCode: "21",
    partyName: formData.party_name,
    address: formData.address,
    gstin: formData.gstin,
    toPlace: "",
    toPincode: "",
    actToStateCode: "21",
    transMode: "1",
    distance: "",
    transporterId: "",
    transporterName: "",
    transDocNo: "",
    transDocDate: "",
    vehicleType: "R",
    computedWeightMT: computedWeight,
    totalWeightOverride: formData.total_weight_override || computedWeight,
    totalValueInclTax: formData.total_value_incl_tax || "0",
    remarks: formData.remarks,
    extraFields: "",
    handwrittenNotes: "",
    items: items.map((it, i) => ({
      slNo: it.sr_no || String(i + 1),
      itemNo: it.item_no || "",
      description: it.description || "",
      qty: it.quantity || "1",
      unit: it.unit || "NOS",
      weightMT: it.weight_mt || "0.000",
      taxableAmount: "0",
      cgstRate: "9",
      sgstRate: "9",
      igstRate: "0",
      cessRate: "0",
    })),
  };

  const handleCopyJSON = () => {
    const jsonPayload = buildEWayJSON(currentChallanData);
    navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2500);
  };

  const handleSendAPI = async () => {
    setSendingAPI(true);
    setApiStatus(null);
    const jsonPayload = buildEWayJSON(currentChallanData);
    const jsonStr = JSON.stringify(jsonPayload, null, 2);

    if (!apiConfig?.endpoint) {
      try {
        navigator.clipboard.writeText(jsonStr);
        setApiStatus("✓ JSON copied to clipboard. (Configure endpoint in E-Way Bill setup)");
      } catch {
        setApiStatus("✗ Clipboard copy failed.");
      }
      setSendingAPI(false);
      setTimeout(() => setApiStatus(null), 4000);
      return;
    }

    try {
      const res = await fetch(apiConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiConfig.token ? { Authorization: "Bearer " + apiConfig.token } : {}),
        },
        body: jsonStr,
      });
      if (res.ok) {
        setApiStatus("✓ Sent to API successfully.");
      } else {
        setApiStatus(`✗ Request failed (${res.status}).`);
      }
    } catch {
      setApiStatus("✗ Failed to connect to API.");
    } finally {
      setSendingAPI(false);
      setTimeout(() => setApiStatus(null), 4000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStandard && onSaveStandard) {
      const updatedStandard: SavedChallan = {
        ...target.challan,
        savedAt: new Date().toISOString(),
        data: currentChallanData,
      };
      onSaveStandard(target.challan.id, updatedStandard);
    } else if (!isStandard && onSaveCanvas) {
      const updatedCanvas: Partial<SavedCanvasChallan> = {
        challan_no: formData.challan_no,
        date: formData.date,
        your_order_no: formData.your_order_no,
        order_date: formData.order_date,
        vehicle_no: formData.vehicle_no,
        eway_bill_no: formData.eway_bill_no,
        party_name: formData.party_name,
        address: formData.address,
        gstin: formData.gstin,
        remarks: formData.remarks,
        computed_weight_mt: computedWeight,
        total_weight_override: formData.total_weight_override || computedWeight,
        total_value_incl_tax: formData.total_value_incl_tax || "0",
        items,
        customer_signature: formData.customer_signature,
        authorised_signatory: formData.authorised_signatory,
      };
      onSaveCanvas(target.challan.id, updatedCanvas);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Delivery Challan"
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${
          previewImg && showPreview ? "max-w-7xl" : "max-w-4xl"
        } max-h-[94vh] flex flex-col overflow-hidden border border-gray-200 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Authentic Trident Challan Layout Header */}
          <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img
                src="/trident-logo.png"
                alt="Trident"
                style={{ height: 38, width: "auto" }}
                className="object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h3 className="text-base font-black text-[#1a237e] tracking-tight">
                  TRIDENT FABRICATORS PVT. LTD.
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">
                  DELIVERY CHALLAN &amp; DESPATCH NOTE
                </p>
              </div>
            </div>

            {/* Header Action Buttons: Print, Excel, Copy JSON, Send via API, Preview Toggle, Close */}
            <div className="flex items-center gap-2 flex-wrap">
              {previewImg && (
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    showPreview
                      ? "bg-blue-50 text-[#1a237e] border-blue-200 shadow-2xs"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  title="Toggle original document / scribble preview"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showPreview ? "Hide Document" : "View Document"}</span>
                </button>
              )}

              {onViewChallan && (
                <button
                  type="button"
                  onClick={() => onViewChallan(currentChallanData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                  title="Print preview"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => exportChallanExcel(currentChallanData)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100 transition-colors shadow-2xs"
                title="Download Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={handleCopyJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                title="Copy JSON Payload"
              >
                {copiedJSON ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJSON ? "Copied!" : "Copy JSON"}</span>
              </button>

              <button
                type="button"
                onClick={handleSendAPI}
                disabled={sendingAPI}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-2xs disabled:opacity-50"
                title="Send via API"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingAPI ? "Sending…" : "Send via API"}</span>
              </button>

              {apiStatus && (
                <span className={`text-[11px] font-medium ${apiStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {apiStatus}
                </span>
              )}

              <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Side-by-Side in Laptop Web View if Preview Available */}
          <div className="flex-1 overflow-hidden flex flex-col lg:grid lg:grid-cols-12 bg-[#f8fafc]">
            {/* Left Column: Original Document / Scribble Drawing in Laptop Web View */}
            {previewImg && showPreview && (
              <div className="w-full lg:col-span-5 h-[320px] lg:h-full flex flex-col bg-[#07080b] border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden relative select-none flex-shrink-0">
                {/* Image Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-900/90 border-b border-gray-800 text-white flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-bold text-gray-200">Original Document / Scribble</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(0.6, z - 0.2))}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-gray-300 w-10 text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.2))}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(1)}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={previewImg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Image Container with Pan/Scroll and Zoom */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-[#0a0f1d]">
                  <img
                    src={previewImg}
                    alt="Original document"
                    style={{
                      transform: `scale(${previewZoom})`,
                      transformOrigin: "top center",
                    }}
                    className="max-w-full h-auto object-contain transition-transform duration-100 rounded shadow-md"
                  />
                </div>
              </div>
            )}

            {/* Right Column: Editable Trident Challan Table Form */}
            <div className={`w-full ${previewImg && showPreview ? "lg:col-span-7" : "lg:col-span-12"} h-full overflow-y-auto p-4 sm:p-6 space-y-4`}>
              {/* Header & Dispatch Info */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="edit-dash-challan-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Challan No.</label>
                    <input
                      id="edit-dash-challan-no"
                      type="text"
                      value={formData.challan_no}
                      onChange={(e) => setFormData({ ...formData, challan_no: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Challan Number"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-dash-date" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Challan Date</label>
                    <input
                      id="edit-dash-date"
                      type="text"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Challan Date"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-dash-your-order-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Your Order No.</label>
                    <input
                      id="edit-dash-your-order-no"
                      type="text"
                      value={formData.your_order_no}
                      onChange={(e) => setFormData({ ...formData, your_order_no: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Your Order Number"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-dash-order-date" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Order Date</label>
                    <input
                      id="edit-dash-order-date"
                      type="text"
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Order Date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label htmlFor="edit-dash-vehicle-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-gray-500" /> Vehicle No.
                    </label>
                    <input
                      id="edit-dash-vehicle-no"
                      type="text"
                      value={formData.vehicle_no}
                      onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                      placeholder="e.g. OD 15 XXXX"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Vehicle Number"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-dash-eway-bill-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-gray-500" /> E-Way Bill No.
                    </label>
                    <input
                      id="edit-dash-eway-bill-no"
                      type="text"
                      value={formData.eway_bill_no}
                      onChange={(e) => setFormData({ ...formData, eway_bill_no: e.target.value })}
                      placeholder="—"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="E-Way Bill Number"
                    />
                  </div>
                </div>
              </div>

              {/* Consignee */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <div>
                  <label htmlFor="edit-dash-party-name" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">M/s. (Party / Consignee Name)</label>
                  <input
                    id="edit-dash-party-name"
                    type="text"
                    value={formData.party_name}
                    onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                    aria-label="Party or Consignee Name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor="edit-dash-address" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Delivery Address</label>
                    <textarea
                      id="edit-dash-address"
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="Delivery Address"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-dash-gstin" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">GSTIN</label>
                    <input
                      id="edit-dash-gstin"
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold text-gray-900 focus:ring-1 focus:ring-[#1a237e]"
                      aria-label="GSTIN"
                    />
                  </div>
                </div>
              </div>

              {/* Goods Table (Authentic Trident Delivery Challan Table Layout with Weight Columns) */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-gray-600" />
                    <label className="text-[11px] font-black text-gray-700 uppercase tracking-wide">
                      Description of Goods ({items.length})
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-xs font-bold text-[#1a237e] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add line
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center">Sl.</th>
                        <th className="px-3 py-2.5 w-28">Item No. (HSN)</th>
                        <th className="px-3 py-2.5 min-w-[200px]">Description of Goods</th>
                        <th className="px-3 py-2.5 w-20 text-right">QTY</th>
                        <th className="px-3 py-2.5 w-24">UNIT</th>
                        <th className="px-3 py-2.5 w-28 text-right">Weight (MT)</th>
                        <th className="px-2 py-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {items.map((it, idx) => (
                        <tr key={it.item_no || it.sr_no ? `goods-row-${it.item_no || it.sr_no}-${it.description.slice(0, 10)}` : `goods-row-${it.description}-${it.quantity}`} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="text"
                              value={it.sr_no}
                              onChange={(e) => handleItemChange(idx, "sr_no", e.target.value)}
                              className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-xs font-semibold"
                              aria-label={`Item ${idx + 1} serial number`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={it.item_no || ""}
                              onChange={(e) => handleItemChange(idx, "item_no", e.target.value)}
                              placeholder="HSN/No."
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                              aria-label={`Item ${idx + 1} HSN code`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              placeholder="e.g. M.S. PLATE 25MM THK"
                              className="w-full px-2.5 py-1 border border-gray-300 rounded text-xs font-medium"
                              aria-label={`Item ${idx + 1} description`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="text"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              placeholder="1"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-bold"
                              aria-label={`Item ${idx + 1} quantity`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={it.unit || "NOS"}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold bg-white"
                              aria-label={`Item ${idx + 1} unit`}
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="text"
                              value={it.weight_mt || "0.000"}
                              onChange={(e) => handleItemChange(idx, "weight_mt", e.target.value)}
                              placeholder="0.000"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono font-semibold"
                              aria-label={`Item ${idx + 1} weight in MT`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length <= 1}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-20 transition-colors"
                              aria-label={`Remove item ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-gray-200 bg-gray-50/70">
                  <div className="px-4 py-2.5 border-b md:border-b-0 md:border-r border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Computed Weight</p>
                    <p className="text-xl font-black text-gray-900">{computedWeight} <span className="text-xs font-bold text-gray-500">MT</span></p>
                  </div>
                  <div className="px-4 py-2.5 border-b md:border-b-0 md:border-r border-gray-200">
                    <label htmlFor="edit-dash-weight-override" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Total Weight Override (Optional)</label>
                    <input
                      id="edit-dash-weight-override"
                      type="text"
                      value={formData.total_weight_override}
                      onChange={(e) => setFormData({ ...formData, total_weight_override: e.target.value })}
                      placeholder={computedWeight}
                      className="w-full px-2.5 py-1 text-xs font-semibold border border-gray-300 rounded-lg bg-white"
                      aria-label="Total Weight Override"
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <label htmlFor="edit-dash-total-value" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Total Value Incl. Tax (₹)</label>
                    <input
                      id="edit-dash-total-value"
                      type="text"
                      value={formData.total_value_incl_tax}
                      onChange={(e) => setFormData({ ...formData, total_value_incl_tax: e.target.value })}
                      placeholder="0"
                      className="w-full px-2.5 py-1 text-xs font-bold border border-gray-300 rounded-lg bg-white"
                      aria-label="Total Value Including Tax"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks / Terms */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-1.5">
                <label htmlFor="edit-dash-remarks" className="block text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Remarks / Terms &amp; Conditions
                </label>
                <textarea
                  id="edit-dash-remarks"
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale."
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e] resize-none"
                  aria-label="Remarks and Terms"
                />
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <div>
                  <label htmlFor="edit-dash-customer-signature" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Customer's Signature</label>
                  <input
                    id="edit-dash-customer-signature"
                    type="text"
                    value={formData.customer_signature}
                    onChange={(e) => setFormData({ ...formData, customer_signature: e.target.value })}
                    placeholder="Receiver signatory"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                    aria-label="Customer's Signature"
                  />
                </div>
                <div>
                  <label htmlFor="edit-dash-authorised-signatory" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">For TRIDENT FABRICATORS PVT. LTD. (Authorised Signatory)</label>
                  <input
                    id="edit-dash-authorised-signatory"
                    type="text"
                    value={formData.authorised_signatory}
                    onChange={(e) => setFormData({ ...formData, authorised_signatory: e.target.value })}
                    placeholder="Authorised signatory"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                    aria-label="Authorised Signatory"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              {previewImg && !showPreview && (
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Show Original Document</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] shadow transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Dashboard({
  challans,
  canvasChallans = [],
  currentUser,
  onUpload,
  onNewChallan,
  onNewVoiceChallan,
  onNewCanvasChallan,
  onEdit,
  onView,
  onDelete,
  onDeleteCanvasChallan,
  onUpdateCanvasChallan,
  onUpdateChallan,
}: DashboardProps) {
  const [methodFilter, setMethodFilter] = useState<"all" | "ocr" | "scribble" | "voice" | "manual">("all");
  const [editModalTarget, setEditModalTarget] = useState<
    | { type: "standard"; challan: SavedChallan }
    | { type: "canvas"; challan: SavedCanvasChallan }
    | null
  >(null);
  const [canvasDeleteConfirm, setCanvasDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [jsonModal, setJsonModal] = useState<{ data: object; challanNo: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChallanModal, setNewChallanModal] = useState(false);
  const [apiConfig, setApiConfig] = useState<{ endpoint: string; token: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("eway_api_config") || '{"endpoint":"","token":""}');
      } catch {
        return { endpoint: "", token: "" };
      }
    }
    return { endpoint: "", token: "" };
  });

  const saveApiConfig = (cfg: { endpoint: string; token: string }) => {
    setApiConfig(cfg);
    localStorage.setItem("eway_api_config", JSON.stringify(cfg));
    setSettingsOpen(false);
  };

  // Live item counts per creation method
  const allCount = challans.length + canvasChallans.length;
  const ocrCount = challans.filter((c) => c.source === "upload").length;
  const scribbleCount = challans.filter((c) => c.source === "scribble").length + canvasChallans.length;
  const voiceCount = challans.filter((c) => c.source === "voice").length;
  const manualCount = challans.filter((c) => !c.source || c.source === "manual").length;

  const filteredChallans = challans.filter((c) => {
    if (methodFilter === "ocr" && c.source !== "upload") return false;
    if (methodFilter === "scribble" && c.source !== "scribble") return false;
    if (methodFilter === "voice" && c.source !== "voice") return false;
    if (methodFilter === "manual" && c.source && c.source !== "manual") return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (c.data.challanNo || "").toLowerCase().includes(q) ||
      (c.data.partyName || "").toLowerCase().includes(q) ||
      (c.data.gstin || "").toLowerCase().includes(q) ||
      (c.data.vehicleNo || "").toLowerCase().includes(q)
    );
  });

  const filteredCanvasChallans = (methodFilter === "all" || methodFilter === "scribble")
    ? canvasChallans.filter((c) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          (c.challan_no || "").toLowerCase().includes(q) ||
          (c.party_name || "").toLowerCase().includes(q) ||
          (c.gstin || "").toLowerCase().includes(q) ||
          (c.your_order_no || "").toLowerCase().includes(q)
        );
      })
    : [];

  const handleShowJSON = (challan: SavedChallan) => {
    setJsonModal({ data: buildEWayJSON(challan.data), challanNo: challan.data.challanNo });
  };

  const handleDeleteConfirm = (id: string) => {
    setDeleteConfirm(id);
  };

  const handleDeleteExecute = () => {
    if (deleteConfirm) {
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleCanvasDeleteExecute = () => {
    if (canvasDeleteConfirm && onDeleteCanvasChallan) {
      onDeleteCanvasChallan(canvasDeleteConfirm);
      setCanvasDeleteConfirm(null);
    }
  };

  const totalCount = filteredChallans.length + filteredCanvasChallans.length;

  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-y-auto">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Recent Challans</h1>
          <p className="text-sm text-gray-500 font-medium mt-0.5">Manage and export your generated challans</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">E-Way Bill Setup</span>
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#1a237e] text-[#1a237e] bg-white hover:bg-[#1a237e]/5 transition-colors shadow-sm text-sm font-bold ml-auto sm:ml-0"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setNewChallanModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#1a237e] text-white text-sm font-bold hover:bg-[#283593] transition-colors shadow-md flex-1 sm:flex-none justify-center"
          >
            <Plus className="w-4 h-4" />
            New challan
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 w-full">
        {challans.length === 0 && canvasChallans.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
               <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Upload a challan document or draw on the scribble template to extract and save it.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onUpload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a237e] text-white text-sm font-bold hover:bg-[#283593] transition-colors shadow-md"
              >
                <Upload className="w-4 h-4" />
                Upload Challan
              </button>
              <button
                type="button"
                onClick={onNewCanvasChallan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors shadow-md"
              >
                <PenTool className="w-4 h-4" />
                Scribble Challan
              </button>
            </div>
          </div>
        ) : (
          /* Challan List & Search */
          <div className="space-y-4">
            {/* Interactive Creation Method Filters Bar + Search Input */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200 shadow-xs">
              {/* Method Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mr-1">
                  Filter:
                </span>
                <button
                  type="button"
                  onClick={() => setMethodFilter("all")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    methodFilter === "all"
                      ? "bg-[#1a237e] text-white shadow-sm ring-2 ring-[#1a237e]/20"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                  }`}
                >
                  <span>All</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${methodFilter === "all" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                    {allCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter("ocr")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    methodFilter === "ocr"
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  }`}
                >
                  <span>📄 OCR / Scan</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${methodFilter === "ocr" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-800"}`}>
                    {ocrCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter("scribble")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    methodFilter === "scribble"
                      ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-300"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                  }`}
                >
                  <span>✍️ Scribble</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${methodFilter === "scribble" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                    {scribbleCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter("voice")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    methodFilter === "voice"
                      ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-300"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                  }`}
                >
                  <span>🎙️ Voice</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${methodFilter === "voice" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"}`}>
                    {voiceCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter("manual")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    methodFilter === "manual"
                      ? "bg-slate-700 text-white shadow-sm ring-2 ring-slate-300"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  <span>⌨️ Manual</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${methodFilter === "manual" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {manualCount}
                  </span>
                </button>
              </div>

              {/* Search input & counter */}
              <div className="flex items-center gap-2 flex-1 max-w-sm ml-auto">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by challan no, party, GSTIN or vehicle no"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow bg-white"
                  />
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-[#1a237e] text-white text-xs font-bold shadow-xs flex-shrink-0 text-center">
                  {totalCount} challan{totalCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-md overflow-x-auto shadow-sm">
              <table className="w-full min-w-[800px] text-left text-xs text-gray-700">
                <thead className="bg-[#f8fafc] border-b border-gray-200 text-gray-500 font-bold tracking-widest uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">CHALLAN NO.</th>
                    <th className="px-4 py-3 font-bold">DATE</th>
                    <th className="px-4 py-3 font-bold">CONSIGNEE</th>
                    <th className="px-4 py-3 font-bold text-center">METHOD</th>
                    <th className="px-4 py-3 font-bold">REF / VEHICLE</th>
                    <th className="px-4 py-3 font-bold">WEIGHT / ITEMS</th>
                    <th className="px-4 py-3 font-bold text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <AnimatePresence>
                    {/* Standard Upload, Voice & Manual Challans */}
                    {filteredChallans.map((challan) => (
                      <motion.tr
                        key={challan.id}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-[#f8fafc] transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-[#1a237e] text-white text-[10px] font-semibold tracking-wide shadow-sm">
                            {challan.data.challanNo || "UNTITLED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {challan.data.date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{challan.data.partyName}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{challan.data.gstin || "—"}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {renderSourceBadge(challan.source)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-600">
                          {challan.data.vehicleNo || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {challan.data.computedWeightMT || challan.data.totalWeightOverride || "0.000"} MT
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditModalTarget({ type: "standard", challan })}
                              className="dashboard-action-btn text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 shadow-2xs"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onView(challan.data)}
                              className="dashboard-action-btn text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 shadow-2xs"
                              title="Print / PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShowJSON(challan)}
                              className="dashboard-action-btn text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs"
                              title="JSON"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>JSON</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => exportChallanExcel(challan.data)}
                              className="dashboard-action-btn text-teal-700 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/80 shadow-2xs"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteConfirm(challan.id)}
                              className="dashboard-action-btn text-red-600 bg-red-50/80 hover:bg-red-100 border border-red-200/80 shadow-2xs"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}

                    {/* Scribble Challans with Full Action Parity: Edit, Print, JSON, Excel, Delete */}
                    {filteredCanvasChallans.map((canvas) => (
                      <motion.tr
                        key={canvas.id}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-emerald-50/30 transition-colors bg-emerald-50/10"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-700 text-white text-[10px] font-semibold tracking-wide shadow-sm">
                            <PenTool className="w-2.5 h-2.5" />
                            {canvas.challan_no || "UNTITLED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {canvas.date || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{canvas.party_name || "—"}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{canvas.gstin || "—"}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            ✍️ Scribble
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-600">
                          {canvas.your_order_no ? `Order: ${canvas.your_order_no}` : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {canvas.items?.length || 0} item{canvas.items?.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditModalTarget({ type: "canvas", challan: canvas })}
                              className="dashboard-action-btn text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 shadow-2xs"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onView(mapCanvasToChallanData(canvas))}
                              className="dashboard-action-btn text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 shadow-2xs"
                              title="Print / PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setJsonModal({
                                  data: buildEWayJSON(mapCanvasToChallanData(canvas)),
                                  challanNo: canvas.challan_no || "UNTITLED",
                                })
                              }
                              className="dashboard-action-btn text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs"
                              title="JSON"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>JSON</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => exportChallanExcel(mapCanvasToChallanData(canvas))}
                              className="dashboard-action-btn text-teal-700 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/80 shadow-2xs"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCanvasDeleteConfirm(canvas.id)}
                              className="dashboard-action-btn text-red-600 bg-red-50/80 hover:bg-red-100 border border-red-200/80 shadow-2xs"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}

                    {totalCount === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                          No challans match your search or filter criteria.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* JSON Modal */}
      {jsonModal && (
        <JSONModal
          data={jsonModal.data}
          challanNo={jsonModal.challanNo}
          apiConfig={apiConfig}
          onClose={() => setJsonModal(null)}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          apiConfig={apiConfig}
          onClose={() => setSettingsOpen(false)}
          onSave={saveApiConfig}
        />
      )}


      {/* Edit Challan Modal (Unified in Trident Challan Image Format) */}
      {editModalTarget && (
        <EditChallanModal
          target={editModalTarget}
          onClose={() => setEditModalTarget(null)}
          onSaveStandard={(id, updated) => {
            if (onUpdateChallan) {
              onUpdateChallan(id, updated);
            }
          }}
          onSaveCanvas={(id, updates) => {
            if (onUpdateCanvasChallan) {
              onUpdateCanvasChallan(id, updates);
            }
          }}
          onViewChallan={onView}
          apiConfig={apiConfig}
        />
      )}

      {/* Delete Confirm Modal (Scribble Challan) */}
      {canvasDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Challan</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCanvasDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCanvasDeleteExecute}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal (Standard Challan) */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Challan"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Challan</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExecute}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Challan Choice Modal */}
      {newChallanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setNewChallanModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Create New Challan"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">New Challan</h3>
              <button type="button" onClick={() => setNewChallanModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {/* Options */}
            <div className="p-4 space-y-3">
              <button
                type="button"
                onClick={() => { setNewChallanModal(false); onNewChallan(); }}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 border-gray-200 hover:border-[#1a237e] hover:bg-[#1a237e]/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1a237e]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1a237e]/20 transition-colors">
                  <PenLine className="w-5 h-5 text-[#1a237e]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Manual Challan</p>
                  <p className="text-xs text-gray-500 mt-0.5">Fill in challan fields manually using the form.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setNewChallanModal(false); onNewVoiceChallan(); }}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <Mic className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Voice Assisted Challan</p>
                  <p className="text-xs text-gray-500 mt-0.5">Dictate challan details using your microphone. GPT-5 fills the form automatically.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setNewChallanModal(false); onNewCanvasChallan(); }}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 border-gray-200 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                  <PenTool className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-900">Scribble Challan</p>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">New</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Draw & write directly on delivery challan template using stylus/touch. AI automatically extracts all fields.</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* Dashboard action button styles */}
      <style jsx>{`
        :global(.dashboard-action-btn) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 20px;
          transition: all 0.15s;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
