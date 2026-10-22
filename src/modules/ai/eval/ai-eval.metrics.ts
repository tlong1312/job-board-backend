/**
 * Chỉ số đo chất lượng xếp hạng. `grades` là điểm phù hợp của từng tin (2 hoặc 1);
 * tin không có trong `grades` coi như không phù hợp (điểm 0).
 *
 * Không dùng Recall@k vì mỗi truy vấn có 12 đến 86 tin phù hợp: lấy 10 kết quả thì
 * Recall@10 tối đa chỉ khoảng 12% đến 83%, nên so sánh giữa truy vấn không công bằng.
 */
export type Grades = Map<number, number>;

export function ndcgAtK(ranked: number[], grades: Grades, k: number): number {
  const dcg = ranked
    .slice(0, k)
    .reduce((sum, id, i) => sum + (grades.get(id) ?? 0) / Math.log2(i + 2), 0);
  const ideal = [...grades.values()]
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, g, i) => sum + g / Math.log2(i + 2), 0);
  return ideal === 0 ? 0 : dcg / ideal;
}

/** Tỉ lệ kết quả trong top-k có điểm >= minGrade. Mẫu số luôn là k. */
export function precisionAtK(ranked: number[], grades: Grades, k: number, minGrade = 1): number {
  const hits = ranked.slice(0, k).filter((id) => (grades.get(id) ?? 0) >= minGrade).length;
  return hits / k;
}

/** 1 / hạng của kết quả phù hợp đầu tiên trong top-k (0 nếu không có). */
export function reciprocalRank(ranked: number[], grades: Grades, k: number, minGrade = 1): number {
  const i = ranked.slice(0, k).findIndex((id) => (grades.get(id) ?? 0) >= minGrade);
  return i === -1 ? 0 : 1 / (i + 1);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
