import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function getKSTDate(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

async function analyzeClass(
  apiKey: string,
  classId: string,
  targetDate: string,
  reflections: any[]
): Promise<any> {
  const content = reflections.map((r: any) =>
    `[학생:${r.student_name}] 별점:${r.attitude_rating} 내용:${r.learned_content} 활동:${r.activities} 협동:${r.collaboration}`
  ).join('\n');

  const prompt = `당신은 베테랑 학급 담임 교사입니다. 다음 학생들의 오늘 성찰 일지를 분석하여 '교사 가이드'를 작성해주세요.

특히 다음 세 가지 측면을 집중적으로 분석하십시오:
1. 학업 부진: 학습 내용 기술이 너무 빈약하거나 '모르겠다', '어렵다'는 표현이 지배적인 학생
2. 관계 갈등: 협동 과정에서 친구에 대한 불만, 소외감, 갈등 징후가 보이는 학생
3. 정서적 위기/태도: 무기력함, 지나친 자기비하, 혹은 수업 거부 의사가 보이는 학생

학생 데이터:
${content}

JSON 형식으로만 응답:
{
  "summary": "학급 전체 분위기 요약",
  "detectedIssues": [
    {
      "studentName": "학생이름",
      "issueType": "학업부진|관계갈등|정서위기|태도불량",
      "severity": "high|medium|low",
      "description": "구체적 이유",
      "actionTip": "지도 조언"
    }
  ],
  "statistics": {
    "averageRating": 평균점수,
    "positiveCount": 긍정학생수,
    "alertCount": 경고학생수
  }
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetDate = body.date || getKSTDate();

  const { data: allClasses } = await supabase.from('classes').select('id, teacher_id');
  if (!allClasses?.length) {
    return new Response(JSON.stringify({ date: targetDate, results: ['no classes'] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: string[] = [];

  for (const cls of allClasses) {
    const cacheKey = `${cls.id}_${targetDate}`;

    // 이미 분석된 경우 스킵
    const { data: existing } = await supabase
      .from('analyses')
      .select('key')
      .eq('key', cacheKey)
      .maybeSingle();

    if (existing) {
      results.push(`class ${cls.id}: already analyzed`);
      continue;
    }

    // 교사 API 키 가져오기
    const { data: teacher } = await supabase
      .from('users')
      .select('gemini_api_key')
      .eq('id', cls.teacher_id)
      .single();

    const apiKey = teacher?.gemini_api_key;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      results.push(`class ${cls.id}: no api key`);
      continue;
    }

    // 해당 학급의 학생 목록
    const { data: students } = await supabase
      .from('users')
      .select('id, name')
      .eq('class_id', cls.id)
      .eq('is_active', true);

    if (!students?.length) {
      results.push(`class ${cls.id}: no students`);
      continue;
    }

    const studentIds = students.map(s => s.id);
    const studentMap = new Map(students.map(s => [s.id, s.name]));

    // 해당 날짜의 성찰 데이터
    const { data: reflections } = await supabase
      .from('reflections')
      .select('student_id, attitude_rating, learned_content, activities, collaboration')
      .in('student_id', studentIds)
      .eq('date', targetDate);

    if (!reflections?.length) {
      results.push(`class ${cls.id}: no reflections for ${targetDate}`);
      continue;
    }

    const enriched = reflections.map(r => ({
      ...r,
      student_name: studentMap.get(r.student_id) || '알 수 없음',
    }));

    try {
      const analysisResult = await analyzeClass(apiKey, cls.id, targetDate, enriched);
      await supabase.from('analyses').upsert({
        key: cacheKey,
        result: { ...analysisResult, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
      results.push(`class ${cls.id}: ok (${enriched.length} reflections)`);
    } catch (e: any) {
      results.push(`class ${cls.id}: error - ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return new Response(JSON.stringify({ date: targetDate, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
