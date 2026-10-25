/**
 * Đo việc chấm CV–tin: chạy 40 cặp trong pairs.json, so nhãn máy với nhãn người (label_human).
 *
 *   npm run ai:match -- --split tune               (xem kết quả, chỉnh trọng số nếu muốn)
 *   npm run ai:match -- --split test --final       (CHỈ MỘT LẦN ở cuối)
 *
 * Ba cách chấm được so với nhau:
 *   cosine   : chỉ dùng độ giống của vector
 *   skill    : chỉ dùng tỉ lệ kỹ năng khớp
 *   combined : cosine + kỹ năng + trừ điểm theo cấp độ
 * Ngưỡng "phù hợp / cần xem / không phù hợp" luôn được dò TRÊN TẬP TUNE, rồi mới áp sang tập test.
 *
 * Tùy chọn: --w-cos 0.5 --w-skill 0.5 --w-below 0.15 --w-above 0.05  --verbose
 *           --pairs --resumes --jobs --map --out --force
 */
import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../../app.module";
import { AiService } from "../ai.service";
import {
  accuracy,
  accuracy2,
  classify,
  cohenKappa,
  confusion,
  DEFAULT_WEIGHTS,
  LABELS,
  MatchLabel,
  MatchLevel,
  MatchWeights,
  parseVectorLiteral,
  scoreMatch,
  Thresholds,
} from "../cvs/ai-match.scoring";
import { extractCvInfo } from "../cvs/cv-extractor";

interface Pair {
  pair_id: string;
  resume_ref: string;
  job_ref: string;
  label_human: MatchLabel;
  split: "tune" | "test";
}
interface ResumeItem {
  ref: string;
  text: string;
}
interface JobItem {
  ref: string;
  level: MatchLevel;
  skills: string[];
}

function parseArgs(argv: string[]) {
  const a = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--"))
      a.set(argv[i].slice(2), "true");
    else a.set(argv[i].slice(2), argv[++i]);
  }
  return a;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const f3 = (n: number) => n.toFixed(3);
const readJson = <T>(p: string): T =>
  JSON.parse(fs.readFileSync(p, "utf-8")) as T;

interface Row {
  pair: Pair;
  scores: Record<string, number>;
}

/** Dò ngưỡng trên các cặp tune: thử mọi cặp (review, suitable) giữa các điểm quan sát, lấy cái đúng nhiều nhất. */
function tuneThresholds(rows: Row[], variant: string): Thresholds {
  const vals = [...new Set(rows.map((r) => r.scores[variant]))].sort(
    (a, b) => a - b,
  );
  const cuts = [0, ...vals.slice(1).map((v, i) => (v + vals[i]) / 2), 1.01];
  const truth = rows.map((r) => r.pair.label_human);
  let best: { t: Thresholds; acc: number; kappa: number } | null = null;
  for (let i = 0; i < cuts.length; i++) {
    for (let j = i; j < cuts.length; j++) {
      const t = { review: cuts[i], suitable: cuts[j] };
      const pred = rows.map((r) => classify(r.scores[variant], t));
      const acc = accuracy(truth, pred);
      const kappa = cohenKappa(truth, pred);
      if (!best || acc > best.acc || (acc === best.acc && kappa > best.kappa))
        best = { t, acc, kappa };
    }
  }
  return best!.t;
}

