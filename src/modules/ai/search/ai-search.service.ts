import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AiService } from "../ai.service";

export const SEARCH_MODES = ["like", "fts", "vector", "hybrid"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export interface SearchHit {
  id: number;
  title: string;
  level: string | null;
  province: string | null;
  location: string | null;
  companyName: string | null;
  jobType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  /** Dạng "YYYY-MM-DD" hoặc null nếu không giới hạn hạn nộp. */
  deadline: string | null;
  score: number;
}

export interface HybridOptions {
  /** Hằng số k trong RRF: điểm = trọng số / (k + hạng). k lớn thì các hạng gần nhau hơn. */
  rrfK: number;
  candidates: number;
  weightFts: number;
  weightVec: number;
}

export const DEFAULT_HYBRID: HybridOptions = {
  rrfK: 60,
  candidates: 50,
  weightFts: 1,
  weightVec: 1,
};

const STOPWORDS = new Set([
  "cho",
  "và",
  "của",
  "các",
  "những",
  "một",
  "là",
  "có",
  "để",
  "khi",
  "trong",
  "với",
  "từ",
  "đến",
  "không",
  "được",
  "này",
  "đó",
  "giữa",
  "phải",
  "hay",
  "trên",
  "tại",
  "ở",
  "rất",
  "the",
  "and",
  "for",
  "of",
  "in",
  "to",
]);

export function tokenize(query: string): string[] {
  const all = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  const kept = all.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return (kept.length > 0 ? kept : all).slice(0, 12);
}

export function fuseRrf(
  lists: { hits: SearchHit[]; weight: number }[],
  rrfK: number,
  limit: number,
): SearchHit[] {
  const merged = new Map<number, SearchHit>();
  for (const { hits, weight } of lists) {
    hits.forEach((hit, index) => {
      const add = weight / (rrfK + index + 1);
      const cur = merged.get(hit.id);
      if (cur) cur.score += add;
      else merged.set(hit.id, { ...hit, score: add });
    });
  }
  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit);
}

const SELECT_COLS = `j.id, j.title, j.level, j.province, j.location,
  co.name AS company_name, j.job_type, j.salary_min, j.salary_max,
  to_char(j.deadline, 'YYYY-MM-DD') AS deadline`;
const FROM_JOBS = `jobs j LEFT JOIN companies co ON co.id = j.company_id`;
/** Chỉ job đang mở và chưa hết hạn nộp. */
const OPEN_JOB = `j.status = 'open' AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)`;

@Injectable()
export class AiSearchService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  async search(
    query: string,
    mode: SearchMode,
    limit = 10,
    hybrid: Partial<HybridOptions> = {},
    queryVector?: number[],
  ): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q) return [];

    switch (mode) {
      case "like":
        return this.searchLike(q, limit);
      case "fts":
        return this.searchFts(q, limit);
      case "vector":
        return this.searchVector(
          queryVector ?? (await this.ai.embed(q)),
          limit,
        );
      case "hybrid": {
        const o = { ...DEFAULT_HYBRID, ...hybrid };
        const vector = queryVector ?? (await this.ai.embed(q));
        const [fts, vec] = await Promise.all([
          this.searchFts(q, o.candidates),
          this.searchVector(vector, o.candidates),
        ]);
        return fuseRrf(
          [
            { hits: fts, weight: o.weightFts },
            { hits: vec, weight: o.weightVec },
          ],
          o.rrfK,
          limit,
        );
      }
    }
  }

  /** Like Search */
  private async searchLike(query: string, limit: number): Promise<SearchHit[]> {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const score = tokens
      .map(
        (_, i) =>
          `(CASE WHEN (j.title || ' ' || COALESCE(j.description, '')) ILIKE $${i + 1} THEN 1 ELSE 0 END)`,
      )
      .join(" + ");
    const sql = `
      SELECT ${SELECT_COLS}, (${score})::float AS score
      FROM ${FROM_JOBS}
      WHERE ${OPEN_JOB} AND (${score}) > 0
      ORDER BY score DESC, j.id
      LIMIT $${tokens.length + 1}`;
    const rows = await this.dataSource.query(sql, [
      ...tokens.map((t) => `%${t}%`),
      limit,
    ]);
    return rows.map(toHit);
  }

  /** Full-text Search */
  private async searchFts(query: string, limit: number): Promise<SearchHit[]> {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const sql = `
      SELECT ${SELECT_COLS}, ts_rank_cd(j.search_vector, q.query)::float AS score
      FROM ${FROM_JOBS}, (SELECT to_tsquery('simple', $1) AS query) q
      WHERE ${OPEN_JOB} AND j.search_vector @@ q.query
      ORDER BY score DESC, j.id
      LIMIT $2`;
    const rows = await this.dataSource.query(sql, [tokens.join(" | "), limit]);
    return rows.map(toHit);
  }

  /** Vector Search */
  private async searchVector(
    vector: number[],
    limit: number,
  ): Promise<SearchHit[]> {
    const sql = `
      SELECT ${SELECT_COLS}, (1 - (e.embedding <=> $1::vector))::float AS score
      FROM job_embeddings e
      JOIN jobs j ON j.id = e.job_id
      LEFT JOIN companies co ON co.id = j.company_id
      WHERE ${OPEN_JOB}
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2`;
    const rows = await this.dataSource.query(sql, [
      AiService.toVectorLiteral(vector),
      limit,
    ]);
    return rows.map(toHit);
  }
}

function toHit(r: Record<string, unknown>): SearchHit {
  return {
    id: Number(r.id),
    title: String(r.title),
    level: (r.level as string | null) ?? null,
    province: (r.province as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    companyName: (r.company_name as string | null) ?? null,
    jobType: (r.job_type as string | null) ?? null,
    salaryMin: r.salary_min == null ? null : Number(r.salary_min),
    salaryMax: r.salary_max == null ? null : Number(r.salary_max),
    deadline: (r.deadline as string | null) ?? null,
    score: Number(r.score),
  };
}
