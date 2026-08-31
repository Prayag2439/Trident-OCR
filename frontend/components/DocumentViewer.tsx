"use client";

import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Copy,
  Check,
  Monitor,
  Search as SearchIcon,
  FileText,
} from "lucide-react";
import { ExtractedRegion, DocumentMeta } from "@/types/ocr";
import { RegionCanvas } from "./RegionCanvas";

interface DocumentViewerProps {
  previewUrl: string | null;
  meta: DocumentMeta | null;
  regions: ExtractedRegion[];
  activeRegion: ExtractedRegion | null;
  onSelectRegion: (region: ExtractedRegion | null) => void;
}

export const DocumentViewer = memo(function DocumentViewer({
  previewUrl,
  meta,
  regions,
  activeRegion,
  onSelectRegion,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState({
    width: meta?.page_width || 900,
    height: meta?.page_height || 1200,
  });
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const imgSrc = meta?.preview_image_base64
    ? (meta.preview_image_base64.startsWith("data:") ? meta.preview_image_base64 : `data:image/jpeg;base64,${meta.preview_image_base64}`)
    : previewUrl;

  const handleImageLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth || meta?.page_width || 900;
      const h = imgRef.current.naturalHeight || meta?.page_height || 1200;
      setNaturalSize({ width: w, height: h });
    }
  };

  useEffect(() => {
    if (meta?.page_width && meta?.page_height) {
      setNaturalSize({ width: meta.page_width, height: meta.page_height });
    }
  }, [meta?.page_width, meta?.page_height]);

  const handleCopySelectedText = () => {
    if (!activeRegion) return;
    navigator.clipboard.writeText(activeRegion.text_content);
    setCopiedToast("Text copied to clipboard.");
    setTimeout(() => setCopiedToast(null), 3000);
  };

  const handleCopyFormatted = () => {
    if (!activeRegion) return;
    const formatted = `[${activeRegion.class} #${activeRegion.reading_order_index}]\n${activeRegion.text_content}`;
    navigator.clipboard.writeText(formatted);
    setCopiedToast("Formatted section copied.");
    setTimeout(() => setCopiedToast(null), 3000);
  };

  const handleWebSearch = () => {
    if (!activeRegion) return;
    const query = encodeURIComponent(activeRegion.text_content.slice(0, 100));
    window.open(`https://www.google.com/search?q=${query}`, "_blank");
  };

  return (
    <div className="relative flex flex-col h-full rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl select-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface/80 backdrop-blur-md z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-cyan" />
          <span className="text-xs font-semibold text-gray-200 tracking-wide uppercase">
            Document Viewport
          </span>
          <span className="text-[11px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
            {meta?.page_width || naturalSize.width} × {meta?.page_height || naturalSize.height} px
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-surface-raised/80 rounded-lg p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-gray-300 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document Canvas Viewport - Completely Fixed & Stationary (overflow-hidden) */}
      <div className="relative flex-1 overflow-hidden p-2 flex items-start justify-center bg-[#07080b]">
        {imgSrc && (
          <div
            className="relative shadow-2xl origin-top rounded-lg overflow-hidden border border-white/10 inline-block my-1"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Document view"
              onLoad={handleImageLoad}
              className="max-h-[720px] max-w-full w-auto block select-none pointer-events-none"
            />
            {/* SVG Region Lens Overlay */}
            <RegionCanvas
              regions={regions}
              activeRegion={activeRegion}
              onSelectRegion={onSelectRegion}
              naturalWidth={naturalSize.width}
              naturalHeight={naturalSize.height}
            />
          </div>
        )}
      </div>

      {/* Google Lens Bottom Sheet Action Modal */}
      <AnimatePresence>
        {activeRegion && (
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white text-gray-900 rounded-3xl p-4 shadow-2xl z-30 border border-gray-200"
          >
            <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-2.5" />

            <div className="flex items-start gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">
                "{activeRegion.text_content.replace(/\n+/g, " ")}"
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopySelectedText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-gray-600" />
                <span>Copy text</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFormatted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5 text-blue-600" />
                <span>Copy section</span>
              </button>

              <button
                type="button"
                onClick={handleWebSearch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors"
              >
                <SearchIcon className="w-3.5 h-3.5 text-gray-600" />
                <span>Search</span>
              </button>
            </div>

            {copiedToast && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[11px] font-medium flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copiedToast}</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-surface/60 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400 flex-shrink-0">
        <span>💡 Stationary Document Viewport (GPT-5 Powered)</span>
        <span>{regions.length} sections</span>
      </div>
    </div>
  );
});