function summarize(rows: Row[], variant: string, t: Thresholds) {
  const truth = rows.map((r) => r.pair.label_human);
  const pred = rows.map((r) => classify(r.scores[variant], t));
  return {
    n: rows.length,
    acc3: accuracy(truth, pred),
    acc2: accuracy2(truth, pred),
    kappa: cohenKappa(truth, pred),
    conf: confusion(truth, pred),
    pred,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const split = args.get("split") ?? "tune";
  const outDir = args.get("out") ?? "seed-data/results";
  const w: MatchWeights = {
    cosine: Number(args.get("w-cos") ?? DEFAULT_WEIGHTS.cosine),
    skill: Number(args.get("w-skill") ?? DEFAULT_WEIGHTS.skill),
    levelBelow: Number(args.get("w-below") ?? DEFAULT_WEIGHTS.levelBelow),
    levelAbove: Number(args.get("w-above") ?? DEFAULT_WEIGHTS.levelAbove),
  };
  if (!["tune", "test"].includes(split)) {
    console.error("--split phải là tune hoặc test");
    process.exit(1);
  }
  const finalFile = path.join(outDir, "match-final.json");
  if (split === "test") {
    if (!args.has("final")) {
      console.error(
        "Tập test chỉ chạy một lần ở cuối. Chỉnh xong trên tập tune rồi thêm --final.",
      );
      process.exit(1);
    }
    if (fs.existsSync(finalFile) && !args.has("force")) {
      console.error(
        `Đã có kết quả cuối ở ${finalFile}. Không chạy lại tập test (thêm --force nếu thật sự cần).`,
      );
      process.exit(1);
    }
  }

  const pairs = readJson<Pair[]>(
    args.get("pairs") ?? "seed-data/data/pairs.json",
  );
  const resumes = new Map(
    readJson<ResumeItem[]>(
      args.get("resumes") ?? "seed-data/data/resumes.json",
    ).map((r) => [r.ref, r]),
  );
  const jobs = new Map(
    readJson<JobItem[]>(args.get("jobs") ?? "seed-data/data/jobs.json").map(
      (j) => [j.ref, j],
    ),
  );
  const idMap = readJson<Record<string, number>>(
    args.get("map") ?? "seed-data/data/job_id_map.json",
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["warn", "error"],
  });
  try {
    let ai: AiService;
    try {
      ai = app.get(AiService, { strict: false });
    } catch {
      console.error(
        "Module AI chưa bật. Đặt AI_ENABLED=true trong .env rồi chạy lại.",
      );
      process.exitCode = 1;
      return;
    }
    const ds = app.get(DataSource);
    try {
      const h = await ai.health();
      console.log(`Ollama OK: ${h.model}, ${h.dimensions} chiều.`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
      return;
    }

    // Vector tin lấy từ DB (đã có từ Bước 2). Vector CV tính ngay từ nội dung CV.
    const jobVec = new Map<string, number[]>();
    for (const ref of new Set(pairs.map((p) => p.job_ref))) {
      const id = idMap[ref];
      if (id === undefined) throw new Error(`job_id_map.json thiếu ${ref}`);
      const r = await ds.query(
        `SELECT embedding::text AS v FROM job_embeddings WHERE job_id = $1`,
        [id],
      );
      if (r.length === 0)
        throw new Error(
          `Tin ${ref} (id ${id}) chưa có vector. Chạy npm run ai:embed-jobs.`,
        );
      jobVec.set(ref, parseVectorLiteral(r[0].v as string));
    }
    const cvVec = new Map<string, number[]>();
    for (const ref of new Set(pairs.map((p) => p.resume_ref))) {
      cvVec.set(ref, await ai.embed(resumes.get(ref)!.text));
    }

    const variants: Record<string, MatchWeights> = {
      cosine: { cosine: 1, skill: 0, levelBelow: 0, levelAbove: 0 },
      skill: { cosine: 0, skill: 1, levelBelow: 0, levelAbove: 0 },
      combined: w,
    };

    const rows: Row[] = pairs.map((p) => {
      const cv = extractCvInfo(resumes.get(p.resume_ref)!.text);
      const job = jobs.get(p.job_ref);
      if (!job) throw new Error(`jobs.json thiếu ${p.job_ref}`);
      const input = {
        cvVector: cvVec.get(p.resume_ref)!,
        jobVector: jobVec.get(p.job_ref)!,
        cvSkills: cv.skills,
        jobSkills: job.skills,
        cvLevel: cv.level,
        jobLevel: job.level,
      };
      const scores: Record<string, number> = {};
      for (const [name, weights] of Object.entries(variants))
        scores[name] = scoreMatch(input, weights).score;
      return { pair: p, scores };
    });

    const tuneRows = rows.filter((r) => r.pair.split === "tune");
    const evalRows = rows.filter((r) => r.pair.split === split);
    const dist = (rs: Row[]) =>
      LABELS.map(
        (l) => `${l} ${rs.filter((r) => r.pair.label_human === l).length}`,
      ).join(", ");
    const baseline = (rs: Row[]) =>
      rs.filter((r) => r.pair.label_human === "unsuitable").length / rs.length;

    const lines: string[] = [
      `Trọng số combined: ${JSON.stringify(w)}`,
      `Tập ${split}: ${evalRows.length} cặp (${dist(evalRows)}).`,
      `Mốc so sánh: luôn đoán "unsuitable" thì đúng ${pct(baseline(evalRows))}.`,
      "",
      `| Cách chấm | Ngưỡng cần xem / phù hợp (dò trên tune) | Đúng 3 nhóm | Đúng 2 nhóm | Kappa |`,
      `|---|---|---|---|---|`,
    ];
    const payload: Record<string, unknown> = { split, weights: w, results: {} };
    for (const v of Object.keys(variants)) {
      const t = tuneThresholds(tuneRows, v);
      const s = summarize(evalRows, v, t);
      lines.push(
        `| ${v} | ${f3(t.review)} / ${f3(t.suitable)} | ${pct(s.acc3)} (${Math.round(s.acc3 * s.n)}/${s.n}) | ${pct(
          s.acc2,
        )} | ${f3(s.kappa)} |`,
      );
      (payload.results as Record<string, unknown>)[v] = {
        thresholds: t,
        acc3: s.acc3,
        acc2: s.acc2,
        kappa: s.kappa,
        confusion: s.conf,
      };
      if (args.has("verbose") || v === "combined") {
        lines.push(
          "",
          `Ma trận nhầm lẫn của "${v}" (hàng = người chấm, cột = máy; thứ tự ${LABELS.join(", ")}):`,
        );
        s.conf.forEach((row, i) =>
          lines.push(`  ${LABELS[i].padEnd(11)} ${row.join("  ")}`),
        );
        lines.push("");
      }
    }
    if (args.has("verbose")) {
      lines.push("Chi tiết từng cặp (điểm combined):");
      const t = tuneThresholds(tuneRows, "combined");
      for (const r of evalRows) {
        const s = r.scores.combined;
        const m = classify(s, t);
        lines.push(
          `  ${r.pair.pair_id} ${r.pair.resume_ref}-${r.pair.job_ref} điểm=${f3(s)} máy=${m} người=${r.pair.label_human}${
            m === r.pair.label_human ? "" : "  <-- khác"
          }`,
        );
      }
    }
    const report = lines.join("\n");
    console.log("\n" + report);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `match-${split}.md`), report + "\n");
    if (split === "test") {
      fs.writeFileSync(
        finalFile,
        JSON.stringify(
          { ...payload, finishedAt: new Date().toISOString() },
          null,
          2,
        ),
      );
      console.log(`\nĐã khóa kết quả cuối: ${finalFile}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
