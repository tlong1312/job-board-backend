# Bộ dữ liệu mẫu cho phần AI của Job Board (Bước 0)

Thư mục này gồm dữ liệu tổng hợp để thử tìm kiếm theo ngữ nghĩa và chấm độ phù hợp CV với tin. Toàn bộ công ty, tin tuyển dụng và CV đều là hư cấu, sinh bằng `gen_data.py` với seed cố định nên chạy lại luôn ra đúng cùng một bộ.

## Có gì trong `data/`

- `jobs.json`: 300 tin (285 tin open, 15 tin closed), 16 loại vị trí, 4 cấp độ, 5 tỉnh/thành. Các trường khớp bảng `jobs` trong `init.sql`, thêm `skills` (đã chuẩn hóa) và `_meta` (thuộc tính dùng để gán nhãn, không đưa vào model).
- `companies.json`: 24 công ty, mỗi công ty có một tài khoản employer riêng (`employer01@jobboard.local` ... `employer24@jobboard.local`, mật khẩu `Password@123`).
- `skills.json`: danh sách kỹ năng chuẩn kèm các cách viết khác.
- `queries.json`: 30 truy vấn, chia ba nhóm: từ khóa (10), ngữ nghĩa (12), không dấu hoặc viết tắt (8). Mỗi truy vấn có `relevant` là danh sách mã tin đúng kèm điểm 2 (rất phù hợp) hoặc 1 (phù hợp một phần), và `split` là `tune` hoặc `test`.
- `resumes.json`: 20 CV giả (đã ẩn tên và liên lạc), có cả bản viết gọn, bản lộn xộn một đoạn và bản tiếng Anh.
- `pairs.json`: 40 cặp CV với tin, nhãn `suitable`, `review`, `unsuitable` (13, 14, 13), có `split`.
- `queries_review.csv` và `pairs_review.csv`: bản mở bằng Excel để kiểm tra tay và điền cột nhãn của người.
- `stats.json`: thống kê bộ dữ liệu.

## Cách nạp vào DB

Thêm cột địa chỉ trước (hoặc sửa thẳng trong `init.sql` rồi `docker compose down -v` và `up -d`):

```sql
ALTER TABLE companies ADD COLUMN province VARCHAR(80), ADD COLUMN ward VARCHAR(80);
ALTER TABLE jobs ADD COLUMN province VARCHAR(80);
```

Chép thư mục này vào repo (ví dụ `seed-data/`), rồi chạy:

```
npx ts-node seed-data/seed.ts
```

Kết nối đọc từ `DATABASE_URL`, hoặc `DB_HOST`, `DB_PORT` (mặc định 5435), `DB_USER`, `DB_PASSWORD`, `DB_NAME` (mặc định `job_board_db`). Script chạy trong một transaction, chạy lại không bị trùng, và ghi `data/job_id_map.json` để đổi mã `J001...` sang id thật khi chấm điểm. Nếu thiếu cột, script báo rõ và dừng.

## Những điều cần biết trước khi dùng số liệu

Nhãn của truy vấn và của cặp CV-tin là nhãn gán bằng quy tắc dựa trên thuộc tính lúc sinh dữ liệu (vị trí, cấp độ, tỉnh, kỹ năng), không phải do người đọc từng tin rồi chấm. Vì vậy chúng chỉ là nhãn tạm, và có hai rủi ro cần xử lý.

Thứ nhất, nhãn có thể sai với một số tin cụ thể. Hãy mở `queries_review.csv` và chọn khoảng 10 truy vấn, đọc thử các tin trong `relevant` xem có đúng không, rồi ghi vào cột kiểm tra tay. Sai nhiều thì sửa tiêu chí trong `gen_data.py` rồi sinh lại.

Thứ hai, nhãn của cặp CV-tin được tính từ tỷ lệ trùng kỹ năng, vị trí và cấp độ. Nếu lớp chấm điểm của bạn cũng dựa vào khớp kỹ năng thì nó sẽ gần như tái hiện đúng quy tắc này và độ chính xác trông cao một cách giả tạo. Cột `label_human` để trống là để bạn và một bạn trong nhóm tự gán lại ít nhất khoảng 20 cặp, rồi báo cáo độ lệch giữa nhãn tự động và nhãn người. Số liệu đo cuối cùng nên dựa trên nhãn người.

Ngoài ra, tin sinh từ mẫu nên văn phong vẫn lặp lại hơn tin thật. Các truy vấn nhóm ngữ nghĩa đã được viết khác với nội dung tin nhưng không hoàn toàn không trùng từ, nên full-text vẫn có thể bắt được một phần, và đó là điều bình thường khi đo. Hãy ghi rõ trong báo cáo rằng dữ liệu là tổng hợp, cách sinh và cách gán nhãn.

## Cách chia tập

Mỗi truy vấn và mỗi cặp có `split` là `tune` (khoảng 70%, dùng để chỉnh ngưỡng và trọng số) hoặc `test` (khoảng 30%, chỉ chạy một lần ở cuối). Đừng chỉnh tham số dựa trên tập `test`.

## Sinh lại

```
python3 gen_data.py
```

Đổi `SEED` trong file để ra một bộ khác. Sau khi sinh lại, chạy lại `seed.ts` trên DB trống để id không lệch.
