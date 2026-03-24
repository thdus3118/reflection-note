-- weekly_ai_feedbacks 테이블 재생성 (student_id 추가)
DROP TABLE IF EXISTS weekly_ai_feedbacks;

CREATE TABLE weekly_ai_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_feedbacks_student_id ON weekly_ai_feedbacks(student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_feedbacks_class_id ON weekly_ai_feedbacks(class_id);

ALTER TABLE weekly_ai_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all" ON weekly_ai_feedbacks FOR ALL USING (true);
