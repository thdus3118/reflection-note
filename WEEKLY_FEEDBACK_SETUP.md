# 주간 AI 피드백 자동화 설정 가이드

매주 일요일 밤 9시(KST)에 자동으로 주간 피드백이 생성됩니다.

---

## 1단계: Supabase CLI 설치 및 로그인

```bash
npm install -g supabase
supabase login
```

## 2단계: 프로젝트 연결

```bash
cd "C:\Users\thdus\Desktop\VS code\reflection-note"
supabase link --project-ref noaoxiwbxjmloaytsqpk
```

## 3단계: Edge Function 배포

```bash
supabase functions deploy weekly-feedback --no-verify-jwt
```

## 4단계: Edge Function 환경변수 설정

Supabase 대시보드 → Edge Functions → weekly-feedback → Secrets 에서 추가:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | https://noaoxiwbxjmloaytsqpk.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | (대시보드 Settings > API > service_role 키) |

## 5단계: pg_cron 설정

Supabase 대시보드 → SQL Editor 에서 `setup-cron.sql` 내용 실행

단, pg_cron에서 http_post를 쓰려면 `pg_net` 확장도 필요합니다:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

그리고 app 설정값 등록:
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://noaoxiwbxjmloaytsqpk.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '여기에_service_role_키_입력';
```

---

## 수동 테스트 (배포 후)

```bash
supabase functions invoke weekly-feedback
```

또는 브라우저/curl:
```bash
curl -X POST https://noaoxiwbxjmloaytsqpk.supabase.co/functions/v1/weekly-feedback \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 동작 방식

1. pg_cron이 매주 일요일 21:00 KST에 Edge Function 호출
2. Edge Function이 모든 학급을 순회
3. 각 학급의 이번 주(월~일) 성찰 데이터 수집
4. 교사의 Gemini API 키로 피드백 생성
5. `weekly_ai_feedbacks` 테이블에 저장
6. 학생들이 다음 주 성찰 작성 화면에서 공지로 확인
