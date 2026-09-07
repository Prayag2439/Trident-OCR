"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Bot, User, ChevronDown, ChevronUp } from "lucide-react";

import { ChallanData } from "@/types/ocr";
import { getApiBaseUrl } from "@/utils/api";


// ── Voice Activity Detection (VAD) config ─────────────────────────────────────
// RMS amplitude (0–1) below which audio is considered silence
const SILENCE_THRESHOLD = 0.018;
// Minimum ms of continuous silence before auto-stopping
const SILENCE_DURATION_MS = 1600;
// Wait this many ms after recording starts before VAD can trigger auto-stop
// (prevents instantly stopping before the user has begun speaking)
const VAD_GRACE_PERIOD_MS = 800;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

type RecordingState = "idle" | "listening" | "processing";

function getMicButtonColorClass(state: RecordingState): string {
  if (state === "listening") return "bg-red-600 hover:bg-red-700 shadow-red-900/60";
  if (state === "processing") return "bg-indigo-800 opacity-60 cursor-not-allowed";
  return "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50 hover:scale-105 active:scale-95 border-indigo-400/30";
}

function renderMicIcon(state: RecordingState) {
  if (state === "processing") return <Loader2 className="w-6 h-6 animate-spin text-white" />;
  if (state === "listening") return <MicOff className="w-6 h-6 text-white" />;
  return <Mic className="w-6 h-6 text-white" />;
}

