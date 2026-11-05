# Quản lý cơ sở dữ liệu

Ứng dụng đặt `synchronize: false`, nên TypeORM không tự sửa cấu trúc bảng. Lược đồ do hai nơi quản lý:

| Tình huống | Làm gì | Mất dữ liệu? |
|---|---|---|
| Máy mới, chưa có DB | `docker compose up -d`. Postgres tự chạy `init.sql` khi volume còn trống. Sau đó `npm run db:seed` nếu cần 300 tin để đo. | Không |
| DB đã có dữ liệu, lược đồ cũ hơn `init.sql` | `npm run db:migrate`: áp dụng các file trong `db/migrations/` chưa chạy, ghi tên file vào bảng `schema_migrations`. Chạy lại nhiều lần không sao. | Không |
| Muốn làm lại từ đầu trên máy lab | `docker compose down -v` rồi `docker compose up -d`. | **Có, xoá toàn bộ dữ liệu.** Chỉ dùng khi chủ ý reset. |

## Quy ước khi đổi lược đồ

1. Sửa `init.sql` để DB tạo mới có cấu trúc đúng.
2. Thêm một file mới `db/migrations/NNN_ten_thay_doi.sql` (đánh số tăng dần, viết dạng chạy lại được, ví dụ `ADD COLUMN IF NOT EXISTS`) để DB cũ cập nhật theo mà không phải xoá volume.
3. Không sửa file migration đã được áp dụng; muốn đổi tiếp thì thêm file mới.

## Seed dữ liệu đo

`npm run db:seed` chạy các file trong `db/seed/`. File `001_sample_jobs.sql` tạo thêm 298 tin cho công ty "ABC Software" (cùng 2 tin mẫu trong `init.sql` là 300 tin). Chạy lại không tạo trùng.

## Sao lưu trước khi thao tác

```bash
docker exec job_board_postgres pg_dump -U postgres job_board_db > backup.sql
```

## Kết nối của các script

`scripts/db.js` đọc `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` từ `.env` (mặc định giống `src/config.ts`).
