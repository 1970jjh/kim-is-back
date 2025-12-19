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

  // R12: 인포그래픽 이미지 생성 (레거시)
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
  },

  // R12: 팀활동 결과보고서 검증
  validateReport: async (report: { oneLine: string; bestMission: string; regret: string; futureHelp: string }): Promise<{ pass: boolean; message: string }> => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validateReport',
          payload: { report }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { pass: false, message: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      console.error('Gemini report validation error:', error);
      return { pass: false, message: '검증 중 오류가 발생했습니다.' };
    }
  },

  // R12: 팀활동 결과보고서 인포그래픽 생성 (Gemini 3 Pro Image Preview - 90초 대기)
  generateReportInfographic: async (
    report: { oneLine: string; bestMission: string; regret: string; futureHelp: string },
    teamId: number
  ): Promise<{ success: boolean; imageData?: string; error?: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90초 타임아웃

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateReportInfographic',
          payload: { report, teamId }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Gemini report infographic timeout (90s)');
        return { success: false, error: '이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.' };
      }
      console.error('Gemini report infographic error:', error);
      return { success: false, error: '보고서 생성 중 오류가 발생했습니다.' };
    }
  },

  // Admin: 우승팀 포스터 생성 (Gemini 3 Pro Image Preview)
  generateWinnerPoster: async (
    imageBase64: string,
    mimeType: string,
    teamId: number,
    options?: { teamName?: string; rank?: number; groupName?: string }
  ): Promise<{ success: boolean; imageData?: string; error?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 115000); // 115초 타임아웃

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateWinnerPoster',
          payload: {
            imageBase64,
            mimeType,
            teamId,
            ...options
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Gemini winner poster timeout (115s)');
        return { success: false, error: '포스터 생성 시간이 초과되었습니다. 다시 시도해주세요.' };
      }
      console.error('Gemini winner poster error:', error);
      return { success: false, error: '포스터 생성 중 오류가 발생했습니다.' };
    }
  },

  // Admin: 전체 팀 성과 종합 분석 (Gemini Pro)
  analyzeTotalPerformance: async (
    groupName: string,
    totalTeams: number,
    performances: Array<{
      teamId: number;
      teamName: string;
      rank: number;
      totalTime: number;
      totalTimeWithBonus: number;
      helpCount: number;
      helpBonusTime: number;
      roundTimes: Record<number, number>;
      members?: Array<{ role: string; name: string }>;
    }>,
    teamReports?: Array<{
      teamId: number;
      oneLine: string;
      bestMission: string;
      regret: string;
      futureHelp: string;
    }>
  ): Promise<{
    success: boolean;
    analysis?: Record<string, unknown>;
    rawStats?: Record<string, unknown>;
    error?: string;
  }> => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyzeTotalPerformance',
          payload: {
            groupName,
            totalTeams,
            performances,
            teamReports
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'API 오류가 발생했습니다.' };
      }

      return await response.json();
    } catch (error) {
      console.error('Gemini total performance analysis error:', error);
      return { success: false, error: '성과 분석 중 오류가 발생했습니다.' };
    }
  }
};
