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
  qty?: string;
  unit?: string;
  weightMT?: string;
}

export function parseSteelDescription(description: string): ParsedDimensions {
  if (!description?.trim()) return {};

  // Normalize: replace × (U+00D7) with x, collapse whitespace
  const raw = description.trim().replace(/×/g, "x").replace(/\s+/g, " ");
  const res: ParsedDimensions = {};

  // 1. Extract Quantity and Unit if present (e.g. "- 1 Pc", "-3pc", "2 Nos", "4 PCS", "1 SET")
  const qtyRegex = /(?:^|[\s,/-])(\d+(?:\.\d+)?)\s*(pcs?|pieces?|nos?|no\.?|units?|sets?)\b/i;
  const qm = qtyRegex.exec(raw);
  if (qm) {
    res.qty = qm[1];
    const u = qm[2].toLowerCase();
    if (u.startsWith("pc")) res.unit = "PCS";
    else if (u.startsWith("no")) res.unit = "NOS";
    else if (u.startsWith("set")) res.unit = "SET";
    else res.unit = "NOS";
  }

  // 2. Extract Explicit Weight if present (e.g. "- 0.640 MT", "0.640 MT", "1.2 TON", "640 KG")
  const wtRegex = /(?:^|[\s,/-]|wt\.?:?\s*)(\d+(?:\.\d+)?)\s*(mt|tons?|tonnes?|kgs?)\b/i;
  const wm = wtRegex.exec(raw);
  if (wm) {
    const val = parseFloat(wm[1]);
    const u = wm[2].toLowerCase();
    if (!isNaN(val) && val > 0) {
      if (u.startsWith("kg")) {
        res.weightMT = (val / 1000).toFixed(3);
      } else {
        res.weightMT = val.toFixed(3);
      }
    }
  }

  const N = "(\\d+(?:\\.\\d+)?)"; // integer or decimal
  const SEP = "\\s*[xX]\\s*";     // separator: x / X with optional spaces

  // ── PLATE ──────────────────────────────────────────────────────────────────
  if (/\b(?:(?:M\.?S\.?|CHK|CHEQUERED)\s*)?PL(?:ATE)?\b/i.test(raw)) {
    res.materialType = "PLATE";
    // Full 3 dims: PL {t} [mm] [thk] x {w} [mm] x {l} [mm|m]
    const r3 = new RegExp(
      "\\b(?:(?:M\\.?S\\.?|CHK|CHEQUERED)\\s*)?PL(?:ATE)?\\b\\s*" +
      N +
      "\\s*(?:mm\\s*thk|mm|thk)?\\.?\\s*" +
      SEP +
      N +
      "(?:\\s*mm)?\\s*" +
      SEP +
      N +
      "(?:\\s*(mm|m(?:tr)?s?))?",
      "i"
    );
    const m3 = r3.exec(raw);
    if (m3) {
      res.thicknessMm = m3[1];
      res.widthMm = m3[2];
      let l = m3[3];
      if (m3[4] && m3[4].toLowerCase().startsWith("m") && !m3[4].toLowerCase().startsWith("mm")) {
        l = String(parseFloat(l) * 1000);
      }
      res.lengthMm = l;
      return res;
    }

    // Two dims: PL {t} x {w}
    const r2 = new RegExp(
      "\\b(?:(?:M\\.?S\\.?|CHK|CHEQUERED)\\s*)?PL(?:ATE)?\\b\\s*" +
      N +
      "\\s*(?:mm\\s*thk|mm|thk)?\\.?\\s*" +
      SEP +
      N,
      "i"
    );
    const m2 = r2.exec(raw);
    if (m2) {
      res.thicknessMm = m2[1];
      res.widthMm = m2[2];
      return res;
    }

    // One dim: PL {t}
    const r1 = new RegExp(
      "\\b(?:(?:M\\.?S\\.?|CHK|CHEQUERED)\\s*)?PL(?:ATE)?\\b\\s*" +
      N,
      "i"
    );
    const m1 = r1.exec(raw);
    if (m1) {
      res.thicknessMm = m1[1];
      return res;
    }

    return res;
  }

  // ── NPB ────────────────────────────────────────────────────────────────────
  if (/\bNPB\b/i.test(raw)) {
    res.materialType = "NPB";
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
      res.heightMm = m3[1];
      res.widthMm = m3[2];
      res.lengthMm = lengthMm;
      return res;
    }
    const r2 = new RegExp(`\\bNPB\\b\\s*${N}${SEP}${N}`, "i");
    const m2 = r2.exec(raw);
    if (m2) {
      res.heightMm = m2[1];
      res.widthMm = m2[2];
      return res;
    }
    return res;
  }

  // ── ISA ────────────────────────────────────────────────────────────────────
  if (/\bISA\b/i.test(raw)) {
    res.materialType = "ISA";
    // ISA {A} x {B} x {t}
    const r3 = new RegExp(`\\bISA\\b\\s*${N}${SEP}${N}${SEP}${N}`, "i");
    const m3 = r3.exec(raw);
    if (m3) {
      res.heightMm = m3[1];
      res.widthMm = m3[2];
      res.thicknessMm = m3[3];
      return res;
    }

    // ISA {A} x {t}  (shorthand equal angle)
    const r2 = new RegExp(`\\bISA\\b\\s*${N}${SEP}${N}`, "i");
    const m2 = r2.exec(raw);
    if (m2) {
      res.heightMm = m2[1];
      res.thicknessMm = m2[2];
      return res;
    }

    const r1 = new RegExp(`\\bISA\\b\\s*${N}`, "i");
    const m1 = r1.exec(raw);
    if (m1) {
      res.heightMm = m1[1];
      return res;
    }
    return res;
  }

  // ── ISMB ──────────────────────────────────────────────────────────────────
  if (/\bISMB\b/i.test(raw)) {
    res.materialType = "ISMB";
    const r3 = new RegExp(`\\bISMB\\b\\s*${N}${SEP}${N}`, "i");
    const m3 = r3.exec(raw);
    if (m3) {
      res.heightMm = m3[1];
      res.lengthMm = m3[2];
      return res;
    }
    const m = new RegExp(`\\bISMB\\b\\s*${N}`, "i").exec(raw);
    if (m) res.heightMm = m[1];
    return res;
  }

  // ── ISMC ──────────────────────────────────────────────────────────────────
  if (/\bISMC\b/i.test(raw)) {
    res.materialType = "ISMC";
    const r3 = new RegExp(`\\bISMC\\b\\s*${N}${SEP}${N}`, "i");
    const m3 = r3.exec(raw);
    if (m3) {
      res.heightMm = m3[1];
      res.lengthMm = m3[2];
      return res;
    }
    const m = new RegExp(`\\bISMC\\b\\s*${N}`, "i").exec(raw);
    if (m) res.heightMm = m[1];
    return res;
  }

  return res;
}

