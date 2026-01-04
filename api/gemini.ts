import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Pro plan - 120초 타임아웃
export const config = {
  maxDuration: 120,
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_IMAGE_GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
// Gemini 3 Pro Image Preview - 이미지 심층 분석 & 텍스트 렌더링 강화, 디자인 이미지 생성 (메인 이미지 생성 모델)
const GEMINI_3_PRO_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
// Gemini 3 Flash Preview - 텍스트 분석 및 종합 리포트 생성 (최신 모델)
const GEMINI_PRO_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

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
      case 'generateCustomerServiceFeedback':
        return res.json(await generateCustomerServiceFeedback(payload));
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

// 산업군별 고객 시나리오
const CUSTOMER_SCENARIOS: Record<number, { role: string; situation: string; personality: string }> = {
  1: { // IT/솔루션
    role: '시스템 장애로 화난 IT 담당자',
    situation: '우리 회사 ERP 시스템이 갑자기 멈춰서 업무가 완전히 마비됐어요. 어제 오후부터 지금까지 아무것도 못하고 있습니다. 계약서에는 24시간 내 복구라고 되어 있는데, 벌써 15시간째예요!',
    personality: '논리적이고 데이터를 중시하며, 명확한 해결 일정과 원인 분석을 요구함'
  },
  2: { // 제조/원자재
    role: '납품 지연에 화난 구매 담당자',
    situation: '이번 달 원자재 납품이 또 3일이나 늦어졌어요. 이게 벌써 세 번째예요! 우리 생산라인이 멈추면 그 손해가 얼마인지 아세요?',
    personality: '실용적이고 결과 중심적이며, 구체적인 보상과 재발 방지 대책을 요구함'
  },
  3: { // 유통/리테일
    role: '재고 오류로 화난 매장 점주',
    situation: '발주한 물건이 절반밖에 안 왔는데, 시스템에는 전량 입고로 떠요. 이번 주말 세일 행사 앞두고 이게 무슨 일이에요? 매출 손실 누가 책임지나요?',
    personality: '매출과 고객에 민감하며, 신속한 처리와 추가 지원을 기대함'
  },
  4: { // 건설/인프라
    role: '공사 지연으로 화난 현장 소장',
    situation: '장비 대여 일정이 갑자기 변경됐다는 게 말이 됩니까? 현장에서 20명이 기다리고 있는데. 지체보상금 어떻게 할 건지 당장 답변 주세요!',
    personality: '일정과 비용에 예민하며, 책임 소재를 명확히 하려 함'
  },
  5: { // 금융/보험
    role: '보험금 처리 지연에 화난 고객',
    situation: '사고 접수한 지 한 달이 넘었는데 아직도 심사 중이라고요? 서류는 진작에 다 냈고, 매번 전화하면 담당자가 다르고. 도대체 언제 처리되는 겁니까?',
    personality: '절차와 투명성을 중시하며, 정확한 진행 상황과 일정을 알고 싶어함'
  },
  6: { // 광고/마케팅
    role: '캠페인 성과 불만인 마케팅 담당자',
    situation: '지난 달 캠페인 비용 3천만원 썼는데 전환율이 0.5%밖에 안 나왔어요. 경쟁사 대행사는 2% 이상 뽑아주던데, 이래서 계약 연장하라고요?',
    personality: 'ROI와 수치에 민감하며, 구체적인 개선안과 추가 서비스를 원함'
  },
  7: { // 화학/에너지
    role: '품질 이슈로 화난 품질관리 담당자',
    situation: '최근 납품된 원료 성분 분석 결과가 스펙과 다릅니다. 이 원료로 만든 제품 전량 리콜해야 할 수도 있어요. 인증서에는 문제없다고 나와있는데 어떻게 된 겁니까?',
    personality: '안전과 규정 준수를 최우선시하며, 문서화된 증빙과 공식 대응을 요구함'
  },
  8: { // 의료/제약
    role: '의료기기 오류로 화난 병원 담당자',
    situation: 'MRI 장비가 또 에러가 났어요. 오늘 검사 예약 환자가 15명인데 다 취소해야 합니다. 환자들한테 뭐라고 설명하라고요? 엔지니어 언제 옵니까?',
    personality: '환자 안전과 병원 평판에 민감하며, 즉각적인 기술 지원을 원함'
  },
  9: { // 물류/운송
    role: '배송 사고로 화난 물류 담당자',
    situation: '화물이 파손된 채로 도착했어요. 보험 처리한다고 하는데, 당장 오늘 납품해야 하는 건 어떻게 하라고요? 고객사에서 계약 해지 얘기까지 나오고 있습니다!',
    personality: '시간에 쫓기며, 대안 솔루션과 책임 있는 후속 조치를 원함'
  },
  10: { // 식음료(F&B)
    role: '식자재 품질 문제로 화난 레스토랑 오너',
    situation: '오늘 배송 온 해산물 상태가 엉망이에요. 냄새도 나고, 이걸 손님한테 내놓으라고요? 토요일 저녁 예약 다 잡혀있는데 메뉴를 어떻게 하라는 겁니까?',
    personality: '신선도와 고객 경험에 민감하며, 즉시 대체품과 보상을 원함'
  }
};

// R11: Chat with executive (레거시) / 고객 응대 시뮬레이션
async function chat(payload: {
  conversationHistory: Array<{ role: string; content: string }>;
  userMessage: string;
  mode?: 'customerService';
  industryType?: number;
}) {
  // 고객 응대 모드인 경우 별도 프롬프트 사용
  if (payload.mode === 'customerService' && payload.industryType) {
    return await chatWithCustomer(payload);
  }

  // 기존 전무님 대화 (레거시)
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

// R11: 고객 응대 시뮬레이션 - 산업군별 화난 고객 역할
async function chatWithCustomer(payload: {
  conversationHistory: Array<{ role: string; content: string }>;
  userMessage: string;
  industryType?: number;
}) {
  const industryType = payload.industryType || 1;
  const scenario = CUSTOMER_SCENARIOS[industryType] || CUSTOMER_SCENARIOS[1];

  const systemPrompt = `당신은 "${scenario.role}" 역할을 수행하는 AI입니다.
당신은 서비스/제품에 불만이 있는 B2B 고객입니다.

## 상황
${scenario.situation}

## 성격 특성
${scenario.personality}

## 대화 규칙
1. 당신은 화가 난 고객입니다. 처음에는 짜증과 불만을 표현하세요
2. 상대방(직원)이 진심으로 사과하고 공감하면 조금씩 누그러지세요
3. 구체적인 해결책과 보상을 제시받으면 만족도가 올라갑니다
4. 형식적인 사과나 책임 회피는 더 화나게 합니다
5. 업무적인 내용으로만 대화하세요 (개인적인 이야기 X)
6. 고객 관점에서 문제 해결을 원합니다

## 만족도 평가 기준
- 진심 어린 사과와 공감: +15~20점
- 구체적인 해결책 제시: +10~15점
- 보상/대안 제안: +10~15점
- 책임 인정: +8~12점
- 경청하고 요약해주기: +5~10점
- 형식적 사과만: -5~0점
- 변명/책임 회피: -10~15점
- 무시/무관심: -15~20점

## 응답 형식 (반드시 JSON으로)
{
  "response": "고객의 대답 (자연스러운 대화체로, 업무 관련 내용만, 150자 내외)",
  "empathyScore": 현재까지의 누적 고객 만족도(0-100, 초기값 10),
  "scoreChange": 이번 대화로 인한 점수 변화(-20 ~ +20),
  "mood": "현재 감정 상태 (매우화남/화남/불만/누그러짐/만족)"
}

중요: 절대로 개인적인 이야기(가족, 자녀, 건강 등)를 하지 마세요. 오직 비즈니스 상황에 대해서만 대화하세요.`;

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
        empathyScore: Math.min(100, Math.max(0, result.empathyScore || 10)),
        scoreChange: result.scoreChange || 0
      };
    }
  } catch {
    // JSON parsing failed
  }

  return { response: text.slice(0, 200), empathyScore: 10, scoreChange: 0 };
}

