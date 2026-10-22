/**
 * Đo chất lượng tìm kiếm: chạy các truy vấn trong queries.json qua 4 cách và tính
 * nDCG@10, P@10, P@10 (chỉ điểm 2), MRR@10.
 *
 *   npm run ai:eval -- --split tune                  (dùng khi chỉnh tham số)
 *   npm run ai:eval -- --split test --final          (CHỈ MỘT LẦN ở cuối)
 *
 * Tùy chọn: --modes like,fts,vector,hybrid  --k 10  --verbose
 *           --rrf-k 60  --cand 50  --w-fts 1  --w-vec 1
 *           --queries <file>  --map <file>  --out <thư mục>  --force
 */
import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../../app.module";
import { AiService } from "../ai.service";
import {
  AiSearchService,
  DEFAULT_HYBRID,
  HybridOptions,
  SEARCH_MODES,
  SearchMode,
} from "../search/ai-search.service";
import {
  Grades,
  mean,
  ndcgAtK,
  precisionAtK,
  reciprocalRank,
} from "../eval/ai-eval.metrics";

interface QueryItem {
  qid: string;
  query: string;
  group: string;
  split: "tune" | "test";
  relevant: Record<string, number>;
}

interface Scores {
  ndcg: number;
  p: number;
  pStrict: number;
  mrr: number;
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

const fmt = (n: number) => n.toFixed(3);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const split = args.get("split") ?? "tune";
  const k = Number(args.get("k") ?? 10);
  const modes = (args.get("modes") ?? SEARCH_MODES.join(",")).split(
    ",",
  ) as SearchMode[];
  const hybrid: HybridOptions = {
    rrfK: Number(args.get("rrf-k") ?? DEFAULT_HYBRID.rrfK),
    candidates: Number(args.get("cand") ?? DEFAULT_HYBRID.candidates),
    weightFts: Number(args.get("w-fts") ?? DEFAULT_HYBRID.weightFts),
    weightVec: Number(args.get("w-vec") ?? DEFAULT_HYBRID.weightVec),
  };
  const outDir = args.get("out") ?? "seed-data/results";
  const final = split !== "tune";

  if (!["tune", "test", "all"].includes(split)) {
    console.error("--split phải là tune, test hoặc all");
    process.exit(1);
  }
  for (const m of modes) {
    if (!SEARCH_MODES.includes(m)) {
      console.error(`Cách tìm không hợp lệ: ${m}`);
      process.exit(1);
    }
  }

  // Chốt tập test: phải có --final, và chỉ chạy một lần (trừ khi --force)
  const finalFile = path.join(outDir, "search-final.json");
  if (final) {
    if (!args.has("final")) {
      console.error(
        "Tập test chỉ được chạy một lần ở cuối. Nếu chắc chắn đã chỉnh xong tham số trên tập tune, thêm --final.",
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

  const queries: QueryItem[] = JSON.parse(
    fs.readFileSync(
      args.get("queries") ?? "seed-data/data/queries.json",
      "utf-8",
    ),
  );
  const idMap: Record<string, number> = JSON.parse(
    fs.readFileSync(
      args.get("map") ?? "seed-data/data/job_id_map.json",
      "utf-8",
    ),
  );
  const selected = queries.filter((q) => split === "all" || q.split === split);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["warn", "error"],
  });
  try {
    let search: AiSearchService;
    let ai: AiService;
    try {
      search = app.get(AiSearchService, { strict: false });
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

    const embedded = Number(
      (await ds.query(`SELECT count(*) AS n FROM job_embeddings`))[0].n,
    );
    const open = new Set<number>(
      (await ds.query(`SELECT id FROM jobs WHERE status = 'open'`)).map(
        (r: { id: number }) => Number(r.id),
      ),
    );
    console.log(`DB: ${open.size} tin open, ${embedded} tin đã có vector.`);
    if (embedded === 0) {
      console.error("Chưa có vector nào. Chạy npm run ai:embed-jobs trước.");
      process.exitCode = 1;
      return;
    }

    // Đổi mã J### sang id thật, bỏ tin không còn open (tìm kiếm chỉ trả tin open)
    let dropped = 0;
    const grades = new Map<string, Grades>();
    for (const q of selected) {
      const g: Grades = new Map();
      for (const [ref, grade] of Object.entries(q.relevant)) {
        const id = idMap[ref];
        if (id === undefined) throw new Error(`job_id_map.json thiếu ${ref}`);
        if (open.has(id)) g.set(id, grade);
        else dropped++;
      }
      grades.set(q.qid, g);
    }
    console.log(
      `Tập ${split}: ${selected.length} truy vấn, bỏ ${dropped} cặp (tin không còn open).`,
    );
    console.log(`Hybrid: ${JSON.stringify(hybrid)}\n`);

    const vectors = new Map<string, number[]>();
    if (modes.includes("vector") || modes.includes("hybrid")) {
      for (const q of selected) vectors.set(q.qid, await ai.embed(q.query));
    }

    const results: Record<string, Record<string, Scores>> = {};
    for (const mode of modes) {
      results[mode] = {};
      for (const q of selected) {
        const g = grades.get(q.qid)!;
        if (g.size === 0) continue;
        const hits = await search.search(
          q.query,
          mode,
          k,
          hybrid,
          vectors.get(q.qid),
        );
        const ranked = hits.map((h) => h.id);
        results[mode][q.qid] = {
          ndcg: ndcgAtK(ranked, g, k),
          p: precisionAtK(ranked, g, k, 1),
          pStrict: precisionAtK(ranked, g, k, 2),
          mrr: reciprocalRank(ranked, g, k, 1),
        };
        if (args.has("verbose")) {
          console.log(
            `${q.qid} [${mode}] ${q.query}  nDCG=${fmt(results[mode][q.qid].ndcg)}`,
          );
        }
      }
    }

    // Bảng kết quả: tổng và theo nhóm truy vấn
    const groups = ["all", ...new Set(selected.map((q) => q.group))];
    const lines: string[] = [];
    for (const group of groups) {
      const ids = selected
        .filter((q) => group === "all" || q.group === group)
        .map((q) => q.qid);
      lines.push(
        `### ${group === "all" ? "Tất cả" : group} (${ids.length} truy vấn)`,
        "",
      );
      lines.push(
        `| Cách | nDCG@${k} | P@${k} | P@${k} (điểm 2) | MRR@${k} |`,
        "|---|---|---|---|---|",
      );
      for (const mode of modes) {
        const rows = ids.map((id) => results[mode][id]).filter(Boolean);
        lines.push(
          `| ${mode} | ${fmt(mean(rows.map((r) => r.ndcg)))} | ${fmt(mean(rows.map((r) => r.p)))} | ${fmt(
            mean(rows.map((r) => r.pStrict)),
          )} | ${fmt(mean(rows.map((r) => r.mrr)))} |`,
        );
      }
      lines.push("");
    }
    const report = lines.join("\n");
    console.log(report);

    fs.mkdirSync(outDir, { recursive: true });
    const payload = {
      split,
      k,
      hybrid,
      modes,
      dropped,
      results,
      finishedAt: new Date().toISOString(),
    };
    if (final) {
      fs.writeFileSync(finalFile, JSON.stringify(payload, null, 2));
      fs.writeFileSync(path.join(outDir, "search-final.md"), report);
      console.log(`Đã lưu kết quả cuối vào ${outDir}/search-final.{json,md}`);
    } else {
      fs.writeFileSync(
        path.join(outDir, "search-tune-latest.json"),
        JSON.stringify(payload, null, 2),
      );
      fs.writeFileSync(path.join(outDir, "search-tune-latest.md"), report);
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
