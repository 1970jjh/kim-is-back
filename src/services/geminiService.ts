// Gemini AI Service for various AI-powered features
// Uses Gemini 2.0 Flash for text/image analysis and Gemini 2.0 Flash Preview for image generation

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Gemini API endpoints
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_IMAGE_GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

export const geminiService = {
  // R5: 사진에 식물이 포함되어 있는지 검증
  verifyPlantInPhoto: async (imageBase64: string, mimeType: string): Promise<{ pass: boolean; message: string }> => {
    if (!GEMINI_API_KEY) {
      return { pass: false, message: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `이 사진을 분석해주세요. 다음 조건을 확인하세요:
1. 사진에 사람들이 있나요? (단체사진인지)
2. 사진에 식물(화초, 화분, 나무, 숲, 꽃, 잔디 등)이 포함되어 있나요?

JSON 형식으로만 답변하세요:
{"hasPlant": true/false, "hasPeople": true/false, "plantDescription": "발견된 식물 설명", "reason": "판단 이유"}`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64.replace(/^data:[^;]+;base64,/, '')
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      });

      const data: GeminiResponse = await response.json();

      if (data.error) {
        return { pass: false, message: `AI 오류: ${data.error.message}` };
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      try {
        // JSON 파싱 시도
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          if (!result.hasPeople) {
            return { pass: false, message: 'FAIL: 사진에 사람이 보이지 않습니다. 팀원들이 함께 찍은 단체사진을 올려주세요!' };
          }

          if (!result.hasPlant) {
            return { pass: false, message: 'FAIL: 사진에 식물이 보이지 않습니다. 화초, 나무, 꽃 등 식물이 포함된 사진을 올려주세요!' };
          }

          return {
            pass: true,
            message: `PASS! 🌿 ${result.plantDescription || '식물이 포함된 단체사진입니다!'}`
          };
        }
      } catch {
        // JSON 파싱 실패 시 텍스트 분석
      }

      // 텍스트에서 키워드 찾기
      const hasPlant = text.includes('true') && (text.includes('plant') || text.includes('식물'));
      return {
        pass: hasPlant,
        message: hasPlant ? 'PASS! 식물이 포함된 사진입니다!' : 'FAIL: 식물을 찾을 수 없습니다.'
      };

    } catch (error) {
      console.error('Gemini API error:', error);
      return { pass: false, message: '사진 분석 중 오류가 발생했습니다. 다시 시도해주세요.' };
    }
  },

  // R11: 공감 대화 (전무님 역할) - 공감 점수 계산
  chatWithExecutive: async (
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string
  ): Promise<{ response: string; empathyScore: number; scoreChange: number }> => {
    if (!GEMINI_API_KEY) {
      return { response: 'API 키가 설정되지 않았습니다.', empathyScore: 0, scoreChange: 0 };
    }

    try {
      const systemPrompt = `당신은 "전무님" 역할을 수행하는 AI입니다.
당신은 회사의 전무이사로, 자녀 교육 문제로 고민이 있습니다.

배경 스토리:
- 당신의 큰 아이(고3)가 수능을 앞두고 있는데, 최근 성적이 많이 떨어졌습니다
- 아이가 스마트폰에 중독되어 공부를 하지 않고 있습니다
- 배우자와 아이 교육 방식에 대해 의견 충돌이 있습니다
- 일이 바빠서 아이와 대화할 시간이 없어 죄책감을 느낍니다
- 직원들에게는 항상 강한 모습만 보여왔기에 이런 고민을 털어놓기 어렵습니다

대화 지침:
1. 처음에는 조금 방어적으로 시작하세요 (예: "뭐, 별거 아닌데...")
2. 상대방이 공감해주면 점점 더 마음을 열어주세요
3. 구체적인 에피소드를 들려주세요 (어젯밤 아이와 싸운 이야기 등)
4. 감정을 표현하세요 (한숨, 걱정, 불안함 등)
5. 상대방이 조언보다 경청할 때 더 마음을 열어주세요

응답 형식 (반드시 JSON으로):
{
  "response": "전무님의 대답 (자연스러운 대화체로, 100자 내외)",
  "empathyScore": 현재까지의 누적 공감점수(0-100),
  "scoreChange": 이번 대화로 인한 점수 변화(-10 ~ +15),
  "emotionalState": "현재 감정 상태 (방어적/조금열림/마음열림/감사함)"
}

점수 기준:
- 경청하고 따라 말해주기: +8~12점
- 공감 표현 ("힘드셨겠네요", "이해해요"): +10~15점
- 섣부른 조언: -5~0점
- 무관심하거나 대충 대답: -10점
- 비난이나 부정적 반응: -15점`;

      const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500
          }
        })
      });

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            response: result.response || '...',
            empathyScore: Math.min(100, Math.max(0, result.empathyScore || 50)),
            scoreChange: result.scoreChange || 0
          };
        }
      } catch {
        // 파싱 실패
      }

      return { response: text.slice(0, 200), empathyScore: 50, scoreChange: 0 };

    } catch (error) {
      console.error('Gemini chat error:', error);
      return { response: '죄송합니다, 잠시 후 다시 시도해주세요.', empathyScore: 0, scoreChange: 0 };
    }
  },

  // R12: 다짐 내용 검증
  validateResolutions: async (resolutions: string[]): Promise<{ pass: boolean; message: string }> => {
    if (!GEMINI_API_KEY) {
      return { pass: false, message: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `다음은 직장인의 새해 다짐 3가지입니다. 각 다짐이 충분히 진정성 있고 구체적인지 평가해주세요.

다짐 1: ${resolutions[0]}
다짐 2: ${resolutions[1]}
다짐 3: ${resolutions[2]}

평가 기준:
- 각 다짐이 최소 10자 이상인가?
- 구체적인 행동이나 목표가 포함되어 있는가?
- 성의 있게 작성되었는가? (단순히 "열심히 하겠다" 같은 추상적 표현만 있으면 안됨)

JSON 형식으로 응답:
{"pass": true/false, "reason": "판단 이유", "feedback": "피드백 메시지"}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300
          }
        })
      });

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            pass: result.pass,
            message: result.pass
              ? 'PASS! 진정성 있는 다짐입니다. 인포그래픽을 생성합니다...'
              : `FAIL: ${result.feedback || '다시 정성껏 작성해주세요.'}`
          };
        }
      } catch {
        // 파싱 실패
      }

      return { pass: false, message: '다짐 검증 중 오류가 발생했습니다.' };

    } catch (error) {
      console.error('Gemini validation error:', error);
      return { pass: false, message: '검증 중 오류가 발생했습니다.' };
    }
  },

  // R12: 인포그래픽 이미지 생성
  generateInfographic: async (resolutions: string[]): Promise<{ success: boolean; imageData?: string; error?: string }> => {
    if (!GEMINI_API_KEY) {
      return { success: false, error: 'API 키가 설정되지 않았습니다.' };
    }

    try {
      const prompt = `Create a 16:9 brutalist style infographic poster for a Korean professional's New Year resolutions.

Design requirements:
- Bold, brutalist typography with strong contrast
- Black, white, and yellow color scheme
- Industrial/corporate aesthetic
- Clean, impactful layout

Content (in Korean):
Title: 2025 나의 다짐
Resolution 1: ${resolutions[0]}
Resolution 2: ${resolutions[1]}
Resolution 3: ${resolutions[2]}

Make it look like a motivational corporate poster with brutalist design elements.`;

      const response = await fetch(`${GEMINI_IMAGE_GEN_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["image", "text"],
            imageSafetySetting: "block_none"
          }
        })
      });

      const data: GeminiResponse = await response.json();

      if (data.error) {
        return { success: false, error: data.error.message };
      }

      // 이미지 데이터 찾기
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          return {
            success: true,
            imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          };
        }
      }

      return { success: false, error: '이미지 생성에 실패했습니다.' };

    } catch (error) {
      console.error('Gemini image generation error:', error);
      return { success: false, error: '이미지 생성 중 오류가 발생했습니다.' };
    }
  }
};
