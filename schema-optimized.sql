-- 성능 최적화된 스키마 (300명+ 학생 대응)

-- 기존 인덱스 외 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE role = 'STUDENT';
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_reflections_student_date ON reflections(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_key ON analyses(key);

-- 복합 인덱스로 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_users_class_role ON users(class_id, role) WHERE is_active = true;

-- 날짜별 성찰 조회 최적화
CREATE INDEX IF NOT EXISTS idx_reflections_date_student ON reflections(date, student_id);

-- UNIQUE 제약 추가 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_class_unique 
  ON users(student_id, class_id) 
  WHERE role = 'STUDENT' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reflections_student_date_unique 
  ON reflections(student_id, date);

-- 통계 정보 업데이트 (쿼리 플래너 최적화)
ANALYZE users;
ANALYZE classes;
ANALYZE reflections;
ANALYZE analyses;