// Standard unit weights (kg/m) for common structural steel sections
export const NPB_WEIGHTS: Record<number, number> = {
  100: 12.2,
  125: 13.5,
  150: 14.0,
  180: 18.8,
  200: 25.1,
  250: 37.3,
  300: 44.0,
  350: 49.8,
  400: 57.0,
  450: 67.2,
  500: 79.4,
  600: 103.0,
};

export const ISMB_WEIGHTS: Record<number, number> = {
  100: 8.9,
  125: 13.3,
  150: 15.0,
  175: 19.6,
  200: 25.4,
  225: 31.1,
  250: 37.3,
  300: 44.2,
  350: 52.4,
  400: 61.6,
  450: 72.4,
  500: 86.9,
  550: 103.7,
  600: 122.6,
};

export const ISMC_WEIGHTS: Record<number, number> = {
  75: 7.14,
  100: 9.56,
  125: 13.1,
  150: 16.8,
  175: 19.6,
  200: 22.3,
  225: 26.3,
  250: 30.6,
  300: 36.3,
  350: 42.1,
  400: 50.1,
};

/**
 * Calculates theoretical steel weight in Metric Tons (MT) based on dimensions and quantity.
 * Density of structural steel is standard 7.85 g/cm³ (7850 kg/m³).
 */
export function calculateTheoreticalWeightMT(item: {
  materialType?: string;
  thicknessMm?: string;
  widthMm?: string;
  heightMm?: string;
  lengthMm?: string;
  qty?: string | number;
}): string | null {
  const type = (item.materialType || "").toUpperCase().trim();
  const t = parseFloat(item.thicknessMm || "0");
  const w = parseFloat(item.widthMm || "0");
  const h = parseFloat(item.heightMm || "0");
  const l = parseFloat(item.lengthMm || "0");
  const q = parseFloat(String(item.qty || "1")) || 1;

  if (type === "PLATE" || type === "PL") {
    // Plate: Weight in MT = (Thickness mm * Width mm * Length mm * 7.85 * Qty) / 10^9
    if (t > 0 && w > 0 && l > 0) {
      const weightMT = (t * w * l * 7.85 * q) / 1e9;
      return weightMT.toFixed(3);
    }
  } else if (type === "ISA") {
    // Equal/Unequal Angle: Weight (kg/m) ≈ (A + B - t) * t * 0.00785
    const a = h > 0 ? h : (w > 0 ? w : 0);
    const b = w > 0 ? w : a;
    if (a > 0 && t > 0 && l > 0) {
      const kgPerM = (a + b - t) * t * 0.00785;
      const weightMT = (kgPerM * (l / 1000) * q) / 1000;
      return weightMT.toFixed(3);
    }
  } else if (type === "NPB") {
    const depth = Math.round(h);
    const kgPerM = NPB_WEIGHTS[depth] || (depth > 0 ? depth * 0.142 : 0);
    if (kgPerM > 0 && l > 0) {
      const weightMT = (kgPerM * (l / 1000) * q) / 1000;
      return weightMT.toFixed(3);
    }
  } else if (type === "ISMB") {
    const depth = Math.round(h);
    const kgPerM = ISMB_WEIGHTS[depth] || (depth > 0 ? depth * 0.15 : 0);
    if (kgPerM > 0 && l > 0) {
      const weightMT = (kgPerM * (l / 1000) * q) / 1000;
      return weightMT.toFixed(3);
    }
  } else if (type === "ISMC") {
    const depth = Math.round(h);
    const kgPerM = ISMC_WEIGHTS[depth] || (depth > 0 ? depth * 0.105 : 0);
    if (kgPerM > 0 && l > 0) {
      const weightMT = (kgPerM * (l / 1000) * q) / 1000;
      return weightMT.toFixed(3);
    }
  } else if (t > 0 && w > 0 && l > 0) {
    // Fallback: general rectangular volumetric steel weight
    const weightMT = (t * w * l * 7.85 * q) / 1e9;
    return weightMT.toFixed(3);
  }

  return null;
}

