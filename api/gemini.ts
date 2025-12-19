import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Pro plan - 120초 타임아웃
export const config = {
  maxDuration: 120,
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_IMAGE_GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const IMAGEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';
// Gemini 3 Pro Image Preview - 이미지 심층 분석 & 텍스트 렌더링 강화, 디자인 이미지 생성
const GEMINI_3_PRO_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
// Gemini 3 Pro Preview - 텍스트 분석 및 종합 리포트 생성
const GEMINI_3_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'verifyPlant':
        return res.json(await verifyPlant(payload));
      case 'chat':
        return res.json(await chat(payload));
      case 'validateResolutions':
        return res.json(await validateResolutions(payload));
      case 'generateInfographic':
        return res.json(await generateInfographic(payload));
      case 'validateReport':
        return res.json(await validateReport(payload));
      case 'generateReportInfographic':
        return res.json(await generateReportInfographic(payload));
      case 'generateWinnerPoster':
        return res.json(await generateWinnerPoster(payload));
      case 'analyzeTotalPerformance':
        return res.json(await analyzeTotalPerformance(payload));
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// R5: Verify plant in photo
async function verifyPlant(payload: { imageBase64: string; mimeType: string }) {
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
              mimeType: payload.mimeType,
              data: payload.imageBase64.replace(/^data:[^;]+;base64,/, '')
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

  const data = await response.json();

  if (data.error) {
    return { pass: false, message: `AI 오류: ${data.error.message}` };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
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
        message: `PASS! ${result.plantDescription || '식물이 포함된 단체사진입니다!'}`
      };
    }
  } catch {
    // JSON parsing failed
  }

  const hasPlant = text.includes('true') && (text.includes('plant') || text.includes('식물'));
  return {
    pass: hasPlant,
    message: hasPlant ? 'PASS! 식물이 포함된 사진입니다!' : 'FAIL: 식물을 찾을 수 없습니다.'
  };
}

// R11: Chat with executive
async function chat(payload: { conversationHistory: Array<{ role: string; content: string }>; userMessage: string }) {
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
    ...payload.conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: payload.userMessage }] }
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

  const data = await response.json();
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
    // JSON parsing failed
  }

  return { response: text.slice(0, 200), empathyScore: 50, scoreChange: 0 };
}

// R12: Validate resolutions
async function validateResolutions(payload: { resolutions: string[] }) {
  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `다음은 직장인의 새해 다짐 3가지입니다. 각 다짐이 충분히 진정성 있고 구체적인지 평가해주세요.

다짐 1: ${payload.resolutions[0]}
다짐 2: ${payload.resolutions[1]}
다짐 3: ${payload.resolutions[2]}

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

  const data = await response.json();
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
    // JSON parsing failed
  }

  return { pass: false, message: '다짐 검증 중 오류가 발생했습니다.' };
}

// R12: Generate infographic
async function generateInfographic(payload: { resolutions: string[] }) {
  const prompt = `Create a 16:9 brutalist style infographic poster for a Korean professional's New Year resolutions.

Design requirements:
- Bold, brutalist typography with strong contrast
- Black, white, and yellow color scheme
- Industrial/corporate aesthetic
- Clean, impactful layout

Content (in Korean):
Title: 2025 나의 다짐
Resolution 1: ${payload.resolutions[0]}
Resolution 2: ${payload.resolutions[1]}
Resolution 3: ${payload.resolutions[2]}

Make it look like a motivational corporate poster with brutalist design elements.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 110000); // 110초 타임아웃

  try {
    const response = await fetch(`${GEMINI_IMAGE_GEN_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

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
    clearTimeout(timeoutId);
    console.error('Infographic generation error:', error);
    return { success: false, error: '이미지 생성 중 타임아웃이 발생했습니다.' };
  }
}

// R12: Validate team activity report
async function validateReport(payload: { report: { oneLine: string; bestMission: string; regret: string; futureHelp: string } }) {
  const { oneLine, bestMission, regret, futureHelp } = payload.report;

  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `다음은 팀활동 결과보고서입니다. 각 항목이 충분히 진정성 있고 구체적인지 평가해주세요.

1. 한 줄 정리: ${oneLine}
2. 가장 기억에 남는 미션과 이유: ${bestMission}
3. 아쉬운 점: ${regret}
4. 앞으로 AI가 도와줬으면 하는 것: ${futureHelp}

평가 기준:
- 각 항목이 최소 10자 이상인가?
- 구체적인 내용이 포함되어 있는가?
- 성의 있게 작성되었는가? (단순히 "좋았다", "없다" 같은 추상적 표현만 있으면 안됨)
- 팀 활동에 대한 실제 경험이 담겨 있는가?

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

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        pass: result.pass,
        message: result.pass
          ? 'PASS! 진정성 있는 보고서입니다. 결과보고서를 생성합니다...'
          : `FAIL: ${result.feedback || '다시 정성껏 작성해주세요.'}`
      };
    }
  } catch {
    // JSON parsing failed
  }

  return { pass: false, message: '보고서 검증 중 오류가 발생했습니다.' };
}

