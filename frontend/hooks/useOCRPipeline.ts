"use client";

import { useState, useRef } from "react";
import { ProcessResponse, ExtractedRegion } from "@/types/ocr";

export type PipelineStage = "idle" | "triage" | "layout" | "vlm" | "complete" | "error";

export function useOCRPipeline() {
  const [selectedModel, setSelectedModel] = useState<"gpt-5" | "gemini">("gpt-5");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [activeRegion, setActiveRegion] = useState<ExtractedRegion | null>(null);
  const stageTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    stageTimersRef.current.forEach((t) => clearTimeout(t));
    stageTimersRef.current = [];
  };

  const processFile = async (uploadedFile: File, modelOverride?: "gpt-5" | "gemini") => {
    clearTimers();
    const modelToUse = modelOverride || selectedModel;
    setFile(uploadedFile);
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveRegion(null);
    setStage("triage");

    // Local preview URL
    const objectUrl = URL.createObjectURL(uploadedFile);
    setPreviewUrl(objectUrl);

    // Dynamic stage progression animation during in-flight request
    stageTimersRef.current.push(
      setTimeout(() => {
        setStage("layout");
      }, 700)
    );

    stageTimersRef.current.push(
      setTimeout(() => {
        setStage("vlm");
      }, 1600)
    );

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("model_override", modelToUse);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${API_BASE}/api/v1/process-document`, {
        method: "POST",
        body: formData,
      });

      clearTimers();

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned error status ${response.status}`);
      }

      const data: ProcessResponse = await response.json();
      setResult(data);
      setStage("complete");
    } catch (err: any) {
      clearTimers();
      console.error("OCR Pipeline error:", err);
      setError(err.message || "Failed to process document");
      setStage("error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    clearTimers();
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setActiveRegion(null);
    setStage("idle");
    setError(null);
  };

  return {
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
  };
}
