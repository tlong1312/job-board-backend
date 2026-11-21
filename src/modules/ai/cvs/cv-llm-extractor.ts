/**
 * Rút thông tin từ CV bằng LLM (chạy qua Ollama), để so sánh với cách từ điển + quy tắc
 * trong cv-extractor.ts.
 *
 * LLM chỉ đảm nhận phần "đọc hiểu": kỹ năng, số năm kinh nghiệm, tỉnh/thành, vị trí ứng tuyển.
 * Kết quả luôn được kiểm lại bằng code thường để mô hình có "bịa" cũng không lọt vào hệ thống:
 *  - kỹ năng phải đổi được về tên chuẩn trong từ điển VÀ có xuất hiện trong văn bản CV;
 *  - số năm phải là số hợp lệ (0 đến 50), nếu không thì coi như không rút được;
 *  - cấp độ KHÔNG hỏi LLM mà tính từ số năm bằng đúng quy tắc cũ (levelFromYears),
 *    để hai cách rút chỉ khác nhau ở phần đọc hiểu.
 *
 * Phần xử lý kết quả (parseLlmCv) là hàm thuần, không gọi mạng nên thử được bằng jest.
 */
import { CvInfo, findSkills, levelFromYears } from "./cv-extractor";
import { SKILL_DICTIONARY } from "./cv-skills.dictionary";
import { LlmProvider } from "../providers/llm.provider";

/** Chỉ gửi phần đầu CV cho LLM (CV thường ngắn hơn nhiều; giữ trong giới hạn ngữ cảnh). */
export const MAX_LLM_CV_CHARS = 5000;

export class LlmExtractError extends Error {}

export type CvExtractorMode = "rules" | "llm";

/** Chọn cách rút CV bằng biến môi trường CV_EXTRACTOR=rules|llm (mặc định rules). */
export function cvExtractorMode(): CvExtractorMode {
  return (process.env.CV_EXTRACTOR ?? "rules").trim().toLowerCase() === "llm"
    ? "llm"
    : "rules";
}

const SKILL_NAMES = SKILL_DICTIONARY.map((s) => s.name);

export function buildCvPrompt(cvText: string): {
  system: string;
  user: string;
} {
  const system = [
    "You extract structured data from a resume written in Vietnamese or English.",
    "Reply with ONE JSON object and nothing else, in exactly this shape:",
    '{"skills": string[], "years": number | null, "province": string | null, "desiredTitle": string | null}',
    "",
    "Rules:",
    `- "skills": technical skills the candidate lists or clearly uses. Choose ONLY from this list and spell each exactly as written: ${SKILL_NAMES.join(", ")}.`,
    '- "years": total years of professional work experience. Add up the job entries. Do NOT count years spent at school. Use 0 if the resume says the candidate has no experience. Use null if it cannot be told.',
    '- "province": the city or province where the candidate lives or wants to work, for example "Hà Nội" or "TP. Hồ Chí Minh". Use null if not stated.',
    '- "desiredTitle": the position the candidate is applying for. Use null if not stated.',
    "- Never invent anything that is not in the resume.",
  ].join("\n");
  const user = `Resume:\n"""\n${cvText.slice(0, MAX_LLM_CV_CHARS)}\n"""`;
  return { system, user };
}

const PROVINCES: Array<[RegExp, string]> = [
  [
    /(?:ho chi minh|hồ chí minh|\bhcm\b|tp\.?\s*hcm|sài gòn|sai gon)/i,
    "TP. Hồ Chí Minh",
  ],
  [/(?:ha noi|hà nội|hanoi)/i, "Hà Nội"],
  [/(?:hai phong|hải phòng)/i, "Hải Phòng"],
  [/(?:da nang|đà nẵng)/i, "Đà Nẵng"],
  [/(?:can tho|cần thơ)/i, "Cần Thơ"],
];

/** Đưa cách viết tỉnh/thành về một dạng chuẩn; không nhận ra thì giữ nguyên chuỗi đã cắt gọn. */
export function normalizeProvince(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  for (const [re, name] of PROVINCES) if (re.test(s)) return name;
  return s.slice(0, 80);
}

function toYears(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 50)
    return null;
  return Math.round(n * 10) / 10;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(raw.trim());
  if (direct) return direct;
  // Có mô hình bọc JSON trong ```json ... ``` hoặc thêm vài chữ: lấy đoạn từ { đầu tới } cuối
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start !== -1 && end > start
    ? tryParse(raw.slice(start, end + 1))
    : null;
}

/** Biến câu trả lời thô của LLM thành CvInfo đã kiểm tra; trả null nếu không dùng được. */
export function parseLlmCv(raw: string, cvText: string): CvInfo | null {
  const obj = parseJsonObject(raw);
  if (!obj || !("skills" in obj)) return null;

  const mentioned = findSkills(cvText);
  const claimed = Array.isArray(obj.skills)
    ? obj.skills.filter((s): s is string => typeof s === "string")
    : [];
  const skills = [...new Set(claimed.flatMap((s) => findSkills(s)))]
    .filter((s) => mentioned.includes(s))
    .sort((a, b) => a.localeCompare(b));

  const years = toYears(obj.years);
  const province =
    typeof obj.province === "string" ? normalizeProvince(obj.province) : null;
  const title =
    typeof obj.desiredTitle === "string" ? obj.desiredTitle.trim() : "";

  return {
    skills,
    mentionedSkills: mentioned,
    years,
    level: levelFromYears(years, cvText),
    province,
    desiredTitle: title ? title.slice(0, 120) : null,
    extractor: "llm",
  };
}

export async function extractCvInfoWithLlm(
  llm: LlmProvider,
  cvText: string,
): Promise<CvInfo> {
  const { system, user } = buildCvPrompt(cvText);
  const raw = await llm.completeJson(system, user);
  const info = parseLlmCv(raw, cvText);
  if (!info) {
    throw new LlmExtractError(
      `LLM trả về JSON không dùng được: ${raw.slice(0, 120)}`,
    );
  }
  return info;
}
