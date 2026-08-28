"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Edit3,
  Eye,
  Printer,
  Code2,
  Trash2,
  Copy,
  Check,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  Truck,
  Building2,
  Package,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { SavedChallan, ChallanData } from "@/types/ocr";

interface DashboardProps {
  challans: SavedChallan[];
  onUpload: () => void;
  onNewChallan: () => void;
  onEdit: (challan: SavedChallan) => void;
  onView: (data: ChallanData) => void;
  onDelete: (id: string) => void;
}

interface JSONModalProps {
  data: object;
  challanNo: string;
  onClose: () => void;
}

function JSONModal({ data, challanNo, onClose }: JSONModalProps) {
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
    try {
      setSendStatus("✓ JSON payload ready. No external API configured — copied to clipboard.");
      navigator.clipboard.writeText(jsonStr);
    } catch {
      setSendStatus("✗ Failed.");
    } finally {
      setSending(false);
      setTimeout(() => setSendStatus(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          <div className="flex items-center gap-2">
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

// ── Export a single challan to CSV in E-way Bill Format ──────────────
function exportChallanCSV(data: ChallanData): void {
  const computedWeight = data.items
    .reduce((sum, item) => sum + parseFloat(item.weightMT || "0"), 0)
    .toFixed(3);
  const totalAmt = data.totalValueInclTax || "0";

  // Mimics the structure of E-way Bill Format-01.xlsx
  const rows: (string | number | null)[][] = [
    // Header
    [null, "e-Way Bill / Challan Export", null, null, null, null, null, null, "<Challan Record>"],
    [null],
    [null, "1. E-WAY BILL Details"],
    [null],
    [null, `eWay Bill No: ${data.ewayBillNo || "—"}`, null, null, `Challan No: ${data.challanNo}`, null, null, `Date: ${data.date}`],
    [null, null, null, null, null, null, null, `Vehicle No: ${data.vehicleNo || "—"}`],
    [null, `Mode: Road`, null, null, `Your Order No: ${data.yourOrderNo || "—"}`],
    [null, `Type: Outward-Supply`, null, null, `Document Details: Challan-${data.challanNo}-${data.date}`, null, null, `Transaction type: Regular`],
    [null],
    [null],
    [null, "2. Address Details"],
    [null],
    [null, "From", null, null, null, null, "To"],
    [null, `GSTIN: ${data.fromGstin || "21AACCT1555G1ZR"}`, null, null, null, null, `GSTIN: ${data.gstin || "—"}`],
    [null, data.fromTrdName || "TRIDENT FABRICATORS PVT. LTD.", null, null, null, null, data.partyName || "—"],
    [null, data.fromAddr1 || "Kalunga, Sambalpur, Odisha", null, null, null, null, data.address || "—"],
    [null],
    [null, "::Dispatch From::", null, null, null, null, "::Ship To::"],
    [null, data.fromPlace || ""], [null], [null], [null],
    [null, "3. Goods Details"],
    [null],
    [null, "HSN Code", "Product Name & Desc", null, null, null, "Quantity", "Taxable Amount Rs.", "Tax Rate (C+S+I+Cess)", null, null, null, null, null, null],
  ];

  data.items.forEach((item) => {
    const cgst = parseFloat(item.cgstRate || "9") / 100;
    const sgst = parseFloat(item.sgstRate || "9") / 100;
    const igst = parseFloat(item.igstRate || "0") / 100;
    const taxAmt = parseFloat(item.taxableAmount || "0");
    rows.push([
      null,
      item.itemNo || "",
      item.description || "",
      null, null, null,
      `${item.qty} ${item.unit}`,
      taxAmt || null,
      cgst, sgst, igst, 0, 0,
    ]);
  });

  rows.push(
    [null],
    [null, "Tot. Tax'ble Amt", "CGST Amt", "SGST Amt", "IGST Amt", "Cess Amt", "Cess Non.Advol Amt", "Other Amt", "Tot. Inv. Amt"],
    [null, null, null, null, null, null, null, null, totalAmt],
    [null],
    [null, "4. Weight Summary"],
    [null, `Computed Weight (MT)`, computedWeight],
    [null, `Total Weight Override (MT)`, data.totalWeightOverride || computedWeight],
    [null],
    [null, "5. Remarks / Terms"],
    [null, data.remarks || ""],
  );

  const csvContent = "\uFEFF" + rows.map((r) =>
    r.map(v => v === null ? "" : typeof v === "string" && v.includes(",") ? `"${v.replace(/"/g, '""')}"` : String(v ?? ""))
     .join(",")
  ).join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `eway-bill_${data.challanNo.replace(/\//g, "-")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function Dashboard({ challans, onUpload, onNewChallan, onEdit, onView, onDelete }: DashboardProps) {
  const [jsonModal, setJsonModal] = useState<{ data: object; challanNo: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            CHALLAN & DESPATCH CONSOLE
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {challans.length} challan{challans.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewChallan}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-900 text-gray-900 text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Challan
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors shadow-md"
          >
            <Upload className="w-4 h-4" />
            Upload Challan
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {challans.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-2">No challans yet</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Upload a challan image to extract and save it to your console.
            </p>
            <button
              type="button"
              onClick={onUpload}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              Upload First Challan
            </button>
          </div>
        ) : (
          /* Challan List */
          <div className="space-y-3">
            <AnimatePresence>
              {challans.map((challan) => (
                <motion.div
                  key={challan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    {/* Left: Challan Info */}
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-gray-900 tracking-tight">
                            {challan.data.challanNo || "Untitled Challan"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide border border-gray-200">
                            {challan.data.items.length} items
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {challan.data.date}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Building2 className="w-3 h-3" />
                            {challan.data.partyName}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Truck className="w-3 h-3" />
                            {challan.data.vehicleNo || "—"}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Package className="w-3 h-3" />
                            {challan.data.computedWeightMT || challan.data.totalWeightOverride || "—"} MT
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(challan)}
                        className="dashboard-action-btn text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onView(challan.data)}
                        className="dashboard-action-btn text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onView(challan.data)}
                        className="dashboard-action-btn text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100"
                        title="Print / PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShowJSON(challan)}
                        className="dashboard-action-btn text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                        title="JSON"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportChallanCSV(challan.data)}
                        className="dashboard-action-btn text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
                        title="Export Excel/CSV"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfirm(challan.id)}
                        className="dashboard-action-btn text-red-500 border-red-200 bg-red-50 hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Saved-at timestamp */}
                  <div className="px-5 pb-2 text-[10px] text-gray-400">
                    Saved {new Date(challan.savedAt).toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* JSON Modal */}
      {jsonModal && (
        <JSONModal
          data={jsonModal.data}
          challanNo={jsonModal.challanNo}
          onClose={() => setJsonModal(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
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

      {/* Dashboard action button styles */}
      <style jsx>{`
        :global(.dashboard-action-btn) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          border-width: 1px;
          border-style: solid;
          transition: all 0.15s;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
