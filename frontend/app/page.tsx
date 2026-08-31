"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Layers,
  Sparkles,
  ArrowLeft,
  Cpu,
  AlertCircle,
  Upload,
  Copy,
  Check,
} from "lucide-react";
import { useOCRPipeline } from "@/hooks/useOCRPipeline";
import { ModelToggle } from "@/components/ModelToggle";
import { DropZone } from "@/components/DropZone";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ChallanEditPanel } from "@/components/ChallanEditPanel";
import { ChallanPrintView } from "@/components/ChallanPrintView";
import { Dashboard } from "@/components/Dashboard";
import { VoiceAssistantPanel } from "@/components/VoiceAssistantPanel";
import {
  EWayBillInvoiceData,
  ChallanData,
  ChallanItem,
  SavedChallan,
} from "@/types/ocr";

// ─── Helper: Map OCR result → ChallanData ─────────────────────────────────

// Filters out values that are LLM prompt echoes or OCR instruction leaks
const GARBLED_PHRASES = [
  "provide a direct transcription",
  "you are an enterprise",
  "do not invent",
  "transcribe all",
  "return only the transcribed",
  "ocr content extracted",
  "section #",
];
function sanitize(val: string | undefined): string {
  if (!val) return "";
  const lower = val.toLowerCase();
  if (GARBLED_PHRASES.some((p) => lower.includes(p))) return "";
  return val.trim();
}

function mapOCRtoChallan(
  structured: EWayBillInvoiceData | undefined,
  filename: string
): ChallanData {
  const s = structured || ({} as Partial<EWayBillInvoiceData>);

  const items: ChallanItem[] = (s.itemList || []).map((item, i) => {
    const desc = sanitize(item.productDesc || item.productName) || "";
    let wt = (item as any).weightMT || "0.000";
    // Extract MT weight from description if backend returned 0
    if (parseFloat(wt) === 0 && desc) {
      const mtMatch = desc.match(/[-–]\s*(\d+\.?\d*)\s*MT\b/i);
      if (mtMatch) wt = parseFloat(mtMatch[1]).toFixed(3);
    }
    return {
      slNo: String(i + 1),
      itemNo: sanitize(item.hsnCode) || "",
      description: desc,
      qty: item.quantity || "1",
      unit: (item as any).unit || item.qtyUnit || "NOS",
      weightMT: wt,
      taxableAmount: item.taxableAmount || "0",
      cgstRate: item.cgstRate || "9",
      sgstRate: item.sgstRate || "9",
      igstRate: item.igstRate || "0",
    };
  });

  const computedWeight = items
    .reduce((sum, item) => sum + parseFloat(item.weightMT || "0"), 0)
    .toFixed(3);

    const baseRemarks = sanitize((s as any).remarks) || "";
    const extra = sanitize(s.extraFields) || "";
    const notes = sanitize(s.handwrittenNotes) || "";
    
    let combinedRemarks = baseRemarks;
    if (extra) combinedRemarks += (combinedRemarks ? "\n" : "") + extra;
    if (notes) combinedRemarks += (combinedRemarks ? "\n" : "") + notes;

    return {
      challanNo: sanitize((s as any).challanNo || s.docNo) || "",
      date: sanitize(s.docDate) || "",
      yourOrderNo: sanitize((s as any).yourOrderNo) || "",
      vehicleNo: sanitize(s.vehicleNo) || "",
      ewayBillNo: "",

      partyName: sanitize((s as any).partyName || s.toTrdName) || "",
      gstin: sanitize(s.toGstin) || "",
      address: sanitize((s as any).address || s.toAddr1) || "",

      items,

      computedWeightMT: computedWeight,
      totalWeightOverride: sanitize((s as any).totalWeightOverride) || computedWeight,
      totalValueInclTax: sanitize((s as any).totalValueInclTax || s.totInvValue || s.totalValue) || "0",

      remarks: combinedRemarks,
      extraFields: "",
      handwrittenNotes: "",

    // E-Way Bill passthrough fields
    fromGstin: s.fromGstin || "",
    fromTrdName: s.fromTrdName || "",
    fromAddr1: s.fromAddr1 || "",
    fromPlace: s.fromPlace || "",
    fromPincode: s.fromPincode || "",
    actFromStateCode: s.actFromStateCode || "",
    toGstin: s.toGstin || "",
    toPlace: s.toPlace || "",
    toPincode: s.toPincode || "",
    actToStateCode: s.actToStateCode || "",
    transMode: s.transMode || "1",
    distance: s.distance || "",
    transporterId: s.transporterId || "",
    transporterName: s.transporterName || "",
    transDocNo: s.transDocNo || "",
    transDocDate: s.transDocDate || "",
    vehicleType: s.vehicleType || "R",

    token_usage: s.token_usage,
  };
}

