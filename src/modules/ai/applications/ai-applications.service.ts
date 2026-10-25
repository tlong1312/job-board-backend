import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AiJobsService } from "../jobs/ai-jobs.service";
import { AiResumesService, Requester } from "../cvs/ai-resumes.service";
import { CvReadError } from "../cvs/cv-text-reader";
import { CvInfo } from "../cvs/cv-extractor";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  MatchLabel,
  MatchLevel,
  classify,
  scoreFromParts,
} from "../cvs/ai-match.scoring";
import { ForBiddenException, NotFoundException } from "commons/error";

const asLevel = (v: unknown): MatchLevel | null =>
  v === "intern" || v === "junior" || v === "middle" || v === "senior"
    ? v
    : null;

export interface ApplicationScore {
  applicationId: number;
  status: "scored" | "unscored";
  score: number | null;
  label: MatchLabel | null;
  reason: string | null;
}

@Injectable()
export class AiApplicationsService {
  private readonly logger = new Logger(AiApplicationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly resumes: AiResumesService,
    private readonly jobs: AiJobsService,
  ) {}

  private async saveUnscored(
    applicationId: number,
    reason: string,
  ): Promise<ApplicationScore> {
    await this.dataSource.query(
      `INSERT INTO application_scores (application_id, status, reason)
       VALUES ($1, 'unscored', $2)
       ON CONFLICT (application_id) DO UPDATE
         SET status = 'unscored', reason = EXCLUDED.reason, score = NULL, label = NULL,
             cosine = NULL, skill_ratio = NULL, level_gap = NULL,
             matched_skills = NULL, missing_skills = NULL, scored_at = NOW()`,
      [applicationId, reason],
    );
    this.logger.warn(`Hồ sơ ${applicationId}: chưa chấm được - ${reason}`);
    return {
      applicationId,
      status: "unscored",
      score: null,
      label: null,
      reason,
    };
  }

  async scoreApplication(applicationId: number): Promise<ApplicationScore> {
    const apps: Array<{
      job_id: number;
      candidate_id: number;
      resume_id: number | null;
    }> = await this.dataSource.query(
      `SELECT job_id, candidate_id, resume_id FROM applications WHERE id = $1`,
      [applicationId],
    );
    if (apps.length === 0)
      throw new NotFoundException(`Không tìm thấy hồ sơ ${applicationId}`);
    const { job_id: jobId, candidate_id: candidateId } = apps[0];

    let resumeId = apps[0].resume_id;
    if (!resumeId) {
      const r: Array<{ id: number }> = await this.dataSource.query(
        `SELECT id FROM resumes WHERE user_id = $1 ORDER BY is_default DESC, uploaded_at DESC LIMIT 1`,
        [candidateId],
      );
      resumeId = r[0]?.id ?? null;
    }
    if (!resumeId)
      return this.saveUnscored(applicationId, "Ứng viên chưa có CV");

    const loadRow = async () =>
      this.dataSource.query(
        `SELECT r.parsed_data, r.embedding IS NOT NULL AS cv_ok,
                j.level AS job_level,
                je.job_id IS NOT NULL AS job_ok,
                1 - (r.embedding <=> je.embedding) AS cosine
           FROM resumes r
           JOIN jobs j ON j.id = $2
           LEFT JOIN job_embeddings je ON je.job_id = j.id
          WHERE r.id = $1`,
        [resumeId, jobId],
      );

    let rows = await loadRow();
    if (rows.length === 0)
      return this.saveUnscored(applicationId, "Không tìm thấy CV hoặc tin");

    // Chưa có vector thì làm ngay (CV vừa tải lên có thể chưa kịp xử lý)
    if (!rows[0].job_ok) await this.jobs.embedJobs([jobId]);
    if (!rows[0].cv_ok) {
      try {
        await this.resumes.processResume(resumeId);
      } catch (e) {
        if (e instanceof CvReadError)
          return this.saveUnscored(applicationId, e.message);
        throw e; // lỗi hệ thống (Ollama tắt...): để bên nhận ghi log
      }
    }
    if (!rows[0].job_ok || !rows[0].cv_ok) rows = await loadRow();
    const row = rows[0];
    if (!row.cv_ok || !row.job_ok || row.cosine === null) {
      return this.saveUnscored(applicationId, "Chưa có vector cho CV hoặc tin");
    }

    const skillRows: Array<{ name: string }> = await this.dataSource.query(
      `SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = $1`,
      [jobId],
    );
    const info = row.parsed_data as CvInfo;
    const m = scoreFromParts(
      Number(row.cosine),
      info.skills ?? [],
      skillRows.map((s) => s.name),
      asLevel(info.level),
      asLevel(row.job_level),
      DEFAULT_WEIGHTS,
    );
    const label = classify(m.score, DEFAULT_THRESHOLDS);

    await this.dataSource.query(
      `INSERT INTO application_scores
         (application_id, status, score, label, cosine, skill_ratio, level_gap,
          matched_skills, missing_skills, reason, scored_at)
       VALUES ($1, 'scored', $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NULL, NOW())
       ON CONFLICT (application_id) DO UPDATE
         SET status = 'scored', score = EXCLUDED.score, label = EXCLUDED.label,
             cosine = EXCLUDED.cosine, skill_ratio = EXCLUDED.skill_ratio,
             level_gap = EXCLUDED.level_gap, matched_skills = EXCLUDED.matched_skills,
             missing_skills = EXCLUDED.missing_skills, reason = NULL, scored_at = NOW()`,
      [
        applicationId,
        Number(m.score.toFixed(4)),
        label,
        Number(m.parts.cosine.toFixed(4)),
        Number(m.parts.skill.toFixed(4)),
        m.parts.levelGap,
        JSON.stringify(m.parts.matched),
        JSON.stringify(m.parts.missing),
      ],
    );
    this.logger.log(
      `Hồ sơ ${applicationId}: điểm ${m.score.toFixed(3)} (${label})`,
    );
    return {
      applicationId,
      status: "scored",
      score: m.score,
      label,
      reason: null,
    };
  }

