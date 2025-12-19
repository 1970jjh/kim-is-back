// Gemini AI Service - Uses Vercel API Routes for secure API calls
// R5, R11, R12에서 사용

const API_ENDPOINT = '/api/gemini';

export const geminiService = {
  // R5: 사진에 식물이 포함되어 있는지 검증
  verifyPlantInPhoto: async (imageBase64: string, mimeType: string): Promise<{ pass: boolean; message: string }> => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifyPlant',
          payload: { imageBase64, mimeType }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { pass: false, message: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
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
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          payload: { conversationHistory, userMessage }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { response: error.error || 'API 오류가 발생했습니다.', empathyScore: 0, scoreChange: 0 };
      }

      return await response.json();
    } catch (error) {
      console.error('Gemini chat error:', error);
      return { response: '죄송합니다, 잠시 후 다시 시도해주세요.', empathyScore: 0, scoreChange: 0 };
    }
  },

  // R12: 다짐 내용 검증
  validateResolutions: async (resolutions: string[]): Promise<{ pass: boolean; message: string }> => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validateResolutions',
          payload: { resolutions }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { pass: false, message: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      console.error('Gemini validation error:', error);
      return { pass: false, message: '검증 중 오류가 발생했습니다.' };
    }
  },

  // R12: 인포그래픽 이미지 생성
  generateInfographic: async (resolutions: string[]): Promise<{ success: boolean; imageData?: string; error?: string }> => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateInfographic',
          payload: { resolutions }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      console.error('Gemini image generation error:', error);
      return { success: false, error: '이미지 생성 중 오류가 발생했습니다.' };
    }
  }
};