export interface VoiceAssistantPanelProps {
  currentData: ChallanData;
  onApplyUpdates: (updates: Partial<ChallanData>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceAssistantPanel({ currentData, onApplyUpdates }: Readonly<VoiceAssistantPanelProps>) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: 'Hello! I\'ll fill the challan form as you speak. Tap the mic to begin.',
    },
  ]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isListeningRef = useRef(false);
  const hasSpeechRef = useRef(false);          // true once the user has actually spoken
  const silenceStartRef = useRef<number | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // pendingContextRef holds partial transcript for multi-segment values (e.g. incomplete GSTIN)
  const pendingContextRef = useRef<string>("");

  // Use a ref for processAudioBlob so startRecording can call it without circular useCallback dep
  const processAudioBlobRef = useRef<(blob: Blob, context: string) => Promise<void>>();

  // ── Helpers ────────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${role}`, role, text },
    ]);
  }, []);

  // Stop the WebAudio VAD loop and close the AudioContext
  const stopVAD = useCallback(() => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    silenceStartRef.current = null;
    hasSpeechRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Stop the MediaRecorder (triggers onstop → processAudioBlob)
  const stopRecording = useCallback(() => {
    isListeningRef.current = false;
    stopVAD();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, [stopVAD]);

  // ── processAudioBlob ───────────────────────────────────────────────────────

  const processAudioBlob = useCallback(
    async (blob: Blob, continueFromContext: string) => {
      setRecordingState("processing");

      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        formData.append("challan_state", JSON.stringify(currentData));
        if (continueFromContext) {
          formData.append("partial_context", continueFromContext);
        }

        const backendUrl = getApiBaseUrl();
        const res = await fetch(`${backendUrl}/api/v1/assistant/voice`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Unknown error" }));
          addMessage("assistant", `⚠️ ${err.detail || "Voice processing failed."}`);
          pendingContextRef.current = "";
          return;
        }

        const result = await res.json();

        // Build combined transcript display
        const combined = continueFromContext
          ? `${continueFromContext} ${result.transcript || ""}`.trim()
          : (result.transcript || "").trim();

        if (combined) addMessage("user", combined);

        // Backend signals to keep listening (e.g. incomplete GSTIN)
        if (result.continueListening) {
          pendingContextRef.current = combined;
          addMessage("assistant", result.clarification || "I need a bit more — please continue speaking…");
          setRecordingState("idle");
          // Small delay so the user can see the prompt, then auto-restart
          setTimeout(() => {
            startRecordingWithContext(pendingContextRef.current);
          }, 600);
          return;
        }

        // Value is complete — clear any accumulated context
        pendingContextRef.current = "";

        if (result.clarification) {
          addMessage("assistant", result.clarification);
          return;
        }

        if (result.updates && Object.keys(result.updates).length > 0) {
          onApplyUpdates(result.updates);
          const changedFields = Object.keys(result.updates).filter((k) => k !== "items");
          const hasItems = result.updates.items !== undefined;
          const parts: string[] = [];
          if (changedFields.length) parts.push(`Updated: ${changedFields.join(", ")}`);
          if (hasItems) parts.push("Items updated");
          addMessage("assistant", `✓ ${parts.join(". ")}. You can keep speaking.`);
        } else {
          addMessage("assistant", "I didn't find any challan fields in that. Could you rephrase?");
        }
      } catch {
        const backendUrl = getApiBaseUrl();
        addMessage("assistant", `⚠️ Could not reach server at ${backendUrl}. Please check network connection.`);
        pendingContextRef.current = "";
      } finally {
        setRecordingState("idle");
      }
    },
    [currentData, onApplyUpdates, addMessage]
  );

  // Keep ref in sync so startRecording can call it without circular deps
  useEffect(() => {
    processAudioBlobRef.current = processAudioBlob;
  }, [processAudioBlob]);

  // ── VAD — Voice Activity Detection ────────────────────────────────────────

  const startVAD = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      audioContextRef.current = audioCtx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!isListeningRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        // Compute RMS normalised to 0–1
        const rms = Math.sqrt(
          dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
        ) / 255;

        const now = Date.now();
        const gracePeriodPassed = now - recordingStartRef.current > VAD_GRACE_PERIOD_MS;

        if (rms > SILENCE_THRESHOLD) {
          // Voice detected — reset silence timer and mark that the user has spoken
          hasSpeechRef.current = true;
          silenceStartRef.current = null;
          setIsSpeaking(true);
        } else {
          setIsSpeaking(false);
          if (hasSpeechRef.current && gracePeriodPassed) {
            // Silence after speech — start counting
            if (silenceStartRef.current === null) {
              silenceStartRef.current = now;
            } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
              // Sustained silence — auto-stop
              stopRecording();
              return;
            }
          }
        }

        vadRafRef.current = requestAnimationFrame(tick);
      };

      vadRafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      // VAD unavailable (e.g. AudioContext blocked) — user must tap manually
      console.warn("[VAD] Web Audio API unavailable:", e);
    }
  }, [stopRecording]);

  // ── startRecordingWithContext ───────────────────────────────────────────────

  const startRecordingWithContext = useCallback(async (context: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      isListeningRef.current = true;
      hasSpeechRef.current = false;
      silenceStartRef.current = null;
      recordingStartRef.current = Date.now();
      let mimeType = "audio/mp4";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size > 1200) {
          // Automatically process — no manual confirmation needed
          processAudioBlobRef.current?.(blob, context);
        } else {
          setRecordingState("idle");
          if (!context) {
            addMessage("assistant", "I didn't catch any audio. Please try again.");
          }
        }
      };

      recorder.start();
      setRecordingState("listening");
      startVAD(stream);
    } catch {
      addMessage("assistant", "⚠️ Microphone access denied. Please allow microphone permissions.");
      setRecordingState("idle");
    }
  }, [startVAD, addMessage]);

  const handleMicClick = useCallback(() => {
    setHasInteracted(true);
    if (recordingState === "idle") {
      // Start fresh (pendingContext may be set if continuing a structured value)
      startRecordingWithContext(pendingContextRef.current);
    } else if (recordingState === "listening") {
      // Manual stop — user is done speaking
      stopRecording();
    }
  }, [recordingState, startRecordingWithContext, stopRecording]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      stopVAD();
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
      }
    };
  }, [stopVAD]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Left Sidebar: Chat Interface (Active only after interaction starts) ── */}
      {hasInteracted && (
        <div
          className={`flex-shrink-0 w-full md:w-80 flex flex-col bg-[#07080b] text-white border-b md:border-b-0 md:border-r border-white/10 shadow-2xl z-40 relative transition-all duration-300 ${
            isMobileExpanded ? "h-64 md:h-full" : "h-11 md:h-full"
          }`}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Voice Assistant</span>
            
            {/* Mobile collapsible toggle */}
            <button
              type="button"
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="md:hidden flex items-center gap-1 text-[11px] text-indigo-400 bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 ml-auto"
            >
              <span>{isMobileExpanded ? "Hide transcript" : "Show transcript"}</span>
              {isMobileExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            <span className="ml-auto hidden md:flex items-center gap-2">
              <span className="text-[10px] text-white/25 font-mono">GPT-5 + Whisper</span>
            </span>
          </div>

          {/* Message history — scrollable on desktop, and only shown on mobile when expanded */}
          <div
            className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 pb-32 ${
              isMobileExpanded ? "block" : "hidden md:block"
            }`}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5
                    ${msg.role === "assistant" ? "bg-indigo-600" : "bg-gray-700"}`}
                >
                  {msg.role === "assistant"
                    ? <Bot className="w-3.5 h-3.5 text-white" />
                    : <User className="w-3.5 h-3.5 text-white" />}
                </div>
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed
                    ${msg.role === "assistant"
                      ? "bg-white/[0.07] text-white/80 border border-white/10"
                      : "bg-indigo-600/30 text-white border border-indigo-500/30"
                    }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}


      {/* ── Fixed Bottom-Center Mic Overlay ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        
        {/* Status text */}
        <div className="h-5 flex items-center justify-center bg-black/40 backdrop-blur-md px-3 rounded-full text-shadow-sm border border-white/10 pointer-events-auto">
          {recordingState === "idle" && !pendingContextRef.current && (
            <span className="text-[11px] text-white/70 font-medium">Tap to speak</span>
          )}
          {recordingState === "idle" && pendingContextRef.current && (
            <span className="text-[11px] text-amber-300 font-medium">Tap to continue…</span>
          )}
          {recordingState === "listening" && (
            <span className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Listening… tap to stop</span>
            </span>
          )}
          {recordingState === "processing" && (
            <span className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processing…</span>
            </span>
          )}
        </div>

        {/* Mic button */}
        <button
          type="button"
          onClick={handleMicClick}
          disabled={recordingState === "processing"}
          aria-label={recordingState === "listening" ? "Stop recording" : "Start recording"}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center pointer-events-auto
            transition-all duration-300 shadow-xl focus:outline-none border-2 border-transparent
            ${getMicButtonColorClass(recordingState)}
            ${isSpeaking && recordingState === "listening" ? "scale-110 shadow-[0_0_30px_rgba(239,68,68,0.8)] border-red-400/50" : ""}
          `}
        >
          {renderMicIcon(recordingState)}

          {/* Animated pulse rings while listening */}
          {recordingState === "listening" && (
            <>
              <span className={`absolute inset-0 rounded-full bg-red-500 transition-opacity duration-300 ${isSpeaking ? 'opacity-40 animate-ping' : 'opacity-20 animate-ping'}`} style={{ animationDuration: isSpeaking ? '1s' : '2s' }} />
              <span
                className={`absolute rounded-full border border-red-500 transition-all duration-300 ${isSpeaking ? 'opacity-50 animate-ping' : 'opacity-25 animate-ping'}`}
                style={{ inset: "-12px", animationDelay: "0.3s", animationDuration: isSpeaking ? '1s' : '2s' }}
              />
            </>
          )}
        </button>
      </div>
    </>
  );
}
