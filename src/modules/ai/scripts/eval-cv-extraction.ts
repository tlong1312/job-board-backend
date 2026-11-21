/**
 * Đo chất lượng rút thông tin CV so với đáp án ẩn trong resumes.json.
 *
 *   npm run ai:eval-cv                          (cách từ điển, như trước đây)
 *   npm run ai:eval-cv -- --extractor llm       (LLM qua Ollama)
 *   npm run ai:eval-cv -- --extractor both      (chạy cả hai rồi in bảng so sánh)
 *
 * Tùy chọn: --file <đường dẫn resumes.json>
 * LLM cấu hình bằng biến môi trường (xem .env.example): OLLAMA_URL, LLM_MODEL...
 * Chạy ở chế độ llm/both thì Ollama phải đang chạy và đã `ollama pull` model.
 */
import * as fs from "fs";
import * as path from "path";
import { CvInfo, extractCvInfo } from "../cvs/cv-extractor";
import { extractCvInfoWithLlm } from "../cvs/cv-llm-extractor";
import { OllamaLlmProvider } from "../providers/ollama-llm.provider";

interface Sample {
  ref: string;
  format: string;
  text: string;
  skills: string[];
  years: number;
  level: string;
  province: string;
}

type Mode = "rules" | "llm" | "both";
type Kind = "skills" | "mentionedSkills";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const positional = argv.find(
  (a, i) =>
    !a.startsWith("--") &&
    argv[i - 1] !== "--extractor" &&
    argv[i - 1] !== "--file",
);
const file = flag("file") ?? positional ?? "seed-data/data/resumes.json";
const mode = (flag("extractor") ?? "rules") as Mode;
if (!["rules", "llm", "both"].includes(mode)) {
  console.error("--extractor phải là rules, llm hoặc both");
  process.exit(1);
}
const samples: Sample[] = JSON.parse(fs.readFileSync(file, "utf-8"));

const pct = (a: number, b: number) =>
  b === 0 ? "n/a" : `${((a / b) * 100).toFixed(1)}%`;

interface Counts {
  tp: number;
  fp: number;
  fn: number;
}
const add = (c: Counts, truth: string[], pred: string[]) => {
  const t = new Set(truth);
  const p = new Set(pred);
  c.tp += [...p].filter((x) => t.has(x)).length;
  c.fp += [...p].filter((x) => !t.has(x)).length;
  c.fn += [...t].filter((x) => !p.has(x)).length;
};
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));
const prf = (c: Counts) => {
  const precision = c.tp / (c.tp + c.fp || 1);
  const recall = c.tp / (c.tp + c.fn || 1);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
};
const f = (n: number) => `${(n * 100).toFixed(1)}%`;

const EMPTY: CvInfo = {
  skills: [],
  mentionedSkills: [],
  years: null,
  level: null,
  province: null,
  desiredTitle: null,
};

interface Run {
  label: string;
  infos: Map<string, CvInfo>;
  msPerCv: number;
  failed: number;
}

