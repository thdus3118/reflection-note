-- =============================================
-- Cron 자동 실행 설정
-- Supabase 대시보드 > SQL Editor 에서 실행
-- =============================================

-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================
-- 주간 AI 피드백: 매주 토요일 21:00 KST (= 12:00 UTC)
-- =============================================

-- 기존 job 삭제
SELECT cron.unschedule('weekly-ai-feedback') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-feedback'
);

-- 매주 토요일 12:00 UTC (= 21:00 KST) 실행
SELECT cron.schedule(
  'weekly-ai-feedback',
  '0 12 * * 6',
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

-- =============================================
-- 매일 학급 분석: 매일 22:00 KST (= 13:00 UTC)
-- =============================================

-- 기존 job 삭제
SELECT cron.unschedule('daily-class-analysis') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-class-analysis'
);

-- 매일 13:00 UTC (= 22:00 KST) 실행
SELECT cron.schedule(
  'daily-class-analysis',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/daily-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 등록 확인
SELECT jobname, schedule, command FROM cron.job 
WHERE jobname IN ('weekly-ai-feedback', 'daily-class-analysis');
