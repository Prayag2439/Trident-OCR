"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Sparkles,
  Loader2,
  Hand,
  Pen,
  Eraser,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Save,
  MessageSquare,
  Bot,
  Send,
  Truck,
  FileText,
  Package,
  Copy,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { processCanvasChallan, getApiBaseUrl } from "@/utils/api";
import { useToast } from "@/components/ToastProvider";
import { SavedCanvasChallan, CanvasChallanData, CanvasChallanItem } from "@/types/ocr";
import { applyParsedDimensionsCanvas, parseSteelDescription } from "@/utils/steelParser";

interface CanvasScribblePanelProps {
  onBack: () => void;
  onSaved: (challan: SavedCanvasChallan) => void;
  currentUser?: { email: string; name: string; role: string } | null;
}

function getCanvasAiMessageClass(type: string): string {
  if (type === "success") return "bg-green-50 text-green-800 border-green-200";
  if (type === "clarify") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-red-50 text-red-800 border-red-200";
}

const TEMPLATE_WIDTH = 814;
const TEMPLATE_HEIGHT = 1024;
const UNIT_OPTIONS = ["NOS", "MT", "KG", "PCS", "SET", "BOX", "M", "M2", "M3", "LTR", "TON"];

const PEN_COLORS = [
  { name: "Ink Blue", value: "#1d4ed8", preview: "bg-blue-700" },
  { name: "Classic Black", value: "#0f172a", preview: "bg-slate-900" },
  { name: "Red", value: "#dc2626", preview: "bg-red-600" },
  { name: "Green", value: "#16a34a", preview: "bg-emerald-600" },
];



