"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  Code2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
  ArrowLeft,
  FileText,
  Truck,
  Package,
  MessageSquare,
  Bot,
  Loader2,
} from "lucide-react";
import { ChallanData, ChallanItem } from "@/types/ocr";
import { getApiBaseUrl } from "@/utils/api";


interface ChallanEditPanelProps {
  initialData: ChallanData;
  onSave: (data: ChallanData) => void;
  onView: (data: ChallanData) => void;
  onCancel: () => void;
  /** Optional: Partial update object pushed in from Voice/AI assistant. Changing the reference triggers a merge. */
  incomingUpdates?: Partial<ChallanData> | null;
  /** Optional: Called whenever local data changes, so parent can observe the latest state. */
  onDataChange?: (data: ChallanData) => void;
}

const UNIT_OPTIONS = ["NOS", "MT", "KG", "PCS", "SET", "BOX", "M", "M2", "M3", "LTR", "TON"];

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
    fromPlace: data.fromPlace || "",
    fromPincode: data.fromPincode || "",
    actFromStateCode: data.actFromStateCode || "21",
    toGstin: data.gstin,
    toTrdName: data.partyName,
    partyName: data.partyName,
    toAddr1: data.address,
    address: data.address,
    toPlace: data.toPlace || "",
    toPincode: data.toPincode || "",
    actToStateCode: data.actToStateCode || "21",
    transactionType: "1",
    totalValue: data.totalValueInclTax,
    cgstValue: "0",
    sgstValue: "0",
    igstValue: "0",
    cessValue: "0",
    totInvValue: data.totalValueInclTax,
    totalValueInclTax: data.totalValueInclTax,
    computedWeightMT: data.computedWeightMT,
    totalWeightOverride: data.totalWeightOverride,
    remarks: data.remarks,
    extraFields: data.extraFields || "",
    handwrittenNotes: data.handwrittenNotes || "",
    itemList: data.items.map((item, i) => ({
      itemNo: String(i + 1),
      productName: item.description,
      productDesc: item.description,
      hsnCode: item.itemNo,
      quantity: item.qty,
      qtyUnit: item.unit || "NOS",
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

function getAiMessageClass(type: string): string {
  if (type === "success") return "bg-green-50 text-green-700 border border-green-200";
  if (type === "clarify") return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

export function ChallanEditPanel({ initialData, onSave, onView, onCancel, incomingUpdates, onDataChange }: ChallanEditPanelProps) {
  const [data, setData] = useState<ChallanData>(() => ({
    ...initialData,
    items:
      initialData.items.length > 0
        ? initialData.items
        : [{ slNo: "1", itemNo: "", description: "", qty: "1", unit: "NOS", weightMT: "0.000" }],
  }));
  const [showJSON, setShowJSON] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [copiedExcel, setCopiedExcel] = useState(false);

  // AI Assistant state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: "success" | "error" | "clarify"; text: string } | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);


  // Merge incoming updates from Voice Assistant or AI
  useEffect(() => {
    if (!incomingUpdates) return;
    setData((prev) => {
      const updated = { ...prev };
      (Object.keys(incomingUpdates) as (keyof ChallanData)[]).forEach((key) => {
        if (incomingUpdates[key] !== undefined) {
          (updated as any)[key] = incomingUpdates[key];
        }
      });
      return updated;
    });
  }, [incomingUpdates]);

  // Notify parent of data changes
  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  const updateField = (field: keyof ChallanData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof ChallanItem, value: string) => {
    setData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          slNo: String(prev.items.length + 1),
          itemNo: "",
          description: "",
          qty: "1",
          unit: "NOS",
          weightMT: "0.000",
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setData((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, slNo: String(i + 1) })),
    }));
  };

  const computedWeight = data.items
    .reduce((sum, item) => sum + Number.parseFloat(item.weightMT || "0"), 0)
    .toFixed(3);

  const finalJSON = buildEWayJSON(data);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(finalJSON, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2500);
  };

  const handleSendAPI = async () => {
    setSending(true);
    setSendStatus(null);
    try {
      setSendStatus("✓ JSON payload ready — copied to clipboard.");
      navigator.clipboard.writeText(JSON.stringify(finalJSON, null, 2));
    } catch {
      setSendStatus("✗ Failed.");
    } finally {
      setSending(false);
      setTimeout(() => setSendStatus(null), 4000);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    setAiMessage(null);
    try {
      const formData = new FormData();
      formData.append("instruction", aiInput.trim());
      formData.append("challan_state", JSON.stringify(data));

      const backendUrl = getApiBaseUrl();
      const res = await fetch(`${backendUrl}/api/v1/assistant/text`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        setAiMessage({ type: "error", text: `Error: ${err.detail || "Request failed."}` });
        return;
      }

      const result = await res.json();

      if (result.clarification) {
        setAiMessage({ type: "clarify", text: result.clarification });
        return;
      }

      if (result.updates && Object.keys(result.updates).length > 0) {
        setData((prev) => {
          const updated = { ...prev };
          (Object.keys(result.updates) as (keyof ChallanData)[]).forEach((key) => {
            if (result.updates[key] !== undefined) {
              (updated as any)[key] = result.updates[key];
            }
          });
          return updated;
        });
        const fields = Object.keys(result.updates).filter((k) => k !== "items").join(", ");
        const hasItems = result.updates.items !== undefined;
        const parts = [];
        if (fields) parts.push(fields);
        if (hasItems) parts.push("items");
        setAiMessage({ type: "success", text: `✓ Updated: ${parts.join(", ")}.` });
        setAiInput("");
      } else {
        setAiMessage({ type: "clarify", text: "I didn't find a recognizable instruction. Could you rephrase?" });
      }
    } catch {
      const backendUrl = getApiBaseUrl();
      setAiMessage({ type: "error", text: `⚠️ Could not reach server at ${backendUrl}. Please check network connection.` });
    } finally {
      setAiLoading(false);
      setTimeout(() => setAiMessage(null), 6000);
    }
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ["TRIDENT FABRICATORS PVT. LTD. — CHALLAN EXTRACTION REPORT"],
      ["Generated At", new Date().toLocaleString()],
      [],
      ["--- CHALLAN HEADER ---"],
      ["Challan No", data.challanNo],
      ["Date", data.date],
      ["Your Order No", data.yourOrderNo],
      ["Vehicle No", data.vehicleNo],
      [],
      ["--- CONSIGNEE (TO) ---"],
      ["Party Name", data.partyName],
      ["GSTIN", data.gstin],
      ["Address", data.address],
      [],
      ["--- DESCRIPTION OF GOODS ---"],
      ["Sl.", "Item No (HSN)", "Description", "QTY", "UNIT", "Weight (MT)"],
    ];

    data.items.forEach((item, i) => {
      rows.push([
        String(i + 1),
        item.itemNo,
        `"${item.description.replaceAll('"', '""')}"`,
        item.qty,
        item.unit,
        item.weightMT,
      ]);
    });

    rows.push(
      [],
      ["Computed Weight (MT)", computedWeight],
      ["Total Weight Override", data.totalWeightOverride],
      ["Total Value Incl. Tax (₹)", data.totalValueInclTax],
      [],
      ["--- REMARKS / TERMS ---"],
      ["Remarks", `"${data.remarks.replaceAll('"', '""')}"`]
    );

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `challan_${data.challanNo.replaceAll("/", "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    setCopiedExcel(true);
    setTimeout(() => setCopiedExcel(false), 2500);
  };

  return (
    <div className="h-full flex flex-col bg-[#f5f6fa] font-sans overflow-hidden">

      {/* ── Page Header: "EDIT CHALLAN" ──────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight truncate">EDIT CHALLAN</h1>
          {data.challanNo && (
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#1a237e] text-white text-[10px] sm:text-xs font-bold tracking-wide shrink-0">
              {data.challanNo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onView(data)}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors shrink-0"
          >
            {copiedExcel ? <Check className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>{copiedExcel ? "Exported!" : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Form Body ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">

        {/* ── Section 1: Challan Details ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Challan Details
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-challan-no" className="field-label">Challan No.</label>
              <input
                id="edit-challan-no"
                type="text"
                value={data.challanNo}
                onChange={(e) => updateField("challanNo", e.target.value)}
                className="field-input"
                placeholder="e.g. TFPL/08/2026-27/4"
                aria-label="Challan Number"
              />
            </div>
            <div>
              <label htmlFor="edit-challan-date" className="field-label">Date</label>
              <input
                id="edit-challan-date"
                type="text"
                value={data.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="field-input"
                placeholder="DD/MM/YYYY"
                aria-label="Challan Date"
              />
            </div>
            <div>
              <label htmlFor="edit-order-no" className="field-label">Your Order No.</label>
              <input
                id="edit-order-no"
                type="text"
                value={data.yourOrderNo}
                onChange={(e) => updateField("yourOrderNo", e.target.value)}
                className="field-input"
                placeholder="Recipient PO / Order No."
                aria-label="Your Order Number"
              />
            </div>
            <div>
              <label htmlFor="edit-vehicle-no" className="field-label">Vehicle No.</label>
              <input
                id="edit-vehicle-no"
                type="text"
                value={data.vehicleNo}
                onChange={(e) => updateField("vehicleNo", e.target.value)}
                className="field-input"
                placeholder="e.g. OD 15 XXXX"
                aria-label="Vehicle Number"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="edit-eway-no" className="field-label">E-Way Bill No. (if already generated)</label>
              <input
                id="edit-eway-no"
                type="text"
                value={data.ewayBillNo}
                onChange={(e) => updateField("ewayBillNo", e.target.value)}
                className="field-input"
                placeholder="—"
                aria-label="E-Way Bill Number"
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Consignee ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <Truck className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Consignee (To)
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-party-name" className="field-label">Party Name</label>
              <input
                id="edit-party-name"
                type="text"
                value={data.partyName}
                onChange={(e) => updateField("partyName", e.target.value)}
                className="field-input"
                placeholder="Recipient company name"
                aria-label="Party Name"
              />
            </div>
            <div>
              <label htmlFor="edit-gstin" className="field-label">GSTIN</label>
              <input
                id="edit-gstin"
                type="text"
                value={data.gstin}
                onChange={(e) => updateField("gstin", e.target.value)}
                className="field-input"
                placeholder="15-char GSTIN"
                aria-label="Consignee GSTIN"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="edit-address" className="field-label">Address</label>
              <input
                id="edit-address"
                type="text"
                value={data.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="field-input"
                placeholder="Full delivery address"
                aria-label="Consignee Address"
              />
            </div>
          </div>
        </div>

        {/* ── Section 3: Description of Goods ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <Package className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Description of Goods
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="goods-th w-10">Sl.</th>
                  <th className="goods-th w-28">Item No. (HSN)</th>
                  <th className="goods-th">Description</th>
                  <th className="goods-th w-16">QTY</th>
                  <th className="goods-th w-20">UNIT</th>
                  <th className="goods-th w-24">Weight (MT)</th>
                  <th className="goods-th w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={item.slNo ? `item-sl-${item.slNo}` : `item-row-${item.itemNo}-${item.description}`} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                    <td className="goods-td text-center text-gray-400">{i + 1}</td>
                    <td className="goods-td">
                      <input
                        type="text"
                        value={item.itemNo}
                        onChange={(e) => updateItem(i, "itemNo", e.target.value)}
                        className="cell-input"
                        placeholder="HSN code"
                        aria-label={`Item ${i + 1} HSN code`}
                      />
                    </td>
                    <td className="goods-td">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        className="cell-input"
                        placeholder="Item description..."
                        aria-label={`Item ${i + 1} Description`}
                      />
                    </td>
                    <td className="goods-td">
                      <input
                        type="text"
                        value={item.qty}
                        onChange={(e) => updateItem(i, "qty", e.target.value)}
                        className="cell-input text-center"
                        placeholder="1"
                        aria-label={`Item ${i + 1} Quantity`}
                      />
                    </td>
                    <td className="goods-td">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        className="cell-input bg-white"
                        aria-label={`Item ${i + 1} Unit`}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="goods-td">
                      <input
                        type="text"
                        value={item.weightMT}
                        onChange={(e) => updateItem(i, "weightMT", e.target.value)}
                        className="cell-input text-right"
                        placeholder="0.000"
                        aria-label={`Item ${i + 1} Weight in MT`}
                      />
                    </td>
                    <td className="goods-td text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label={`Remove item ${i + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line */}
          <div className="px-4 py-2 border-t border-gray-100">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add line
            </button>
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-gray-200">
            <div className="px-4 py-3 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                Computed Weight
              </p>
              <p className="text-2xl font-black text-gray-900">{computedWeight} <span className="text-sm font-bold text-gray-500">MT</span></p>
            </div>
            <div className="px-4 py-3 border-b sm:border-b-0 sm:border-r border-gray-200">
              <label htmlFor="edit-weight-override" className="field-label">Total Weight Override (Optional)</label>
              <input
                id="edit-weight-override"
                type="text"
                value={data.totalWeightOverride}
                onChange={(e) => updateField("totalWeightOverride", e.target.value)}
                className="field-input mt-1"
                placeholder={computedWeight}
                aria-label="Total Weight Override"
              />
            </div>
            <div className="px-4 py-3">
              <label htmlFor="edit-total-value" className="field-label">Total Value Incl. Tax (₹)</label>
              <input
                id="edit-total-value"
                type="text"
                value={data.totalValueInclTax}
                onChange={(e) => updateField("totalValueInclTax", e.target.value)}
                className="field-input mt-1"
                placeholder="0"
                aria-label="Total Value Including Tax"
              />
            </div>
          </div>
        </div>

        {/* ── Section 4: Remarks / Terms ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Remarks / Terms
            </span>
          </div>
          <div className="p-4">
            <label htmlFor="edit-remarks" className="field-label">Additional notes / Remarks / Terms</label>
            <textarea
              id="edit-remarks"
              value={data.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
              rows={3}
              className="field-input resize-none mt-1"
              placeholder="e.g. Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale."
              aria-label="Remarks and terms"
            />
            {data.extraFields && (
              <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                <p className="font-semibold mb-1 text-[10px] uppercase tracking-wider">Extra Fields (from OCR):</p>
                <pre className="whitespace-pre-wrap font-mono text-[11px]">{data.extraFields}</pre>
              </div>
            )}
          </div>
        </div>

        {/* ── AI Assistant ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">
              AI Assistant
            </span>
            <span className="ml-auto text-[10px] text-indigo-400">Natural language updates</span>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-gray-500 mb-2">
              Type an instruction to update challan fields (e.g. &quot;Change quantity to 25&quot; or &quot;Update customer name to Amit Kumar&quot;).
            </p>
            <div className="flex gap-2">
              <input
                ref={aiInputRef}
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !aiLoading) handleAiSubmit(); }}
                placeholder="e.g. Change the rate of cement to 500…"
                className="flex-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 transition-all"
                disabled={aiLoading}
              />
              <button
                type="button"
                onClick={handleAiSubmit}
                disabled={aiLoading || !aiInput.trim()}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{aiLoading ? "…" : "Send"}</span>
              </button>
            </div>
            {aiMessage && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${getAiMessageClass(aiMessage.type)}`}>
                {aiMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* ── JSON Section ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setShowJSON((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                JSON / API Payload
              </span>
            </div>
            {showJSON ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>

          {showJSON && (
            <div className="p-4 border-b border-gray-100">
              <div className="rounded-lg bg-gray-900 p-4 max-h-56 overflow-y-auto">
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(finalJSON, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
            <button
              type="button"
              onClick={handleCopyJSON}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm shrink-0"
            >
              {copiedJSON ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJSON ? "Copied!" : "Copy JSON"}</span>
            </button>
            <button
              type="button"
              onClick={handleSendAPI}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors shadow disabled:opacity-50 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "Sending…" : "Send via API"}</span>
            </button>
            {sendStatus && (
              <span className={`text-xs font-medium w-full sm:w-auto text-right ${sendStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                {sendStatus}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ── Sticky Footer: Cancel + Save ─────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0 h-9 sm:h-10"
        >
          <ArrowLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          <span>Cancel</span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onView({ ...data, computedWeightMT: computedWeight })}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs shrink-0 h-9 sm:h-10"
          >
            <Printer className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span className="hidden sm:inline">Print / Preview</span>
            <span className="sm:hidden">Print</span>
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...data, computedWeightMT: computedWeight })}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] transition-colors shadow shrink-0 h-9 sm:h-10"
          >
            <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span className="hidden sm:inline">Save challan</span>
            <span className="sm:hidden">Save</span>
          </button>
        </div>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        :global(.field-label) {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          margin-bottom: 4px;
        }
        :global(.field-input) {
          width: 100%;
          padding: 7px 10px;
          font-size: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        :global(.field-input:focus) {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.12);
        }
        :global(.goods-th) {
          padding: 8px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          text-align: left;
          white-space: nowrap;
          background: #f9fafb;
        }
        :global(.goods-td) {
          padding: 4px 6px;
          vertical-align: middle;
        }
        :global(.cell-input) {
          width: 100%;
          padding: 5px 7px;
          font-size: 12px;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          color: #111827;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          font-family: inherit;
        }
        :global(.cell-input:focus) {
          border-color: #93c5fd;
          background: #eff6ff;
        }
        :global(.cell-input:hover) {
          border-color: #d1d5db;
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}
