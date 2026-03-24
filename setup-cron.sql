-- =============================================
-- 매주 일요일 21:00 KST (= 12:00 UTC) 자동 실행
-- Supabase 대시보드 > SQL Editor 에서 실행
-- =============================================

-- 1. pg_cron 확장 활성화 (이미 활성화된 경우 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 기존 job 있으면 삭제 후 재등록
SELECT cron.unschedule('weekly-ai-feedback') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-feedback'
);

-- 3. 매주 일요일 12:00 UTC (= 21:00 KST) 실행
SELECT cron.schedule(
  'weekly-ai-feedback',
  '0 12 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/weekly-feedback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. 등록 확인
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'weekly-ai-feedback';
