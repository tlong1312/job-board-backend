import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { DataSource } from "typeorm";
import { StatusChangedPayload } from "./mail.config";
import { renderStatusEmail } from "./mail.templates";

export type SendOutcome = "sent" | "duplicate" | "failed" | "skipped";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2000, 10000];

interface MailInfoRow {
  email: string;
  full_name: string;
  job_title: string;
  company_name: string | null;
  to_status: string;
  note: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const user = config.get<string>("mail.user");
    this.from = config.get<string>(
      "mail.from",
      "Job Board <no-reply@jobboard.local>",
    );
    this.transporter = nodemailer.createTransport({
      host: config.get<string>("mail.host", "localhost"),
      port: config.get<number>("mail.port", 1026),
      secure: config.get<boolean>("mail.secure", false),
      auth: user
        ? { user, pass: config.get<string>("mail.pass", "") }
        : undefined,
    });
  }

  async sendStatusChanged(p: StatusChangedPayload): Promise<SendOutcome> {
    const rows: MailInfoRow[] = await this.dataSource.query(
      `SELECT u.email, u.full_name, j.title AS job_title, c.name AS company_name,
              h.to_status, h.note
         FROM application_status_history h
         JOIN applications a ON a.id = h.application_id
         JOIN users u ON u.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN companies c ON c.id = j.company_id
        WHERE h.id = $1 AND a.id = $2`,
      [p.historyId, p.applicationId],
    );
    if (rows.length === 0) {
      this.logger.warn(
        `Hồ sơ ${p.applicationId} / lịch sử ${p.historyId} không còn, bỏ qua email`,
      );
      return "skipped";
    }
    const r = rows[0];
    const mail = renderStatusEmail({
      candidateName: r.full_name,
      jobTitle: r.job_title,
      companyName: r.company_name,
      status: r.to_status,
      note: r.note,
    });

    // Ghi nhật ký; trùng khóa thì lấy dòng cũ ra xem đã gửi chưa
    const key = `application-status-${p.historyId}`;
    const logged: Array<{ id: number; status: string }> =
      await this.dataSource.query(
        `INSERT INTO email_logs (idempotency_key, to_email, subject, template, payload)
       VALUES ($1, $2, $3, 'application-status', $4::jsonb)
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id, status`,
        [key, r.email, mail.subject, JSON.stringify(p)],
      );
    const logId = logged[0].id;
    if (logged[0].status === "sent") return "duplicate";

    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: r.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        await this.dataSource.query(
          `UPDATE email_logs SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = NOW() WHERE id = $1`,
          [logId],
        );
        this.logger.log(
          `Đã gửi email hồ sơ ${p.applicationId} -> ${r.email} (${r.to_status})`,
        );
        return "sent";
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        await this.dataSource.query(
          `UPDATE email_logs SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
          [logId, lastError],
        );
        this.logger.warn(
          `Gửi email hồ sơ ${p.applicationId} lần ${attempt}/${MAX_ATTEMPTS} lỗi: ${lastError}`,
        );
        if (attempt < MAX_ATTEMPTS)
          await new Promise((res) =>
            setTimeout(res, RETRY_DELAYS_MS[attempt - 1]),
          );
      }
    }
    await this.dataSource.query(
      `UPDATE email_logs SET status = 'failed' WHERE id = $1`,
      [logId],
    );
    return "failed";
  }
}
