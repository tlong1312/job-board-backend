-- =====================================================================
-- ai-init.sql - Nen cho module AI (chay SAU init.sql)
-- Vector 1024 chieu = mo hinh bge-m3. Doi mo hinh khac thi phai doi so chieu.
-- Chay lai nhieu lan khong loi (IF NOT EXISTS).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- CV: van ban doc ra tu file, thong tin AI rut ra, vector
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,            -- chu doc ra tu file CV
  ADD COLUMN IF NOT EXISTS parsed_data    JSONB,           -- {skills:[], level:'junior', years:1}
  ADD COLUMN IF NOT EXISTS embedding      vector(1024),
  ADD COLUMN IF NOT EXISTS parsed_at      TIMESTAMPTZ;

-- Tin tuyen dung: vector rieng mot bang, de tat AI thi bang jobs khong bi anh huong
CREATE TABLE IF NOT EXISTS job_embeddings (
  job_id       INT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  embedding    vector(1024) NOT NULL,
  model        VARCHAR(80)  NOT NULL,
  content_hash CHAR(64)     NOT NULL,                      -- sha256 noi dung, noi dung khong doi thi khong nhung lai
  embedded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_embeddings_hnsw
  ON job_embeddings USING hnsw (embedding vector_cosine_ops);