export function CanvasScribblePanel({ onBack, onSaved, currentUser }: Readonly<CanvasScribblePanelProps>) {
  const { showAlert } = useToast();

  // Canvas refs
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);

  // Two-finger touch gesture tracking (Pinch-to-zoom and Pan)
  const isTwoFingerPanningRef = useRef<boolean>(false);
  const twoFingerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const twoFingerDistanceStartRef = useRef<number>(0);
  const twoFingerZoomStartRef = useRef<number>(1.0);
  const justFinishedTwoFingerPanRef = useRef<boolean>(false);
  // Track active pointer ID for stylus/pen input
  const activePointerIdRef = useRef<number | null>(null);

  // Drawing state
  const [tool, setTool] = useState<"pen" | "eraser" | "pan">("pen");
  const [penColor, setPenColor] = useState<string>("#1d4ed8");
  const [strokeWidth, setStrokeWidth] = useState<number>(1.5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [templateLoaded, setTemplateLoaded] = useState<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Pan and Zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fullscreen mode & floating dropdown
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenDropdownOpen, setFullscreenDropdownOpen] = useState<boolean>(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("");

  // Post-OCR Editable Review State
  const [reviewMode, setReviewMode] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<CanvasChallanData | null>(null);
  const [reviewItems, setReviewItems] = useState<CanvasChallanItem[]>([]);
  const [compositeImage, setCompositeImage] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [showReviewImage, setShowReviewImage] = useState<boolean>(true);
  const [reviewImageZoom, setReviewImageZoom] = useState<number>(1);
  const [copiedReviewJSON, setCopiedReviewJSON] = useState<boolean>(false);
  const [sendingReviewAPI, setSendingReviewAPI] = useState<boolean>(false);
  const [reviewApiStatus, setReviewApiStatus] = useState<string | null>(null);

  // AI Assistant Chatbot State
  const [aiInput, setAiInput] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<{ type: "success" | "error" | "clarify"; text: string } | null>(null);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  // Clear table confirmation
  const [clearTableConfirm, setClearTableConfirm] = useState<boolean>(false);

  // Load template image on mount
  useEffect(() => {
    const img = new Image();
    img.src = "/challan-canvas-template.png";
    img.onload = () => {
      templateImgRef.current = img;
      setTemplateLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load /challan-canvas-template.png");
      showAlert("Could not load challan template image.", "error");
    };
  }, [showAlert]);

  // Initialize ink canvas context
  useEffect(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [reviewMode]);

  // Responsive fit on initial load
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      if (containerWidth < TEMPLATE_WIDTH) {
        const fitZoom = Math.max(0.35, Number((containerWidth / TEMPLATE_WIDTH).toFixed(2)));
        setZoom(fitZoom);
      }
    }
  }, [isFullscreen]);

  // Save snapshot to undo stack
  const pushUndoSnapshot = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
    setUndoStack((prev) => [...prev.slice(-15), snapshot]);
  }, []);

  // Undo last stroke (Recent Reset)
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const previousSnapshot = undoStack.at(-1)!;
    ctx.putImageData(previousSnapshot, 0, 0);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack]);

  // Clear all ink
  const handleClear = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    pushUndoSnapshot();
    ctx.clearRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
    showAlert("Drawing cleared.", "info");
  }, [pushUndoSnapshot, showAlert]);

  // Helper: map touch or mouse coordinates to canvas native (814 x 1024) coordinates
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent): { x: number; y: number } | null => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent | React.PointerEvent).clientX;
      clientY = (e as React.MouseEvent | React.PointerEvent).clientY;
    }

    const scaleX = TEMPLATE_WIDTH / rect.width;
    const scaleY = TEMPLATE_HEIGHT / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Helper: apply drawing context settings (pen or eraser)
  const applyDrawingContext = useCallback((ctx: CanvasRenderingContext2D) => {
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = strokeWidth * 3.5;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = penColor;
      ctx.shadowBlur = Math.max(1, strokeWidth * 0.45);
      ctx.shadowOffsetX = 0.4;
      ctx.shadowOffsetY = 0.4;
    }
  }, [tool, penColor, strokeWidth]);

  // Helper: reset shadow state on canvas context to prevent zoom "spots"
  const resetContextShadow = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Helper: draw stroke segment respecting strokeWidth
  const drawStrokeSegment = useCallback((
    ctx: CanvasRenderingContext2D,
    targetX: number,
    targetY: number,
    pressure: number
  ) => {
    if (tool === "pen") {
      if (pressure > 0) {
        ctx.lineWidth = Math.max(1.2, strokeWidth * (0.65 + pressure * 0.7));
      } else {
        ctx.lineWidth = strokeWidth;
      }
    }

    if (!lastPointRef.current) {
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      lastPointRef.current = { x: targetX, y: targetY };
      return;
    }

    const prev = lastPointRef.current;
    const midX = (prev.x + targetX) / 2;
    const midY = (prev.y + targetY) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    ctx.stroke();
    lastPointRef.current = { x: targetX, y: targetY };
  }, [tool, strokeWidth]);

  // ── Pointer Events (handles stylus, mouse, and touch-based pen input) ──
  // Using pointer events ensures stylus (pointerType="pen") works correctly.
  // We capture the pointer to keep receiving events even outside the element.
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle stylus (pen) and mouse here; touch is handled by touch events
    if (e.pointerType === "touch") return;

    e.preventDefault();

    if (tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    activePointerIdRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    pushUndoSnapshot();
    setIsDrawing(true);
    applyDrawingContext(ctx);
    lastPointRef.current = { x: coords.x, y: coords.y };

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    e.preventDefault();

    if (tool === "pan" && isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing || activePointerIdRef.current !== e.pointerId) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Use coalesced events when available for smooth digitizer tracking
    const native = e.nativeEvent as any;
    const coalesced = (native && typeof native.getCoalescedEvents === "function")
      ? native.getCoalescedEvents()
      : null;

    if (coalesced && coalesced.length > 1) {
      for (const subEvt of coalesced) {
        const subCoords = getCanvasCoords(subEvt);
        if (subCoords) {
          drawStrokeSegment(ctx, subCoords.x, subCoords.y, subEvt.pressure || 0.5);
        }
      }
    } else {
      drawStrokeSegment(ctx, coords.x, coords.y, e.pressure || 0.5);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    e.preventDefault();

    if (isPanning) setIsPanning(false);
    if (isDrawing && activePointerIdRef.current === e.pointerId) {
      setIsDrawing(false);
      activePointerIdRef.current = null;
      lastPointRef.current = null;
      const canvas = inkCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.closePath();
          resetContextShadow(ctx);
        }
      }
    }
  };

  // Mouse drawing handlers (fallback for non-touch, non-stylus desktop)
  const startDrawingMouse = (e: React.MouseEvent) => {
    // Skip if pointer events already handled this (stylus/mouse via pointer events)
    if ((e.nativeEvent as any).pointerType && (e.nativeEvent as any).pointerType !== "touch") return;

    if (tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    pushUndoSnapshot();
    setIsDrawing(true);
    applyDrawingContext(ctx);
    lastPointRef.current = { x: coords.x, y: coords.y };

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
    ctx.stroke();
  };

  const drawMouse = (e: React.MouseEvent) => {
    if ((e.nativeEvent as any).pointerType && (e.nativeEvent as any).pointerType !== "touch") return;

    if (tool === "pan" && isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    drawStrokeSegment(ctx, coords.x, coords.y, 0.5);
  };

  const stopDrawingMouse = () => {
    if (isPanning) setIsPanning(false);
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      const canvas = inkCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.closePath();
          resetContextShadow(ctx);
        }
      }
    }
  };

  // Mobile Touch Handlers with 2-Finger Pinch Zoom In / Out & Pan Recognition
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default to stop browser tap-selection and native scroll interfering
    e.preventDefault();

    // 2-Finger Pinch Zoom + Pan gesture
    if (e.touches.length === 2) {
      if (isDrawing) {
        setIsDrawing(false);
        lastPointRef.current = null;
        const canvas = inkCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.closePath();
            resetContextShadow(ctx);
          }
        }
      }
      isTwoFingerPanningRef.current = true;
      const touch0 = e.touches[0];
      const touch1 = e.touches[1];
      const midX = (touch0.clientX + touch1.clientX) / 2;
      const midY = (touch0.clientY + touch1.clientY) / 2;
      const dist = Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY);

      twoFingerStartRef.current = {
        x: midX - panOffset.x,
        y: midY - panOffset.y,
      };
      twoFingerDistanceStartRef.current = dist;
      twoFingerZoomStartRef.current = zoom;
      return;
    }

    // Single finger touch: drawing or pan tool
    if (e.touches.length === 1) {
      if (justFinishedTwoFingerPanRef.current) return;

      if (tool === "pan") {
        setIsPanning(true);
        setPanStart({
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y,
        });
        return;
      }

      const coords = getCanvasCoords(e);
      if (!coords) return;

      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      pushUndoSnapshot();
      setIsDrawing(true);
      applyDrawingContext(ctx);
      lastPointRef.current = { x: coords.x, y: coords.y };

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
      ctx.stroke();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    // Two-finger Pinch Zoom In / Out + Drag / Moving
    if (e.touches.length === 2) {
      const touch0 = e.touches[0];
      const touch1 = e.touches[1];
      const midX = (touch0.clientX + touch1.clientX) / 2;
      const midY = (touch0.clientY + touch1.clientY) / 2;
      const dist = Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY);

      if (!isTwoFingerPanningRef.current) {
        isTwoFingerPanningRef.current = true;
        twoFingerStartRef.current = {
          x: midX - panOffset.x,
          y: midY - panOffset.y,
        };
        twoFingerDistanceStartRef.current = dist;
        twoFingerZoomStartRef.current = zoom;
      } else if (twoFingerDistanceStartRef.current > 15 && dist > 15) {
        // Pinch to Zoom In / Zoom Out calculation
        const scaleRatio = dist / twoFingerDistanceStartRef.current;
        const nextZoom = Math.min(3.0, Math.max(0.35, Number((twoFingerZoomStartRef.current * scaleRatio).toFixed(2))));
        setZoom(nextZoom);
      }

      // Smooth Two-finger Pan calculation
      setPanOffset({
        x: midX - twoFingerStartRef.current.x,
        y: midY - twoFingerStartRef.current.y,
      });
      return;
    }

    // 1-finger panning tool
    if (tool === "pan" && isPanning && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y,
      });
      return;
    }

    // 1-finger drawing
    if (isDrawing && e.touches.length === 1 && !isTwoFingerPanningRef.current) {
      const coords = getCanvasCoords(e);
      if (!coords) return;

      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const nativeTouch = e.touches[0] as any;
      const pressure = (nativeTouch && typeof nativeTouch.force === "number" && nativeTouch.force > 0)
        ? nativeTouch.force
        : 0.5;

      drawStrokeSegment(ctx, coords.x, coords.y, pressure);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();

    if (isTwoFingerPanningRef.current) {
      if (e.touches.length < 2) {
        isTwoFingerPanningRef.current = false;
        twoFingerDistanceStartRef.current = 0;
        justFinishedTwoFingerPanRef.current = true;
        setTimeout(() => {
          justFinishedTwoFingerPanRef.current = false;
        }, 250);
      }
      return;
    }

    if (isPanning) setIsPanning(false);
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      const canvas = inkCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.closePath();
          resetContextShadow(ctx);
        }
      }
    }
  };

  // Zoom helpers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Extract Handwritten Challan (Sends to OCR and switches to Editable Review Mode)
  const handleExtract = async () => {
    if (!templateImgRef.current) {
      showAlert("Template image is not loaded yet.", "warning");
      return;
    }

    setIsProcessing(true);
    setFullscreenDropdownOpen(false);
    setProcessingStage("Merging handwritten ink with blank challan template...");

    try {
      // 1. Create offscreen canvas for composite
      const offscreen = document.createElement("canvas");
      offscreen.width = TEMPLATE_WIDTH;
      offscreen.height = TEMPLATE_HEIGHT;
      const oCtx = offscreen.getContext("2d");

      if (!oCtx) {
        throw new Error("Unable to create offscreen rendering context");
      }

      // Draw background template
      oCtx.drawImage(templateImgRef.current, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);

      // Draw handwritten ink on top
      if (inkCanvasRef.current) {
        oCtx.drawImage(inkCanvasRef.current, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
      }

      // 2. Export composite as JPEG
      setProcessingStage("Encoding high-res challan composite (814x1024)...");
      const compositeBase64 = offscreen.toDataURL("image/jpeg", 0.94);
      setCompositeImage(compositeBase64);

      // 3. Send to Backend Canvas OCR Endpoint with user attribution
      setProcessingStage("Extracting text and details from challan...");
      const response = await processCanvasChallan(
        compositeBase64,
        currentUser?.email || "admin@optimo.com",
        currentUser?.role || "admin",
        currentUser?.name || "Admin"
      );

      if (!response?.success) {
        throw new Error("OCR pipeline returned failure response.");
      }

      // Populate review state with extracted data
      setReviewData(response.data);
      setReviewItems(
        response.data.items && response.data.items.length > 0
          ? response.data.items.map((it, idx) => applyParsedDimensionsCanvas({
              sr_no: it.sr_no || String(idx + 1),
              item_no: it.item_no || "",
              description: it.description || "",
              material_type: it.material_type || "",
              thickness_mm: it.thickness_mm || "",
              width_mm: it.width_mm || "",
              height_mm: it.height_mm || "",
              length_mm: it.length_mm || "",
              quantity: it.quantity || "",
              unit: it.unit || "NOS",
              weight_mt: it.weight_mt || "0.000",
            }))
          : [{ sr_no: "1", item_no: "", description: "", material_type: "", thickness_mm: "", width_mm: "", height_mm: "", length_mm: "", quantity: "1", unit: "NOS", weight_mt: "0.000" }]
      );
      setRawOcrText(response.raw_text || "");
      setReviewMode(true);
      setIsFullscreen(false);

      showAlert("OCR completed! Review and edit the extracted challan fields below.", "success");
    } catch (err: any) {
      console.error("Extraction error:", err);
      showAlert(err.message || "Failed to extract challan data.", "error");
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
    }
  };

  // Dynamically computed total weight
  const computedWeight = reviewItems
    .reduce((sum, it) => sum + Number.parseFloat(it.weight_mt || "0"), 0)
    .toFixed(3);

  // Confirm and Save final editable challan to database
  const handleFinalSave = () => {
    if (!reviewData) return;

    const finalRecord: SavedCanvasChallan = {
      id: `canvas_${Date.now()}`,
      challan_no: reviewData.challan_no || "",
      date: reviewData.date || "",
      your_order_no: reviewData.your_order_no || "",
      order_date: reviewData.order_date || "",
      vehicle_no: reviewData.vehicle_no || "",
      eway_bill_no: reviewData.eway_bill_no || "",
      party_name: reviewData.party_name || "",
      address: reviewData.address || "",
      gstin: reviewData.gstin || "",
      items: reviewItems.filter((it) => it.description.trim() || it.quantity.trim()),
      computed_weight_mt: computedWeight,
      total_weight_override: reviewData.total_weight_override || "",
      total_value_incl_tax: reviewData.total_value_incl_tax || "",
      remarks: reviewData.remarks || "",
      extra_fields: reviewData.extra_fields || "",
      customer_signature: reviewData.customer_signature || "",
      authorised_signatory: reviewData.authorised_signatory || "",
      preview_image_base64: compositeImage || undefined,
      raw_ocr_text: rawOcrText,
      user_id: currentUser?.email || "admin@optimo.com",
      role: currentUser?.role || "admin",
      creator_name: currentUser?.name || "Admin",
      saved_at: new Date().toISOString(),
    };

    onSaved(finalRecord);
  };

  const buildReviewJSON = () => {
    if (!reviewData) return {};
    return {
      supplyType: "O",
      subSupplyType: "1",
      docType: "INV",
      docNo: reviewData.challan_no,
      challanNo: reviewData.challan_no,
      docDate: reviewData.date,
      yourOrderNo: reviewData.your_order_no,
      vehicleNo: reviewData.vehicle_no || "",
      fromGstin: "21AACCT1555G1ZR",
      fromTrdName: "TRIDENT FABRICATORS PVT. LTD.",
      fromAddr1: "Plot No - 112, Industrial Estate, Kalunga, Sambalpur, Odisha - 768212",
      toGstin: reviewData.gstin || "",
      toTrdName: reviewData.party_name || "",
      partyName: reviewData.party_name || "",
      toAddr1: reviewData.address || "",
      address: reviewData.address || "",
      totalValue: reviewData.total_value_incl_tax || "0",
      totalValueInclTax: reviewData.total_value_incl_tax || "0",
      computedWeightMT: computedWeight,
      totalWeightOverride: reviewData.total_weight_override || computedWeight,
      remarks: reviewData.remarks || "",
      extraFields: reviewData.extra_fields || "",
      itemList: reviewItems.map((it, idx) => {
        const parsed = applyParsedDimensionsCanvas(it);
        return {
          itemNo: String(idx + 1),
          productDesc: it.description,
          hsnCode: it.item_no,
          materialType: parsed.material_type || "",
          thicknessMm: parsed.thickness_mm || "",
          widthMm: parsed.width_mm || "",
          heightMm: parsed.height_mm || "",
          lengthMm: parsed.length_mm || "",
          quantity: it.quantity,
          unit: it.unit || "NOS",
          weightMT: it.weight_mt,
        };
      }),
    };
  };

  const handleCopyReviewJSON = () => {
    const jsonStr = JSON.stringify(buildReviewJSON(), null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedReviewJSON(true);
    setTimeout(() => setCopiedReviewJSON(false), 2500);
  };

  const handleSendReviewAPI = async () => {
    setSendingReviewAPI(true);
    setReviewApiStatus(null);
    const jsonStr = JSON.stringify(buildReviewJSON(), null, 2);
    try {
      let endpoint = "";
      let token = "";
      if (typeof window !== "undefined") {
        try {
          const cfg = JSON.parse(localStorage.getItem("eway_api_config") || "{}");
          endpoint = cfg.endpoint || "";
          token = cfg.token || "";
        } catch {}
      }
      if (!endpoint) {
        navigator.clipboard.writeText(jsonStr);
        setReviewApiStatus("✓ JSON copied to clipboard. (Configure endpoint in E-Way Bill setup)");
        setSendingReviewAPI(false);
        setTimeout(() => setReviewApiStatus(null), 4000);
        return;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: jsonStr,
      });
      if (res.ok) {
        setReviewApiStatus("✓ Sent to API successfully.");
      } else {
        setReviewApiStatus(`✗ Request failed (${res.status}).`);
      }
    } catch {
      setReviewApiStatus("✗ Failed to connect to API.");
    } finally {
      setSendingReviewAPI(false);
      setTimeout(() => setReviewApiStatus(null), 4000);
    }
  };

  // AI Assistant Chatbot natural language handler
  const handleAiSubmit = async () => {
    if (!aiInput.trim() || aiLoading || !reviewData) return;
    setAiLoading(true);
    setAiMessage(null);
    try {
      const BACKEND_URL = getApiBaseUrl();
      const currentChallanState = {
        challanNo: reviewData.challan_no,
        date: reviewData.date,
        yourOrderNo: reviewData.your_order_no,
        vehicleNo: reviewData.vehicle_no || "",
        ewayBillNo: reviewData.eway_bill_no || "",
        partyName: reviewData.party_name,
        address: reviewData.address,
        gstin: reviewData.gstin,
        remarks: reviewData.remarks || "",
        totalWeightOverride: reviewData.total_weight_override || "",
        totalValueInclTax: reviewData.total_value_incl_tax || "",
        items: reviewItems.map((it, idx) => ({
          slNo: it.sr_no || String(idx + 1),
          itemNo: it.item_no || "",
          description: it.description,
          qty: it.quantity,
          unit: it.unit || "NOS",
          weightMT: it.weight_mt || "0.000",
        })),
      };

      const formData = new FormData();
      formData.append("instruction", aiInput.trim());
      formData.append("challan_state", JSON.stringify(currentChallanState));

      const res = await fetch(`${BACKEND_URL}/api/v1/assistant/text`, {
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
        setReviewData((prev) => {
          if (!prev) return prev;
          const u = result.updates;
          return {
            ...prev,
            challan_no: u.challanNo !== undefined ? u.challanNo : prev.challan_no,
            date: u.date !== undefined ? u.date : prev.date,
            your_order_no: u.yourOrderNo !== undefined ? u.yourOrderNo : prev.your_order_no,
            vehicle_no: u.vehicleNo !== undefined ? u.vehicleNo : (prev.vehicle_no || ""),
            eway_bill_no: u.ewayBillNo !== undefined ? u.ewayBillNo : (prev.eway_bill_no || ""),
            party_name: u.partyName !== undefined ? u.partyName : prev.party_name,
            address: u.address !== undefined ? u.address : prev.address,
            gstin: u.gstin !== undefined ? u.gstin : prev.gstin,
            remarks: u.remarks !== undefined ? u.remarks : (prev.remarks || ""),
            total_weight_override: u.totalWeightOverride !== undefined ? u.totalWeightOverride : (prev.total_weight_override || ""),
            total_value_incl_tax: u.totalValueInclTax !== undefined ? u.totalValueInclTax : (prev.total_value_incl_tax || ""),
          };
        });

        if (result.updates.items && Array.isArray(result.updates.items)) {
          setReviewItems(
            result.updates.items.map((it: any, i: number) => applyParsedDimensionsCanvas({
              sr_no: it.slNo || String(i + 1),
              item_no: it.itemNo || "",
              description: it.description || "",
              material_type: it.materialType || "",
              thickness_mm: it.thicknessMm || "",
              width_mm: it.widthMm || "",
              height_mm: it.heightMm || "",
              length_mm: it.lengthMm || "",
              quantity: it.qty || "",
              unit: it.unit || "NOS",
              weight_mt: it.weightMT || "0.000",
            }))
          );
        }

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
      setAiMessage({ type: "error", text: "⚠️ Could not reach the server. Please check backend is running." });
    } finally {
      setAiLoading(false);
      setTimeout(() => setAiMessage(null), 6000);
    }
  };

  // Editable review items table helpers
  const handleItemChange = (index: number, field: keyof CanvasChallanItem, value: string) => {
    setReviewItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Auto-compute weight_mt if unit changed to KG or MT, or quantity changed
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

      // When the description changes, auto-populate empty dimensional fields
      if (field === "description") {
        const parsed = parseSteelDescription(value);
        if (parsed.materialType) item.material_type = parsed.materialType;
        if (parsed.thicknessMm)  item.thickness_mm  = parsed.thicknessMm;
        if (parsed.widthMm)      item.width_mm      = parsed.widthMm;
        if (parsed.heightMm)     item.height_mm     = parsed.heightMm;
        if (parsed.lengthMm)     item.length_mm     = parsed.lengthMm;
      }

      updated[index] = item;
      return updated;
    });
  };

  const addItemRow = () => {
    setReviewItems((prev) => [
      ...prev,
      {
        sr_no: String(prev.length + 1),
        item_no: "",
        description: "",
        material_type: "",
        thickness_mm: "",
        width_mm: "",
        height_mm: "",
        length_mm: "",
        quantity: "1",
        unit: "NOS",
        weight_mt: "0.000",
      },
    ]);
  };

  const clearReviewItems = () => {
    setReviewItems([{ sr_no: "1", item_no: "", description: "", material_type: "", thickness_mm: "", width_mm: "", height_mm: "", length_mm: "", quantity: "1", unit: "NOS", weight_mt: "0.000" }]);
    if (reviewData) {
      setReviewData({ ...reviewData, total_weight_override: "" });
    }
    setClearTableConfirm(false);
  };

  const removeItemRow = (index: number) => {
    setReviewItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, i) => i !== index)
        .map((it, i) => ({ ...it, sr_no: String(i + 1) }));
    });
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-[#f8fafc] text-gray-800 overflow-hidden select-none relative ${isFullscreen ? "fixed inset-0 z-50 bg-[#f1f5f9]" : ""}`}>
      {/* ── Top Navigation Bar (Hidden in Fullscreen Mode) ─────────────── */}
      {!isFullscreen && !reviewMode && (
        <header className="h-13 sm:h-14 flex-shrink-0 bg-white border-b border-gray-200 px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-3 z-30 shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 h-9 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-all shadow-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
            <div className="h-5 w-px bg-gray-200 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h1 className="text-xs sm:text-base font-bold text-gray-900 truncate">
                Scribble Challan
              </h1>
              <span className="hidden md:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold shrink-0">
                Stylus &amp; Touch
              </span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs transition-all shrink-0"
              title="Fullscreen Mode (Customer Filling)"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#1a237e]" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>

            <button
              type="button"
              onClick={handleExtract}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-2 h-9 rounded-lg bg-[#1a237e] hover:bg-[#283593] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#1a237e]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin text-white" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-300" />
                  <span className="hidden sm:inline">Extract &amp; Review</span>
                  <span className="sm:hidden">Extract</span>
                </>
              )}
            </button>
          </div>
        </header>
      )}

      {/* ── Normal Mode Toolbar (Hidden in Fullscreen Mode & Review Mode) ── */}
      {!isFullscreen && !reviewMode && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-20 shadow-xs text-xs">
          
          {/* Top Row / Desktop Left: Tool Mode & Mobile Actions */}
          <div className="flex items-center justify-between gap-1.5 w-full sm:w-auto">
            {/* Tool Mode Buttons */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTool("pen")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all h-8 ${
                  tool === "pen"
                    ? "bg-[#1a237e] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <Pen className="w-3.5 h-3.5" />
                <span>Pen</span>
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all h-8 ${
                  tool === "eraser"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>
              <button
                type="button"
                onClick={() => setTool("pan")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all h-8 ${
                  tool === "pan"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Pan</span>
              </button>
            </div>

            {/* Mobile Actions: Undo, Clear, Zoom (aligned on row 1) */}
            <div className="flex items-center gap-1 shrink-0 sm:hidden">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo stroke"
                className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-all text-xs font-semibold h-8 min-w-[32px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClear}
                title="Clear all ink"
                className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-all text-xs font-semibold h-8 min-w-[32px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Mobile Compact Zoom */}
              <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200 p-0.5 h-8">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1 rounded text-gray-700 hover:bg-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 font-mono text-[10px] text-gray-600 font-bold min-w-[30px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1 rounded text-gray-700 hover:bg-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Color & Thickness (when Pen selected) */}
          {tool === "pen" && (
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pt-1 sm:pt-0 border-t border-gray-100 sm:border-0">
              {/* Color Palette */}
              <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-xl border border-gray-200 shrink-0">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPenColor(c.value)}
                    title={c.name}
                    className={`w-5 h-5 rounded-full ${c.preview} transition-all ${
                      penColor === c.value
                        ? "ring-2 ring-gray-900 ring-offset-2 ring-offset-white scale-110 shadow-sm"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  />
                ))}
              </div>

              {/* Size Slider Control (matches reference image: label, slider, and preview circle) */}
              <div className="flex items-center bg-[#252528] text-white px-3 py-1 rounded-xl shadow-xs border border-gray-700/60 shrink-0 gap-2.5 h-8">
                <span className="text-xs font-semibold text-gray-200 select-none">Size</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="0.5"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number.parseFloat(e.target.value))}
                  className="w-20 sm:w-28 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#60a5fa]"
                  title={`Pen Size: ${strokeWidth}px`}
                />
                <div className="w-px h-5 bg-white/20 mx-0.5" />
                <div className="w-6 h-6 flex items-center justify-center shrink-0" title={`Preview: ${strokeWidth}px`}>
                  <div
                    className="rounded-full bg-white transition-all shadow-xs"
                    style={{
                      width: `${Math.max(2, Math.min(22, strokeWidth))}px`,
                      height: `${Math.max(2, Math.min(22, strokeWidth))}px`,
                    }}
                  />
                </div>
              </div>

              {/* Stylus Pen Shading Badge */}
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 font-semibold shadow-2xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>Stylus Pen ({strokeWidth}px)</span>
              </div>
            </div>
          )}

          {/* Desktop Actions: Undo, Clear, and Zoom Controls */}
          <div className="hidden sm:flex items-center gap-2 sm:ml-auto shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo stroke (Recent reset)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-all text-xs font-semibold h-8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              title="Clear all ink"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-all text-xs font-semibold h-8"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            {/* Zoom controls */}
            <div className="flex items-center bg-gray-100 rounded-xl border border-gray-200 p-0.5 h-8">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg hover:bg-white text-gray-700 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[10px] text-gray-600 font-bold min-w-[38px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg hover:bg-white text-gray-700 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg hover:bg-white text-gray-700 transition-colors border-l border-gray-200 ml-0.5"
                title="Reset Zoom / Fit"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN FLOATING DROPDOWN & MINIMAL CONTROLS ─────────────── */}
      {isFullscreen && !reviewMode && (
        <>
          {/* Top-Left Exit Fullscreen Pill */}
          <div className="absolute top-4 left-4 z-40">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-gray-300 rounded-xl shadow-lg text-gray-700 hover:bg-gray-100 text-xs font-bold transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#1a237e]" />
              <span>Exit Fullscreen</span>
            </button>
          </div>

          {/* Top-Right Floating Action Dropdown Button */}
          <div className="absolute top-4 right-4 z-40">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFullscreenDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-md border border-gray-300 rounded-xl shadow-xl text-gray-900 hover:bg-gray-50 text-xs font-bold transition-all"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#1a237e]" />
                <span>Actions</span>
                {fullscreenDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Floating Dropdown Menu */}
              <AnimatePresence>
                {fullscreenDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2.5 space-y-1.5 z-50 text-xs"
                  >
                    {/* Primary Action: Save / Extract */}
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#1a237e] text-white font-bold hover:bg-[#283593] transition-colors shadow"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        Extract &amp; Review Challan
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg] opacity-75" />
                    </button>

                    <div className="h-px bg-gray-100 my-1" />

                    {/* Mode Switching */}
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => { setTool("pen"); setFullscreenDropdownOpen(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-colors ${
                          tool === "pen" ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <Pen className="w-3.5 h-3.5 text-blue-600" />
                        <span>Pen Tool</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setTool("eraser"); setFullscreenDropdownOpen(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-colors ${
                          tool === "eraser" ? "bg-amber-50 text-amber-700 border border-amber-200" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <Eraser className="w-3.5 h-3.5 text-amber-600" />
                        <span>Eraser</span>
                      </button>
                    </div>

                    {/* Size Slider in Fullscreen */}
                    {tool === "pen" && (
                      <div className="p-2.5 bg-[#252528] text-white rounded-xl border border-gray-700/60">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
                          <span>Size</span>
                          <span className="font-mono text-[#60a5fa]">{strokeWidth}px</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <input
                            type="range"
                            min="1"
                            max="24"
                            step="0.5"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(Number.parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#60a5fa]"
                          />
                          <div className="w-px h-5 bg-white/20" />
                          <div className="w-6 h-6 flex items-center justify-center shrink-0">
                            <div
                              className="rounded-full bg-white transition-all shadow-xs"
                              style={{
                                width: `${Math.max(2, Math.min(22, strokeWidth))}px`,
                                height: `${Math.max(2, Math.min(22, strokeWidth))}px`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="h-px bg-gray-100 my-1" />

                    {/* Quick Canvas Operations */}
                    <button
                      type="button"
                      onClick={() => { handleUndo(); }}
                      disabled={undoStack.length === 0}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                      <span>Undo / Recent Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { handleClear(); setFullscreenDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Drawing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { handleResetZoom(); setFullscreenDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>Reset Zoom / Fit to Screen</span>
                    </button>

                    <div className="h-px bg-gray-100 my-1" />

                    <button
                      type="button"
                      onClick={() => { setIsFullscreen(false); setFullscreenDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Exit Fullscreen</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {/* ── CANVAS DRAWING VIEWPORT ──────────────────────────────────────── */}
      {!reviewMode && (
        <div
          ref={containerRef}
          role="application"
          aria-label="Interactive Scribble Drawing Surface"
          tabIndex={0}
          className={`flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 bg-[#f1f5f9] touch-none ${
            tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
          }`}
          onMouseDown={startDrawingMouse}
          onMouseMove={drawMouse}
          onMouseUp={stopDrawingMouse}
          onMouseLeave={stopDrawingMouse}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {!templateLoaded ? (
            <div className="flex flex-col items-center justify-center gap-3 text-gray-500 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a237e]" />
              <span className="text-xs font-semibold">Loading Blank Challan Template...</span>
            </div>
          ) : (
            <div
              style={{
                width: `${TEMPLATE_WIDTH * zoom}px`,
                height: `${TEMPLATE_HEIGHT * zoom}px`,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isPanning || isTwoFingerPanningRef.current ? "none" : "transform 0.08s ease-out",
              }}
              className="relative flex-shrink-0 shadow-2xl ring-1 ring-gray-300 rounded-sm bg-white touch-none select-none"
            >
              {/* Official Trident Delivery Challan Background Template */}
              <img
                src="/challan-canvas-template.png"
                alt="Trident Fabricators Delivery Challan Template"
                draggable={false}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
              />

              {/* Foreground Handwritten Ink Layer */}
              <canvas
                ref={inkCanvasRef}
                width={TEMPLATE_WIDTH}
                height={TEMPLATE_HEIGHT}
                className="absolute inset-0 w-full h-full z-10 select-none touch-none"
              />
            </div>
          )}

          {/* Floating Mobile Two-Finger Tip */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-30">
            <div className="bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-gray-300 shadow-md text-[11px] text-gray-700 flex items-center gap-1.5 font-medium">
              <span>💡</span>
              <span className="font-semibold text-blue-700">Touch Gestures:</span>
              <span>Pinch with 2 fingers to zoom in / out • Drag with 2 fingers to pan</span>
            </div>
          </div>
        </div>
      )}

      {/* ── POST-OCR EDITABLE TRIDENT CHALLAN FORMAT TABLE VIEW ──────────── */}
      {reviewMode && reviewData && (
        <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-y-auto">
          {/* Header / Notice & Actions Bar */}
          <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  ✨ OCR Transcription Completed
                </span>
                <span className="text-xs font-bold text-gray-900">
                  {reviewData.challan_no ? `Challan #${reviewData.challan_no}` : "Trident Delivery Challan"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Verify or edit extracted fields in the authentic Trident challan layout before saving to the database.
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start md:justify-end w-full md:w-auto">
              {compositeImage && (
                <button
                  type="button"
                  onClick={() => setShowReviewImage((p) => !p)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0 h-8 sm:h-9 ${
                    showReviewImage
                      ? "bg-blue-50 text-[#1a237e] border-blue-200 shadow-2xs"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  title="Toggle scribble document preview"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showReviewImage ? "Hide Image" : "View Image"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyReviewJSON}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs shrink-0 h-8 sm:h-9"
                title="Copy JSON Payload"
              >
                {copiedReviewJSON ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReviewJSON ? "Copied!" : "Copy JSON"}</span>
              </button>

              <button
                type="button"
                onClick={handleSendReviewAPI}
                disabled={sendingReviewAPI}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-2xs disabled:opacity-50 shrink-0 h-8 sm:h-9"
                title="Send via API"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingReviewAPI ? "Sending…" : "Send via API"}</span>
              </button>

              {reviewApiStatus && (
                <span className={`text-[11px] font-medium shrink-0 ${reviewApiStatus.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {reviewApiStatus}
                </span>
              )}

              <button
                type="button"
                onClick={() => setReviewMode(false)}
                className="flex items-center justify-center px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors shrink-0 h-8 sm:h-9"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-white bg-[#1a237e] hover:bg-[#283593] rounded-lg shadow-md transition-all shrink-0 h-8 sm:h-9"
              >
                <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Main Review Body: Split-Screen on Laptop Web View if Scribbled Image Available */}
          <div className="flex-1 overflow-hidden flex flex-col lg:grid lg:grid-cols-12">
            {/* Left Panel: Scribbled Drawing Image Viewport (Laptop Web View) */}
            {compositeImage && showReviewImage && (
              <div className="w-full lg:col-span-5 h-[320px] lg:h-full flex flex-col bg-[#07080b] border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden relative select-none flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-900/90 border-b border-gray-800 text-white flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-bold text-gray-200">Scribbled Challan Document</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReviewImageZoom((z) => Math.max(0.6, z - 0.2))}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-gray-300 w-10 text-center">
                      {Math.round(reviewImageZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewImageZoom((z) => Math.min(3, z + 0.2))}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewImageZoom(1)}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={compositeImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-[#0a0f1d]">
                  <img
                    src={compositeImage}
                    alt="Scribbled challan"
                    style={{
                      transform: `scale(${reviewImageZoom})`,
                      transformOrigin: "top center",
                    }}
                    className="max-w-full h-auto object-contain transition-transform duration-100 rounded shadow-md"
                  />
                </div>
              </div>
            )}

            {/* Right Panel: Editable Review Form */}
            <div className={`w-full ${compositeImage && showReviewImage ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl mx-auto"} h-full overflow-y-auto p-4 sm:p-6 space-y-6`}>
              {/* Authentic Trident Challan Layout Box */}
              <div className="bg-white rounded-2xl border-2 border-[#1a237e]/20 shadow-md p-6 space-y-6">
              {/* Header Box: Company Header Info */}
              <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-[#1a237e] tracking-tight">
                    TRIDENT FABRICATORS PVT. LTD.
                  </h3>
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">
                    DELIVERY CHALLAN &amp; DESPATCH NOTE
                  </p>
                </div>
              </div>

              {/* Header & Dispatch Info */}
              <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="review-challan-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Challan No.
                    </label>
                    <input
                      id="review-challan-no"
                      type="text"
                      value={reviewData.challan_no}
                      onChange={(e) => setReviewData({ ...reviewData, challan_no: e.target.value })}
                      placeholder="e.g. 1045"
                      className="w-full px-3 py-1.5 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-challan-date" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Challan Date
                    </label>
                    <input
                      id="review-challan-date"
                      type="text"
                      value={reviewData.date}
                      onChange={(e) => setReviewData({ ...reviewData, date: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-order-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Your Order No.
                    </label>
                    <input
                      id="review-order-no"
                      type="text"
                      value={reviewData.your_order_no}
                      onChange={(e) => setReviewData({ ...reviewData, your_order_no: e.target.value })}
                      placeholder="e.g. PO-889"
                      className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-order-date" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Order Date
                    </label>
                    <input
                      id="review-order-date"
                      type="text"
                      value={reviewData.order_date}
                      onChange={(e) => setReviewData({ ...reviewData, order_date: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
                  <div>
                    <label htmlFor="review-vehicle-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-gray-500" />
                      Vehicle No.
                    </label>
                    <input
                      id="review-vehicle-no"
                      type="text"
                      value={reviewData.vehicle_no || ""}
                      onChange={(e) => setReviewData({ ...reviewData, vehicle_no: e.target.value })}
                      placeholder="e.g. OD 15 XXXX"
                      className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-eway-bill-no" className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-gray-500" />
                      E-Way Bill No. (if generated)
                    </label>
                    <input
                      id="review-eway-bill-no"
                      type="text"
                      value={reviewData.eway_bill_no || ""}
                      onChange={(e) => setReviewData({ ...reviewData, eway_bill_no: e.target.value })}
                      placeholder="e.g. 241234567890"
                      className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>
              </div>

              {/* Consignee Details */}
              <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
                <div>
                  <label htmlFor="review-party-name" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    M/s. (Party / Consignee Name)
                  </label>
                  <input
                    id="review-party-name"
                    type="text"
                    value={reviewData.party_name}
                    onChange={(e) => setReviewData({ ...reviewData, party_name: e.target.value })}
                    placeholder="Consignee company name"
                    className="w-full px-3 py-2 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor="review-delivery-address" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Delivery Address
                    </label>
                    <textarea
                      id="review-delivery-address"
                      rows={2}
                      value={reviewData.address}
                      onChange={(e) => setReviewData({ ...reviewData, address: e.target.value })}
                      placeholder="Delivery site or plant address"
                      className="w-full px-3 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-gstin" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      GSTIN
                    </label>
                    <input
                      id="review-gstin"
                      type="text"
                      value={reviewData.gstin}
                      onChange={(e) => setReviewData({ ...reviewData, gstin: e.target.value })}
                      placeholder="24AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table (Editable Rows) */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-wide">
                      Description of Goods ({reviewItems.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Clear Table Button */}
                    {clearTableConfirm ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-red-600 font-semibold">Clear all rows?</span>
                        <button
                          type="button"
                          onClick={clearReviewItems}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                          Yes, Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setClearTableConfirm(false)}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setClearTableConfirm(true)}
                        className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear Table
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="flex items-center gap-1 text-xs font-bold text-[#1a237e] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item Row
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100/90 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center">Sl.</th>
                        <th className="px-3 py-2.5 w-28">Item No. (HSN)</th>
                        <th className="px-3 py-2.5 min-w-[160px]">Description of Goods</th>
                        <th className="px-2 py-2.5 w-24">Mat. Type</th>
                        <th className="px-2 py-2.5 w-20">Thk (mm)</th>
                        <th className="px-2 py-2.5 w-20">W (mm)</th>
                        <th className="px-2 py-2.5 w-20">H (mm)</th>
                        <th className="px-2 py-2.5 w-20">L (mm)</th>
                        <th className="px-3 py-2.5 w-20 text-right">QTY</th>
                        <th className="px-3 py-2.5 w-24">UNIT</th>
                        <th className="px-3 py-2.5 w-28 text-right">Weight (MT)</th>
                        <th className="px-2 py-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {reviewItems.map((item, idx) => (
                        <tr key={item.item_no || item.sr_no ? `scribble-row-${item.item_no || item.sr_no}-${item.description.slice(0, 10)}` : `scribble-row-${item.description}-${item.quantity}`} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-2 py-2 text-center">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} serial number`}
                              value={item.sr_no}
                              onChange={(e) => handleItemChange(idx, "sr_no", e.target.value)}
                              className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-xs font-semibold"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} item number`}
                              value={item.item_no || ""}
                              onChange={(e) => handleItemChange(idx, "item_no", e.target.value)}
                              placeholder="HSN/No."
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} description`}
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              placeholder="e.g. M.S. PLATE 25MM THK"
                              className="w-full px-2.5 py-1 border border-gray-300 rounded text-xs font-medium"
                            />
                          </td>
                          {/* Dimensional fields */}
                          <td className="px-2 py-2">
                            <select
                              aria-label={`Item ${idx + 1} material type`}
                              value={item.material_type || ""}
                              onChange={(e) => handleItemChange(idx, "material_type", e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs font-semibold bg-white"
                            >
                              <option value="">—</option>
                              <option value="PLATE">PLATE</option>
                              <option value="NPB">NPB</option>
                              <option value="ISA">ISA</option>
                              <option value="ISMB">ISMB</option>
                              <option value="ISMC">ISMC</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} thickness`}
                              value={item.thickness_mm || ""}
                              onChange={(e) => handleItemChange(idx, "thickness_mm", e.target.value)}
                              placeholder="mm"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} width`}
                              value={item.width_mm || ""}
                              onChange={(e) => handleItemChange(idx, "width_mm", e.target.value)}
                              placeholder="mm"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} height`}
                              value={item.height_mm || ""}
                              onChange={(e) => handleItemChange(idx, "height_mm", e.target.value)}
                              placeholder="mm"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} length`}
                              value={item.length_mm || ""}
                              onChange={(e) => handleItemChange(idx, "length_mm", e.target.value)}
                              placeholder="mm"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} quantity`}
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              placeholder="1"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-bold"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              aria-label={`Item ${idx + 1} unit`}
                              value={item.unit || "NOS"}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold bg-white"
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="text"
                              aria-label={`Item ${idx + 1} weight`}
                              value={item.weight_mt || "0.000"}
                              onChange={(e) => handleItemChange(idx, "weight_mt", e.target.value)}
                              placeholder="0.000"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono font-semibold"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={reviewItems.length <= 1}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-20 transition-colors"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Item Line Button */}
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-[#1a237e] hover:text-[#1a237e] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add line
                  </button>
                </div>

                {/* Totals Row (Matching Manual OCR & Voice Assistant) */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-gray-200 bg-gray-50/70">
                  <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                      Computed Weight
                    </p>
                    <p className="text-2xl font-black text-gray-900">
                      {computedWeight} <span className="text-sm font-bold text-gray-500">MT</span>
                    </p>
                    <p className="text-[10px] text-gray-400">Sum of line weights (auto-calculated)</p>
                  </div>
                  <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200">
                    <label htmlFor="review-weight-override" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Total Weight Override (Optional)
                    </label>
                    <input
                      id="review-weight-override"
                      type="text"
                      value={reviewData.total_weight_override || ""}
                      onChange={(e) => setReviewData({ ...reviewData, total_weight_override: e.target.value })}
                      placeholder={computedWeight}
                      className="w-full px-3 py-1.5 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Leave blank to use computed weight</p>
                  </div>
                  <div className="px-4 py-3">
                    <label htmlFor="review-total-value" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Total Value Incl. Tax (₹)
                    </label>
                    <input
                      id="review-total-value"
                      type="text"
                      value={reviewData.total_value_incl_tax || ""}
                      onChange={(e) => setReviewData({ ...reviewData, total_value_incl_tax: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Invoice / Challan gross valuation</p>
                  </div>
                </div>
              </div>

              {/* Remarks / Terms Section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                    Remarks / Terms &amp; Conditions
                  </span>
                </div>
                <div className="p-4">
                  <textarea
                    id="review-remarks"
                    aria-label="Remarks and Terms"
                    rows={3}
                    value={reviewData.remarks || ""}
                    onChange={(e) => setReviewData({ ...reviewData, remarks: e.target.value })}
                    placeholder="e.g. Above mentioned material issued to G.P. Engg for job work basis on returnable basis. Not for sale."
                    className="w-full px-3 py-2 text-xs text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e] resize-none"
                  />
                  {reviewData.extra_fields && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
                      <p className="font-semibold mb-1 text-[10px] uppercase tracking-wider">
                        Extra Fields Detected:
                      </p>
                      <pre className="whitespace-pre-wrap font-mono text-[11px]">
                        {reviewData.extra_fields}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Assistant Chatbot (Matching Manual OCR & Voice Assistant) */}
              <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-xs">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                  <Bot className="w-4 h-4 text-indigo-700" />
                  <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
                    AI Assistant
                  </span>
                  <span className="ml-auto text-[10px] text-indigo-500 font-medium">
                    Natural language updates
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-[11px] text-gray-500">
                    Type an instruction to update challan fields (e.g. &quot;Change quantity to 25&quot;, &quot;Update vehicle number to MH 04 1234&quot;, or &quot;Update remarks to issued to GP Engg&quot;).
                  </p>
                  <div className="flex gap-2">
                    <input
                      ref={aiInputRef}
                      id="review-ai-input"
                      aria-label="AI Assistant Input"
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !aiLoading) {
                          e.preventDefault();
                          handleAiSubmit();
                        }
                      }}
                      placeholder="e.g. Set vehicle number to OD-15-B-1234 or update remarks..."
                      className="flex-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-300 transition-all bg-white"
                      disabled={aiLoading}
                    />
                    <button
                      type="button"
                      onClick={handleAiSubmit}
                      disabled={aiLoading || !aiInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {aiLoading ? "Updating..." : "Send"}
                    </button>
                  </div>

                  {aiMessage && (
                    <div className={`px-3 py-2 rounded-lg text-xs font-medium border ${getCanvasAiMessageClass(aiMessage.type)}`}>
                      {aiMessage.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/80 p-4 rounded-xl border border-gray-200">
                <div>
                  <label htmlFor="review-customer-signature" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Customer's Signature
                  </label>
                  <input
                    id="review-customer-signature"
                    type="text"
                    value={reviewData.customer_signature}
                    onChange={(e) => setReviewData({ ...reviewData, customer_signature: e.target.value })}
                    placeholder="Signature status / name"
                    className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                  />
                </div>

                <div>
                  <label htmlFor="review-authorised-signatory" className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    For TRIDENT FABRICATORS PVT. LTD. (Authorised Signatory)
                  </label>
                  <input
                    id="review-authorised-signatory"
                    type="text"
                    value={reviewData.authorised_signatory}
                    onChange={(e) => setReviewData({ ...reviewData, authorised_signatory: e.target.value })}
                    placeholder="Authorised signatory status / name"
                    className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1a237e]"
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setReviewMode(false)}
                  className="flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors h-10 order-2 sm:order-1"
                >
                  Back to Scribble
                </button>
                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1a237e] hover:bg-[#283593] rounded-xl shadow-md shadow-[#1a237e]/20 transition-all h-10 order-1 sm:order-2"
                >
                  <Check className="w-4 h-4" />
                  Save Challan to Database
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Processing Overlay Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 10 }}
              className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-5"
            >
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#1a237e]/20 animate-ping" />
                <div className="w-14 h-14 rounded-full bg-[#1a237e] flex items-center justify-center shadow-md">
                  <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Transcribing Challan Handwriting
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Extracting text and details from challan...
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-xs font-mono text-[#1a237e] font-semibold animate-pulse">
                  {processingStage || "Extracting text and details from challan..."}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Generating editable Trident Challan table...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