// ─── Storage helpers ───────────────────────────────────────────────────────
const STORAGE_KEY = "trident_challans_v1";

function loadChallans(): SavedChallan[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveChallans(challans: SavedChallan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challans));
  } catch {}
}

// ─── View states ───────────────────────────────────────────────────────────
type AppView = "dashboard" | "upload" | "edit" | "loading";

export default function Home() {
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [challans, setChallans] = useState<SavedChallan[]>([]);
  const [editingChallan, setEditingChallan] = useState<ChallanData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<"manual" | "upload" | "voice" | null>(null);
  const [editingPreview, setEditingPreview] = useState<string | null>(null);
  const [printData, setPrintData] = useState<ChallanData | null>(null);
  const [rawTextCopied, setRawTextCopied] = useState(false);
  // Incoming updates pushed from VoiceAssistantPanel → ChallanEditPanel
  const [incomingUpdates, setIncomingUpdates] = useState<Partial<ChallanData> | null>(null);
  // Tracks the current live challan data for voice panel context
  const [liveChallanData, setLiveChallanData] = useState<ChallanData | null>(null);

  // Empty ChallanData for "New Challan" (manual entry)
  const emptyChalllanData = useCallback((): ChallanData => ({
    challanNo: "", date: "", yourOrderNo: "", vehicleNo: "", ewayBillNo: "",
    partyName: "", gstin: "", address: "",
    items: [{ slNo: "1", itemNo: "", description: "", qty: "1", unit: "NOS", weightMT: "0.000" }],
    computedWeightMT: "0.000", totalWeightOverride: "", totalValueInclTax: "0",
    remarks: "", extraFields: "", handwrittenNotes: "",
    fromGstin: "", fromTrdName: "TRIDENT FABRICATORS PVT. LTD.", fromAddr1: "",
    fromPlace: "", fromPincode: "", actFromStateCode: "",
    toGstin: "", toPlace: "", toPincode: "", actToStateCode: "",
    transMode: "1", distance: "", transporterId: "", transporterName: "",
    transDocNo: "", transDocDate: "", vehicleType: "R",
  }), []);

  const {
    file,
    previewUrl,
    selectedModel,
    setSelectedModel,
    loading,
    stage,
    error,
    result,
    activeRegion,
    setActiveRegion,
    processFile,
    reset,
  } = useOCRPipeline();

  // Load challans from localStorage on mount
  useEffect(() => {
    setChallans(loadChallans());
  }, []);

  // When OCR result arrives, map it and switch to edit view
  useEffect(() => {
    if (result && appView === "loading") {
      const mapped = mapOCRtoChallan(result.structured_invoice_data, result.document_meta.filename);
      setEditingChallan(mapped);
      setEditingId(null); // new challan (not editing existing)
      setEditingSource("upload");
      setEditingPreview(result.document_meta.preview_image_base64 || null);
      // Always clear voice-session state before opening a fresh upload result
      setIncomingUpdates(null);
      setLiveChallanData(null);
      setAppView("edit");
    }
  }, [result, appView]);

  // Sync loading state
  useEffect(() => {
    if (loading) setAppView("loading");
  }, [loading]);

  const handleUploadFile = useCallback(
    (f: File) => {
      setEditingId(null);
      setIncomingUpdates(null);
      setLiveChallanData(null);
      processFile(f);
    },
    [processFile]
  );

  const handleSaveChallan = useCallback(
    (data: ChallanData) => {
      setChallans((prev) => {
        let updated: SavedChallan[];

        if (editingId) {
          // Update existing challan
          updated = prev.map((c) =>
            c.id === editingId
              ? { ...c, data, savedAt: new Date().toISOString() }
              : c
          );
        } else {
          // Add new challan
          const newChallan: SavedChallan = {
            id: `challan_${Date.now()}`,
            savedAt: new Date().toISOString(),
            previewImageBase64: editingPreview || result?.document_meta?.preview_image_base64 || undefined,
            source: editingSource || "manual",
            data,
          };
          updated = [newChallan, ...prev];
        }

        saveChallans(updated);
        return updated;
      });

      reset();
      setEditingChallan(null);
      setEditingId(null);
      setEditingSource(null);
      setEditingPreview(null);
      setIncomingUpdates(null);
      setLiveChallanData(null);
      setAppView("dashboard");
    },
    [editingId, editingSource, editingPreview, reset, result]
  );

  const handleEditFromDashboard = useCallback((challan: SavedChallan) => {
    setEditingChallan(challan.data);
    setEditingId(challan.id);
    setEditingSource(challan.source || "manual");
    setEditingPreview(challan.previewImageBase64 || null);
    setIncomingUpdates(null);
    setLiveChallanData(null);
    setAppView("edit");
  }, []);

  const handleDeleteChallan = useCallback((id: string) => {
    setChallans((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveChallans(updated);
      return updated;
    });
  }, []);

  const handleBackToDashboard = useCallback(() => {
    reset();
    setEditingChallan(null);
    setEditingId(null);
    setEditingSource(null);
    setEditingPreview(null);
    setIncomingUpdates(null);
    setLiveChallanData(null);
    setAppView("dashboard");
  }, [reset]);

  const handleNewChallan = useCallback(() => {
    reset();
    setEditingChallan(emptyChalllanData());
    setEditingId(null);
    setEditingSource("manual");
    setEditingPreview(null);
    setIncomingUpdates(null);
    setLiveChallanData(null);
    setAppView("edit");
  }, [reset, emptyChalllanData]);

  const handleNewVoiceChallan = useCallback(() => {
    reset();
    setEditingChallan(emptyChalllanData());
    setEditingId(null);
    setEditingSource("voice");
    setEditingPreview(null);
    setIncomingUpdates(null);
    setLiveChallanData(null);
    setAppView("edit");
  }, [reset, emptyChalllanData]);

  const handleViewChallan = useCallback((data: ChallanData) => {
    setPrintData(data);
  }, []);

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      {/* ── Top Navigation Bar (always visible) ──────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          {/* Logo — Trident company branding */}
          <div className="flex items-center gap-2.5">
            <img
              src="/trident-logo.png"
              alt="Trident Logo"
              style={{ height: 40, width: "auto" }}
              className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-sm font-bold px-3 py-1 rounded bg-[#1a237e]/10 text-[#1a237e] border border-[#1a237e]/20 uppercase tracking-wide">
              Challan &amp; Despatch
            </span>
          </div>

          {/* Right side: actions based on view */}
          <div className="flex items-center gap-3">
            {(appView === "edit" || appView === "upload" || appView === "loading") && (
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Dashboard
              </button>
            )}

            {/* {appView === "edit" && (
              <ModelToggle
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                disabled={loading}
              />
            )} */}

            {/* {appView === "upload" && (
              <ModelToggle
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                disabled={loading}
              />
            )} */}

            {/* Backend Ready field removed as per user request */}
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* VIEW: Dashboard */}
        {appView === "dashboard" && (
          <Dashboard
            challans={challans}
            onUpload={() => setAppView("upload")}
            onNewChallan={handleNewChallan}
            onNewVoiceChallan={handleNewVoiceChallan}
            onEdit={handleEditFromDashboard}
            onView={handleViewChallan}
            onDelete={handleDeleteChallan}
          />
        )}

        {appView === "upload" && !loading && !result && (
          <div className="flex-1 flex flex-col bg-[#f0f2f5]">
            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mx-auto mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-600 text-xs max-w-3xl w-full"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span>{error}</span>
                  </div>
                  <button type="button" onClick={handleBackToDashboard} className="text-red-600 underline">
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload Card */}
            <div className="flex-1 flex items-start justify-center pt-10 px-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-3xl">
                {/* Card Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-black tracking-widest text-gray-700 uppercase">Upload Challan</h2>
                  <button
                    type="button"
                    onClick={() => { const input = document.getElementById('upload-file-input') as HTMLInputElement; input?.click(); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] transition-colors"
                  >
                    <span className="text-gray-400 text-[10px]">1.</span> Choose file
                  </button>
                </div>

                {/* Drop Zone Area */}
                <div className="p-6">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center py-16 px-8 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
                    onClick={() => { const input = document.getElementById('upload-file-input') as HTMLInputElement; input?.click(); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) handleUploadFile(f);
                    }}
                  >
                    {/* Upload Icon */}
                    <div className="mb-4 flex flex-col items-center">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-sm font-black tracking-widest text-gray-700 uppercase mb-2">
                      Upload a Scanned Challan
                    </h3>
                    <p className="text-xs text-gray-500 text-center max-w-sm">
                      Accepts a photo/scan (JPG, PNG) or a PDF of the despatch challan.
                    </p>
                    <p className="text-xs text-gray-400 text-center mt-1">
                      Everything is processed on the server — uploaded securely.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); const input = document.getElementById('upload-file-input') as HTMLInputElement; input?.click(); }}
                      className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] transition-colors shadow"
                    >
                      <Upload className="w-4 h-4" />
                      Choose file
                    </button>
                    <input
                      id="upload-file-input"
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }}
                    />
                  </div>
                </div>

                {/* Cancel Footer */}
                <div className="px-6 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleBackToDashboard}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: Loading / Processing */}
        {appView === "loading" && loading && (
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] p-8">
            <div className="w-full max-w-sm p-8 rounded-2xl bg-white border border-gray-200 shadow-xl text-center flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#1a237e]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-[#1a237e] border-t-transparent animate-spin" />
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center p-4">
                  <img
                    src="/trident-logo.png"
                    alt="Trident Logo"
                    className="w-full h-auto object-contain animate-pulse"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Processing Document</h3>
              <p className="text-sm text-gray-500">
                Please wait while we extract data from your challan...
              </p>
            </div>
          </div>
        )}

        {appView === "edit" && editingChallan && editingSource !== "voice" && (
          <div className="flex-1 grid grid-cols-12 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
            {/* Left Panel: Document image viewer (upload mode only) */}
            {editingSource === "upload" && (
              <div className="col-span-5 h-full flex flex-col overflow-hidden border-r border-gray-200 bg-[#07080b]">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <DocumentViewer
                    previewUrl={previewUrl || (editingPreview ? (editingPreview.startsWith("data:") ? editingPreview : `data:image/jpeg;base64,${editingPreview}`) : null)}
                    meta={result?.document_meta || null}
                    regions={result?.extracted_regions || []}
                    activeRegion={activeRegion}
                    onSelectRegion={setActiveRegion}
                  />
                </div>
              </div>
            )}

            {/* Right Panel: Editable Challan Form */}
            <div className={`${editingSource === "upload" ? "col-span-7" : "col-span-12"} h-full overflow-hidden`}>
              <ChallanEditPanel
                key={`${editingSource}-${editingId || "new"}`}
                initialData={editingChallan}
                onSave={handleSaveChallan}
                onView={handleViewChallan}
                onCancel={handleBackToDashboard}
              />
            </div>
          </div>
        )}

        {/* Voice mode: flex layout — VoiceAssistantPanel self-manages its width (collapsed/expanded) */}
        {appView === "edit" && editingChallan && editingSource === "voice" && (
          <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
            <VoiceAssistantPanel
              currentData={liveChallanData || editingChallan}
              onApplyUpdates={(updates) => setIncomingUpdates({ ...updates })}
            />
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <ChallanEditPanel
                key={editingId || "new"}
                initialData={editingChallan}
                onSave={handleSaveChallan}
                onView={handleViewChallan}
                onCancel={handleBackToDashboard}
                incomingUpdates={incomingUpdates}
                onDataChange={setLiveChallanData}
              />
            </div>
          </div>
        )}

      </div>

      {/* Print / View Modal */}
      {printData && (
        <ChallanPrintView data={printData} onClose={() => setPrintData(null)} />
      )}
    </main>
  );
}
