/**
 * steelParser.ts — Client-side parser for steel material descriptions.
 *
 * Extracts materialType, thicknessMm, widthMm, heightMm, lengthMm from
 * common shorthand patterns found on Trident challans:
 *
 *   PL  – "PL 8 thk x 1250 x 6300"  → PLATE, t=8, w=1250, l=6300
 *          "PL 10mm x 2000 x 6300"   → PLATE, t=10, w=2000, l=6300
 *   NPB – "NPB 350 x 170 x 12 m"    → NPB, h=350, w=170, l=12000
 *          "NPB 350 x 170 x 7000 LG" → NPB, h=350, w=170, l=7000
 *   ISA – "ISA 75 x 75 x 6"         → ISA, h=75, w=75, t=6
 *          "ISA 75 x 6"              → ISA, h=75, t=6 (shorthand)
 *   ISMB – "ISMB 250"               → ISMB, h=250
 *   ISMC – "ISMC 150"               → ISMC, h=150
 */

export interface ParsedDimensions {
  materialType?: string;
  thicknessMm?: string;
  widthMm?: string;
  heightMm?: string;
  lengthMm?: string;
}

export function parseSteelDescription(description: string): ParsedDimensions {
  if (!description?.trim()) return {};

  // Normalize: replace × (U+00D7) with x, collapse whitespace
  const raw = description.trim().replace(/×/g, "x").replace(/\s+/g, " ");

  const N = "(\\d+(?:\\.\\d+)?)"; // integer or decimal
  const SEP = "\\s*[xX]\\s*";     // separator: x / X with optional spaces

  // ── PLATE ──────────────────────────────────────────────────────────────────
  if (/\bPL\b/i.test(raw) || /\bPLATE\b/i.test(raw)) {
    // Full: PL {t} [mm] [thk] x {w} x {l}
    const r3 = new RegExp(
      `\\bPL(?:ATE)?\\b\\s*${N}\\s*(?:mm)?\\s*(?:thk)?${SEP}${N}${SEP}${N}`,
      "i"
    );
    const m3 = r3.exec(raw);
    if (m3) return { materialType: "PLATE", thicknessMm: m3[1], widthMm: m3[2], lengthMm: m3[3] };

    // Two dims: PL {t} x {w}
    const r2 = new RegExp(
      `\\bPL(?:ATE)?\\b\\s*${N}\\s*(?:mm)?\\s*(?:thk)?${SEP}${N}`,
      "i"
    );
    const m2 = r2.exec(raw);
    if (m2) return { materialType: "PLATE", thicknessMm: m2[1], widthMm: m2[2] };

    // One dim: PL {t}
    const r1 = new RegExp(`\\bPL(?:ATE)?\\b\\s*${N}`, "i");
    const m1 = r1.exec(raw);
    if (m1) return { materialType: "PLATE", thicknessMm: m1[1] };

    return { materialType: "PLATE" };
  }

  // ── NPB ────────────────────────────────────────────────────────────────────
  if (/\bNPB\b/i.test(raw)) {
    // NPB {depth} x {width} x {length} [m|mm|LG]
    const r3 = new RegExp(
      `\\bNPB\\b\\s*${N}${SEP}${N}${SEP}${N}\\s*(m(?:m)?|lg[t]?)?`,
      "i"
    );
    const m3 = r3.exec(raw);
    if (m3) {
      const unit = (m3[4] || "").toLowerCase();
      let lengthMm = m3[3];
      // If unit is bare "m" (metres), or value < 100 and not explicitly mm/lg, convert
      if (unit === "m" || (!unit.startsWith("mm") && !unit.startsWith("lg") && parseFloat(m3[3]) < 100)) {
        lengthMm = String(Math.round(parseFloat(m3[3]) * 1000));
      }
      return { materialType: "NPB", heightMm: m3[1], widthMm: m3[2], lengthMm };
    }
    const r2 = new RegExp(`\\bNPB\\b\\s*${N}${SEP}${N}`, "i");
    const m2 = r2.exec(raw);
    if (m2) return { materialType: "NPB", heightMm: m2[1], widthMm: m2[2] };
    return { materialType: "NPB" };
  }

  // ── ISA ────────────────────────────────────────────────────────────────────
  if (/\bISA\b/i.test(raw)) {
    // ISA {A} x {B} x {t}
    const r3 = new RegExp(`\\bISA\\b\\s*${N}${SEP}${N}${SEP}${N}`, "i");
    const m3 = r3.exec(raw);
    if (m3) return { materialType: "ISA", heightMm: m3[1], widthMm: m3[2], thicknessMm: m3[3] };

    // ISA {A} x {t}  (shorthand equal angle)
    const r2 = new RegExp(`\\bISA\\b\\s*${N}${SEP}${N}`, "i");
    const m2 = r2.exec(raw);
    if (m2) return { materialType: "ISA", heightMm: m2[1], thicknessMm: m2[2] };

    const r1 = new RegExp(`\\bISA\\b\\s*${N}`, "i");
    const m1 = r1.exec(raw);
    if (m1) return { materialType: "ISA", heightMm: m1[1] };
    return { materialType: "ISA" };
  }

  // ── ISMB ──────────────────────────────────────────────────────────────────
  if (/\bISMB\b/i.test(raw)) {
    const m = new RegExp(`\\bISMB\\b\\s*${N}`, "i").exec(raw);
    return { materialType: "ISMB", ...(m ? { heightMm: m[1] } : {}) };
  }

  // ── ISMC ──────────────────────────────────────────────────────────────────
  if (/\bISMC\b/i.test(raw)) {
    const m = new RegExp(`\\bISMC\\b\\s*${N}`, "i").exec(raw);
    return { materialType: "ISMC", ...(m ? { heightMm: m[1] } : {}) };
  }

  return {};
}

/**
 * camelCase variant — merges parsed dimensions into a ChallanItem-shaped object.
 * Only fills fields that are currently empty.
 */
export function applyParsedDimensions<
  T extends {
    materialType?: string;
    thicknessMm?: string;
    widthMm?: string;
    heightMm?: string;
    lengthMm?: string;
    description: string;
  }
>(item: T): T {
  const p = parseSteelDescription(item.description);
  return {
    ...item,
    materialType: item.materialType || p.materialType || "",
    thicknessMm: item.thicknessMm || p.thicknessMm || "",
    widthMm: item.widthMm || p.widthMm || "",
    heightMm: item.heightMm || p.heightMm || "",
    lengthMm: item.lengthMm || p.lengthMm || "",
  };
}

/**
 * snake_case variant — merges parsed dimensions into a CanvasChallanItem-shaped object.
 * Only fills fields that are currently empty.
 */
export function applyParsedDimensionsCanvas<
  T extends {
    material_type?: string;
    thickness_mm?: string;
    width_mm?: string;
    height_mm?: string;
    length_mm?: string;
    description: string;
  }
>(item: T): T {
  const p = parseSteelDescription(item.description);
  return {
    ...item,
    material_type: item.material_type || p.materialType || "",
    thickness_mm: item.thickness_mm || p.thicknessMm || "",
    width_mm: item.width_mm || p.widthMm || "",
    height_mm: item.height_mm || p.heightMm || "",
    length_mm: item.length_mm || p.lengthMm || "",
  };
}
