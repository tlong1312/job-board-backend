// Chay luong nghiep vu chinh qua API that va in bang ket qua (dung cho muc 12.2.3, Bang 5.2 va Bang 12.2).
//   Yeu cau: ung dung dang chay (npm run start:dev), Postgres/Redis/RabbitMQ dang chay.
//   node scripts/e2e-flow.js            (BASE_URL mac dinh http://localhost:3000/api)
// Luu y: dang ky bi gioi han 5 lan/phut moi IP; script dung 4 lan dang ky nen khong chay lai trong vong 1 phut.
const BASE = process.env.BASE_URL || "http://localhost:3000/api";
const stamp = Date.now();
const results = [];
let n = 0;

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
function short(b) {
  if (b === undefined || b === null) return "";
  const s = typeof b === "string" ? b : JSON.stringify(b);
  return s.length > 110 ? s.slice(0, 107) + "..." : s;
}
async function step(title, method, url, expect, opts) {
  const r = await call(method, url, opts);
  n += 1;
  const ok = r.status === expect;
  results.push({ n, title, req: `${method} /api${url}`, expect, actual: r.status, ok, body: short(r.body && (r.body.message || r.body.errors) ? { message: r.body.message, errors: r.body.errors } : r.body) });
  return r;
}
const tokenOf = (r) => r.body && (r.body.accessToken || (r.body.data && r.body.data.accessToken));
const idOf = (r) => r.body && (r.body.id || (r.body.data && r.body.data.id));

async function register(role, name) {
  const email = `${role}.${name}.${stamp}@test.local`;
  const r = await step(`Dang ky ${role} ${name}`, "POST", "/auth/register", 201, {
    body: { email, password: "Password123", confirmPassword: "Password123", fullName: `${name} ${role}`, role },
  });
  return { email, token: tokenOf(r), id: r.body && r.body.user && r.body.user.id };
}

(async () => {
  const empA = await register("employer", "A");
  const empB = await register("employer", "B");
  const canA = await register("candidate", "A");
  const canB = await register("candidate", "B");
  await step("Dang nhap sai mat khau", "POST", "/auth/login", 401, { body: { email: canA.email, password: "SaiMatKhau1" } });

  const company = await step("Employer A tao cong ty", "POST", "/companies", 201, { token: empA.token, body: { name: `Cong ty ${stamp}`, province: "Hồ Chí Minh", address: "Quan 1" } });
  const companyId = idOf(company);
  await step("Candidate tao cong ty (sai vai tro)", "POST", "/companies", 403, { token: canA.token, body: { name: "x" } });
  const deadline = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const job = await step("Employer A dang tin", "POST", "/jobs", 201, { token: empA.token, body: { companyId, title: `Backend NestJS ${stamp}`, description: "Phat trien API", province: "Hồ Chí Minh", jobType: "full_time", level: "junior", salaryMin: 10000000, salaryMax: 20000000, deadline } });
  const jobId = idOf(job);
  await step("Luong min lon hon max", "POST", "/jobs", 400, { token: empA.token, body: { companyId, title: "Loi luong", salaryMin: 20000000, salaryMax: 10000000 } });
  await step("Employer B dang tin vao cong ty cua A", "POST", "/jobs", 403, { token: empB.token, body: { companyId, title: "Khong duoc" } });
  await step("Khach xem danh sach tin", "GET", "/jobs", 200);
  await step("Id tin khong hop le", "GET", "/jobs/abc", 400);
  await step("Khach goi API can dang nhap", "GET", "/users", 401);
  await step("Candidate goi API cua admin", "GET", "/users", 403, { token: canA.token });
  await step("Employer B sua tin cua A", "PATCH", `/jobs/${jobId}`, 403, { token: empB.token, body: { title: "Bi sua" } });
  await step("Candidate sua tin", "PATCH", `/jobs/${jobId}`, 403, { token: canA.token, body: { title: "Bi sua" } });

  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), "cv.pdf");
  form.append("isDefault", "true");
  const cv = await step("Candidate A tai CV", "POST", "/resumes", 201, { token: canA.token, form });
  const cvId = idOf(cv);
  await step("Candidate B xoa CV cua A", "DELETE", `/resumes/${cvId}`, 403, { token: canB.token });
  await step("Xoa CV khong token", "DELETE", `/resumes/${cvId}`, 401);

  const app = await step("Candidate A nop ho so", "POST", "/applications", 201, { token: canA.token, body: { jobId, resumeId: cvId, coverLetter: "Em xin ung tuyen" } });
  const appId = idOf(app);
  await step("Candidate A nop lan hai", "POST", "/applications", 409, { token: canA.token, body: { jobId, resumeId: cvId } });
  await step("Employer nop ho so (sai vai tro)", "POST", "/applications", 403, { token: empA.token, body: { jobId } });
  await step("Candidate B xem ho so cua A", "GET", `/applications/${appId}`, 403, { token: canB.token });
  await step("Employer B xem ho so vao tin cua A", "GET", `/applications/${appId}`, 403, { token: empB.token });
  await step("Candidate A xem ho so cua minh", "GET", `/applications/${appId}`, 200, { token: canA.token });
  await step("Candidate A doi trang thai", "PATCH", `/applications/${appId}/status`, 403, { token: canA.token, body: { status: "viewed" } });
  await step("Employer B doi trang thai", "PATCH", `/applications/${appId}/status`, 403, { token: empB.token, body: { status: "viewed" } });
  await step("Employer A doi new -> viewed", "PATCH", `/applications/${appId}/status`, 200, { token: empA.token, body: { status: "viewed", note: "Da xem" } });
  await step("Doi lai viewed", "PATCH", `/applications/${appId}/status`, 400, { token: empA.token, body: { status: "viewed" } });
  await step("Employer A doi viewed -> rejected", "PATCH", `/applications/${appId}/status`, 200, { token: empA.token, body: { status: "rejected" } });
  await step("Doi tiep sau khi bi tu choi", "PATCH", `/applications/${appId}/status`, 400, { token: empA.token, body: { status: "interview" } });
  const hist = await step("Xem lich su doi trang thai", "GET", `/applications/${appId}/history`, 200, { token: canA.token });

  console.log("\n| # | Buoc | Request | Mong doi | Thuc te | Ket qua | Noi dung tra ve |\n|---|---|---|---|---|---|---|");
  for (const r of results) console.log(`| ${r.n} | ${r.title} | ${r.req} | ${r.expect} | ${r.actual} | ${r.ok ? "dung" : "LECH"} | ${String(r.body).replace(/\|/g, "/")} |`);
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} buoc dung mong doi.`);
  console.log(`Lich su ho so ${appId}: ${Array.isArray(hist.body) ? hist.body.map((h) => `${h.fromStatus}->${h.toStatus}`).join(", ") : short(hist.body)}`);
  console.log(`Ids: job ${jobId}, ho so ${appId}, CV ${cvId}.`);
  console.log("Doi chieu DB: SELECT id, status FROM applications WHERE id = " + appId + "; SELECT * FROM application_status_history WHERE application_id = " + appId + "; SELECT status, attempts FROM email_logs ORDER BY id DESC LIMIT 3;");
  process.exit(bad.length ? 2 : 0);
})().catch((e) => { console.error("Loi khi chay luong:", e.message); process.exit(1); });
