-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable all for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON classes;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON reflections;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON analyses;

-- anon 키로도 접근 가능하도록 정책 수정
CREATE POLICY "Enable all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON reflections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON analyses FOR ALL USING (true) WITH CHECK (true);
