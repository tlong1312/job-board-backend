import { basename, join } from "path";
import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CvReadError, readCvText } from "./cv-text-reader";
import { CvInfo, extractCvInfo } from "./cv-extractor";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  MatchLabel,
  MatchLevel,
  classify,
  scoreFromParts,
} from "./ai-match.scoring";
import { AiService } from "../ai.service";
import { ForBiddenException, NotFoundException } from "commons/error";

/** Chỉ nhúng phần đầu CV (CV thường rất ngắn so với giới hạn này). */
const MAX_EMBED_CHARS = 6000;
/** Lấy 50 tin giống nhất bằng vector rồi mới chấm kỹ từng tin. */
const CANDIDATES = 50;

export interface ParsedResume {
  resumeId: number;
  info: CvInfo;
  textLength: number;
}

export interface JobMatch {
  jobId: number;
  title: string;
  company: string | null;
  province: string | null;
  level: string | null;
  score: number;
  label: MatchLabel;
  cosine: number;
  skillRatio: number;
  matchedSkills: string[];
  missingSkills: string[];
  levelGap: number | null;
}

export interface Requester {
  id: number;
  role: string;
}

interface ResumeRow {
  id: number;
  user_id: number;
  file_name: string;
  mime_type: string | null;
}

const asLevel = (v: unknown): MatchLevel | null =>
  v === "intern" || v === "junior" || v === "middle" || v === "senior"
    ? v
    : null;

@Injectable()
export class AiResumesService {
  private readonly logger = new Logger(AiResumesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  private async loadResume(id: number): Promise<ResumeRow> {
    const rows: ResumeRow[] = await this.dataSource.query(
      `SELECT id, user_id, file_name, mime_type FROM resumes WHERE id = $1`,
      [id],
    );
    if (rows.length === 0)
      throw new NotFoundException(`Không tìm thấy CV ${id}`);
    return rows[0];
  }

  async assertAccess(resumeId: number, who: Requester): Promise<void> {
    const r = await this.loadResume(resumeId);
    if (who.role !== "admin" && Number(r.user_id) !== Number(who.id)) {
      throw new ForBiddenException("Bạn không có quyền với CV này");
    }
  }

  async processResume(id: number): Promise<ParsedResume> {
    const r = await this.loadResume(id);
    try {
      const filePath = join(process.cwd(), "uploads", basename(r.file_name));
      const text = await readCvText(filePath, r.mime_type);
      const info = extractCvInfo(text);
      const vector = await this.ai.embed(text.slice(0, MAX_EMBED_CHARS));
      await this.dataSource.query(
        `UPDATE resumes
            SET extracted_text = $2, parsed_data = $3::jsonb, embedding = $4::vector, parsed_at = NOW()
          WHERE id = $1`,
        [id, text, JSON.stringify(info), AiService.toVectorLiteral(vector)],
      );
      this.logger.log(
        `CV ${id}: ${info.skills.length} kỹ năng, ${info.years ?? "?"} năm, cấp ${info.level ?? "?"}`,
      );
      return { resumeId: id, info, textLength: text.length };
    } catch (e) {
      if (e instanceof CvReadError) {
        await this.dataSource.query(
          `UPDATE resumes SET parsed_data = $2::jsonb, parsed_at = NULL, embedding = NULL WHERE id = $1`,
          [id, JSON.stringify({ error: e.message })],
        );
      }
      throw e;
    }
  }

  async getParsed(id: number) {
    const rows = await this.dataSource.query(
      `SELECT id, parsed_data, parsed_at FROM resumes WHERE id = $1`,
      [id],
    );
    if (rows.length === 0)
      throw new NotFoundException(`Không tìm thấy CV ${id}`);
    const { parsed_data: data, parsed_at: at } = rows[0];
    return {
      resumeId: id,
      status: at ? "done" : data?.error ? "error" : "pending",
      parsedAt: at,
      data,
    };
  }

  /** Gợi ý tin phù hợp với CV: lấy 50 tin gần nhất bằng vector, chấm kỹ rồi xếp lại. */
  async matchJobs(
    resumeId: number,
    limit = 10,
  ): Promise<{ resumeId: number; items: JobMatch[] }> {
    const rows = await this.dataSource.query(
      `SELECT embedding::text AS v, parsed_data FROM resumes WHERE id = $1`,
      [resumeId],
    );
    if (rows.length === 0)
      throw new NotFoundException(`Không tìm thấy CV ${resumeId}`);
    if (!rows[0].v) {
      const err = rows[0].parsed_data?.error;
      throw new NotFoundException(
        err
          ? `CV chưa dùng được: ${err}`
          : "CV đang được xử lý, thử lại sau ít giây",
      );
    }
    const info = rows[0].parsed_data as CvInfo;
    const cvVector: string = rows[0].v;

    const cands: Array<{
      id: number;
      title: string;
      company: string | null;
      province: string | null;
      level: string | null;
      cosine: string;
    }> = await this.dataSource.query(
      `SELECT j.id, j.title, c.name AS company, j.province, j.level,
              1 - (je.embedding <=> $1::vector) AS cosine
         FROM job_embeddings je
         JOIN jobs j ON j.id = je.job_id
         LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.status = 'open'
        ORDER BY je.embedding <=> $1::vector
        LIMIT ${CANDIDATES}`,
      [cvVector],
    );
    if (cands.length === 0) return { resumeId, items: [] };

    const skillRows: Array<{ job_id: number; name: string }> =
      await this.dataSource.query(
        `SELECT js.job_id, s.name
         FROM job_skills js JOIN skills s ON s.id = js.skill_id
        WHERE js.job_id = ANY($1::int[])`,
        [cands.map((c) => c.id)],
      );
    const skillsOf = new Map<number, string[]>();
    for (const s of skillRows) {
      const list = skillsOf.get(Number(s.job_id)) ?? [];
      list.push(s.name);
      skillsOf.set(Number(s.job_id), list);
    }

    const items: JobMatch[] = cands.map((c) => {
      const m = scoreFromParts(
        Number(c.cosine),
        info.skills ?? [],
        skillsOf.get(Number(c.id)) ?? [],
        asLevel(info.level),
        asLevel(c.level),
        DEFAULT_WEIGHTS,
      );
      return {
        jobId: Number(c.id),
        title: c.title,
        company: c.company,
        province: c.province,
        level: c.level,
        score: Number(m.score.toFixed(3)),
        label: classify(m.score, DEFAULT_THRESHOLDS),
        cosine: Number(m.parts.cosine.toFixed(3)),
        skillRatio: Number(m.parts.skill.toFixed(2)),
        matchedSkills: m.parts.matched,
        missingSkills: m.parts.missing,
        levelGap: m.parts.levelGap,
      };
    });
    items.sort((a, b) => b.score - a.score);
    return { resumeId, items: items.slice(0, limit) };
  }
}
