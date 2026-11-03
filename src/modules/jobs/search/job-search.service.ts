import { Injectable, Optional } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../../redis/redis.service";

export interface JobSearchHit {
  id: number;
  title: string;
  level: string | null;
  province: string | null;
  location: string | null;
  score: number;
}

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

@Injectable()
export class JobSearchService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async search(query: string, limit = 10): Promise<JobSearchHit[]> {
    const tokens = tokenize(query.trim());
    if (tokens.length === 0) return [];
    const key = `search:${limit}:${tokens.join(" ")}`;
    if (!this.redis) return this.runSearch(tokens, limit);
    return this.redis.remember(key, 60, () => this.runSearch(tokens, limit));
  }

  private async runSearch(
    tokens: string[],
    limit: number,
  ): Promise<JobSearchHit[]> {
    const rows = await this.dataSource.query(
      `SELECT j.id, j.title, j.level, j.province, j.location,
              ts_rank_cd(j.search_vector, q.query)::float AS score
         FROM jobs j, (SELECT to_tsquery('simple', $1) AS query) q
        WHERE j.status = 'open'
          AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)
          AND j.search_vector @@ q.query
        ORDER BY score DESC, j.id
        LIMIT $2`,
      [tokens.join(" | "), limit],
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      title: String(r.title),
      level: (r.level as string | null) ?? null,
      province: (r.province as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      score: Number(r.score),
    }));
  }
}
