-- Users 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  name TEXT NOT NULL,
  login_id TEXT NOT NULL,
  student_id TEXT,
  class_id UUID REFERENCES classes(id),
  password_hash TEXT NOT NULL,
  is_first_login BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes 테이블
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year TEXT NOT NULL,
  teacher_id UUID REFERENCES users(id),
  target_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reflections 테이블
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  attitude_rating INTEGER NOT NULL,
  learned_content TEXT NOT NULL,
  activities TEXT NOT NULL,
  collaboration TEXT NOT NULL,
  ai_feedback TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  teacher_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyses 테이블 (AI 분석 결과 캐싱)
CREATE TABLE analyses (
  key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_login_id ON users(login_id);
CREATE INDEX idx_users_class_id ON users(class_id);
CREATE INDEX idx_reflections_student_id ON reflections(student_id);
CREATE INDEX idx_reflections_date ON reflections(date);

-- RLS (Row Level Security) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자가 읽기/쓰기 가능 (애플리케이션 레벨에서 권한 관리)
CREATE POLICY "Enable all for authenticated users" ON users FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON classes FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON reflections FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON analyses FOR ALL USING (true);
