// Cong cu migration/seed don gian cho PostgreSQL (khong xoa du lieu).
//   npm run db:migrate   ap dung cac file db/migrations/*.sql chua chay (ghi vao bang schema_migrations)
//   npm run db:seed      chay cac file db/seed/*.sql (viet theo kieu chay lai khong tao trung)
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadDotEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function sqlFiles(dir) {
  const full = path.join(__dirname, "..", dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(full, f), "utf8") }));
}

async function main() {
  const cmd = process.argv[2];
  if (!["migrate", "seed"].includes(cmd)) {
    console.error("Cach dung: node scripts/db.js <migrate|seed>");
    process.exit(1);
  }
  loadDotEnv();
  const e = process.env;
  const client = new Client({
    host: e.DB_HOST || "127.0.0.1",
    port: parseInt(e.DB_PORT || "5435", 10),
    user: e.DB_USER || "postgres",
    password: String(e.DB_PASS || "123456"),
    database: e.DB_NAME || "job_board_db",
  });
  await client.connect();
  try {
    if (cmd === "migrate") {
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(200) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
      );
      const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
      const todo = sqlFiles("db/migrations").filter((f) => !done.has(f.name));
      if (todo.length === 0) console.log("Khong co migration moi.");
      for (const f of todo) {
        await client.query("BEGIN");
        try {
          await client.query(f.sql);
          await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f.name]);
          await client.query("COMMIT");
          console.log("Da ap dung: " + f.name);
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Migration ${f.name} loi: ${err.message}`);
        }
      }
    } else {
      for (const f of sqlFiles("db/seed")) {
        await client.query(f.sql);
        console.log("Da chay seed: " + f.name);
      }
      const { rows } = await client.query("SELECT count(*)::int AS n FROM jobs");
      console.log("Tong so tin hien co: " + rows[0].n);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
