-- Du lieu tong hop de do hieu nang (full-text search, cache): tao them 298 tin
-- cho cong ty "ABC Software" (cong voi 2 tin mau trong init.sql la 300 tin).
-- Chay lai nhieu lan khong tao trung (kiem tra theo cong ty + tieu de).
UPDATE jobs SET province = 'Hồ Chí Minh'
 WHERE province IS NULL AND location LIKE '%Hồ Chí Minh%';

WITH gen AS (
  SELECT g,
    (ARRAY['Backend NestJS Developer','Frontend React Developer','Phát triển phần mềm Java',
           'Backend Node.js Engineer','DevOps Docker Engineer'])[1 + g % 5] AS base,
    (ARRAY['Xây dựng REST API bằng NestJS và PostgreSQL',
           'Phát triển giao diện React cho hệ thống nội bộ',
           'Phat trien phan mem backend voi Java Spring',
           'Backend với Node.js, Redis và Docker',
           'Vận hành Docker và CI cho nhóm backend'])[1 + g % 5] AS descr
  FROM generate_series(1, 298) AS g
)
INSERT INTO jobs (company_id, created_by, title, description, location, province,
                  job_type, level, salary_min, salary_max)
SELECT c.id, c.owner_id, gen.base || ' ' || gen.g, gen.descr,
       'TP. Hồ Chí Minh', 'Hồ Chí Minh', 'full_time',
       (ARRAY['intern','junior','middle','senior'])[1 + gen.g % 4], 10000000, 30000000
  FROM companies c
 CROSS JOIN gen
 WHERE c.name = 'ABC Software'
   AND NOT EXISTS (SELECT 1 FROM jobs j
                    WHERE j.company_id = c.id AND j.title = gen.base || ' ' || gen.g);