// R12: Generate team activity report infographic (Gemini 3 Pro Image Preview - 텍스트 렌더링 강화)
async function generateReportInfographic(payload: { report: { oneLine: string; bestMission: string; regret: string; futureHelp: string }; teamId: number }) {
  const { oneLine, bestMission, regret, futureHelp } = payload.report;
  const teamId = payload.teamId;

  // 오늘 날짜
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  // 프롬프트 - Gemini 3 Pro Image Preview 모델용 (한글 텍스트 렌더링 최적화)
  const prompt = `고급 인포그래픽 포스터 이미지를 생성해주세요.

## 디자인 요구사항

### 스타일
- 3:4 세로 비율 포스터 (포트레이트)
- 다크 그라데이션 배경 (진한 네이비 #1a1a2e에서 #0f3460)
- 메탈릭 골드(#FFD700) 테두리와 장식 요소
- 고급스럽고 프로페셔널한 기업 스타일

### 레이아웃 (위에서 아래로)

1. **헤더 영역**
   - 상단 가운데: "TEAM ${teamId}" (큰 골드색 텍스트)
   - 바로 아래: "팀활동 결과보고서" (흰색 텍스트)
   - 골드색 구분선

2. **4개의 컨텐츠 카드** (각각 반투명 배경, 왼쪽에 색상 바)

   카드 1 - 빨간색(#ff6b6b) 강조:
   제목: "💬 오늘의 한줄 소감"
   내용: "${oneLine}"

   카드 2 - 골드색(#ffd700) 강조:
   제목: "⭐ 가장 빛났던 미션"
   내용: "${bestMission}"

   카드 3 - 청록색(#4ecdc4) 강조:
   제목: "💭 아쉬웠던 점과 다짐"
   내용: "${regret}"

   카드 4 - 보라색(#a855f7) 강조:
   제목: "🚀 현업에 도움이 될 점"
   내용: "${futureHelp}"

3. **푸터**
   - 하단 가운데: "김부장의 복귀 프로젝트 | ${dateStr}"
   - 연한 흰색 텍스트

### 중요 사항
- 모든 한글 텍스트를 명확하고 읽기 쉽게 렌더링
- 각 카드의 내용은 깔끔하게 줄바꿈하여 표시
- 전체적으로 세련되고 공유하고 싶은 디자인으로 제작`;

  // Gemini 3 Pro Image Preview API 호출 (AbortController로 타임아웃 처리)
  try {
    console.log('Calling Gemini 3 Pro Image Preview for report generation...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000); // 110초 타임아웃

    const response = await fetch(`${GEMINI_3_PRO_IMAGE_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('Gemini 3 Pro response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Gemini 3 Pro error:', data.error);
      // Fallback to Imagen 3
      return await generateReportInfographicImagen(payload);
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        console.log('Successfully generated image with Gemini 3 Pro Image Preview');
        return {
          success: true,
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    // Fallback if no image in response
    console.log('No image in Gemini 3 Pro response, falling back to Imagen 3...');
    return await generateReportInfographicImagen(payload);
  } catch (error) {
    console.error('Gemini 3 Pro API error:', error);
    return await generateReportInfographicImagen(payload);
  }
}

// Fallback 1: Imagen 3 API (3:4 aspect ratio)
async function generateReportInfographicImagen(payload: { report: { oneLine: string; bestMission: string; regret: string; futureHelp: string }; teamId: number }) {
  const { oneLine, bestMission, regret, futureHelp } = payload.report;
  const teamId = payload.teamId;

  const shortOneLine = oneLine.slice(0, 50);
  const shortBestMission = bestMission.slice(0, 80);
  const shortRegret = regret.slice(0, 80);
  const shortFutureHelp = futureHelp.slice(0, 80);

  const prompt = `Create a beautiful modern infographic poster for Team ${teamId}'s activity report.

Style: Modern corporate infographic with vibrant gradient background (purple to blue). Clean minimalist design with white text. 3:4 portrait aspect ratio.

Layout:
- Top: Large title "TEAM ${teamId} 팀활동 결과보고서" with gold decorative elements
- 4 content sections in card/box style with icons:
  1. 💬 한줄소감: "${shortOneLine}"
  2. ⭐ 베스트미션: "${shortBestMission}"
  3. 💭 아쉬운점: "${shortRegret}"
  4. 🚀 현업도움: "${shortFutureHelp}"
- Bottom: "김부장의 복귀 프로젝트 | 2025" branding

Design: Professional Korean corporate style, glass morphism effects, rounded corners, subtle shadows.`;

  try {
    console.log('Calling Imagen 3 for report generation...');

    const response = await fetch(`${IMAGEN_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "3:4",
          safetyFilterLevel: "block_few",
          personGeneration: "allow_all"
        }
      })
    });

    const data = await response.json();
    console.log('Imagen 3 response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Imagen 3 error:', data.error);
      return await generateReportInfographicFallback(payload);
    }

    const predictions = data.predictions || [];
    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      console.log('Successfully generated image with Imagen 3');
      return {
        success: true,
        imageData: `data:image/png;base64,${predictions[0].bytesBase64Encoded}`
      };
    }

    return await generateReportInfographicFallback(payload);
  } catch (error) {
    console.error('Imagen 3 API error:', error);
    return await generateReportInfographicFallback(payload);
  }
}

