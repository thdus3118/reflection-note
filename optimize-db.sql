-- ============================================
-- 성능 최적화 스크립트 (300명+ 학생 대응)
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 추가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE role = 'STUDENT';
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_reflections_student_date ON reflections(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_users_class_role ON users(class_id, role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reflections_date_student ON reflections(date, student_id);

-- 2. UNIQUE 제약 추가 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_class_unique 
  ON users(student_id, class_id) 
  WHERE role = 'STUDENT' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reflections_student_date_unique 
  ON reflections(student_id, date);

-- 3. 통계 정보 업데이트
ANALYZE users;
ANALYZE classes;
ANALYZE reflections;
ANALYZE analyses;

-- 4. 자동 VACUUM 설정 (선택사항)
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE reflections SET (autovacuum_vacuum_scale_factor = 0.1);

-- 완료 메시지
SELECT 'Performance optimization completed!' as status;