async function runExtractor(
  label: string,
  extract: (text: string) => Promise<CvInfo>,
): Promise<Run> {
  const infos = new Map<string, CvInfo>();
  let failed = 0;
  let total = 0;
  for (const s of samples) {
    const t0 = process.hrtime.bigint();
    try {
      infos.set(s.ref, await extract(s.text));
    } catch (e) {
      failed++;
      infos.set(s.ref, EMPTY); // lỗi tính như không rút được gì (tính theo hướng bất lợi)
      console.error(
        `[${label}] ${s.ref} lỗi: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    total += Number(process.hrtime.bigint() - t0) / 1e6;
  }
  return { label, infos, msPerCv: total / samples.length, failed };
}

interface Summary {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  exact: number;
  years: number;
  level: number;
  province: number;
  msPerCv: number;
  failed: number;
}

function report(
  run: Run,
  kinds: Kind[],
  outFile: string,
): { summary: Summary; lines: string[] } {
  const lines: string[] = [];
  const out = (s = "") => {
    lines.push(s);
    console.log(s);
  };
  const formats = ["all", ...new Set(samples.map((s) => s.format))];
  const detail: string[] = [];

  out("## Rút kỹ năng (so với đáp án ẩn)\n");
  out(
    "| Nhóm | Số CV | Cách | Precision | Recall | F1 | CV rút đúng hoàn toàn |",
  );
  out("|---|---|---|---|---|---|---|");
  let summary: Pick<Summary, "precision" | "recall" | "f1" | "exact"> = {
    precision: 0,
    recall: 0,
    f1: 0,
    exact: 0,
  };
  for (const fmt of formats) {
    const group = samples.filter((s) => fmt === "all" || s.format === fmt);
    for (const kind of kinds) {
      const c: Counts = { tp: 0, fp: 0, fn: 0 };
      let exact = 0;
      for (const s of group) {
        const info = run.infos.get(s.ref)!;
        add(c, s.skills, info[kind]);
        if (sameSet(s.skills, info[kind])) exact++;
      }
      const r = prf(c);
      if (fmt === "all" && kind === "skills")
        summary = { ...r, exact: exact / group.length };
      out(
        `| ${fmt} | ${group.length} | ${kind === "skills" ? "mục Kỹ năng" : "cả CV"} | ${f(r.precision)} | ${f(r.recall)} | ${f(r.f1)} | ${exact}/${group.length} |`,
      );
    }
  }

  let yearsOk = 0,
    levelOk = 0,
    provOk = 0;
  for (const s of samples) {
    const info = run.infos.get(s.ref)!;
    if (info.years === s.years) yearsOk++;
    else
      detail.push(`${s.ref}: số năm đáp án ${s.years}, rút được ${info.years}`);
    if (info.level === s.level) levelOk++;
    else
      detail.push(`${s.ref}: cấp độ đáp án ${s.level}, rút được ${info.level}`);
    if (info.province === s.province) provOk++;
    else
      detail.push(
        `${s.ref}: tỉnh đáp án ${s.province}, rút được ${info.province}`,
      );
    const miss = s.skills.filter((x) => !info.skills.includes(x));
    const extra = info.skills.filter((x) => !s.skills.includes(x));
    if (miss.length || extra.length) {
      detail.push(
        `${s.ref} [${s.format}]: thiếu [${miss.join(", ")}], thừa [${extra.join(", ")}]`,
      );
    }
  }

  out("\n## Các trường khác\n");
  out("| Trường | Đúng | Tỉ lệ |");
  out("|---|---|---|");
  out(
    `| Số năm kinh nghiệm | ${yearsOk}/${samples.length} | ${pct(yearsOk, samples.length)} |`,
  );
  out(
    `| Cấp độ | ${levelOk}/${samples.length} | ${pct(levelOk, samples.length)} |`,
  );
  out(
    `| Tỉnh/thành | ${provOk}/${samples.length} | ${pct(provOk, samples.length)} |`,
  );

  if (run.label !== "rules") {
    out(
      `\nThời gian trung bình: ${run.msPerCv.toFixed(0)} ms mỗi CV. CV bị lỗi (tính như không rút được gì): ${run.failed}/${samples.length}.`,
    );
  }

  out("\n## Các chỗ sai\n");
  out(
    detail.length === 0 ? "Không có." : detail.map((d) => `- ${d}`).join("\n"),
  );

  const dir = "seed-data/results";
  if (fs.existsSync("seed-data")) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, outFile), lines.join("\n"));
  }
  return {
    summary: {
      label: run.label,
      ...summary,
      years: yearsOk / samples.length,
      level: levelOk / samples.length,
      province: provOk / samples.length,
      msPerCv: run.msPerCv,
      failed: run.failed,
    },
    lines,
  };
}

async function main() {
  const summaries: Summary[] = [];

  if (mode === "rules" || mode === "both") {
    const run = await runExtractor("rules", (t) =>
      Promise.resolve(extractCvInfo(t)),
    );
    summaries.push(
      report(run, ["skills", "mentionedSkills"], "cv-extraction.md").summary,
    );
  }

  if (mode === "llm" || mode === "both") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("dotenv").config();
    } catch {
      /* không có dotenv thì dùng biến môi trường có sẵn */
    }
    const env = (k: string, d?: unknown) => process.env[k] ?? d;
    const llm = new OllamaLlmProvider({ get: env } as never);
    console.log(`\n=== LLM: ${llm.model} ===`);
    // Gọi thử một lần cho mô hình nạp vào bộ nhớ, để thời gian đo không tính lần nạp
    try {
      await extractCvInfoWithLlm(llm, "warm up");
    } catch {
      /* chỉ cần mô hình nạp xong, kết quả bỏ qua */
    }
    const run = await runExtractor("llm", (t) => extractCvInfoWithLlm(llm, t));
    summaries.push(report(run, ["skills"], "cv-extraction-llm.md").summary);
  }

  if (summaries.length === 2) {
    const lines = [
      "\n## So sánh từ điển và LLM (kỹ năng lấy theo mục Kỹ năng)\n",
      "| Cách | Precision | Recall | F1 | CV rút đúng hoàn toàn | Số năm | Cấp độ | Tỉnh | ms mỗi CV | CV lỗi |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...summaries.map(
        (s) =>
          `| ${s.label} | ${f(s.precision)} | ${f(s.recall)} | ${f(s.f1)} | ${f(s.exact)} | ${f(s.years)} | ${f(s.level)} | ${f(s.province)} | ${s.msPerCv.toFixed(1)} | ${s.failed} |`,
      ),
    ];
    lines.forEach((l) => console.log(l));
    if (fs.existsSync("seed-data")) {
      fs.writeFileSync(
        path.join("seed-data/results", "cv-extraction-compare.md"),
        lines.join("\n"),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
