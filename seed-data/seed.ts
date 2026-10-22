/**
 * Nạp dữ liệu mẫu (24 công ty, 300 tin tuyển dụng) vào PostgreSQL của Job Board.
 *
 * Cách chạy (từ thư mục gốc của repo job-board-backend, sau khi chép thư mục này vào repo):
 *   npx ts-node seed-data/seed.ts
 *
 * Chạy lại nhiều lần không bị trùng. Sau khi chạy xong sẽ ghi file data/job_id_map.json
 * (mã J001... trong bộ dữ liệu -> id thật trong bảng jobs) để chấm điểm truy vấn về sau.
 *
 * Cần DB đã có các cột: companies.province, companies.ward, jobs.province.
 * Kết nối lấy từ biến môi trường DATABASE_URL, hoặc DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 */
/* eslint-disable */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const { Client } = require('pg');

const DATA_DIR = join(__dirname, 'data');
// Băm bcrypt của mật khẩu Password@123, giống ba tài khoản mẫu trong init.sql
const PASSWORD_HASH = '$2b$10$dX4ye8p.VgjxkZxxzXj9k.oDGMflBuSQCjuMSYvbN7vYLGgn6uG.W';

const read = (name: string) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8'));

async function ensureColumns(client: any) {
  const need: [string, string][] = [
    ['companies', 'province'],
    ['companies', 'ward'],
    ['jobs', 'province'],
  ];
  const { rows } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('companies', 'jobs')`,
  );
  const have = new Set(rows.map((r: any) => `${r.table_name}.${r.column_name}`));
  const missing = need.filter(([t, c]) => !have.has(`${t}.${c}`));
  if (missing.length) {
    console.error('DB đang thiếu cột: ' + missing.map(([t, c]) => `${t}.${c}`).join(', '));
    console.error('Chạy các lệnh sau rồi seed lại:');
    console.error('  ALTER TABLE companies ADD COLUMN province VARCHAR(80), ADD COLUMN ward VARCHAR(80);');
    console.error('  ALTER TABLE jobs ADD COLUMN province VARCHAR(80);');
    process.exit(1);
  }
}

async function main() {
  const client = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5435),
          user: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'job_board_db',
        },
  );
  await client.connect();

  const skills = read('skills.json');
  const companies = read('companies.json');
  const jobs = read('jobs.json');

  try {
    await ensureColumns(client);
    await client.query('BEGIN');

    for (const s of skills) {
      await client.query('INSERT INTO skills (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [s.name]);
    }

    // Mỗi công ty có một tài khoản employer riêng (một employer một công ty)
    const companyId: Record<string, number> = {};
    const ownerId: Record<string, number> = {};
    let newCompanies = 0;
    for (const c of companies) {
      const u = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'employer')
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [c.owner_email, PASSWORD_HASH, c.owner_name],
      );
      ownerId[c.ref] = u.rows[0].id;

      const found = await client.query('SELECT id FROM companies WHERE owner_id = $1 AND name = $2', [
        ownerId[c.ref],
        c.name,
      ]);
      if (found.rows.length) {
        companyId[c.ref] = found.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO companies (owner_id, name, description, website, address, province, ward)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [ownerId[c.ref], c.name, c.description, c.website, c.address, c.province, c.ward],
        );
        companyId[c.ref] = ins.rows[0].id;
        newCompanies++;
      }
    }

    const idMap: Record<string, number> = {};
    let newJobs = 0;
    for (const j of jobs) {
      const cid = companyId[j.company_ref];
      const found = await client.query(
        'SELECT id FROM jobs WHERE company_id = $1 AND title = $2 AND description = $3',
        [cid, j.title, j.description],
      );
      let id: number;
      if (found.rows.length) {
        id = found.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO jobs (company_id, created_by, title, description, location, province, job_type, level,
                             salary_min, salary_max, currency, status, deadline, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
          [
            cid, ownerId[j.company_ref], j.title, j.description, j.location, j.province, j.job_type, j.level,
            j.salary_min, j.salary_max, j.currency, j.status, j.deadline, j.created_at,
          ],
        );
        id = ins.rows[0].id;
        newJobs++;
      }
      idMap[j.ref] = id;
      await client.query(
        `INSERT INTO job_skills (job_id, skill_id)
         SELECT $1, id FROM skills WHERE name = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [id, j.skills],
      );
    }

    await client.query('COMMIT');
    writeFileSync(join(DATA_DIR, 'job_id_map.json'), JSON.stringify(idMap, null, 2), 'utf-8');
    console.log(`Xong: thêm ${newCompanies} công ty mới, ${newJobs} tin mới (tổng ${jobs.length} tin trong bộ dữ liệu).`);
    console.log('Đã ghi data/job_id_map.json');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
