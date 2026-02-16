
import { Reflection } from "./types";

export const aiService = {
  getEncouragingFeedback: async (reflection: Reflection): Promise<{ feedback: string, sentiment: string }> => {
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { feedback: "", sentiment: "neutral" };
    }

    const prompt = `학생의 오늘 성찰 내용을 바탕으로 따뜻하고 구체적인 격려 피드백을 한글로 작성해주세요.
성찰 내용:
- 오늘 학습: ${reflection.learnedContent}
- 학습 활동: ${reflection.activities}
- 협동 과정: ${reflection.collaboration}
- 수업 태도: ${reflection.attitudeRating}점

JSON 형식으로만 응답: {"feedback": "격려 메시지", "sentiment": "positive|neutral|negative"}`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      return { feedback: "", sentiment: "neutral" };
    }
  },

  analyzeClassroomIssues: async (reflections: (Reflection & { studentName: string })[]): Promise<any> => {
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return { 
        summary: "API 키가 설정되지 않았습니다.", 
        detectedIssues: [], 
        statistics: { averageRating: 0, positiveCount: 0, alertCount: 0 } 
      };
    }

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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
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
