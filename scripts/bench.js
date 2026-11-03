// Cong cu do cho Bang 6.1 (ILIKE so voi full-text) va Bang 6.2 (cache).
//   node scripts/bench.js fts  [--runs 30]
//   node scripts/bench.js http --url "http://localhost:3000/api/jobs?level=junior" [--runs 30] [--label "Khong cache"]
// Ket qua in ra la so do thuc tren may chay lenh, hay chay lai tren may nhom roi ghi vao bao cao.
const fs = require("fs");
const path = require("path");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(a, p) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
function scanTypes(node, out = []) {
  if (/Scan/.test(node["Node Type"] || "") && !out.includes(node["Node Type"])) out.push(node["Node Type"]);
  (node.Plans || []).forEach((c) => scanTypes(c, out));
  return out;
}
function loadDotEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function fts(runs) {
  const { Client } = require("pg");
  loadDotEnv();
  const e = process.env;
  const c = new Client({
    host: e.DB_HOST || "127.0.0.1", port: parseInt(e.DB_PORT || "5435", 10),
    user: e.DB_USER || "postgres", password: String(e.DB_PASS || "123456"),
    database: e.DB_NAME || "job_board_db",
  });
  await c.connect();
  const total = (await c.query("SELECT count(*)::int AS n FROM jobs")).rows[0].n;
  console.log(`So tin trong bang jobs: ${total}; moi truy van chay ${runs} lan, lay trung vi Execution Time.\n`);
  const keywords = [["nestjs", "nestjs"], ["backend", "backend"], ["nest", "nest"], ["phat trien", "phat | trien"]];
  const timeOf = async (sql) => {
    const r = await c.query("EXPLAIN (ANALYZE, FORMAT JSON) " + sql);
    const plan = r.rows[0]["QUERY PLAN"][0];
    return { ms: plan["Execution Time"], rows: plan.Plan["Actual Rows"], scans: scanTypes(plan.Plan) };
  };
  const lines = ["| Tu khoa | ILIKE: dong / ms | FTS: dong / ms | Kieu quet FTS | FTS (tat seqscan): ms / kieu quet |", "|---|---|---|---|---|"];
  for (const [label, tsq] of keywords) {
    const likeSql = `SELECT id FROM jobs WHERE status='open' AND (title ILIKE ${lit("%" + label + "%")} OR description ILIKE ${lit("%" + label + "%")})`;
    const ftsSql = `SELECT id FROM jobs WHERE status='open' AND search_vector @@ to_tsquery('simple', ${lit(tsq)})`;
    await c.query("RESET enable_seqscan");
    await timeOf(likeSql); await timeOf(ftsSql); // khoi dong, bo qua
    const l = [], f = [];
    let lr, fr;
    for (let i = 0; i < runs; i++) { lr = await timeOf(likeSql); l.push(lr.ms); fr = await timeOf(ftsSql); f.push(fr.ms); }
    await c.query("SET enable_seqscan = off");
    await timeOf(ftsSql);
    const g = []; let gr;
    for (let i = 0; i < runs; i++) { gr = await timeOf(ftsSql); g.push(gr.ms); }
    await c.query("RESET enable_seqscan");
    lines.push(`| ${label} | ${lr.rows} / ${median(l).toFixed(3)} | ${fr.rows} / ${median(f).toFixed(3)} | ${fr.scans.join(", ")} | ${median(g).toFixed(3)} / ${gr.scans.join(", ")} |`);
  }
  console.log(lines.join("\n"));
  await c.end();
}

async function http(runs) {
  const url = arg("url");
  if (!url) { console.error('Thieu --url'); process.exit(1); }
  const label = arg("label", "");
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = await fetch(url);
    await res.arrayBuffer();
    times.push(performance.now() - t0);
    if (i === 0 && !res.ok) console.warn("Canh bao: request dau tra ve " + res.status);
  }
  const rest = times.slice(1);
  console.log(`${label ? label + ": " : ""}${url}`);
  console.log(`Lan dau (co the la cache miss): ${times[0].toFixed(2)} ms`);
  console.log(`Cac lan sau (${rest.length} lan): trung vi ${median(rest).toFixed(2)} ms, p95 ${pct(rest, 95).toFixed(2)} ms, nho nhat ${Math.min(...rest).toFixed(2)} ms`);
  console.log(`Tat ca ${times.length} lan: trung vi ${median(times).toFixed(2)} ms`);
}

const cmd = process.argv[2];
const runs = parseInt(arg("runs", "30"), 10);
(cmd === "fts" ? fts(runs) : cmd === "http" ? http(runs) : Promise.reject(new Error("Cach dung: node scripts/bench.js <fts|http>")))
  .catch((err) => { console.error(err.message); process.exit(1); });
