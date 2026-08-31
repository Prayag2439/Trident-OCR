"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, BrainCircuit, Check } from "lucide-react";

interface ModelToggleProps {
  selectedModel: "gpt-5" | "gemini";
  onSelectModel: (model: "gpt-5" | "gemini") => void;
  disabled?: boolean;
}

export function ModelToggle({
  selectedModel,
  onSelectModel,
  disabled = false,
}: ModelToggleProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center p-1.5 rounded-2xl glass-panel border border-white/10 relative shadow-2xl">
        {/* GPT-5 Button */}
        <button
          type="button"
          onClick={() => onSelectModel("gpt-5")}
          disabled={disabled}
          className={`relative z-10 flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
            selectedModel === "gpt-5"
              ? "text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <BrainCircuit className={`w-4 h-4 ${selectedModel === "gpt-5" ? "text-emerald-400" : "text-gray-500"}`} />
          <span>GPT-5</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-normal border border-emerald-500/30">
            1.22% CER
          </span>
          {selectedModel === "gpt-5" && (
            <motion.div
              layoutId="activeModelIndicator"
              className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-400/40 rounded-xl -z-10 shadow-glow-emerald backdrop-blur-md"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        {/* Gemini 3 Button commented out as per request
        <button
          type="button"
          onClick={() => onSelectModel("gemini")}
          disabled={disabled}
          className={`relative z-10 flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
            selectedModel === "gemini"
              ? "text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${selectedModel === "gemini" ? "text-cyan-400" : "text-gray-500"}`} />
          <span>Gemini 3</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-normal border border-cyan-500/30">
            1.44% CER
          </span>
          {selectedModel === "gemini" && (
            <motion.div
              layoutId="activeModelIndicator"
              className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-cyan-400/40 rounded-xl -z-10 shadow-glow backdrop-blur-md"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
            />
          )}
        </button>
        */}
      </div>

      {/* Model Contextual Helper Info */}
      <motion.p
        key={selectedModel}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-gray-400 font-medium flex items-center gap-1.5"
      >
        {selectedModel === "gpt-5" ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-emerald-300">GPT-5 Active:</span> SOTA contextual inferencing for cursive & faded handwriting
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
            <span className="text-cyan-300">Gemini 3 Active:</span> Optimized for dense multilingual layouts & high-throughput batching
          </>
        )}
      </motion.p>
    </div>
  );
}