// Fallback: Gemini 2.0 Flash image generation
async function generateReportInfographicFallback(payload: { report: { oneLine: string; bestMission: string; regret: string; futureHelp: string }; teamId: number }) {
  const { oneLine, bestMission, regret, futureHelp } = payload.report;
  const teamId = payload.teamId;

  const prompt = `Generate a beautiful infographic image for Team ${teamId}'s activity report.

Create a 3:4 portrait poster with:
- Gradient background (purple/blue/pink)
- Title: "TEAM ${teamId} 결과보고서"
- 4 sections with Korean text:
  1. 한줄소감: ${oneLine.slice(0, 40)}
  2. 베스트미션: ${bestMission.slice(0, 60)}
  3. 아쉬운점: ${regret.slice(0, 60)}
  4. AI활용: ${futureHelp.slice(0, 60)}
- Modern glassmorphism style
- Professional corporate design
- "KIM IS BACK 2025" at bottom`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 110000); // 110초 타임아웃

  try {
    const response = await fetch(`${GEMINI_IMAGE_GEN_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('Gemini Flash response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Gemini Flash error:', data.error);
      return { success: false, error: data.error.message };
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          success: true,
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    return { success: false, error: '보고서 이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Gemini Flash fallback error:', error);
    return { success: false, error: '보고서 이미지 생성 중 타임아웃이 발생했습니다.' };
  }
}

// Admin: Generate winner team poster with team photo (Gemini 3 Pro Image Preview)
async function generateWinnerPoster(payload: {
  imageBase64: string;
  mimeType: string;
  teamId: number;
  teamName?: string;
  rank?: number;
  groupName?: string;
}) {
  const { imageBase64, mimeType, teamId, teamName, rank, groupName } = payload;

  // 오늘 날짜
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  // 프롬프트 - 우승팀 포스터 생성 (원본 사진의 팀원들 얼굴 반영)
  const prompt = `이 단체 사진을 기반으로 우승팀 축하 포스터를 생성해주세요.

## 중요 요구사항
- **원본 사진에 있는 사람들의 얼굴과 모습을 그대로 유지**해주세요
- 사진 속 팀원들의 실제 얼굴이 포스터에 잘 보여야 합니다

## 디자인 요구사항

### 스타일
- 3:4 세로 비율 포스터 (포트레이트)
- 화려하고 축하하는 분위기
- 골드, 블랙, 레드 컬러 스킴
- 럭셔리하고 프로페셔널한 스타일

### 레이아웃
1. **상단**: 큰 타이틀 "CONGRATULATIONS!" 또는 "축하합니다!" (골드색)
2. **중앙**: 원본 사진의 팀원들을 멋지게 배치 (얼굴이 선명하게)
3. **팀 정보**:
   - 팀 이름: "${teamName || `TEAM ${teamId}`}"
   - 순위: ${rank ? `#${rank}` : '우승'}
   ${groupName ? `- 교육그룹: "${groupName}"` : ''}
4. **하단**: "김부장의 복귀 프로젝트 | ${dateStr}"
5. **장식**: 금색 트로피, 별, 리본, 불꽃놀이 등 축하 요소

### 스타일 효과
- 영화 포스터 같은 드라마틱한 조명
- 팀원들이 영웅처럼 보이도록 연출
- 화려한 프레임과 장식 요소
- 승리와 성취를 강조하는 시각적 요소`;

  try {
    console.log('Calling Gemini 3 Pro Image Preview for winner poster generation...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000); // 110초 타임아웃

    const response = await fetch(`${GEMINI_3_PRO_IMAGE_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64.replace(/^data:[^;]+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('Gemini 3 Pro winner poster response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Gemini 3 Pro winner poster error:', data.error);
      return { success: false, error: data.error.message || '포스터 생성에 실패했습니다.' };
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        console.log('Successfully generated winner poster with Gemini 3 Pro Image Preview');
        return {
          success: true,
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    return { success: false, error: '포스터 이미지가 생성되지 않았습니다. 다시 시도해주세요.' };
  } catch (error) {
    console.error('Gemini 3 Pro winner poster API error:', error);
    return { success: false, error: '포스터 생성 중 오류가 발생했습니다.' };
  }
}

// Admin: Analyze total performance of all teams (Gemini Pro)
async function analyzeTotalPerformance(payload: {
  groupName: string;
  totalTeams: number;
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
  }>;
  teamReports?: Array<{
    teamId: number;
    oneLine: string;
    bestMission: string;
    regret: string;
    futureHelp: string;
  }>;
}) {
  const { groupName, totalTeams, performances, teamReports } = payload;

  // 오늘 날짜
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  // 통계 데이터 계산
  const avgTime = performances.reduce((sum, p) => sum + p.totalTimeWithBonus, 0) / performances.length;
  const minTime = Math.min(...performances.map(p => p.totalTimeWithBonus));
  const maxTime = Math.max(...performances.map(p => p.totalTimeWithBonus));
  const totalHelps = performances.reduce((sum, p) => sum + p.helpCount, 0);

  // 라운드별 평균 시간 계산
  const roundAvgTimes: Record<number, number> = {};
  for (let r = 1; r <= 12; r++) {
    const times = performances.map(p => p.roundTimes[r] || 0).filter(t => t > 0);
    if (times.length > 0) {
      roundAvgTimes[r] = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  // 가장 어려웠던/쉬웠던 라운드 찾기
  const roundEntries = Object.entries(roundAvgTimes).map(([r, t]) => ({ round: parseInt(r), time: t }));
  const hardestRound = roundEntries.sort((a, b) => b.time - a.time)[0];
  const easiestRound = roundEntries.sort((a, b) => a.time - b.time)[0];

  // 팀 리포트에서 가장 많이 언급된 미션 분석
  const bestMissions = teamReports?.map(r => r.bestMission).join('\n') || '';

  const formatTimeStr = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}분 ${secs}초`;
  };

  const prompt = `당신은 기업 교육 프로그램 분석 전문가입니다. 다음 팀 빌딩 미션 데이터를 종합적으로 분석하고 상세한 리포트를 작성해주세요.

## 교육 프로그램 정보
- 교육그룹명: ${groupName}
- 참여 팀 수: ${totalTeams}팀
- 분석 일자: ${dateStr}

## 전체 성과 통계
- 평균 소요시간: ${formatTimeStr(avgTime)}
- 최단 소요시간: ${formatTimeStr(minTime)} (1위 팀)
- 최장 소요시간: ${formatTimeStr(maxTime)}
- 총 HELP 사용 횟수: ${totalHelps}회

## 라운드별 평균 소요시간
${Object.entries(roundAvgTimes).map(([r, t]) => `- R${r}: ${formatTimeStr(t)}`).join('\n')}

## 가장 어려웠던 라운드
- ${hardestRound ? `R${hardestRound.round} (평균 ${formatTimeStr(hardestRound.time)})` : '데이터 없음'}

## 가장 쉬웠던 라운드
- ${easiestRound ? `R${easiestRound.round} (평균 ${formatTimeStr(easiestRound.time)})` : '데이터 없음'}

## 팀별 성과 데이터
${performances.map(p => `
### Team ${p.teamId} (${p.teamName})
- 순위: #${p.rank}
- 총 소요시간: ${formatTimeStr(p.totalTimeWithBonus)}
- HELP 사용: ${p.helpCount}회 (+${formatTimeStr(p.helpBonusTime)} 패널티)
`).join('')}

## 팀 활동 소감 (베스트 미션 선정 의견)
${bestMissions || '수집된 소감 없음'}

---

위 데이터를 바탕으로 다음 형식의 JSON 분석 리포트를 작성해주세요:

{
  "executiveSummary": "3-5문장의 핵심 요약",
  "overallAssessment": "전체 교육 프로그램에 대한 종합 평가 (5-7문장)",
  "teamRankingAnalysis": "순위별 팀 분석 및 특징 (상위팀/중위팀/하위팀 그룹별 특성)",
  "roundAnalysis": {
    "hardestRounds": ["가장 어려웠던 라운드 3개와 그 이유"],
    "easiestRounds": ["가장 쉬웠던 라운드 3개와 그 이유"],
    "keyInsights": "라운드별 분석에서 발견된 주요 인사이트"
  },
  "teamworkInsights": "팀워크 및 협업에 대한 분석",
  "helpUsageAnalysis": "HELP 사용 패턴 분석 및 의미",
  "recommendations": [
    "향후 교육 프로그램 개선을 위한 구체적 제안 5가지"
  ],
  "bestPractices": [
    "이번 교육에서 발견된 베스트 프랙티스 3가지"
  ],
  "chartData": {
    "teamTimeComparison": [{"teamId": 1, "time": 초, "rank": 순위}, ...],
    "roundDifficulty": [{"round": 1, "avgTime": 초}, ...],
    "helpUsageByTeam": [{"teamId": 1, "helpCount": 횟수}, ...]
  }
}

반드시 JSON 형식으로만 응답해주세요.`;

  try {
    console.log('Calling Gemini Pro for total performance analysis...');

    const response = await fetch(`${GEMINI_3_PRO_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
    });

    const data = await response.json();
    console.log('Gemini Pro analysis response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Gemini Pro analysis error:', data.error);
      return { success: false, error: data.error.message || '분석에 실패했습니다.' };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      // JSON 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          analysis: analysisResult,
          rawStats: {
            avgTime,
            minTime,
            maxTime,
            totalHelps,
            roundAvgTimes,
            hardestRound,
            easiestRound,
            dateStr,
            groupName,
            totalTeams
          }
        };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    // JSON 파싱 실패시 텍스트 그대로 반환
    return {
      success: true,
      analysis: { rawText: text },
      rawStats: {
        avgTime,
        minTime,
        maxTime,
        totalHelps,
        roundAvgTimes,
        hardestRound,
        easiestRound,
        dateStr,
        groupName,
        totalTeams
      }
    };
  } catch (error) {
    console.error('Gemini Pro analysis API error:', error);
    return { success: false, error: '성과 분석 중 오류가 발생했습니다.' };
  }
}