// R11: 고객 응대 대화 피드백 생성
async function generateCustomerServiceFeedback(payload: {
  conversationHistory: Array<{ role: string; content: string }>;
  finalScore: number;
  industryType: number;
}) {
  const scenario = CUSTOMER_SCENARIOS[payload.industryType] || CUSTOMER_SCENARIOS[1];

  // 대화 내용을 텍스트로 변환
  const conversationText = payload.conversationHistory.map((msg, idx) => {
    const speaker = msg.role === 'user' ? '직원(학습자)' : '고객';
    return `${idx + 1}. ${speaker}: ${msg.content}`;
  }).join('\n');

  const systemPrompt = `당신은 B2B 고객 응대 교육 전문가입니다.
다음 고객 응대 시뮬레이션 대화를 분석하고 피드백을 제공해주세요.

## 상황 배경
${scenario.situation}

## 대화 내용
${conversationText}

## 최종 고객 만족도
${payload.finalScore}점 / 100점

## 피드백 요청사항
1. 전체적인 응대 평가 (잘한 점, 아쉬운 점)
2. 구체적인 개선 포인트 3가지
3. 실무에서 활용할 수 있는 팁
4. 종합 점수에 대한 코멘트

## 응답 형식 (반드시 JSON으로)
{
  "overallGrade": "S/A/B/C/D 중 하나",
  "summary": "전체 응대에 대한 2-3문장 요약 평가",
  "goodPoints": ["잘한 점 1", "잘한 점 2", "잘한 점 3"],
  "improvementPoints": ["개선점 1", "개선점 2", "개선점 3"],
  "practicalTips": "실무 활용 팁 (2-3문장)",
  "scoreComment": "점수에 대한 코멘트 (1문장)"
}

평가 기준:
- S등급(90점 이상): 완벽한 응대, 고객이 감동받음
- A등급(80-89점): 우수한 응대, 문제 해결됨
- B등급(70-79점): 양호한 응대, 기본은 충족
- C등급(60-69점): 보통 응대, 개선 필요
- D등급(60점 미만): 미흡한 응대, 많은 개선 필요`;

  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: systemPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
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
        success: true,
        feedback: {
          overallGrade: result.overallGrade || 'C',
          summary: result.summary || '피드백을 생성할 수 없습니다.',
          goodPoints: result.goodPoints || [],
          improvementPoints: result.improvementPoints || [],
          practicalTips: result.practicalTips || '',
          scoreComment: result.scoreComment || ''
        }
      };
    }
  } catch {
    // JSON parsing failed
  }

  return {
    success: false,
    feedback: {
      overallGrade: 'C',
      summary: '피드백 생성 중 오류가 발생했습니다.',
      goodPoints: [],
      improvementPoints: [],
      practicalTips: '',
      scoreComment: ''
    }
  };
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
      return { success: false, error: data.error.message || 'Gemini API 오류가 발생했습니다.' };
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

    // No image in response
    console.log('No image in Gemini 3 Pro response');
    return { success: false, error: '이미지가 생성되지 않았습니다. 다시 시도해주세요.' };
  } catch (error) {
    console.error('Gemini 3 Pro API error:', error);
    return { success: false, error: '이미지 생성 중 오류가 발생했습니다. 다시 시도해주세요.' };
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

    // gemini-3-pro-image-preview 사용 (텍스트-이미지, 이미지-이미지 생성 지원)
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
    console.log('Gemini winner poster response:', JSON.stringify(data).slice(0, 500));

    if (data.error) {
      console.error('Gemini winner poster error:', data.error);
      return { success: false, error: data.error.message || '포스터 생성에 실패했습니다.' };
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        console.log('Successfully generated winner poster');
        return {
          success: true,
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    return { success: false, error: '포스터 이미지가 생성되지 않았습니다. 다시 시도해주세요.' };
  } catch (error) {
    console.error('Gemini winner poster API error:', error);
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

  const prompt = `당신은 기업 교육 성과 분석 및 학습자 피드백 전문가입니다. 다음 팀 빌딩 미션 데이터를 분석하여 **학습자와 교육담당자에게 전달할 종합 피드백 리포트**를 작성해주세요.

## 교육 프로그램 정보
- 교육그룹명: ${groupName}
- 참여 팀 수: ${totalTeams}팀
- 분석 일자: ${dateStr}

## 전체 성과 통계
- 평균 소요시간: ${formatTimeStr(avgTime)}
- 최단 소요시간: ${formatTimeStr(minTime)} (1위 팀)
- 최장 소요시간: ${formatTimeStr(maxTime)}

## 라운드별 평균 소요시간
${Object.entries(roundAvgTimes).map(([r, t]) => `- R${r}: ${formatTimeStr(t)}`).join('\n')}

## 가장 도전적이었던 라운드
- ${hardestRound ? `R${hardestRound.round} (평균 ${formatTimeStr(hardestRound.time)})` : '데이터 없음'}

## 가장 빠르게 해결한 라운드
- ${easiestRound ? `R${easiestRound.round} (평균 ${formatTimeStr(easiestRound.time)})` : '데이터 없음'}

## 팀별 성과 데이터
${performances.map(p => `
### Team ${p.teamId} (${p.teamName})
- 순위: #${p.rank}
- 총 소요시간: ${formatTimeStr(p.totalTimeWithBonus)}
`).join('')}

## 팀 활동 소감 (참가자들의 목소리)
${bestMissions || '수집된 소감 없음'}

---

## 리포트 작성 가이드라인

이 리포트는 **학습자들과 교육담당자에게 공유되는 자료**입니다. 다음 관점에서 분석해주세요:

1. **오늘 활동의 가치**: 이번 교육이 얼마나 재미있고 유익했는지
2. **업무 역량 향상**: 현업에서의 문제해결, 의사결정, 시간관리 역량에 어떤 도움이 될지
3. **소통과 협업**: 팀원 간 의사소통, 역할 분담, 협업 능력이 어떻게 발휘되었는지
4. **AI 활용 스킬**: AI 도구를 업무에 활용하는 역량이 어떻게 성장했는지
5. **강점 발견**: 각 팀과 개인이 발견한 강점과 가능성
6. **실무 적용**: 오늘의 경험이 실제 업무에 어떻게 적용될 수 있는지

다음 형식의 JSON 분석 리포트를 작성해주세요:

{
  "executiveSummary": "3-5문장의 핵심 요약 (이번 교육의 성과와 의미 중심)",
  "overallAssessment": "전체 교육 프로그램에 대한 종합 평가 (5-7문장, 참가자들의 열정과 성취를 칭찬하고, 교육의 가치를 강조)",
  "teamRankingAnalysis": "팀별 분석 (상위팀의 성공 비결, 모든 팀이 보여준 강점과 가능성 중심으로 긍정적으로 분석)",
  "roundAnalysis": {
    "hardestRounds": ["도전적이었던 라운드에서 참가자들이 보여준 끈기와 문제해결 능력"],
    "easiestRounds": ["빠르게 해결한 라운드에서 드러난 팀의 강점과 협업 능력"],
    "keyInsights": "라운드별 활동을 통해 발견된 학습 포인트와 성장 기회"
  },
  "teamworkInsights": "팀워크 및 협업에 대한 분석 (구체적 사례 언급, 소통 방식의 발전, 신뢰 형성 등)",
  "recommendations": [
    "현업에서 활용할 수 있는 구체적인 팁 5가지 (오늘 배운 것을 실무에 적용하는 방법)"
  ],
  "bestPractices": [
    "이번 교육에서 발견된 베스트 프랙티스 3가지 (다른 학습자들에게 공유할 만한 성공 사례)"
  ],
  "skillsGained": {
    "aiSkills": "AI 활용 역량에서의 성장 포인트",
    "communicationSkills": "소통과 협업 역량에서의 성장 포인트",
    "problemSolvingSkills": "문제해결과 의사결정 역량에서의 성장 포인트",
    "timeManagementSkills": "시간관리와 우선순위 설정 역량에서의 성장 포인트"
  },
  "futureApplications": "오늘의 경험을 현업에 적용할 수 있는 구체적인 상황과 방법 (3-5가지)",
  "closingMessage": "참가자들에게 전하는 격려와 응원의 메시지 (2-3문장)",
  "chartData": {
    "teamTimeComparison": [{"teamId": 1, "time": 초, "rank": 순위}, ...],
    "roundDifficulty": [{"round": 1, "avgTime": 초}, ...]
  }
}

중요:
- 관리자/강사 관점의 "프로그램 개선 제안"은 제외
- 학습자들이 자신의 성장을 느끼고, 자신감을 얻을 수 있는 내용으로 작성
- 긍정적이고 격려하는 톤 유지
- 구체적인 사례와 데이터를 바탕으로 설득력 있게 작성

반드시 JSON 형식으로만 응답해주세요.`;

  try {
    console.log('Calling Gemini 3 Flash Preview for total performance analysis...');

    const response = await fetch(`${GEMINI_PRO_TEXT_URL}?key=${GEMINI_API_KEY}`, {
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
