"use client";

import { motion } from "framer-motion";
import { ExtractedRegion } from "@/types/ocr";

interface RegionCanvasProps {
  regions: ExtractedRegion[];
  activeRegion: ExtractedRegion | null;
  onSelectRegion: (region: ExtractedRegion | null) => void;
  naturalWidth: number;
  naturalHeight: number;
}

export function RegionCanvas({
  regions,
  activeRegion,
  onSelectRegion,
  naturalWidth,
  naturalHeight,
}: RegionCanvasProps) {
  if (!naturalWidth || !naturalHeight) return null;

  // Helper to determine border/highlight color based on exact 3 sections
  const getSectionColor = (cls: string) => {
    const lower = cls.toLowerCase();
    if (lower.includes("company") || lower.includes("header") || lower.includes("metadata")) {
      return "#EAB308"; // Yellow (Company Name)
    }
    if (lower === "extra fields 2" || lower.includes("extra 2") || lower.includes("fields 2")) {
      return "#10B981"; // Emerald (Extra Fields 2: Quantity & Weights)
    }
    if (lower.includes("extra") || lower.includes("table")) {
      return "#3B82F6"; // Blue (Extra Fields: Additional Info)
    }
    return "#00F0FF"; // Cyan default
  };

  return (
    <svg
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="lens-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Render the 3 document sections */}
      {regions.map((region) => {
        const [x0, y0, x1, y1] = region.bbox;
        const w = Math.max(16, x1 - x0);
        const h = Math.max(16, y1 - y0);
        const isActive = activeRegion?.region_id === region.region_id;
        const themeColor = getSectionColor(region.class);

        return (
          <g
            key={region.region_id}
            className="cursor-pointer transition-all"
            onMouseEnter={() => onSelectRegion(region)}
            onClick={() => onSelectRegion(region)}
          >
            {/* Section Boundary Box */}
            <rect
              x={x0}
              y={y0}
              width={w}
              height={h}
              fill={isActive ? `${themeColor}22` : `${themeColor}06`}
              stroke={isActive ? themeColor : `${themeColor}85`}
              strokeWidth={isActive ? "3.5" : "2"}
              strokeDasharray={isActive ? "none" : "6 4"}
              rx="4"
              className="hover:stroke-brand-cyan hover:fill-brand-cyan/15 transition-all"
            />

            {/* Section Tag Badge in SVG */}
            <g transform={`translate(${x0 + 8}, ${y0 + 16})`}>
              <rect
                x="0"
                y="-12"
                width={region.class.length * 8.5 + 28}
                height="17"
                rx="4"
                fill="#0F111A"
                stroke={themeColor}
                strokeWidth="1.2"
              />
              <text
                x="6"
                y="0"
                fill={themeColor}
                fontSize="10"
                fontWeight="800"
                fontFamily="monospace"
              >
                #{region.reading_order_index} {region.class.toUpperCase()}
              </text>
            </g>
          </g>
        );
      })}

      {/* Google Lens Style Blue Selection Highlighter with Circular Pins */}
      {activeRegion && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {(() => {
            const [x0, y0, x1, y1] = activeRegion.bbox;
            const w = Math.max(20, x1 - x0);
            const h = Math.max(20, y1 - y0);
            const themeColor = getSectionColor(activeRegion.class);

            return (
              <>
                {/* Vibrant Highlighter Fill */}
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  fill="#3B82F6"
                  fillOpacity="0.25"
                  stroke={themeColor}
                  strokeWidth="3"
                  rx="6"
                  filter="url(#lens-glow)"
                />

                {/* Selection Start Pin */}
                <g transform={`translate(${x0}, ${y0})`}>
                  <circle cx="0" cy="0" r="6" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                </g>

                {/* Selection End Pin */}
                <g transform={`translate(${x1}, ${y1})`}>
                  <circle cx="0" cy="0" r="6" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                </g>
              </>
            );
          })()}
        </motion.g>
      )}
    </svg>
  );
}