/**
 * camelCase variant — merges parsed dimensions into a ChallanItem-shaped object.
 * Auto-fills dimensions, qty, unit, and weight from description if empty or default.
 */
export function applyParsedDimensions<
  T extends {
    materialType?: string;
    thicknessMm?: string;
    widthMm?: string;
    heightMm?: string;
    lengthMm?: string;
    description: string;
    weightMT?: string;
    qty?: string;
    unit?: string;
  }
>(item: T): T {
  const p = parseSteelDescription(item.description);
  const materialType = item.materialType || p.materialType || "";
  const thicknessMm = item.thicknessMm || p.thicknessMm || "";
  const widthMm = item.widthMm || p.widthMm || "";
  const heightMm = item.heightMm || p.heightMm || "";
  const lengthMm = item.lengthMm || p.lengthMm || "";
  const qty = (!item.qty || item.qty === "1" || item.qty === "0" || item.qty === "") && p.qty ? p.qty : (item.qty || "1");
  const unit = (!item.unit || item.unit === "NOS" || item.unit === "") && p.unit ? p.unit : (item.unit || "NOS");

  let weightMT = item.weightMT;
  if (p.weightMT && (!weightMT || weightMT === "0.000" || weightMT === "0" || weightMT.trim() === "")) {
    weightMT = p.weightMT;
  }
  if (!weightMT || weightMT === "0.000" || weightMT === "0" || weightMT.trim() === "") {
    const calc = calculateTheoreticalWeightMT({
      materialType,
      thicknessMm,
      widthMm,
      heightMm,
      lengthMm,
      qty,
    });
    if (calc) weightMT = calc;
  }

  return {
    ...item,
    materialType,
    thicknessMm,
    widthMm,
    heightMm,
    lengthMm,
    qty,
    unit,
    weightMT: weightMT ?? item.weightMT,
  };
}

/**
 * snake_case variant — merges parsed dimensions into a CanvasChallanItem-shaped object.
 * Auto-fills dimensions, quantity, unit, and weight from description if empty or default.
 */
export function applyParsedDimensionsCanvas<
  T extends {
    material_type?: string;
    thickness_mm?: string;
    width_mm?: string;
    height_mm?: string;
    length_mm?: string;
    description: string;
    weight_mt?: string;
    quantity?: string;
    unit?: string;
  }
>(item: T): T {
  const p = parseSteelDescription(item.description);
  const material_type = item.material_type || p.materialType || "";
  const thickness_mm = item.thickness_mm || p.thicknessMm || "";
  const width_mm = item.width_mm || p.widthMm || "";
  const height_mm = item.height_mm || p.heightMm || "";
  const length_mm = item.length_mm || p.lengthMm || "";
  const quantity = (!item.quantity || item.quantity === "1" || item.quantity === "0" || item.quantity === "") && p.qty ? p.qty : (item.quantity || "1");
  const unit = (!item.unit || item.unit === "NOS" || item.unit === "") && p.unit ? p.unit : (item.unit || "NOS");

  let weight_mt = item.weight_mt;
  if (p.weightMT && (!weight_mt || weight_mt === "0.000" || weight_mt === "0" || weight_mt.trim() === "")) {
    weight_mt = p.weightMT;
  }
  if (!weight_mt || weight_mt === "0.000" || weight_mt === "0" || weight_mt.trim() === "") {
    const calc = calculateTheoreticalWeightMT({
      materialType: material_type,
      thicknessMm: thickness_mm,
      widthMm: width_mm,
      heightMm: height_mm,
      lengthMm: length_mm,
      qty: quantity,
    });
    if (calc) weight_mt = calc;
  }

  return {
    ...item,
    material_type,
    thickness_mm,
    width_mm,
    height_mm,
    length_mm,
    quantity,
    unit,
    weight_mt: weight_mt ?? item.weight_mt,
  };
}
