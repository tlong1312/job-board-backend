# AI Study Assistant - Backend

Hệ thống Backend cho dự án AI Study Assistant tích hợp RAG.
Stack công nghệ sử dụng: **NestJS, PostgreSQL (pgvector), Redis, RabbitMQ & Docker**.

## Yêu cầu hệ thống (Prerequisites)

- **Node.js**: Phiên bản 20.x trở lên.
- **Docker Desktop**: Bắt buộc phải cài để chạy hạ tầng Database, Cache và Message Queue.
- **Git**: Khuyên dùng Git Bash trên Windows.

## Hướng dẫn cài đặt & Khởi chạy dự án

**Bước 1: Clone dự án và cài đặt thư viện**
Mở terminal và chạy lần lượt các lệnh sau:

```bash
git clone <LINK_GITHUB_CỦA_BẠN>
cd ai-study-backend
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

# PostgreSQL (Dùng cho TypeORM và pgvector cho RAG)
DB_HOST=localhost
DB_PORT=5435
DB_USER=postgres
DB_PASS=secret123
DB_NAME=ai_study_db

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5673

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Bước 3: Dựng hạ tầng với Docker**
Đảm bảo Docker Desktop đang mở, chạy lệnh sau để kéo image và khởi động các services (PostgreSQL, RabbitMQ, Redis):

```bash
docker-compose up -d
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
