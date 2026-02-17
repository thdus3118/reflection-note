import { GoogleGenerativeAI } from "@google/generative-ai";
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
  getEncouragingFeedback: async (reflection: Reflection, classId?: string): Promise<{ feedback: string, sentiment: string }> => {
    const apiKey = await getTeacherApiKey(classId);
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { feedback: "", sentiment: "neutral" };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

    const prompt = `학생의 오늘 성찰 내용을 바탕으로 따뜻하고 구체적인 격려 피드백을 한글로 작성해주세요.
성찰 내용:
- 오늘 학습: ${reflection.learnedContent}
- 학습 활동: ${reflection.activities}
- 협동 과정: ${reflection.collaboration}
- 수업 태도: ${reflection.attitudeRating}점

JSON 형식으로만 응답: {"feedback": "격려 메시지", "sentiment": "positive|neutral|negative"}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      return { feedback: "", sentiment: "neutral" };
    }
  },

  analyzeClassroomIssues: async (reflections: (Reflection & { studentName: string })[], classId?: string): Promise<any> => {
    const apiKey = await getTeacherApiKey(classId);
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { 
        summary: "API 키가 설정되지 않았습니다.", 
        detectedIssues: [], 
        statistics: { averageRating: 0, positiveCount: 0, alertCount: 0 } 
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

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
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
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
