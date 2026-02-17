-- users 테이블에 gemini_api_key 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- 기존 교사들의 API 키를 NULL로 초기화 (교사가 직접 입력하도록)
UPDATE users SET gemini_api_key = NULL WHERE role = 'TEACHER';
