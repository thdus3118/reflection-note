# Vercel + Supabase 배포 가이드

## ⚠️ 해결된 문제
1. ✅ DB 호출 async/await 적용 (index.tsx, LoginView.tsx)
2. ✅ Vercel 설정 파일 추가

## 🚨 남은 주의사항

### 1. 환경 변수 설정 (중요!)
Vercel 대시보드에서 설정:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

**절대 .env.local을 Git에 커밋하지 마세요!**

### 2. 나머지 컴포넌트 수정 필요
다음 파일들도 DB 호출을 async/await로 변경해야 합니다:
- `views/StudentDashboard.tsx`
- `views/TeacherDashboard.tsx`
- `views/AdminDashboard.tsx`
- `components/ReflectionForm.tsx`

### 3. Supabase RLS 정책 강화
현재는 모든 접근 허용 상태입니다. 프로덕션에서는:
```sql
-- 예시: 학생은 자신의 데이터만 조회
CREATE POLICY "Students can view own reflections" 
ON reflections FOR SELECT 
USING (student_id = auth.uid());
```

### 4. 비밀번호 해싱
현재 평문 저장 중입니다. bcrypt 등으로 해싱 권장:
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

### 5. 에러 처리
모든 async 함수에 try-catch 추가 권장

## 📦 배포 순서

### 1단계: Supabase 설정
```bash
# schema.sql 실행
# Supabase 대시보드 > SQL Editor에서 실행
```

### 2단계: Vercel 배포
```bash
# Vercel CLI 설치 (선택)
npm i -g vercel

# 배포
vercel

# 또는 GitHub 연동 후 자동 배포
```

### 3단계: 환경 변수 설정
Vercel 대시보드 > Settings > Environment Variables

### 4단계: 초기 데이터 생성
첫 배포 후 사이트 접속 시 `DB.init()` 자동 실행

## 🐛 예상 런타임 에러

### "Cannot read properties of undefined"
→ DB 호출에 await 누락

### "CORS error"
→ Supabase 대시보드에서 Vercel 도메인 허용

### "RLS policy violation"
→ Supabase RLS 정책 확인

### "Environment variable not found"
→ Vercel 환경 변수 재확인 후 재배포

## 🔍 디버깅 팁
```typescript
// supabaseClient.ts에 로깅 추가
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```
