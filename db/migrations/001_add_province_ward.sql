-- Them cot tinh/phuong cho DB tao tu init.sql ban cu (khong co cac cot nay).
-- An toan khi chay lai: dung IF NOT EXISTS.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS province VARCHAR(80);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ward     VARCHAR(80);
ALTER TABLE jobs      ADD COLUMN IF NOT EXISTS province VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_jobs_province ON jobs (LOWER(province));