  /** Chủ tin hoặc admin mới được xem/chấm lại hồ sơ của tin. */
  async assertJobOwner(jobId: number, who: Requester): Promise<void> {
    const rows: Array<{ created_by: number }> = await this.dataSource.query(
      `SELECT created_by FROM jobs WHERE id = $1`,
      [jobId],
    );
    if (rows.length === 0)
      throw new NotFoundException(`Không tìm thấy tin ${jobId}`);
    if (who.role !== "admin" && Number(rows[0].created_by) !== Number(who.id)) {
      throw new ForBiddenException("Bạn không phải chủ tin tuyển dụng này");
    }
  }

  async jobIdOfApplication(applicationId: number): Promise<number> {
    const rows: Array<{ job_id: number }> = await this.dataSource.query(
      `SELECT job_id FROM applications WHERE id = $1`,
      [applicationId],
    );
    if (rows.length === 0)
      throw new NotFoundException(`Không tìm thấy hồ sơ ${applicationId}`);
    return Number(rows[0].job_id);
  }

  /** Danh sách hồ sơ của một tin, người điểm cao lên trước; hồ sơ chưa chấm xếp cuối. */
  async listApplicants(jobId: number) {
    const rows = await this.dataSource.query(
      `SELECT a.id AS application_id, a.candidate_id, a.resume_id, a.status AS application_status,
              a.created_at, u.full_name,
              s.status AS score_status, s.score, s.label, s.cosine, s.skill_ratio,
              s.level_gap, s.matched_skills, s.missing_skills, s.reason, s.scored_at
         FROM applications a
         JOIN users u ON u.id = a.candidate_id
         LEFT JOIN application_scores s ON s.application_id = a.id
        WHERE a.job_id = $1
        ORDER BY s.score DESC NULLS LAST, a.created_at DESC`,
      [jobId],
    );
    return {
      jobId,
      count: rows.length,
      items: rows.map((r: Record<string, any>) => ({
        applicationId: Number(r.application_id),
        candidateId: Number(r.candidate_id),
        candidateName: r.full_name,
        resumeId: r.resume_id,
        applicationStatus: r.application_status,
        appliedAt: r.created_at,
        ai: r.score_status
          ? {
              status: r.score_status,
              score:
                r.score === null ? null : Number(Number(r.score).toFixed(3)),
              label: r.label,
              cosine:
                r.cosine === null ? null : Number(Number(r.cosine).toFixed(3)),
              skillRatio:
                r.skill_ratio === null
                  ? null
                  : Number(Number(r.skill_ratio).toFixed(2)),
              levelGap: r.level_gap,
              matchedSkills: r.matched_skills,
              missingSkills: r.missing_skills,
              reason: r.reason,
              scoredAt: r.scored_at,
            }
          : { status: "pending" },
      })),
    };
  }
}
