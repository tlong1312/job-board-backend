# Tìm hiểu và Ứng dụng NestJS: Xây dựng Backend Hệ thống Tuyển dụng (Job Board)

Dự án tập trung nghiên cứu sâu kiến trúc **NestJS** chuẩn kỹ nghệ phần mềm và giải quyết các bài toán kỹ thuật Backend nâng cao thông qua bài toán minh họa là Hệ thống Tuyển dụng (Job Board).

Stack công nghệ sử dụng: **NestJS, PostgreSQL (pgvector), Redis, RabbitMQ & Docker**.

## Trọng tâm Công nghệ & Kiến trúc (Technical Focus)

Hệ thống loại bỏ các quy trình nghiệp vụ rườm rà, tập trung 100% vào các luồng kỹ thuật cốt lõi:

1. **Kiến trúc & Phân quyền (NestJS Core, Guards, Interceptors):**
   - Tổ chức code theo kiến trúc Modular, áp dụng Dependency Injection (DI), Custom Pipes và Exception Filters.
   - Xác thực JWT và phân quyền RBAC (`RolesGuard`) cho 3 vai trò: `CANDIDATE` (Ứng viên), `EMPLOYER` (Nhà tuyển dụng), và `ADMIN` (Quản trị viên).
2. **Xử lý bất đồng bộ (RabbitMQ Worker):**
   - Đẩy tác vụ nặng (đọc file PDF CV của ứng viên và gọi API bóc tách dữ liệu JSON) xuống hàng đợi chạy ngầm, giúp giải phóng luồng chính và phản hồi HTTP tức thì.
3. **Tìm kiếm ngữ nghĩa - Semantic Search (PostgreSQL + pgvector):**
   - Vector hóa nội dung tin tuyển dụng và hồ sơ ứng viên, kết hợp đánh chỉ mục HNSW để so khớp độ tương đồng ngữ nghĩa nhanh chóng.
4. **Tối ưu hiệu năng & Bảo vệ tài nguyên (Redis):**
   - **Caching:** Lưu đệm danh sách công việc tuyển dụng giúp giảm tải truy vấn xuống Database.
   - **Rate Limiting:** Kiểm soát tần suất gửi request (chống spam API tải lên CV và tìm kiếm).

## Cấu trúc Thư mục Đề tài

```text
src/
├── common/               # Guards (JWT, Roles), Decorators, Filters, Interceptors
├── config/               # Cấu hình biến môi trường (Database, Redis, RabbitMQ)
├── modules/
│   ├── auth/             # Xác thực người dùng & cấp phát Token
│   ├── users/            # Quản lý tài khoản (Candidate, Employer, Admin)
│   ├── jobs/             # CRUD tin tuyển dụng, Redis Cache & Semantic Search (pgvector)
│   ├── resumes/          # Upload CV & đẩy sự kiện vào hàng đợi
│   ├── applications/     # Luồng nộp đơn ứng tuyển & phân quyền dữ liệu
│   └── queue/            # RabbitMQ Producers & Consumers xử lý bóc tách CV ngầm
└── main.ts
```

## Yêu cầu hệ thống (Prerequisites)

- **Node.js**: Phiên bản 20.x trở lên.
- **Docker Desktop**: Bắt buộc phải cài để chạy hạ tầng Database, Cache và Message Queue.
- **Git**: Khuyên dùng Git Bash trên Windows.

## Hướng dẫn cài đặt & Khởi chạy dự án

**Bước 1: Clone dự án và cài đặt thư viện**
Mở terminal và chạy lần lượt các lệnh sau:

```bash
git clone https://github.com/tlong1312/job-board-backend.git
cd job-board-backend
npm install
```

_(Lưu ý: Chỉ sử dụng `npm install`, không dùng yarn hay pnpm để tránh sai lệch file lock)._

**Bước 2: Cấu hình biến môi trường (.env)**
Tạo file `.env` ở thư mục gốc bằng cách copy từ mẫu:

```bash
cp .env.example .env
```

Mở file `.env` vừa tạo và điền các thông số chuẩn cho môi trường local:

```env
PORT=3000

# PostgreSQL (Dùng cho TypeORM và pgvector cho Semantic Search)
DB_HOST=localhost
DB_PORT=5435
DB_USER=postgres
DB_PASS=secret123
DB_NAME=job_board_db

# RabbitMQ (Xử lý bất đồng bộ luồng đọc file CV)
RABBITMQ_URL=amqp://localhost:5673

# Redis (Caching & Rate Limiting)
REDIS_HOST=localhost
REDIS_PORT=6381
```

**Bước 3: Dựng hạ tầng với Docker**
Đảm bảo Docker Desktop đang mở, chạy lệnh sau để kéo image và khởi động các services (PostgreSQL, RabbitMQ, Redis):

```bash
docker compose up -d
```

**Bước 4: Khởi chạy Server NestJS**

```bash
npm run start:dev
```

Server sẽ chạy tại `http://localhost:3000`. Chế độ Hot-reload đã được bật, code lưu file là server tự restart.

## Quy trình Commit & Push Code (Quan trọng)

Hệ thống đã được tích hợp GitHub Actions chặn lỗi tự động (CI). Vui lòng tuân thủ quy trình sau:

1. Không code trực tiếp trên nhánh `main`. Hãy tạo nhánh riêng: `git checkout -b feature/ten-chuc-nang`
2. Đặt tên commit có tiền tố rõ ràng: `feat:` (tính năng mới), `fix:` (sửa lỗi), `chore:` (cấu hình), `refactor:` (tối ưu code).
3. Sau khi push nhánh lên GitHub, tạo Pull Request (PR).
4. **Chỉ merge code khi tiến trình "Backend CI" trên GitHub báo tích xanh.** Nếu báo đỏ, vui lòng click vào xem log lỗi (thường là lỗi ESLint hoặc sai kiểu TypeScript) và fix lại.
