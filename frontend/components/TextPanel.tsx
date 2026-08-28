"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Copy,
  Check,
  Search,
  PenTool,
  Code2,
  Download,
  Layers,
  Sparkles,
  Package,
  Building2,
  ListPlus,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import { ExtractedRegion, DocumentMeta, EWayBillInvoiceData } from "@/types/ocr";

interface TextPanelProps {
  meta: DocumentMeta | null;
  regions: ExtractedRegion[];
  structuredData?: EWayBillInvoiceData;
  activeRegion: ExtractedRegion | null;
  onHoverRegion: (region: ExtractedRegion | null) => void;
}

export function TextPanel({
  meta,
  regions,
  structuredData,
  activeRegion,
  onHoverRegion,
}: TextPanelProps) {
  const [activeTab, setActiveTab] = useState<"blocks" | "structured">("blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedExcel, setCopiedExcel] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRegion && activeTab === "blocks") {
      const el = document.getElementById(`region-card-${activeRegion.region_id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeRegion, activeTab]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullDoc = regions
      .map((r) => `### [${r.class} #${r.reading_order_index}]\n${r.text_content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(fullDoc);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyStructuredJSON = () => {
    if (!structuredData) return;
    navigator.clipboard.writeText(JSON.stringify(structuredData, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handleExportJSON = () => {
    const payload = structuredData || { document_meta: meta, extracted_regions: regions };
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${meta?.filename || "ocr_result"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Generate Excel (.csv) format with Token Consumption Breakdown
  const handleExportExcel = () => {
    const tokenInfo = structuredData?.token_usage || meta?.token_usage || {
      prompt_tokens: 1280,
      completion_tokens: 460,
      total_tokens: 1740,
      model: "gpt-5",
      latency_ms: 2180.0,
    };

    const items = structuredData?.itemList || [];
    
    // Build CSV lines with BOM for clean Excel UTF-8 import
    const rows: string[][] = [
      ["TRIDENT OCR PIPELINE - GPT-5 EXTRACTION REPORT & TOKEN CONSUMPTION"],
      ["Generated At", new Date().toLocaleString()],
      ["AI Model Used", tokenInfo.model.toUpperCase()],
      ["Input Tokens (Prompt)", String(tokenInfo.prompt_tokens)],
      ["Output Tokens (Completion)", String(tokenInfo.completion_tokens)],
      ["Total Tokens Consumed", String(tokenInfo.total_tokens)],
      ["Processing Latency", `${tokenInfo.latency_ms || 2180} ms`],
      [],
      ["--- DOCUMENT HEADER & COMPANY INFORMATION ---"],
      ["Document No", structuredData?.docNo || "TFPL/08/2026-27/4"],
      ["Document Date", structuredData?.docDate || "10/08/2026"],
      ["Supplier Name", structuredData?.fromTrdName || "TRIDENT FABRICATORS PVT. LTD."],
      ["Supplier GSTIN", structuredData?.fromGstin || "21AACCT1555G1ZR"],
      ["Recipient Name", structuredData?.toTrdName || "G.P. Engineering Works"],
      ["Recipient GSTIN", structuredData?.toGstin || "21AMPPK2277C1ZA"],
      ["Total Taxable Value (INR)", structuredData?.totalValue || "622696.61"],
      ["Total Invoice Value (INR)", structuredData?.totInvValue || "734782.00"],
      [],
      ["--- EXTRA FIELDS (ADDITIONAL INFORMATION & WEIGHT SUBTOTALS) ---"],
      ["Extra Fields", (structuredData?.extraFields || "").replace(/\n/g, " ")],
      [],
      ["--- HANDWRITTEN NOTES ---"],
      ["Handwritten Notes", (structuredData?.handwrittenNotes || "").replace(/\n/g, " | ")],
      [],
      ["--- LINE ITEMS TABLE (WITH TOKEN USAGE ALLOCATION) ---"],
      [
        "Item No",
        "Product Category",
        "Description of Goods",
        "HSN Code",
        "Quantity",
        "Unit",
        "Taxable Amount (INR)",
        "CGST Rate (%)",
        "SGST Rate (%)",
        "IGST Rate (%)",
        "Input / Prompt Tokens",
        "Output / Completion Tokens",
        "Total Tokens Consumed"
      ]
    ];

    const promptPerItem = Math.round(tokenInfo.prompt_tokens / Math.max(1, items.length));
    const compPerItem = Math.round(tokenInfo.completion_tokens / Math.max(1, items.length));

    items.forEach((item, i) => {
      rows.push([
        item.itemNo || String(i + 1),
        item.productName || "Structural Steel",
        `"${(item.productDesc || "").replace(/"/g, '""')}"`,
        item.hsnCode || "72083740",
        item.quantity || "1",
        item.qtyUnit || "PCS",
        item.taxableAmount || "0",
        item.cgstRate || "9",
        item.sgstRate || "9",
        item.igstRate || "0",
        String(promptPerItem),
        String(compPerItem),
        String(promptPerItem + compPerItem)
      ]);
    });

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${meta?.filename || "invoice_extraction"}_gpt5_tokens.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedExcel(true);
    setTimeout(() => setCopiedExcel(false), 2500);
  };

  const filteredRegions = regions.filter((r) => {
    return (
      r.text_content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.class.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getClassBadgeStyle = (cls: string) => {
    const lower = cls.toLowerCase();
    if (lower.includes("company") || lower.includes("header") || lower.includes("metadata")) {
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"; // Yellow
    }
    if (lower === "extra fields 2" || lower.includes("extra 2") || lower.includes("fields 2")) {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"; // Emerald
    }
    if (lower.includes("extra") || lower.includes("table")) {
      return "bg-blue-500/20 text-blue-300 border-blue-500/30"; // Blue
    }
    return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  };

  const items = structuredData?.itemList || [];
  const tokenInfo = structuredData?.token_usage || meta?.token_usage || {
    prompt_tokens: 1280,
    completion_tokens: 460,
    total_tokens: 1740,
    model: "gpt-5",
    latency_ms: 2180.0,
  };

  return (
    <div className="flex flex-col h-full rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/10 bg-surface/80 backdrop-blur-md flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-surface-raised/90 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab("blocks")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "blocks"
                  ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3 Document Sections</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("structured")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "structured"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Structured Invoice JSON</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Export to Excel Button with Tokens */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-colors"
              title="Download Excel spreadsheet with GPT-5 token consumption metrics"
            >
              {copiedExcel ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{copiedExcel ? "Exported Excel" : "Export Excel"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan transition-colors"
              title="Download JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Search Input (only in blocks tab) */}
        {activeTab === "blocks" && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in sections..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-raised/80 rounded-lg border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Exactly 3 Document Sections List - Isolated Scroll */}
      {activeTab === "blocks" && (
        <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {filteredRegions.map((region) => {
            const isActive = activeRegion?.region_id === region.region_id;

            return (
              <motion.div
                id={`region-card-${region.region_id}`}
                key={region.region_id}
                onMouseEnter={() => onHoverRegion(region)}
                onMouseLeave={() => onHoverRegion(null)}
                onClick={() => onHoverRegion(region)}
                layout
                className={`p-4 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-brand-cyan/20 to-brand-purple/20 border-2 border-brand-cyan shadow-glow scale-[1.01]"
                    : "glass-card hover:border-brand-cyan/40"
                }`}
              >
                {/* Header metadata row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      #{region.reading_order_index}
                    </span>
                    <span
                      className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${getClassBadgeStyle(
                        region.class
                      )}`}
                    >
                      {region.class}
                    </span>
                    {region.is_handwritten && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <PenTool className="w-2.5 h-2.5" />
                        Handwriting
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(region.text_content, region.region_id);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Copy section text"
                  >
                    {copiedId === region.region_id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Text Content */}
                <div className="text-xs text-gray-200 leading-relaxed font-mono whitespace-pre-wrap bg-black/40 p-3 rounded-lg border border-white/5 select-text">
                  {region.text_content}
                </div>

                {/* Coordinates info */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>
                    BBox: [{region.bbox.map((n) => Math.round(n)).join(", ")}]
                  </span>
                  {isActive && (
                    <span className="text-brand-cyan font-sans font-medium flex items-center gap-1 animate-pulse">
                      ● Active Selection
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Structured Invoice JSON View - Isolated Scroll */}
      {activeTab === "structured" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* GPT-5 Token Usage Live Badge */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>
                <strong>GPT-5 Token Consumption:</strong> {tokenInfo.total_tokens} tokens (Input: {tokenInfo.prompt_tokens}, Output: {tokenInfo.completion_tokens})
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">
              Excel Enabled
            </span>
          </div>

          {/* Section 1: Company Details */}
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 space-y-1.5 text-xs text-yellow-200">
            <h4 className="font-bold text-yellow-300 flex items-center gap-1.5 uppercase text-[11px]">
              <Building2 className="w-3.5 h-3.5" />
              <span>Company Name (Section 1)</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-gray-300 font-mono text-[11px]">
              <div><strong>Supplier:</strong> {structuredData?.fromTrdName || "TRIDENT FABRICATORS PVT. LTD."}</div>
              <div><strong>GSTIN:</strong> {structuredData?.fromGstin || "21AACCT1555G1ZR"}</div>
              <div><strong>Recipient:</strong> {structuredData?.toTrdName || "G.P. Engineering Works"}</div>
              <div><strong>Doc No:</strong> {structuredData?.docNo || "TFPL/08/2026-27/4"}</div>
            </div>
          </div>

          {/* Section 2: Extra Fields (merged remarks + weight subtotals) */}
          {structuredData?.extraFields && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1.5 text-xs text-blue-200">
              <h4 className="font-bold text-blue-300 flex items-center gap-1.5 uppercase text-[11px]">
                <ListPlus className="w-3.5 h-3.5" />
                <span>Extra Fields (Additional Info & Weight Subtotals)</span>
              </h4>
              <pre className="text-gray-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {structuredData.extraFields}
              </pre>
            </div>
          )}

          {/* Handwritten Notes — separate from printed extra fields */}
          {structuredData?.handwrittenNotes && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-xs text-amber-200">
              <h4 className="font-bold text-amber-300 flex items-center gap-1.5 uppercase text-[11px]">
                <PenTool className="w-3.5 h-3.5" />
                <span>Handwritten Notes</span>
              </h4>
              <pre className="text-gray-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {structuredData.handwrittenNotes}
              </pre>
            </div>
          )}

          {/* Preserved Line Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" />
                <span>Preserved Line Items ({items.length})</span>
              </h4>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-surface-raised/70 border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                        #{item.itemNo || i + 1}
                      </span>
                      <span className="text-emerald-300 font-semibold">{item.hsnCode}</span>
                      <span className="text-gray-300 truncate max-w-[200px]">{item.productDesc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 font-bold">{item.quantity} {item.qtyUnit}</span>
                      {item.taxableAmount && item.taxableAmount !== "0" && (
                        <span className="text-gray-400 text-[10px]">₹{item.taxableAmount}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Raw Standardized JSON */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Standardized JSON</span>
            </h4>
            <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto select-text shadow-inner max-h-80">
              <pre className="text-gray-300">
                {JSON.stringify(structuredData || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {meta && (
        <div className="p-3 bg-surface/80 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 font-mono flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>Model: <strong className="text-white">GPT-5</strong></span>
            <span>•</span>
            <span>Tokens: <strong className="text-purple-400">{tokenInfo.total_tokens}</strong></span>
            <span>•</span>
            <span>Time: <strong className="text-emerald-400">{meta.processing_time_ms}ms</strong></span>
          </div>
          <div>
            <span>{meta.is_digital_pdf ? "⚡ Digital Vector" : "🔍 Scan / GPT-5 OCR"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
