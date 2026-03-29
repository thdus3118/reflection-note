import { GoogleGenAI } from "@google/genai";
import { Reflection } from "./types";
import { supabase } from "./supabaseClient";

const getTeacherApiKey = async (classId?: string): Promise<string | null> => {
  const currentUser = JSON.parse(localStorage.getItem('reflection_note_session_v2') || 'null');
  if (!currentUser?.id) return null;
  
  // 학생인 경우: 해당 수업의 교사 API 키 사용
  if (currentUser.role === 'STUDENT' && classId) {
    const { data: classData } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .single();
    
    if (!classData?.teacher_id) return null;
    
    const { data: teacherData } = await supabase
      .from('users')
      .select('gemini_api_key')
      .eq('id', classData.teacher_id)
      .single();
    
    return teacherData?.gemini_api_key || null;
  }
  
  // 교사인 경우: 자신의 API 키 사용
  const { data } = await supabase
    .from('users')
    .select('gemini_api_key')
    .eq('id', currentUser.id)
    .single();
  
  return data?.gemini_api_key || null;
};

export const aiService = {
  getEncouragingFeedback: async (reflection: Reflection, classId?: string, weeklyContext?: string): Promise<{ feedback: string, sentiment: string }> => {
    const apiKey = await getTeacherApiKey(classId);
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { feedback: "", sentiment: "neutral" };
    }

    const ai = new GoogleGenAI({ apiKey });

    let contextString = "";
    if (weeklyContext) {
      contextString = `\n[학생의 최근 주간 피드백 참고자료]\n${weeklyContext}\n\n위 참고자료의 맥락을 이어서 위 성찰에 대한 한 줄 칭찬/격려를 해주세요. 예: "지난주엔 ~~해서 아쉬웠는데 이번엔 ~~하려 노력했네! 멋지다!"`;
    }

    const prompt = `학생의 성찰에 대해 한 문장으로 짧고 따뜻한 격려를 해주세요.
성찰: 학습=${reflection.learnedContent}, 활동=${reflection.activities}, 협동=${reflection.collaboration}, 태도=${reflection.attitudeRating}점${contextString}

JSON으로만 응답: {"feedback": "20자 이내 격려", "sentiment": "positive|neutral|negative"}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { maxOutputTokens: 50, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      return { feedback: "", sentiment: "neutral" };
    }
  },

  generateWeeklyFeedback: async (
    reflections: (Reflection & { studentName: string })[],
    student: { id: string; name: string },
    weekStart: string,
    weekEnd: string,
    classId: string
  ): Promise<string> => {
    const apiKey = await getTeacherApiKey(classId);
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') return '';

    const ai = new GoogleGenAI({ apiKey });
    const TARGET_COUNT = 3;
    const writeCount = reflections.length;

    const reflectionText = writeCount > 0
      ? reflections.map((r, i) =>
          `[${i + 1}일차] 별점:${r.attitudeRating} | 학습:${r.learnedContent} | 활동:${r.activities} | 협동:${r.collaboration}`
        ).join('\n')
      : '이번 주 작성한 성찰이 없습니다.';

    const prompt = `당신은 영어 회화 수업을 담당하는 따뜻한 선생님입니다.
${student.name} 학생의 이번 주(${weekStart} ~ ${weekEnd}) 성찰 노트를 바탕으로 개별 피드백을 작성해주세요.

[성찰 데이터]
${reflectionText}

[피드백 작성 기준]
1. 작성 횟수: 이번 주 ${writeCount}/${TARGET_COUNT}회 작성${writeCount < TARGET_COUNT ? ` (${TARGET_COUNT - writeCount}회 부족 - 꾸준한 작성 독려)` : ' (목표 달성 - 칭찬)'}
2. 영어 회화 수업 참여도 및 학습 성찰의 질 평가 (구체적인지, 영어 회화와 직접 연관되는지)
3. 모둠 활동 참여 및 협동 성찰의 질 평가
4. 다음 주 구체적 개선 조언

조건:
- 3~5문장, 진심어린 한국어
- ${student.name} 학생에게 직접 말하는 투로
- 성찰이 없으면 작성 독려 위주로

피드백 텍스트만 바로 출력:`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: prompt,
        config: { maxOutputTokens: 400 }
      });
      return response.text.trim();
    } catch (e) {
      console.error('Weekly feedback error:', e);
      return '';
    }
  },

  analyzeClassroomIssues: async (reflections: (Reflection & { studentName: string })[], classId?: string): Promise<any> => {
    const apiKey = await getTeacherApiKey(classId);
    console.log('🔑 API Key check:', { hasKey: !!apiKey, keyLength: apiKey?.length, classId });
    
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { 
        summary: "API 키가 설정되지 않았습니다.", 
        detectedIssues: [], 
        statistics: { averageRating: 0, positiveCount: 0, alertCount: 0 } 
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const content = reflections.map(r => `[학생:${r.studentName}] 별점:${r.attitudeRating} 내용:${r.learnedContent} 활동:${r.activities} 협동:${r.collaboration}`).join("\n");
    
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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    } catch (error: any) {
      console.error("AI Class Analysis Error:", error);
      let errorMsg = "데이터 분석 중 오류가 발생했습니다.";
      if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
        errorMsg = "API 사용량 한계에 도달했습니다. 잠시 후 다시 시도하거나 API 키를 확인해주세요.";
      }
      return { 
        summary: errorMsg, 
        detectedIssues: [], 
        statistics: { averageRating: 0, positiveCount: 0, alertCount: 0 } 
      };
    }
  }
};
