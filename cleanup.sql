-- 모든 데이터 삭제 (초기화) - 외래 키 제약 해결
UPDATE users SET class_id = NULL;
UPDATE classes SET teacher_id = NULL;

DELETE FROM analyses;
DELETE FROM reflections;
DELETE FROM classes;
DELETE FROM users;

-- 또는 중복만 삭제하려면:
-- 1. 중복 교사 확인
-- SELECT login_id, COUNT(*) FROM users WHERE role = 'TEACHER' GROUP BY login_id HAVING COUNT(*) > 1;

-- 2. 중복 학급 확인
-- SELECT name, year, COUNT(*) FROM classes GROUP BY name, year HAVING COUNT(*) > 1;

-- 3. 중복 제거 (최신 것만 남기고 삭제)
-- DELETE FROM users WHERE id NOT IN (
--   SELECT DISTINCT ON (login_id) id FROM users WHERE role = 'TEACHER' ORDER BY login_id, created_at DESC
-- );

-- DELETE FROM classes WHERE id NOT IN (
--   SELECT DISTINCT ON (name, year) id FROM classes ORDER BY name, year, created_at DESC
-- );
