# Job Board Backend (NestJS)

Backend REST API cho website đăng tin tuyển dụng, làm cho môn Các Công nghệ Lập trình Hiện đại. Ba vai trò: ứng viên (`candidate`), nhà tuyển dụng (`employer`) và quản trị viên (`admin`). Hệ thống chỉ là phương tiện để áp dụng các cơ chế của NestJS.

Công nghệ: NestJS 11, TypeORM, PostgreSQL 16, Redis, RabbitMQ, Mailpit (hộp thư giả khi dev), Jest, Swagger.

## Các module (src/modules)

| Module | Nội dung |
|---|---|
| auth | Đăng ký, đăng nhập, refresh token, đổi mật khẩu, đăng xuất (JWT, bcrypt) |
| users | Hồ sơ người dùng, khoá và mở khoá tài khoản |
| companies | Công ty của nhà tuyển dụng (một nhà tuyển dụng có nhiều công ty) |
| jobs | Tin tuyển dụng, lọc và phân trang; `jobs/search` là tìm kiếm full-text (`GET /api/search/jobs?q=`) |
| resumes | Tải CV, CV mặc định, xem file có kiểm tra quyền |
| applications | Nộp hồ sơ, đổi trạng thái (có transaction và lịch sử), rút hồ sơ |
| skills | Danh mục kỹ năng của tin |
| redis | Cache danh sách và chi tiết tin (TTL 60 giây), giới hạn tần suất (`@RateLimit`) |
| mail | Hàng đợi RabbitMQ gửi email khi đổi trạng thái hồ sơ, có nhật ký `email_logs` |

`src/commons` chứa lớp lỗi, `ServiceErrorsFilter`, `JwtAuthGuard`, `RolesGuard`, các decorator `@Public`, `@Roles`, `@CurrentUser`. Mọi route mặc định phải đăng nhập, route công khai ghi `@Public()`.

## Yêu cầu

Node.js 20 trở lên, Docker Desktop, Git.

## Chạy dự án

```bash
git clone https://github.com/tlong1312/job-board-backend.git
cd job-board-backend
cp .env.example .env        # Windows PowerShell: copy .env.example .env
# Sửa JWT_ACCESS_SECRET và JWT_REFRESH_SECRET thành chuỗi ngẫu nhiên riêng
docker compose up -d        # postgres (5435), redis (6381), rabbitmq (5673, quản trị 15673), mailpit (SMTP 1026, xem thư 8026)
npm install
npm run start:dev
```

- Swagger: http://localhost:3000/api-docs
- Xem email giả: http://localhost:8026
- Tài khoản mẫu (mật khẩu `Password@123`): `admin@jobboard.local`, `employer@jobboard.local`, `candidate@jobboard.local`

## Cơ sở dữ liệu

Lược đồ nằm ở `init.sql` (chạy tự động khi volume Postgres còn trống). Đổi lược đồ trên DB đã có dữ liệu dùng `npm run db:migrate`; nạp 300 tin để đo hiệu năng dùng `npm run db:seed`. `docker compose down -v` xoá toàn bộ dữ liệu nên chỉ dùng khi muốn reset. Chi tiết ở [docs/DATABASE.md](docs/DATABASE.md).

## Kiểm thử

```bash
npm test            # unit test (Jest)
npm run test:e2e    # e2e
npm run lint
npm run build
node scripts/e2e-flow.js            # chạy luồng nghiệp vụ qua API đang chạy, in bảng kết quả
node scripts/bench.js fts           # đo ILIKE so với full-text trên DB hiện tại
node scripts/bench.js http --url "http://localhost:3000/api/jobs?level=junior" --label "Có cache"
```

CI (GitHub Actions) chạy lint, build và unit test cho mỗi push và pull request.

## Cấu hình quan trọng

| Biến | Ý nghĩa |
|---|---|
| `DB_*` | Kết nối PostgreSQL (mặc định khớp docker-compose) |
| `REDIS_HOST`, `REDIS_PORT` | Redis cho cache và rate limit; Redis lỗi thì API vẫn chạy bằng DB |
| `RABBITMQ_URL` | Hàng đợi gửi email |
| `MAIL_*` | SMTP; mặc định trỏ vào Mailpit |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Khoá ký token, bắt buộc tự sinh riêng |
| `CORS_ORIGINS` | Danh sách origin được gọi API, cách nhau bằng dấu phẩy. Để trống chỉ hợp lệ khi dev; khi `NODE_ENV=production` mà để trống thì CORS bị tắt |

## Giới hạn tần suất hiện có

Đăng ký 5 lần mỗi phút, đăng nhập 10, đổi mật khẩu 5, tìm kiếm tin 30, nộp hồ sơ 10, tải CV 10 (theo người dùng nếu đã đăng nhập, theo IP nếu là route công khai). Vượt hạn mức trả 429 kèm `Retry-After`.
