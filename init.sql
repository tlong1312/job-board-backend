-- =====================================================================
-- init.sql - Co so du lieu cho do an Job Board (PostgreSQL 14+)
-- Chay tu dong lan dau khi container PostgreSQL khoi tao volume trong.
-- Muon chay lai tu dau: docker compose down -v && docker compose up -d
-- Quy uoc: ten bang/cot snake_case, rang buoc trang thai bang CHECK.
-- =====================================================================

-- ---------- Ham dung chung: tu cap nhat updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. USERS & AUTH
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20)  NOT NULL DEFAULT 'candidate'
                CHECK (role IN ('candidate', 'employer', 'admin')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,   -- admin khoa tai khoan = FALSE
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Refresh token cho JWT (luu ban bam, khong luu token goc)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ  NOT NULL,
  revoked_at TIMESTAMPTZ,                              -- NULL = con hieu luc
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- =====================================================================
-- 2. COMPANIES, SKILLS
-- =====================================================================
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  owner_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  website     VARCHAR(255),
  address     VARCHAR(255),
  logo_path   VARCHAR(255),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);

CREATE TABLE IF NOT EXISTS skills (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

-- =====================================================================
-- 3. JOBS
-- =====================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id          SERIAL PRIMARY KEY,
  company_id  INT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by  INT          NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  location    VARCHAR(150),
  job_type    VARCHAR(20)  NOT NULL DEFAULT 'full_time'
              CHECK (job_type IN ('full_time', 'part_time', 'internship', 'contract')),
  level       VARCHAR(20)
              CHECK (level IN ('intern', 'junior', 'middle', 'senior')),
  salary_min  INT CHECK (salary_min >= 0),
  salary_max  INT CHECK (salary_max >= 0),
  currency    VARCHAR(3)   NOT NULL DEFAULT 'VND',
  status      VARCHAR(20)  NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'closed', 'blocked')),  -- blocked: admin khoa
  deadline    DATE,
  views_count INT          NOT NULL DEFAULT 0,
  -- Cot tim kiem full-text, Postgres tu tinh lai khi title/description doi
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, ''))
  ) STORED,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_jobs_salary CHECK (
    salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min
  )
);
-- Tim kiem full-text (Tang 3)
CREATE INDEX IF NOT EXISTS idx_jobs_search      ON jobs USING GIN (search_vector);
-- Cursor pagination: loc theo status, sap xep moi nhat truoc
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company     ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by  ON jobs(created_by);

-- Job <-> Skill (nhieu-nhieu)
CREATE TABLE IF NOT EXISTS job_skills (
  job_id   INT NOT NULL REFERENCES jobs(id)   ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill ON job_skills(skill_id);

-- Ung vien luu tin de xem sau
CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     INT         NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

-- =====================================================================
-- 4. RESUMES (CV)
-- =====================================================================
CREATE TABLE IF NOT EXISTS resumes (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(100),
  file_size   INT CHECK (file_size >= 0),
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
-- Moi ung vien chi co toi da 1 CV mac dinh
CREATE UNIQUE INDEX IF NOT EXISTS uq_resumes_default ON resumes(user_id) WHERE is_default;

-- =====================================================================
-- 5. APPLICATIONS (ho so ung tuyen)
-- =====================================================================
CREATE TABLE IF NOT EXISTS applications (
  id           SERIAL PRIMARY KEY,
  job_id       INT         NOT NULL REFERENCES jobs(id)    ON DELETE CASCADE,
  candidate_id INT         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  resume_id    INT         REFERENCES resumes(id)          ON DELETE SET NULL,
  cover_letter TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'viewed', 'interview', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Mot ung vien chi nop mot job mot lan
  CONSTRAINT uq_application_job_candidate UNIQUE (job_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_job_status ON applications(job_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_candidate  ON applications(candidate_id);

-- Lich su doi trang thai ho so (nguon phat su kien gui mail)
CREATE TABLE IF NOT EXISTS application_status_history (
  id             SERIAL PRIMARY KEY,
  application_id INT         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    VARCHAR(20),
  to_status      VARCHAR(20) NOT NULL,
  changed_by     INT         REFERENCES users(id) ON DELETE SET NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_history_app ON application_status_history(application_id);

-- =====================================================================
-- 6. EMAIL LOGS (phuc vu hang doi RabbitMQ: retry, idempotency)
-- =====================================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id              SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,     -- chong gui trung khi message bi giao lai
  to_email        VARCHAR(255) NOT NULL,
  subject         VARCHAR(255) NOT NULL,
  template        VARCHAR(80),
  payload         JSONB,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        INT          NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- =====================================================================
-- 7. TRIGGER updated_at
-- =====================================================================
DROP TRIGGER IF EXISTS trg_users_updated        ON users;
CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_companies_updated    ON companies;
CREATE TRIGGER trg_companies_updated    BEFORE UPDATE ON companies    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_jobs_updated         ON jobs;
CREATE TRIGGER trg_jobs_updated         BEFORE UPDATE ON jobs         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_applications_updated ON applications;
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 8. DU LIEU MAU (mat khau cua ca 3 tai khoan: Password@123)
-- =====================================================================
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('admin@jobboard.local',     '$2b$10$dX4ye8p.VgjxkZxxzXj9k.oDGMflBuSQCjuMSYvbN7vYLGgn6uG.W', 'Quản trị viên',     'admin'),
  ('employer@jobboard.local',  '$2b$10$dX4ye8p.VgjxkZxxzXj9k.oDGMflBuSQCjuMSYvbN7vYLGgn6uG.W', 'Nhà tuyển dụng A', 'employer'),
  ('candidate@jobboard.local', '$2b$10$dX4ye8p.VgjxkZxxzXj9k.oDGMflBuSQCjuMSYvbN7vYLGgn6uG.W', 'Nguyễn Văn A',     'candidate')
ON CONFLICT (email) DO NOTHING;

INSERT INTO companies (owner_id, name, description, website, address)
SELECT id, 'ABC Software', 'Công ty phần mềm chuyên về dịch vụ backend.', 'https://abc.example.com', 'Quận 1, TP. Hồ Chí Minh'
FROM users WHERE email = 'employer@jobboard.local'
  AND NOT EXISTS (SELECT 1 FROM companies WHERE name = 'ABC Software');

INSERT INTO skills (name) VALUES
  ('NestJS'), ('TypeScript'), ('PostgreSQL'), ('Docker'), ('React'), ('Redis')
ON CONFLICT (name) DO NOTHING;

INSERT INTO jobs (company_id, created_by, title, description, location, job_type, level, salary_min, salary_max)
SELECT c.id, c.owner_id, v.title, v.descr, 'TP. Hồ Chí Minh', v.jtype, v.lvl, v.smin, v.smax
FROM companies c
CROSS JOIN (VALUES
  ('Backend Developer (NestJS)', 'Phát triển và bảo trì REST API bằng NestJS và PostgreSQL. Ưu tiên biết Docker.', 'full_time',  'junior', 15000000, 25000000),
  ('Backend Intern (NestJS)',    'Thực tập xây dựng API với NestJS, có mentor hướng dẫn.',                          'internship', 'intern',  4000000,  6000000)
) AS v(title, descr, jtype, lvl, smin, smax)
WHERE c.name = 'ABC Software'
  AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.title = v.title AND j.company_id = c.id);

INSERT INTO job_skills (job_id, skill_id)
SELECT j.id, s.id FROM jobs j JOIN skills s ON s.name IN ('NestJS', 'TypeScript', 'PostgreSQL')
WHERE j.title LIKE 'Backend%'
ON CONFLICT DO NOTHING;