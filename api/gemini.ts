import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_IMAGE_GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent';

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

// R12: Generate team activity report infographic (Bento Grid style)
async function generateReportInfographic(payload: { report: { oneLine: string; bestMission: string; regret: string; futureHelp: string }; teamId: number }) {
  const { oneLine, bestMission, regret, futureHelp } = payload.report;
  const teamId = payload.teamId;

  const prompt = `Create a modern Bento Grid style infographic poster for a Korean team's activity report. The design should look like a professional team summary card.

Design requirements:
- Bento Grid layout (asymmetric grid boxes)
- Modern, clean glassmorphism style
- Gradient backgrounds (purple to pink or blue to cyan)
- White text with subtle shadows
- Rounded corners on all elements
- Professional corporate aesthetic
- 9:16 aspect ratio (portrait mode for mobile)

Content (in Korean):
Team Number: ${teamId}조
Title: 팀활동 결과보고서

Section 1 (한 줄 정리 - largest box): ${oneLine}
Section 2 (가장 기억에 남는 미션): ${bestMission}
Section 3 (아쉬운 점): ${regret}
Section 4 (AI에게 바라는 것): ${futureHelp}

Make it look like a stylish team achievement card with modern UI design elements. Include icons or emojis appropriate for each section.`;

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

  return { success: false, error: '보고서 이미지 생성에 실패했습니다.' };
}
