import * as fs from "fs";
import * as path from "path";
import { extractCvInfo } from "../cvs/cv-extractor";

interface Sample {
  ref: string;
  format: string;
  text: string;
  skills: string[];
  years: number;
  level: string;
  province: string;
}

const file = process.argv[2] ?? "seed-data/data/resumes.json";
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
for (const fmt of formats) {
  const group = samples.filter((s) => fmt === "all" || s.format === fmt);
  for (const kind of ["skills", "mentionedSkills"] as const) {
    const c: Counts = { tp: 0, fp: 0, fn: 0 };
    let exact = 0;
    for (const s of group) {
      const info = extractCvInfo(s.text);
      add(c, s.skills, info[kind]);
      if (sameSet(s.skills, info[kind])) exact++;
    }
    const r = prf(c);
    out(
      `| ${fmt} | ${group.length} | ${kind === "skills" ? "mục Kỹ năng" : "cả CV"} | ${f(r.precision)} | ${f(r.recall)} | ${f(r.f1)} | ${exact}/${group.length} |`,
    );
  }
}

let yearsOk = 0,
  levelOk = 0,
  provOk = 0;
for (const s of samples) {
  const info = extractCvInfo(s.text);
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

out("\n## Các chỗ sai\n");
out(detail.length === 0 ? "Không có." : detail.map((d) => `- ${d}`).join("\n"));

const dir = "seed-data/results";
if (fs.existsSync("seed-data")) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "cv-extraction.md"), lines.join("\n"));
}
