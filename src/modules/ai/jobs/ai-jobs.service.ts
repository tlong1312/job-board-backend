import { createHash } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AiService } from "../ai.service";

interface JobRow {
  id: number;
  title: string;
  description: string | null;
  level: string | null;
  location: string | null;
  province: string | null;
  skills: string;
}

export interface EmbedResult {
  embedded: number;
  skipped: number;
  missing: number;
}

const LEVEL_VI: Record<string, string> = {
  intern: "thực tập sinh (intern), sinh viên",
  junior: "junior, mới đi làm",
  middle: "middle, có kinh nghiệm",
  senior: "senior, nhiều năm kinh nghiệm",
};

const MAX_DESCRIPTION_CHARS = 4000;

export function buildJobText(job: JobRow): string {
  const place = [job.location, job.province].filter(Boolean).join(", ");
  const lines = [
    `Vị trí: ${job.title}`,
    job.level ? `Cấp độ: ${LEVEL_VI[job.level] ?? job.level}` : "",
    place ? `Địa điểm: ${place}` : "",
    job.skills ? `Kỹ năng: ${job.skills}` : "",
    job.description ? job.description.slice(0, MAX_DESCRIPTION_CHARS) : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const LOAD_JOBS_SQL = `
  SELECT j.id, j.title, j.description, j.level, j.location, j.province,
         COALESCE(string_agg(s.name, ', ' ORDER BY s.name), '') AS skills
  FROM jobs j
  LEFT JOIN job_skills js ON js.job_id = j.id
  LEFT JOIN skills s      ON s.id = js.skill_id
  WHERE j.id = ANY($1::int[])
  GROUP BY j.id`;

@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  async embedJobs(ids: number[]): Promise<EmbedResult> {
    const unique = [...new Set(ids)];
    const result: EmbedResult = { embedded: 0, skipped: 0, missing: 0 };
    if (unique.length === 0) return result;

    const rows: JobRow[] = await this.dataSource.query(LOAD_JOBS_SQL, [unique]);
    result.missing = unique.length - rows.length;

    const existing: { job_id: number; content_hash: string }[] =
      await this.dataSource.query(
        `SELECT job_id, content_hash FROM job_embeddings WHERE job_id = ANY($1::int[])`,
        [unique],
      );
    const oldHash = new Map(
      existing.map((r) => [Number(r.job_id), r.content_hash]),
    );

    const todo: { id: number; text: string; hash: string }[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      const text = buildJobText(row);
      const hash = createHash("sha256")
        .update(`${this.ai.model}\n${text}`)
        .digest("hex");
      if (oldHash.get(id) === hash) result.skipped++;
      else todo.push({ id, text, hash });
    }

    if (todo.length > 0) {
      const vectors = await this.ai.embedBatch(todo.map((t) => t.text));
      for (let i = 0; i < todo.length; i++) {
        await this.dataSource.query(
          `INSERT INTO job_embeddings (job_id, embedding, model, content_hash)
           VALUES ($1, $2::vector, $3, $4)
           ON CONFLICT (job_id) DO UPDATE SET
             embedding = EXCLUDED.embedding, model = EXCLUDED.model,
             content_hash = EXCLUDED.content_hash, embedded_at = NOW()`,
          [
            todo[i].id,
            AiService.toVectorLiteral(vectors[i]),
            this.ai.model,
            todo[i].hash,
          ],
        );
      }
      result.embedded = todo.length;
    }
    return result;
  }

  /** Nhúng toàn bộ tin trong DB (chạy một lần, hoặc để bù những tin bị lỡ). */
  async embedAllJobs(
    batchSize = 8,
  ): Promise<EmbedResult & { total: number; seconds: number }> {
    const started = Date.now();
    const all: { id: number }[] = await this.dataSource.query(
      `SELECT id FROM jobs ORDER BY id`,
    );
    const total: EmbedResult = { embedded: 0, skipped: 0, missing: 0 };
    for (let i = 0; i < all.length; i += batchSize) {
      const chunk = all.slice(i, i + batchSize).map((r) => Number(r.id));
      const r = await this.embedJobs(chunk);
      total.embedded += r.embedded;
      total.skipped += r.skipped;
      total.missing += r.missing;
      this.logger.log(
        `Đã xử lý ${Math.min(i + batchSize, all.length)}/${all.length} tin`,
      );
    }
    return {
      ...total,
      total: all.length,
      seconds: Math.round((Date.now() - started) / 1000),
    };
  }
}
