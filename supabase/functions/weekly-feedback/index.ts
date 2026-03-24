import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function getWeekRange() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
  };
}

async function generateStudentFeedback(
  apiKey: string,
  studentName: string,
  reflections: any[],
  weekStart: string,
  weekEnd: string
): Promise<string> {
  const TARGET_COUNT = 3;
  const writeCount = reflections.length;

  const reflectionText = writeCount > 0
    ? reflections.map((r: any, i: number) =>
        `[${i + 1}일차] 별점:${r.attitude_rating} | 학습:${r.learned_content} | 활동:${r.activities} | 협동:${r.collaboration}`
      ).join('\n')
    : '이번 주 작성한 성찰이 없습니다.';

  const prompt = `당신은 영어 회화 수업을 담당하는 따뜻한 선생님입니다.
${studentName} 학생의 지난 주(${weekStart} ~ ${weekEnd}) 성찰 노트를 바탕으로 개별 피드백을 작성해주세요.

[피드백 핵심 목적]
- 이 피드백은 학생이 **이번 주 새롭게 성찰 노트를 쓸 때 목표와 방향성**을 잡을 수 있도록 돕는 용도입니다.
- 지난 주에 잘된 점을 칭찬하는 동시에, **"이번 주에는 이런 점에 포인트를 두고 수업/모둠활동에 참여해보자"**는 구체적인 목표를 제안해주세요.

[성찰 데이터]
${reflectionText}

[피드백 작성 기준]
1. 작성 횟수: 이번 주 ${writeCount}/${TARGET_COUNT}회 작성${writeCount < TARGET_COUNT ? ` (${TARGET_COUNT - writeCount}회 부족 - 꾸준한 작성 독려)` : ' (목표 달성 - 칭찬)'}
2. 과거 성찰: 지난 주 영어 회화 수업 참여도와 모둠 활동 협동성에 대한 칭찬/격려
3. **[중요] 이번 주 목표 제안**: 위 데이터를 바탕으로, 이번 주에 집중하거나 개선해볼 구체적 행동 1~2가지를 친근하게 제안

조건:
- 3~5문장, 진심어린 한국어
- ${studentName} 학생에게 직접 말하는 투로
- 성찰 기록이 전혀 없다면, 작성 독려 및 기본적인 수업 참여 목표 위주로

피드백 텍스트만 바로 출력:`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

async function processClass(classId: string, weekStart: string, weekEnd: string): Promise<string[]> {
  const results: string[] = [];

  const { data: cls, error: classErr } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .single();

  if (classErr || !cls) {
    results.push(`class ${classId}: not found`);
    return results;
  }

  const { data: teacher } = await supabase
    .from('users')
    .select('gemini_api_key')
    .eq('id', cls.teacher_id)
    .single();

  const apiKey = teacher?.gemini_api_key;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    results.push(`class ${classId}: no api key`);
    return results;
  }

  const { data: students } = await supabase
    .from('users')
    .select('id, name')
    .eq('class_id', classId)
    .eq('is_active', true);

  if (!students?.length) {
    results.push(`class ${classId}: no students`);
    return results;
  }

  for (const student of students) {
    const { data: existing } = await supabase
      .from('weekly_ai_feedbacks')
      .select('id')
      .eq('student_id', student.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existing) {
      results.push(`${student.name}: skipped`);
      continue;
    }

    const { data: reflections } = await supabase
      .from('reflections')
      .select('attitude_rating, learned_content, activities, collaboration')
      .eq('student_id', student.id)
      .gte('date', weekStart)
      .lte('date', weekEnd);

    try {
      const feedback = await generateStudentFeedback(
        apiKey, student.name, reflections ?? [], weekStart, weekEnd
      );
      if (!feedback) throw new Error('empty');

      await supabase.from('weekly_ai_feedbacks').upsert(
        { student_id: student.id, class_id: classId, week_start: weekStart, week_end: weekEnd, feedback },
        { onConflict: 'student_id,week_start' }
      );
      results.push(`${student.name}: ok`);
    } catch (e: any) {
      results.push(`${student.name}: error - ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const classId: string | undefined = body.class_id;

  const { weekStart, weekEnd } = getWeekRange();
  let allResults: string[] = [];

  if (classId) {
    // 특정 학급만 처리 (수동 호출 시)
    allResults = await processClass(classId, weekStart, weekEnd);
  } else {
    // 모든 학급 순회 (cron 자동 호출 시)
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id');

    if (allClasses && allClasses.length > 0) {
      for (const cls of allClasses) {
        const results = await processClass(cls.id, weekStart, weekEnd);
        allResults.push(...results);
      }
    } else {
      allResults.push('no classes found');
    }
  }

  return new Response(JSON.stringify({ weekStart, weekEnd, results: allResults }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
