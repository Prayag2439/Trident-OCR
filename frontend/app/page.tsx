"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Check,
  LogOut,
} from "lucide-react";
import { useOCRPipeline } from "@/hooks/useOCRPipeline";
import { ModelToggle } from "@/components/ModelToggle";
import { DropZone } from "@/components/DropZone";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ChallanEditPanel } from "@/components/ChallanEditPanel";
import { ChallanPrintView } from "@/components/ChallanPrintView";
import { Dashboard } from "@/components/Dashboard";
import { VoiceAssistantPanel } from "@/components/VoiceAssistantPanel";
import { CanvasScribblePanel } from "@/components/CanvasScribblePanel";
import {
  EWayBillInvoiceData,
  ChallanData,
  ChallanItem,
  SavedChallan,
  SavedCanvasChallan,
  AuthUser,
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
    if (Number.parseFloat(wt) === 0 && desc) {
      const mtMatch = /[-–]\s*(\d+\.?\d*)\s*MT\b/i.exec(desc);
      if (mtMatch) wt = Number.parseFloat(mtMatch[1]).toFixed(3);
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
    .reduce((sum, item) => sum + Number.parseFloat(item.weightMT || "0"), 0)
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

// We now use the backend SQLite database for persistence.
// The frontend only interacts with the backend API.
import {
  fetchChallans,
  createChallan,
  updateChallan,
  deleteChallan,
  migrateLegacyChallans,
  fetchCanvasChallans,
  updateCanvasChallan,
  deleteCanvasChallan,
} from "@/utils/api";
import { useToast } from "@/components/ToastProvider";
import { LoginScreen } from "@/components/LoginScreen";

// ─── View states ───────────────────────────────────────────────────────────
type AppView = "dashboard" | "upload" | "edit" | "loading" | "canvas_scribble";

function resolveViewerPreview(previewUrl: string | null, editingPreview: string | null): string | null {
  if (previewUrl) return previewUrl;
  if (!editingPreview) return null;
  if (editingPreview.startsWith("data:")) return editingPreview;
  return `data:image/jpeg;base64,${editingPreview}`;
}

export default function Home() {
  const { showAlert } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [challans, setChallans] = useState<SavedChallan[]>([]);
  const [canvasChallans, setCanvasChallans] = useState<SavedCanvasChallan[]>([]);
  const [editingChallan, setEditingChallan] = useState<ChallanData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<"manual" | "upload" | "voice" | "scribble" | null>(null);
  const [editingPreview, setEditingPreview] = useState<string | null>(null);
  const [printData, setPrintData] = useState<ChallanData | null>(null);
  // Incoming updates pushed from VoiceAssistantPanel → ChallanEditPanel
  const [incomingUpdates, setIncomingUpdates] = useState<Partial<ChallanData> | null>(null);
  // Tracks the current live challan data for voice panel context
  const [liveChallanData, setLiveChallanData] = useState<ChallanData | null>(null);

  // Check auth and user on mount
  useEffect(() => {
    const token = localStorage.getItem("trident_auth_token");
    const userStr = localStorage.getItem("trident_auth_user");
    if (token) {
      setIsAuthenticated(true);
      if (userStr) {
        try {
          setCurrentUser(JSON.parse(userStr));
        } catch (e) {
          console.error("Failed to parse stored user", e);
        }
      }
    }
    setAuthChecked(true);
  }, []);

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
    error: ocrError,
    result,
    activeRegion,
    setActiveRegion,
    processFile,
    reset,
  } = useOCRPipeline();

  const loadBackendChallans = useCallback(async (user?: AuthUser | null) => {
    try {
      const u = user !== undefined ? user : currentUser;
      const data = await fetchChallans(u?.email, u?.role || "admin");
      setChallans(data);
    } catch (err) {
      console.error("Failed to load challans from backend", err);
      showAlert("Failed to load challans from database.", "error");
    }
  }, [currentUser, showAlert]);

  const loadBackendCanvasChallans = useCallback(async (user?: AuthUser | null) => {
    try {
      const u = user !== undefined ? user : currentUser;
      const data = await fetchCanvasChallans(u?.email, u?.role || "admin");
      setCanvasChallans(data);
    } catch (err) {
      console.error("Failed to load canvas challans from backend", err);
      showAlert("Failed to load canvas challans from database.", "error");
    }
  }, [currentUser, showAlert]);

  // Migrate from localStorage to SQLite on mount, then load
  useEffect(() => {
    const init = async () => {
      try {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed && parsed.length > 0) {
            await migrateLegacyChallans(parsed);
            showAlert("Migrated existing challans to database.", "success");
          }
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.error("Migration failed:", err);
      }
      const userStr = localStorage.getItem("trident_auth_user");
      let u: AuthUser | null = null;
      if (userStr) {
        try { u = JSON.parse(userStr); } catch (_) {}
      }
      loadBackendChallans(u);
      loadBackendCanvasChallans(u);
    };
    init();
  }, [loadBackendChallans, loadBackendCanvasChallans, showAlert]);

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
      showAlert("OCR extraction completed.", "success");
    }
  }, [result, appView, showAlert]);

  // Sync loading state and errors
  useEffect(() => {
    if (loading) setAppView("loading");
  }, [loading]);

  useEffect(() => {
    if (ocrError) {
      showAlert(`OCR extraction failed: ${ocrError}`, "error");
      setAppView("dashboard");
    }
  }, [ocrError, showAlert]);

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
    async (data: ChallanData) => {
      try {
        if (editingId) {
          // Update existing challan
          const updatedChallan = {
            id: editingId,
            data,
            source: editingSource || "manual",
            previewImageBase64: editingPreview || undefined,
            savedAt: new Date().toISOString()
          };
          await updateChallan(editingId, updatedChallan);
          showAlert("Challan updated successfully.", "success");
        } else {
          // Add new challan
          const newChallan: SavedChallan = {
            id: `challan_${Date.now()}`,
            savedAt: new Date().toISOString(),
            previewImageBase64: editingPreview || result?.document_meta?.preview_image_base64 || undefined,
            source: editingSource || "manual",
            userId: currentUser?.email || "admin@optimo.com",
            creatorName: currentUser?.name || "Admin",
            role: currentUser?.role || "admin",
            data,
          };
          await createChallan(newChallan);
          showAlert("Challan added successfully.", "success");
        }

        // Reload data from backend
        await loadBackendChallans();

        reset();
        setEditingChallan(null);
        setEditingId(null);
        setEditingSource(null);
        setEditingPreview(null);
        setIncomingUpdates(null);
        setLiveChallanData(null);
        setAppView("dashboard");
      } catch (err) {
        console.error("Save error:", err);
        showAlert("Failed to save challan to database.", "error");
      }
    },
    [editingId, editingSource, editingPreview, reset, result, loadBackendChallans, showAlert, currentUser]
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

  const handleDeleteChallan = useCallback(async (id: string) => {
    try {
      await deleteChallan(id);
      showAlert("Challan deleted successfully.", "success");
      await loadBackendChallans();
    } catch (err) {
      console.error("Delete error:", err);
      showAlert("Failed to delete challan.", "error");
    }
  }, [loadBackendChallans, showAlert]);

  const handleDeleteCanvasChallan = useCallback(async (id: string) => {
    try {
      await deleteCanvasChallan(id);
      showAlert("Challan deleted successfully.", "success");
      await loadBackendCanvasChallans();
    } catch (err) {
      console.error("Delete error:", err);
      showAlert("Failed to delete challan.", "error");
    }
  }, [loadBackendCanvasChallans, showAlert]);

  const handleUpdateCanvasChallan = useCallback(async (id: string, updates: Partial<SavedCanvasChallan>) => {
    try {
      await updateCanvasChallan(id, updates);
      showAlert("Challan updated successfully.", "success");
      await loadBackendCanvasChallans();
    } catch (err) {
      console.error("Update error:", err);
      showAlert("Failed to update challan.", "error");
    }
  }, [loadBackendCanvasChallans, showAlert]);

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

  const handleUpdateStandardChallan = useCallback(async (id: string, updatedChallan: SavedChallan) => {
    try {
      await updateChallan(id, updatedChallan);
      showAlert("Challan updated successfully.", "success");
      await loadBackendChallans();
    } catch (err) {
      console.error("Update challan error:", err);
      showAlert("Failed to update challan.", "error");
    }
  }, [loadBackendChallans, showAlert]);

  const handleLogout = () => {
    localStorage.removeItem("trident_auth_token");
    localStorage.removeItem("trident_auth_user");
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (!authChecked) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={(user) => {
          if (user) {
            setCurrentUser(user);
            loadBackendChallans(user);
            loadBackendCanvasChallans(user);
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Top Navigation Bar (always visible) ──────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-6 py-2 shadow-xs w-full max-w-full">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Left: Trident Logo branding */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img
              src="/trident-logo.png"
              alt="Trident"
              style={{ height: 32, width: "auto" }}
              className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Center: Challan & Despatch aligned to center and increased size */}
          <div className="hidden sm:flex flex-1 justify-center text-center min-w-0">
            <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-wider text-[#1a237e] uppercase drop-shadow-xs truncate">
              Challan &amp; Despatch
            </h1>
          </div>

          {/* Right side: actions based on view */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
            {currentUser && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs shadow-xs">
                <span className="font-bold text-gray-800">{currentUser.name}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    currentUser.role === "admin"
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
            )}

            {(appView === "edit" || appView === "upload" || appView === "loading" || appView === "canvas_scribble") && (
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white w-full max-w-full min-w-0">

        {/* VIEW: Dashboard */}
        {appView === "dashboard" && (
          <Dashboard
            challans={challans}
            canvasChallans={canvasChallans}
            currentUser={currentUser}
            onUpload={() => setAppView("upload")}
            onNewChallan={handleNewChallan}
            onNewVoiceChallan={handleNewVoiceChallan}
            onNewCanvasChallan={() => setAppView("canvas_scribble")}
            onEdit={handleEditFromDashboard}
            onView={handleViewChallan}
            onDelete={handleDeleteChallan}
            onDeleteCanvasChallan={handleDeleteCanvasChallan}
            onUpdateCanvasChallan={handleUpdateCanvasChallan}
            onUpdateChallan={handleUpdateStandardChallan}
          />
        )}

        {appView === "upload" && !loading && !result && (
          <div className="flex-1 flex flex-col bg-[#f0f2f5]">
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
                    alt="Trident"
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
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
            {/* Left Panel: Document / Scribble image viewer on laptop web view */}
            {(editingSource === "upload" || Boolean(editingPreview) || Boolean(previewUrl)) && (
              <div className="w-full lg:col-span-5 h-1/3 lg:h-full flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#07080b]">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <DocumentViewer
                    previewUrl={resolveViewerPreview(previewUrl, editingPreview)}
                    meta={result?.document_meta || null}
                    regions={result?.extracted_regions || []}
                    activeRegion={activeRegion}
                    onSelectRegion={setActiveRegion}
                  />
                </div>
              </div>
            )}

            {/* Right Panel: Editable Challan Form */}
            <div className={`w-full ${(editingSource === "upload" || Boolean(editingPreview) || Boolean(previewUrl)) ? "lg:col-span-7" : "lg:col-span-12"} flex-1 lg:h-full overflow-hidden`}>
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
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
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

        {/* VIEW: Canvas Scribble */}
        {appView === "canvas_scribble" && (
          <CanvasScribblePanel
            currentUser={currentUser}
            onBack={handleBackToDashboard}
            onSaved={async (saved) => {
              await loadBackendCanvasChallans();
              showAlert("Scribble challan processed and saved successfully.", "success");
              setAppView("dashboard");
            }}
          />
        )}

      </div>

      {/* Print / View Modal */}
      {printData && (
        <ChallanPrintView data={printData} onClose={() => setPrintData(null)} />
      )}
    </main>
  );
}
