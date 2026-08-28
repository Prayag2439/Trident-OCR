"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Sparkles, Image as ImageIcon } from "lucide-react";

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export function DropZone({ onFileSelected, loading }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
      e.target.value = ""; // Reset so same file can be selected again
    }
  };

  const triggerFileInput = () => {
    if (!loading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={handleFileInputChange}
        disabled={loading}
      />

      {/* Drag & Drop Container */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        whileHover={{ scale: loading ? 1 : 1.01 }}
        whileTap={{ scale: loading ? 1 : 0.99 }}
        className={`w-full relative rounded-3xl p-12 cursor-pointer flex flex-col items-center justify-center text-center transition-all duration-300 ${
          isDragOver
            ? "border-2 border-brand-cyan bg-brand-cyan/10 shadow-glow"
            : "glass-panel border-2 border-dashed border-white/15 hover:border-brand-cyan/50 hover:bg-white/[0.02]"
        }`}
      >
        {/* Floating Icon Halo */}
        <div className="relative mb-5 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-cyan/20 to-brand-purple/20 border border-white/10 flex items-center justify-center shadow-lg">
            <UploadCloud className="w-8 h-8 text-brand-cyan animate-bounce" />
          </div>
          <div className="absolute -inset-1 bg-brand-cyan/20 rounded-2xl blur-xl -z-10" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2 tracking-tight pointer-events-none">
          Upload document to process, or <span className="text-brand-cyan underline decoration-brand-cyan/40 underline-offset-4">browse files</span>
        </h3>
        <p className="text-sm text-gray-400 max-w-md mb-6 pointer-events-none">
          Upload any PDF or Image invoice/document to run PyMuPDF Triage, YOLOv8 Layout & GPT-5 Context OCR
        </p>

        <div className="flex items-center gap-3 text-xs font-mono text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/5 pointer-events-none">
          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-400" /> Digital Triage</span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-purple-400" /> YOLOv8 Layout</span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-400" /> GPT-5 Context OCR</span>
        </div>
      </motion.div>
    </div>
  );
}
