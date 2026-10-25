/**
 * Chấm độ hợp giữa MỘT CV và MỘT tin tuyển dụng. Toàn hàm thuần (không gọi DB, không gọi Ollama)
 * nên dễ thử và dễ giải thích.
 *
 * Điểm gồm 3 phần:
 *  - cosine: CV và tin "nói về cùng một thứ" đến đâu (vector của bge-m3), 0..1
 *  - skill:  tin cần bao nhiêu kỹ năng thì CV có bấy nhiêu (tỉ lệ), 0..1
 *  - level:  CV thấp hơn cấp của tin thì trừ điểm; hơn nhiều cấp cũng trừ nhẹ
 *
 * Lưu ý: bảng job_skills không phân biệt kỹ năng "bắt buộc" và "ưu tiên", nên ở đây coi mọi kỹ năng
 * của tin như nhau. Đây là chỗ khác với luật tạo nhãn trong gen_data.py (có tách bắt buộc/ưu tiên).
 */
export type MatchLabel = "suitable" | "review" | "unsuitable";
export type MatchLevel = "intern" | "junior" | "middle" | "senior";

export const LEVEL_INDEX: Record<MatchLevel, number> = { intern: 0, junior: 1, middle: 2, senior: 3 };

export interface MatchWeights {
  cosine: number;
  skill: number;
  /** Trừ cho mỗi cấp CV thấp hơn tin. */
  levelBelow: number;
  /** Trừ cho mỗi cấp CV cao hơn tin, tính từ cấp thứ 2 trở lên (hơn 1 cấp là bình thường). */
  levelAbove: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = { cosine: 0.5, skill: 0.5, levelBelow: 0.15, levelAbove: 0.05 };

export interface MatchInput {
  cvVector: number[];
  jobVector: number[];
  cvSkills: string[];
  jobSkills: string[];
  cvLevel: MatchLevel | null;
  jobLevel: MatchLevel | null;
}

export interface MatchParts {
  cosine: number;
  skill: number;
  levelGap: number | null;
  levelPenalty: number;
  matched: string[];
  missing: string[];
}

export interface MatchScore {
  score: number;
  parts: MatchParts;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Hai vector khác số chiều: ${a.length} và ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Số cấp tin cao hơn CV: dương = CV thấp hơn tin; âm = CV cao hơn tin; null = không rõ. */
export function levelGap(jobLevel: MatchLevel | null, cvLevel: MatchLevel | null): number | null {
  if (!jobLevel || !cvLevel) return null;
  return LEVEL_INDEX[jobLevel] - LEVEL_INDEX[cvLevel];
}

export function skillCoverage(cvSkills: string[], jobSkills: string[]) {
  const cv = new Set(cvSkills.map((s) => s.toLowerCase()));
  const matched = jobSkills.filter((s) => cv.has(s.toLowerCase()));
  const missing = jobSkills.filter((s) => !cv.has(s.toLowerCase()));
  return { matched, missing, ratio: jobSkills.length === 0 ? 0 : matched.length / jobSkills.length };
}

/** Ghép các phần đã tính sẵn (cosine có thể tính từ SQL) thành điểm cuối. */
export function scoreFromParts(
  cos: number,
  cvSkills: string[],
  jobSkills: string[],
  cvLevel: MatchLevel | null,
  jobLevel: MatchLevel | null,
  w: MatchWeights = DEFAULT_WEIGHTS,
): MatchScore {
  const cosPos = Math.max(0, cos);
  const cover = skillCoverage(cvSkills, jobSkills);
  const gap = levelGap(jobLevel, cvLevel);

  let penalty = 0;
  if (gap !== null) {
    if (gap > 0) penalty = gap * w.levelBelow;
    else if (gap < -1) penalty = (-gap - 1) * w.levelAbove;
  }

  const raw = w.cosine * cosPos + w.skill * cover.ratio - penalty;
  return {
    score: Math.max(0, Math.min(1, raw)),
    parts: {
      cosine: cosPos,
      skill: cover.ratio,
      levelGap: gap,
      levelPenalty: penalty,
      matched: cover.matched,
      missing: cover.missing,
    },
  };
}

export function scoreMatch(input: MatchInput, w: MatchWeights = DEFAULT_WEIGHTS): MatchScore {
  return scoreFromParts(
    cosine(input.cvVector, input.jobVector),
    input.cvSkills,
    input.jobSkills,
    input.cvLevel,
    input.jobLevel,
    w,
  );
}

export interface Thresholds {
  /** score >= suitable -> suitable */
  suitable: number;
  /** review <= score < suitable -> review; score < review -> unsuitable */
  review: number;
}

/**
 * Ngưỡng mặc định, dò trên tập tune (cách "combined", trọng số mặc định, bge-m3).
 * Điểm này phụ thuộc bộ dữ liệu mẫu; với CV thật hãy coi nhãn chỉ là gợi ý và xếp hạng theo điểm.
 */
export const DEFAULT_THRESHOLDS: Thresholds = { review: 0.535, suitable: 0.736 };

export function classify(score: number, t: Thresholds): MatchLabel {
  if (score >= t.suitable) return "suitable";
  if (score >= t.review) return "review";
  return "unsuitable";
}

/** Chuyển chuỗi "[0.1,0.2,...]" của pgvector (khi SELECT embedding::text) thành mảng số. */
export function parseVectorLiteral(text: string): number[] {
  return text
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(Number);
}

// ---------------------------------------------------------------------------
// Đo độ khớp giữa nhãn máy và nhãn người
// ---------------------------------------------------------------------------

export const LABELS: MatchLabel[] = ["suitable", "review", "unsuitable"];

export function confusion(truth: MatchLabel[], pred: MatchLabel[]): number[][] {
  const m = LABELS.map(() => LABELS.map(() => 0));
  truth.forEach((t, i) => m[LABELS.indexOf(t)][LABELS.indexOf(pred[i])]++);
  return m;
}

export function accuracy(truth: MatchLabel[], pred: MatchLabel[]): number {
  return truth.length === 0 ? 0 : truth.filter((t, i) => t === pred[i]).length / truth.length;
}

/** Gộp "suitable" + "review" thành "đáng xem"; chỉ còn hai nhóm: đáng xem / không phù hợp. */
export function worthSeeing(l: MatchLabel): boolean {
  return l !== "unsuitable";
}

export function accuracy2(truth: MatchLabel[], pred: MatchLabel[]): number {
  return truth.length === 0
    ? 0
    : truth.filter((t, i) => worthSeeing(t) === worthSeeing(pred[i])).length / truth.length;
}

export function cohenKappa(truth: MatchLabel[], pred: MatchLabel[]): number {
  const n = truth.length;
  if (n === 0) return 0;
  const po = accuracy(truth, pred);
  let pe = 0;
  for (const l of LABELS) {
    pe += (truth.filter((x) => x === l).length / n) * (pred.filter((x) => x === l).length / n);
  }
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}
