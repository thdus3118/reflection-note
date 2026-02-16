# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성
1. https://supabase.com 접속 후 로그인
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. 리전 선택 (Northeast Asia - Seoul 권장)

## 2. 데이터베이스 스키마 생성
1. Supabase 대시보드에서 "SQL Editor" 메뉴 선택
2. `schema.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭하여 실행

## 3. 환경 변수 설정
1. Supabase 대시보드에서 "Settings" > "API" 메뉴 선택
2. 다음 값을 복사:
   - Project URL
   - anon public key

3. `.env.local` 파일 수정:
```
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. 애플리케이션 실행
```bash
npm install
npm run dev
```

## 주요 변경사항
- localStorage → Supabase PostgreSQL
- 모든 DB 메서드가 async/await 패턴으로 변경
- 컴포넌트에서 DB 호출 시 await 필요

## 데이터베이스 테이블
- `users`: 사용자 정보 (관리자, 교사, 학생)
- `classes`: 학급 정보
- `reflections`: 성찰 일지
- `analyses`: AI 분석 결과 캐싱

## 보안
- Row Level Security (RLS) 활성화됨
- 현재는 모든 인증된 사용자가 접근 가능
- 필요시 정책을 수정하여 세밀한 권한 제어 가능
