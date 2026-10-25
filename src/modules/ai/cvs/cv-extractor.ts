import { SKILL_DICTIONARY } from "./cv-skills.dictionary";

export type CvLevel = "intern" | "junior" | "middle" | "senior";

export interface CvInfo {
  /** Kỹ năng ứng viên tự khai trong mục "Kỹ năng" (nếu không thấy mục này thì lấy từ cả CV). */
  skills: string[];
  /** Mọi kỹ năng được nhắc tới ở bất kỳ đâu trong CV (kể cả mô tả công việc, dự án). */
  mentionedSkills: string[];
  years: number | null;
  level: CvLevel | null;
  province: string | null;
  desiredTitle: string | null;
}

interface Term {
  canonical: string;
  term: string;
  re: RegExp;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const TERMS: Term[] = SKILL_DICTIONARY.flatMap((s) =>
  [s.name, ...s.aliases].map((term) => ({
    canonical: s.name,
    term,
    re: new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`,
      term.length <= 3 ? "gu" : "giu",
    ),
  })),
).sort((a, b) => b.term.length - a.term.length); // dài trước: "SQL Server" trước "SQL"

/** Tìm kỹ năng trong một đoạn văn. Đoạn đã khớp được che đi để từ ngắn hơn không khớp lại. */
export function findSkills(text: string): string[] {
  let rest = text;
  const found = new Set<string>();
  for (const t of TERMS) {
    t.re.lastIndex = 0;
    rest = rest.replace(t.re, (m) => {
      found.add(t.canonical);
      return " ".repeat(m.length);
    });
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

const SECTION_HEADERS = [
  "mục tiêu nghề nghiệp",
  "kỹ năng",
  "kinh nghiệm làm việc",
  "dự án",
  "học vấn",
  "chứng chỉ",
  "objective",
  "skills",
  "experience",
  "projects",
  "education",
  "certificates",
];

function segments(text: string): string[] {
  return text
    .split(/\s*\|\s*|\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sectionText(text: string, names: string[]): string | null {
  const segs = segments(text);
  const start = segs.findIndex((s) =>
    names.includes(s.toLowerCase().replace(/:$/, "")),
  );
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < segs.length; i++) {
    if (SECTION_HEADERS.includes(segs[i].toLowerCase().replace(/:$/, "")))
      break;
    body.push(segs[i]);
  }
  return body.join("\n");
}

/** Bỏ mục học vấn: "2022 - nay" ở đây là năm đi học, không phải năm đi làm. */
function withoutEducation(text: string): string {
  const segs = segments(text);
  const out: string[] = [];
  let inEdu = false;
  for (const s of segs) {
    const key = s.toLowerCase().replace(/:$/, "");
    if (["học vấn", "education"].includes(key)) {
      inEdu = true;
      continue;
    }
    if (inEdu && SECTION_HEADERS.includes(key)) inEdu = false;
    if (!inEdu) out.push(s);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 3. Số năm kinh nghiệm và cấp độ
// ---------------------------------------------------------------------------

const num = (s: string) => Number(s.replace(",", "."));

export function extractYears(text: string, now = new Date()): number | null {
  // (1) Cộng các mục làm việc dạng "2023 - 2025 (2 năm)"
  const entries = [
    ...text.matchAll(/\((\d+(?:[.,]\d+)?)\s*(?:năm|years?|yrs?)\)/gi),
  ];
  if (entries.length > 0) return entries.reduce((sum, m) => sum + num(m[1]), 0);

  // (2) Câu tự nêu: "Có 3 năm kinh nghiệm", "Hơn 5 năm kinh nghiệm", "3 years of experience"
  const stated = text.match(
    /(\d+(?:[.,]\d+)?)\s*\+?\s*(?:năm|years?)\s+(?:kinh nghiệm|of experience|experience)/i,
  );
  if (stated) return num(stated[1]);
  // "Kinh nghiệm: 3 năm", "Experience: 2 years"
  const labelled = text.match(
    /(?:kinh nghiệm|experience)\s*:\s*(\d+(?:[.,]\d+)?)\s*\+?\s*(?:năm|years?)/i,
  );
  if (labelled) return num(labelled[1]);

  // (3) Nói rõ chưa có kinh nghiệm
  if (/chưa có kinh nghiệm|no (?:professional |work )?experience/i.test(text))
    return 0;

  // (4) Cộng các khoảng năm "2021 - 2023", "2022 - nay"
  const ranges = [
    ...withoutEducation(text).matchAll(
      /(\d{4})\s*[-–]\s*(\d{4}|nay|hiện tại|present)/gi,
    ),
  ];
  if (ranges.length > 0) {
    return ranges.reduce((sum, m) => {
      const end = /^\d{4}$/.test(m[2]) ? Number(m[2]) : now.getFullYear();
      return sum + Math.max(0, end - Number(m[1]));
    }, 0);
  }
  return null;
}

export function levelFromYears(
  years: number | null,
  text: string,
): CvLevel | null {
  if (years === null) {
    if (/thực tập|sinh viên|intern/i.test(text)) return "intern";
    if (/dẫn dắt|trưởng nhóm|team lead/i.test(text)) return "senior";
    return null;
  }
  if (years <= 0) return "intern";
  if (years < 2) return "junior";
  if (years < 5) return "middle";
  return "senior";
}

// ---------------------------------------------------------------------------
// 4. Hàm chính
// ---------------------------------------------------------------------------

const field = (text: string, labels: string): string | null => {
  const m = text.match(new RegExp(`(?:${labels})\\s*:\\s*([^\\n|]+)`, "i"));
  return m ? m[1].trim() : null;
};

const PROVINCE_HINTS: Array<[RegExp, string]> = [
  [
    /(?:ho chi minh|hồ chí minh|\bhcm\b|tp\.?\s*hcm|sài gòn|sai gon)/i,
    "TP. Hồ Chí Minh",
  ],
  [/(?:ha noi|hà nội|hanoi)/i, "Hà Nội"],
  [/(?:da nang|đà nẵng)/i, "Đà Nẵng"],
  [/(?:can tho|cần thơ)/i, "Cần Thơ"],
];

/** Khi CV không ghi "Địa điểm: ...", đoán từ phần đầu CV (dòng liên hệ). */
function provinceFromHeader(text: string): string | null {
  const head = text.slice(0, 400);
  for (const [re, name] of PROVINCE_HINTS) if (re.test(head)) return name;
  return null;
}

export function extractCvInfo(text: string, now = new Date()): CvInfo {
  const mentionedSkills = findSkills(text);
  const skillSection = sectionText(text, ["kỹ năng", "skills"]);
  const skills =
    skillSection !== null ? findSkills(skillSection) : mentionedSkills;
  const years = extractYears(text, now);
  return {
    skills,
    mentionedSkills,
    years,
    level: levelFromYears(years, text),
    province: field(text, "Địa điểm|Location") ?? provinceFromHeader(text),
    desiredTitle: field(text, "Vị trí ứng tuyển|Target role"),
  };
}
