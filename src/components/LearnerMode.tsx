import React, { useState, useEffect, useRef } from 'react';
import { firebaseService } from '../services/firebaseService';
import { geminiService } from '../services/geminiService';
import { RoomState, TeamState, TeamPerformance, IndustryType, IndustryTypeLabels } from '../types';
import { BrutalistButton, BrutalistCard, BrutalistInput, BrutalistTextarea } from './BrutalistUI';
import { ROUNDS } from '../constants';
import CPRGame from './CPRGame';
import RelayRacingGame from './RelayRacingGame';
import { generateResultPDF } from '../utils/canvasInfographic';

// 시간 포맷팅 유틸
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ==========================================
// R4 AUDIO ENGINE (Web Audio API)
// ==========================================
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const R4Sounds = {
  playTick: (rate: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    // Pitch increases as time runs out (rate 0 to 1)
    // Base 400Hz -> Max 800Hz
    osc.frequency.setValueAtTime(400 + (rate * 400), ctx.currentTime);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  },
  playError: () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  },
  playCorrect: () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  },
  playAlarm: () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);

    // Siren effect
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.0);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  }
};

const formatTimeWithHours = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 화면 상태
type ViewState = 'waiting' | 'intro' | 'factory' | 'mission' | 'result';

// 이미지 최적화: imgur에서 'l' suffix 사용 (large thumbnail, 640px)
const FACTORY_BG = 'https://i.imgur.com/G66myVZl.jpeg';
const DIARY_IMAGE = 'https://i.imgur.com/vvbLGIml.jpeg';

// R1 신입사원 채용 서류전형 미션 (1월)
const R1_STORY = `여느 때처럼 나른한 오후를 즐기며 결재 서류를 뒤적이는 당신.
"적당히 스펙 좋고, 시키는 대로 일할 사람 하나 뽑지 뭐." 관행에 젖어 기계적으로 이력서를 집어 든다.
이 무심한 선택 하나가, 당신의 운명을 저 먼 아산 공장 바닥으로 내동댕이칠 트리거가 될 줄은 꿈에도 모른 채.`;

const R1_PROFILES = [
  {
    id: 1,
    name: '지원자 A',
    image: 'https://i.ibb.co/G3tPykrx/1.jpg',
  },
  {
    id: 2,
    name: '지원자 B',
    image: 'https://i.ibb.co/kn3X0T4/2.jpg',
  },
  {
    id: 3,
    name: '지원자 C',
    image: 'https://i.ibb.co/HpbZt1BZ/3.jpg',
  }
];
const R1_CORRECT_ANSWER = '박낙하';

// R2 노트북 비밀번호 미션 (2월)
const R2_STORY = `1월 신입 채용을 마친 2월의 영업팀, 강화된 보안 규정 탓에 급하게 바꾼 노트북 비밀번호가 도무지 떠오르지 않는다.
짜증을 내며 책상 위를 보니, 급하게 휘갈긴 메모와 찢겨진 다이어리 조각만이 덩그러니 놓여 있다.
모두 함께 단서들을 조합해 김부장의 노트북 비밀번호를 알아내야 한다!`;
const R2_IMAGE = 'https://i.ibb.co/yBcTW4dg/image.jpg';
const R2_CORRECT_ANSWER = '4035';

// R3 공장 위치 퀴즈 이미지 및 정답 (3월) - 기존 R1
const R3_STORY = `간신히 로그인에 성공하자 화면을 가득 채운 건 승진 명단이 아닌, [충청남도 아산 공장 발령] 통지서였다.
"내가... 지방 공장으로 좌천이라고?" 현실을 부정할 새도 없이, 당장 오늘까지 그곳으로 출근해야만 한다.
이제 서울 생활은 끝났다. 아래 이미지를 터치하여, 지도에서 유배지나 다름없는 그 공장의 정확한 위치를 찾아라!`;
const R3_QUIZ_IMAGE = 'https://i.imgur.com/nswRxmdl.jpeg';
const R3_PADLET_LINK = 'https://padlet.com/ksajhjeon/kim-s-back-idnyc8suzfsy502s';
const R3_CORRECT_ANSWERS = [
  '010-4454-2252',
  '010-2319-4323',
  '010-3228-3143',
  '010-9476-7825',
  '010-8448-2354'
];

// R4 틀린 그림 찾기 이미지 세트 (4월) - 새로운 형식: 단일 이미지, 클릭으로 정답 찾기
// 이미지 최적화: imgur 'l' suffix 사용
const R4_GAME_DATA = [
  {
    img: 'https://i.imgur.com/suTemUXl.png',
    answers: [
      { x: 55.1, y: 16.7, r: 7 },
      { x: 71.3, y: 50.3, r: 7 },
      { x: 85.7, y: 54.1, r: 7 }
    ]
  },
  {
    img: 'https://i.imgur.com/o5HD18zl.png',
    answers: [
      { x: 82.5, y: 10.1, r: 7 },
      { x: 74.4, y: 63.9, r: 7 },
      { x: 53.7, y: 71.2, r: 7 }
    ]
  },
  {
    img: 'https://i.imgur.com/sV8YkaBl.png',
    answers: [
      { x: 84.6, y: 43.3, r: 7 },
      { x: 67.6, y: 30.5, r: 7 },
      { x: 57.9, y: 22.4, r: 7 }
    ]
  }
];

const R4_STORY = "본사 복귀를 꿈꾼다면, 먼저 이 낯선 현장의 공기부터 완벽하게 파악해야 한다. 공장 내외부와 그곳을 지키는 강아지 한 마리의 그림 속에 복귀의 실마리가 숨겨져 있다. 당신의 '서울 본사급' 엘리트 눈썰미를 증명할 시간, 두 그림 사이의 미묘한 틀린 부분을 모두 찾아내라!";

// R5 팀 단체사진 (5월) - 이미지 최적화
const R5_SAMPLE_IMAGE = 'https://i.imgur.com/TlJe72Bl.jpeg';
const R5_STORY = "삭막했던 공장 주변에도 어느덧 5월의 신록이 우거졌다. '자연과 하나 된 조직만이 살아남는다!'는 공장장의 뜬금없는 지령, 이것도 본사 복귀 고과에 반영되는 건가? 지금 당장 밖으로 나가 푸른 나무나 식물을 배경으로, 팀원들과 함께 '완벽한 원팀' 인증샷을 찍어오라!";

// R6 사진 퀴즈 (6월)
const R6_CORRECT_ANSWER = 'BERLIN';
const R6_STORY = "무더위가 시작되는 6월, 당신의 인사권을 쥔 본사 임원이 극비리에 출장을 떠났다는 첩보가 입수됐다. 그가 머무는 곳을 알아내 줄을 댈 수 있는 천재일우의 기회, 이 동아줄을 반드시 잡아야 한다! 남겨진 단서들을 조합해, 상무님이 머물고 있는 출장지를 정확히 추적하라.";
const R6_MISSION_IMAGE = 'https://i.ibb.co/dsrs3Pzm/image.jpg';

// R7 영상 퀴즈 (7월)
const R7_VIDEO_URL = 'https://1970jjh.github.io/kim-is-back/7R.mp4';
const R7_STORY = "베를린 첩보가 통한 걸까? 7월의 폭염을 뚫고 본사 인사팀장이 갑자기 당신을 찾아왔다. 지금 필요한 건 단순한 듣기가 아니다. '맥락적 경청'으로 말 뒤에 숨은 의도를 읽고, '날카로운 통찰력'으로 그가 진짜 원하는 바를 찾아내야 한다. 팀원들과 영상을 정밀 분석해, 빙빙 돌려 말하는 인사팀장의 이야기 속 뒤에 감춰진 핵심을 꿰뚫는 '커뮤니케이션 능력과 상황 파악 능력'을 증명하라! 인사팀장이 진짜 원하는 것은 무엇인가? (When/What)";

// R8 문신 퀴즈 (8월)
const R8_CORRECT_ANSWER = 'STAR';
const R8_STORY = "앞선 현장 위기 관리 미션을 완벽하게 수행해낸 당신, 그 능력이 본사까지 전해진 걸까? 그룹의 핵심 실세인 전무님이 극비리에 공장을 방문했다는 첩보가 들어왔다. 그를 식별할 유일한 단서는 전무님 팔뚝의 문신 뿐!! 당신의 유려한 화술로 그가 스스로 소매를 걷게 만들어 문신의 문양을 확인하라!";
const R8_MISSION_IMAGE = 'https://i.ibb.co/WpPXDVch/image.jpg';

// R9 심폐소생술 게임 (9월)
const R9_STORY = "전무에게 확실한 눈도장을 찍으며 승승장구하던 찰나, 현장에서 \"쿵!\" 하는 소리와 함께 다급한 비명이 들려온다. \"사람이 쓰러졌습니다!\" 골든타임은 단 4분, 안전관리팀장으로서 동료의 생명을 구할 절체절명의 순간이다. 당신의 두 손에 모든 것이 달렸다. 흐트러짐 없는 박자와 정확한 속도로 심폐소생술을 실시해, 멈춰버린 심장을 다시 뛰게 하라!";

// R10 팀워크 미션 (10월)
const R10_STORY = "김부장의 눈부신 CPR 실력으로 쓰러졌던 직원은 다행히 의식을 찾았지만, 그 과정에서 공장 내부는 태풍이 휩쓸고 간 듯 자재들이 뒤엉켜 아수라장이 되었다. \"이 상태로 10월 정기 감사가 나오면 끝장이다!\" 흩어진 자재들을 제자리에 완벽하게 끼워 맞추는 대대적인 '현장 정상화(5S)'가 시급하다. 팀원 모두가 앞으로 나와서 제한 시간 내에 어수선한 공장의 질서를 바로잡고, 칼 같은 정리 정돈 능력을 보여줘라!";
const R10_MISSION_IMAGE = 'https://i.ibb.co/Xxh8xWrp/image.jpg';

// R11 고객 응대 시뮬레이션 (11월)
const R11_STORY = "본사 복귀의 마지막 관문! 당신의 고객 응대 스킬을 증명할 시간이다. 화가 난 고객이 클레임을 걸어왔다. 경청하고, 공감하고, 해결책을 제시하라. AI가 당신의 응대를 10가지 항목으로 평가한다. 고객 만족도 80점 이상을 달성하고, 진정한 프로페셔널의 자격을 완성하라!";

// 산업군별 고객 시나리오
const CUSTOMER_SCENARIOS: Record<IndustryType, { title: string; scenario: string; customerName: string }> = {
  [IndustryType.IT_SOLUTION]: {
    title: "시스템 장애 클레임",
    scenario: "ERP 시스템이 갑자기 멈춰서 우리 회사 전체가 마비됐습니다! 어제 업데이트 이후로 계속 이러는데 어떻게 하실 건가요?",
    customerName: "박 과장"
  },
  [IndustryType.MANUFACTURING]: {
    title: "납품 품질 불량",
    scenario: "어제 입고된 원자재 중 30%가 규격 미달입니다! 생산라인이 멈출 판인데 이게 말이 됩니까?",
    customerName: "김 공장장"
  },
  [IndustryType.RETAIL]: {
    title: "배송 지연 불만",
    scenario: "일주일 전에 주문한 상품이 아직도 안 왔어요! 추적 번호는 업데이트도 안 되고... 선물용이었는데 기념일 다 지났잖아요!",
    customerName: "이 고객님"
  },
  [IndustryType.CONSTRUCTION]: {
    title: "시공 하자 민원",
    scenario: "입주한 지 3개월밖에 안 됐는데 벽에 금이 가고 화장실에서 물이 새요! 이게 신축 아파트 맞습니까?",
    customerName: "최 입주민"
  },
  [IndustryType.FINANCE]: {
    title: "금융 상품 손실",
    scenario: "추천하신 펀드가 3개월 만에 20% 손실입니다! 원금 보장에 가깝다고 하셨잖아요? 이게 어떻게 된 겁니까?",
    customerName: "정 고객님"
  },
  [IndustryType.ADVERTISING]: {
    title: "광고 성과 미달",
    scenario: "한 달 광고비 5천만원 썼는데 전환율이 0.1%예요! 예상치의 10분의 1도 안 나왔는데 책임지실 거예요?",
    customerName: "강 마케팅팀장"
  },
  [IndustryType.CHEMICAL_ENERGY]: {
    title: "연료 품질 클레임",
    scenario: "납품받은 연료로 가동했더니 보일러 효율이 급격히 떨어졌어요! 성분 분석 결과 규격에 미달이던데 어떻게 보상받죠?",
    customerName: "윤 시설관리자"
  },
  [IndustryType.MEDICAL]: {
    title: "의료기기 오작동",
    scenario: "새로 도입한 진단 장비가 계속 오류를 일으켜요! 환자 검사 일정이 다 밀리고 있는데 긴급 A/S가 안 된다니요?",
    customerName: "한 원장님"
  },
  [IndustryType.LOGISTICS]: {
    title: "화물 파손 사고",
    scenario: "보낸 물품이 박살나서 도착했어요! 분명 '취급주의' 표시했는데... 이 손해는 누가 배상하는 겁니까?",
    customerName: "송 수출담당"
  },
  [IndustryType.FNB]: {
    title: "식품 이물질 발견",
    scenario: "케이터링 음식에서 이물질이 나왔어요! 중요한 행사였는데 손님들 앞에서 얼마나 창피했는지... 책임자 나오세요!",
    customerName: "임 행사담당"
  }
};

// R12 릴레이 레이싱 (12월) - 본사 복귀
const R12_STORY = "드디어 해냈다! 11개월간의 미션을 완수하고 [본사 복귀 확정] 통지서가 도착했다. 하지만 마지막 관문이 남았다. 본사까지의 험난한 길을 6명의 팀원이 릴레이로 주행해야 한다! 조직의 부정적 요소들(비꼬기, 책임회피, 꼰대문화...)을 피하고, 긍정 에너지(협업 파워, 팀워크, 시너지...)를 모아라. 제한 시간 내에 본사에 도착하면 김 부장의 화려한 복귀가 완성된다!";

// 월별 이름 (라운드와 매핑: R1=1월, R2=2월, ... R12=12월)
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const ROUND_TO_MONTH: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12
};

interface Props {
  room: RoomState;
  auth: { teamId: number; learnerName: string };
  onGoToMain?: () => void;
}

const LearnerMode: React.FC<Props> = ({ room, auth, onGoToMain }) => {
  const [team, setTeam] = useState<TeamState | undefined>(room.teams?.[auth.teamId]);
  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [remainingTime, setRemainingTime] = useState<string>("");

  // R1 신입사원 채용 미션 상태 (1월)
  const [r1Answer, setR1Answer] = useState('');
  const [r1Cleared, setR1Cleared] = useState(false);
  const [r1Error, setR1Error] = useState('');
  const [r1SelectedProfile, setR1SelectedProfile] = useState<number | null>(null);

  // R2 매너리즘 미션 상태 (2월)
  const [r2Answer, setR2Answer] = useState('');
  const [r2Cleared, setR2Cleared] = useState(false);
  const [r2Error, setR2Error] = useState('');
  const [r2SelectedImage, setR2SelectedImage] = useState<number | null>(null);

  // R3 공장위치 퀴즈 상태 (3월) - 기존 R1
  const [r3Answer, setR3Answer] = useState('');
  const [r3Cleared, setR3Cleared] = useState(false);
  const [r3Error, setR3Error] = useState('');
  const [showPadletPopup, setShowPadletPopup] = useState(false);

  // R4 틀린 그림 찾기 상태 (4월)
  const [r4GameStarted, setR4GameStarted] = useState(false);
  const [r4TimeLeft, setR4TimeLeft] = useState(60);
  const [r4CurrentSet, setR4CurrentSet] = useState(0);
  const [r4FoundDifferences, setR4FoundDifferences] = useState<{[setIndex: number]: number[]}>({});
  const [r4Failed, setR4Failed] = useState(false);
  const [r4FailReason, setR4FailReason] = useState<string>('');
  const [r4RetryCountdown, setR4RetryCountdown] = useState(0);
  const [r4Cleared, setR4Cleared] = useState(false);
  const [r4CompletionTime, setR4CompletionTime] = useState('');
  const [r4StartTime, setR4StartTime] = useState<number | null>(null);
  const [r4Mistakes, setR4Mistakes] = useState(0);
  const [r4ScreenShake, setR4ScreenShake] = useState(false);
  const [r4WrongMarkers, setR4WrongMarkers] = useState<{x: number, y: number, id: number}[]>([]);
  const r4SoundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const r4WrongMarkerIdRef = useRef(0);
  // R4 이미지 ref (좌표 계산용)
  const r4ImageRef = useRef<HTMLImageElement>(null);
  const r4ContainerRef = useRef<HTMLDivElement>(null);
  // R4 레이아웃 재계산 트리거 (이미지 로드, 리사이즈 시)
  const [r4LayoutKey, setR4LayoutKey] = useState(0);

  // R11 채팅 스크롤 ref
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // R11 채팅 입력창 ref (자동 포커스용)
  const r11InputRef = useRef<HTMLTextAreaElement>(null);

  // R5 팀 단체사진 상태 (5월)
  const [r5ImagePreview, setR5ImagePreview] = useState<string | null>(null);
  const [r5ImageFile, setR5ImageFile] = useState<File | null>(null);
  const [r5Verifying, setR5Verifying] = useState(false);
  const [r5Result, setR5Result] = useState<{ pass: boolean; message: string } | null>(null);
  const [r5Cleared, setR5Cleared] = useState(false);

  // R6 사진 퀴즈 상태 (6월)
  const [r6Answer, setR6Answer] = useState('');
  const [r6Cleared, setR6Cleared] = useState(false);
  const [r6Error, setR6Error] = useState('');

  // 지령 이미지 팝업 상태 (R6, R8, R10용)
  const [missionImagePopup, setMissionImagePopup] = useState<string | null>(null);

  // R7 영상 퀴즈 상태 (7월)
  const [r7Answer, setR7Answer] = useState('');
  const [r7Cleared, setR7Cleared] = useState(false);
  const [r7Error, setR7Error] = useState('');

  // R8 문신 퀴즈 상태 (8월)
  const [r8Answer, setR8Answer] = useState('');
  const [r8Cleared, setR8Cleared] = useState(false);
  const [r8Error, setR8Error] = useState('');

  // R9 심폐소생술 게임 상태 (9월)
  const [r9GameStarted, setR9GameStarted] = useState(false);
  const [r9Cleared, setR9Cleared] = useState(false);
  const [r9CompletionTime, setR9CompletionTime] = useState('');
  const [r9Score, setR9Score] = useState(0);

  // R10 팀워크 미션 상태 (10월)
  const [r10Answer, setR10Answer] = useState('');
  const [r10Cleared, setR10Cleared] = useState(false);
  const [r10Error, setR10Error] = useState('');

  // R11 고객 응대 시뮬레이션 상태 (11월)
  const [r11ChatHistory, setR11ChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [r11UserInput, setR11UserInput] = useState('');
  const [r11SatisfactionScore, setR11SatisfactionScore] = useState(0);
  const [r11MoodLevel, setR11MoodLevel] = useState(1); // 1-5 (1: 매우 화남, 5: 만족)
  const [r11EvaluationScores, setR11EvaluationScores] = useState<{
    greeting: number; listening: number; empathy: number; solution: number; professionalism: number;
    patience: number; clarity: number; positivity: number; responsibility: number; closing: number;
  }>({ greeting: 0, listening: 0, empathy: 0, solution: 0, professionalism: 0, patience: 0, clarity: 0, positivity: 0, responsibility: 0, closing: 0 });
  const [r11Sending, setR11Sending] = useState(false);
  const [r11Cleared, setR11Cleared] = useState(false);
  const [r11StartTime, setR11StartTime] = useState<number | null>(null);
  const [r11CompletionTime, setR11CompletionTime] = useState('');
  const [r11ShowManual, setR11ShowManual] = useState(false);
  const [r11ShowFeedback, setR11ShowFeedback] = useState(false);
  const [r11Feedback, setR11Feedback] = useState<{
    overallGrade: string;
    summary: string;
    goodPoints: string[];
    improvementPoints: string[];
    practicalTips: string;
    scoreComment: string;
  } | null>(null);
  const [r11FeedbackLoading, setR11FeedbackLoading] = useState(false);
  const [r11ChatEnded, setR11ChatEnded] = useState(false);

  // R12 릴레이 레이싱 게임 상태 (12월)
  const [r12GameStarted, setR12GameStarted] = useState(false);
  const [r12Cleared, setR12Cleared] = useState(false);
  const [r12CompletionTime, setR12CompletionTime] = useState('');
  const [r12GameStats, setR12GameStats] = useState<{
    round: number;
    totalDistance: number;
    timeLeft: number;
    obstaclesHit: string[];
    obstaclesAvoided: number;
    fuelItemsCollected: number;
    roundTimes: number[];
  } | null>(null);

  // 팀활동 결과보고서 상태 (미션 완료 후 작성)
  const [showReportForm, setShowReportForm] = useState(false);
  const [r12Report, setR12Report] = useState({
    oneLine: '',        // 한줄 소감
    bestMission: '',    // 협업이 빛났던 미션
    regret: '',         // 아쉬웠던 점
    futureHelp: ''      // 현업 도움
  });
  const [r12Validating, setR12Validating] = useState(false);
  const [r12ValidationResult, setR12ValidationResult] = useState<{ pass: boolean; message: string } | null>(null);
  const [r12Generating, setR12Generating] = useState(false);
  const [r12InfographicUrl, setR12InfographicUrl] = useState<string | null>(null);

  useEffect(() => {
    setTeam(room.teams?.[auth.teamId]);
  }, [room, auth.teamId]);

  // 미션 시작되면 intro로 전환
  useEffect(() => {
    if (room.missionStarted && viewState === 'waiting') {
      setViewState('intro');
    }
  }, [room.missionStarted, viewState]);

  // 미션 클리어 시 result로 전환
  useEffect(() => {
    if (team?.missionClearTime && viewState !== 'result') {
      setViewState('result');
    }
  }, [team?.missionClearTime, viewState]);

  // 전체 미션 타이머 (이벤트 중 일시정지)
  useEffect(() => {
    if (!room.missionStarted || !room.missionStartTime) {
      setRemainingTime("");
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();

      // 이벤트로 인해 일시정지된 총 시간 (초)
      let pausedSeconds = room.eventPausedTotal || 0;

      // 현재 이벤트가 진행 중이면 추가로 일시정지 시간 계산
      if (room.activeEvent !== 'NONE' && room.eventStartedAt) {
        const currentEventPaused = Math.floor((now - room.eventStartedAt) / 1000);
        pausedSeconds += currentEventPaused;
      }

      // 실제 경과 시간 = 총 경과 시간 - 일시정지된 시간
      const totalElapsed = Math.floor((now - room.missionStartTime!) / 1000);
      const elapsed = totalElapsed - pausedSeconds;

      const bonusTime = team?.totalBonusTime || 0;
      const totalSeconds = (room.missionTimerMinutes * 60) + bonusTime;
      const remaining = totalSeconds - elapsed;

      if (remaining <= 0) {
        setRemainingTime("00:00");
      } else {
        setRemainingTime(formatTimeWithHours(remaining));
      }
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);

    return () => clearInterval(timer);
  }, [room.missionStarted, room.missionStartTime, room.missionTimerMinutes, team?.totalBonusTime, room.eventPausedTotal, room.activeEvent, room.eventStartedAt]);

  const completeRound = async () => {
    if (!team) return;
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    // 라운드 완료 후 공장 페이지로 돌아가기
    setViewState('factory');
  };

  const goToPreviousRound = async () => {
    if (!team || team.currentRound <= 1) return;
    await firebaseService.setTeamRound(room.id, auth.teamId, team.currentRound - 1);
    setViewState('factory');
  };

  const goToNextRoundFromFactory = () => {
    // 이미 완수한 라운드로 이동할 때는 바로 다음 라운드로
    if (team && team.currentRound <= team.maxCompletedRound) {
      firebaseService.setTeamRound(room.id, auth.teamId, team.currentRound + 1);
    }
    setViewState('mission');
  };

  // R1 신입사원 채용 정답 체크 (1월)
  const handleR1Submit = () => {
    const normalizedAnswer = r1Answer.replace(/\s/g, '').trim();
    if (normalizedAnswer === R1_CORRECT_ANSWER || normalizedAnswer === '박낙하') {
      setR1Cleared(true);
      setR1Error('');
    } else {
      setR1Error('정답이 아닙니다. 다시 시도해주세요.');
    }
  };

  // R1 클리어 후 처리
  const handleR1Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR1Cleared(false);
    setR1Answer('');
    setR1SelectedProfile(null);
    setViewState('factory');
  };

  // R2 매너리즘 정답 체크 (2월)
  const handleR2Submit = () => {
    const normalizedAnswer = r2Answer.replace(/\s/g, '').trim();
    if (normalizedAnswer === R2_CORRECT_ANSWER || normalizedAnswer === '4035') {
      setR2Cleared(true);
      setR2Error('');
    } else {
      setR2Error('정답이 아닙니다. 다시 시도해주세요.');
    }
  };

  // R2 클리어 후 처리
  const handleR2Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR2Cleared(false);
    setR2Answer('');
    setR2SelectedImage(null);
    setViewState('factory');
  };

  // R3 공장위치 퀴즈 정답 체크 (3월) - 기존 R1
  const handleR3Submit = () => {
    const normalizedAnswer = r3Answer.replace(/\s/g, '').trim();
    const isCorrect = R3_CORRECT_ANSWERS.some(ans =>
      normalizedAnswer.includes(ans.replace(/-/g, '')) ||
      normalizedAnswer.includes(ans)
    );

    if (isCorrect) {
      setR3Cleared(true);
      setR3Error('');
    } else {
      setR3Error('정답이 아닙니다. 다시 시도해주세요.');
    }
  };

  // R3 클리어 후 처리
  const handleR3Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR3Cleared(false);
    setR3Answer('');
    setViewState('factory');
  };

  // R4 게임 타이머 (4월 틀린그림찾기) - 0.1초 단위로 업데이트
  useEffect(() => {
    if (!r4GameStarted || r4Failed || r4Cleared) return;

    if (r4TimeLeft <= 0) {
      setR4Failed(true);
      setR4FailReason('시간 초과');
      setR4RetryCountdown(5);
      R4Sounds.playAlarm();
      return;
    }

    const timer = setInterval(() => {
      setR4TimeLeft(prev => Math.max(0, prev - 0.1));
    }, 100);

    return () => clearInterval(timer);
  }, [r4GameStarted, r4TimeLeft, r4Failed, r4Cleared]);

  // R4 윈도우 리사이즈 시 레이아웃 재계산
  useEffect(() => {
    if (!r4GameStarted) return;

    const handleResize = () => {
      setR4LayoutKey(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [r4GameStarted]);

  // R4 긴장감 효과음 (시간이 갈수록 빨라짐)
  useEffect(() => {
    if (!r4GameStarted || r4Failed || r4Cleared) return;

    const scheduleTick = () => {
      const progress = 1 - (r4TimeLeft / 60); // 0 to 1
      const delay = Math.max(100, 1000 - (progress * 900)); // 1000ms -> 100ms

      R4Sounds.playTick(progress);

      r4SoundIntervalRef.current = setTimeout(scheduleTick, delay);
    };

    scheduleTick();

    return () => {
      if (r4SoundIntervalRef.current) {
        clearTimeout(r4SoundIntervalRef.current);
      }
    };
  }, [r4GameStarted, r4Failed, r4Cleared]);

  // R4 재도전 카운트다운 (5초)
  useEffect(() => {
    if (!r4Failed || r4RetryCountdown <= 0) return;

    // 알람 사운드 반복
    const alarmInterval = setInterval(() => {
      R4Sounds.playAlarm();
    }, 1000);

    const timer = setInterval(() => {
      setR4RetryCountdown(prev => {
        if (prev <= 1) {
          // 리셋 및 재시작
          setR4Failed(false);
          setR4FailReason('');
          setR4TimeLeft(60);
          setR4CurrentSet(0);
          setR4FoundDifferences({});
          setR4Mistakes(0);
          setR4WrongMarkers([]);
          setR4StartTime(Date.now());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(alarmInterval);
    };
  }, [r4Failed, r4RetryCountdown]);

  // R4 게임 시작
  const startR4Game = () => {
    // Audio context permission
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    setR4GameStarted(true);
    setR4TimeLeft(60);
    setR4CurrentSet(0);
    setR4FoundDifferences({});
    setR4Failed(false);
    setR4FailReason('');
    setR4Cleared(false);
    setR4CompletionTime('');
    setR4StartTime(Date.now());
    setR4Mistakes(0);
    setR4WrongMarkers([]);
    setR4ScreenShake(false);
  };

  // R4 실제 렌더링된 이미지 영역 계산 (object-contain으로 인한 여백 처리)
  const getR4RenderedLayout = () => {
    const img = r4ImageRef.current;
    const container = r4ContainerRef.current;
    if (!img || !container || !img.naturalWidth) return null;

    const containerRect = container.getBoundingClientRect();
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerRect.width / containerRect.height;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (naturalRatio > containerRatio) {
      // 이미지가 컨테이너보다 더 넓음 -> 너비에 맞춤 (위/아래 여백)
      renderWidth = containerRect.width;
      renderHeight = containerRect.width / naturalRatio;
      offsetX = 0;
      offsetY = (containerRect.height - renderHeight) / 2;
    } else {
      // 이미지가 컨테이너보다 더 높음 -> 높이에 맞춤 (좌/우 여백)
      renderHeight = containerRect.height;
      renderWidth = containerRect.height * naturalRatio;
      offsetX = (containerRect.width - renderWidth) / 2;
      offsetY = 0;
    }

    return { containerRect, renderWidth, renderHeight, offsetX, offsetY };
  };

  // R4 이미지 클릭 처리 (좌표 기반 정답 판정) - 정밀 좌표 계산
  const handleR4ImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (r4Failed || r4Cleared) return;

    const layout = getR4RenderedLayout();
    if (!layout) {
      // 레이아웃 계산 실패 시 기존 방식으로 폴백
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;
      processR4Click(clickX, clickY, clickX, clickY);
      return;
    }

    const { containerRect, renderWidth, renderHeight, offsetX, offsetY } = layout;

    // 마우스 위치 (컨테이너 기준)
    const clientX = e.clientX - containerRect.left;
    const clientY = e.clientY - containerRect.top;

    // 클릭이 실제 이미지 영역 내인지 확인
    if (clientX < offsetX || clientX > offsetX + renderWidth ||
        clientY < offsetY || clientY > offsetY + renderHeight) {
      // 여백 영역 클릭 무시
      return;
    }

    // 이미지 내의 퍼센트 좌표 계산
    const clickX = ((clientX - offsetX) / renderWidth) * 100;
    const clickY = ((clientY - offsetY) / renderHeight) * 100;

    // 마커 표시용 퍼센트 좌표 (컨테이너 기준)
    const markerX = (clientX / containerRect.width) * 100;
    const markerY = (clientY / containerRect.height) * 100;

    processR4Click(clickX, clickY, markerX, markerY);
  };

  // R4 클릭 처리 로직 (정답 체크)
  const processR4Click = (clickX: number, clickY: number, markerX: number, markerY: number) => {

    const currentStage = R4_GAME_DATA[r4CurrentSet];
    const currentFound = r4FoundDifferences[r4CurrentSet] || [];

    let hit = false;

    // 클릭 위치가 어떤 정답에 해당하는지 확인
    for (let i = 0; i < currentStage.answers.length; i++) {
      if (currentFound.includes(i)) continue; // 이미 찾은 것

      const answer = currentStage.answers[i];
      const distance = Math.sqrt(Math.pow(clickX - answer.x, 2) + Math.pow(clickY - answer.y, 2));

      if (distance <= answer.r) {
        // 정답 발견!
        hit = true;
        R4Sounds.playCorrect();

        const newFound = {
          ...r4FoundDifferences,
          [r4CurrentSet]: [...currentFound, i]
        };
        setR4FoundDifferences(newFound);

        // 현재 세트의 모든 차이점을 찾았는지 확인
        if (newFound[r4CurrentSet]?.length === 3) {
          // 모든 세트 완료 확인
          const allComplete = R4_GAME_DATA.every((_, idx) =>
            newFound[idx]?.length === 3
          );

          if (allComplete && r4StartTime) {
            // 게임 완료! - 소수점 2자리까지 초 단위로 기록 (예: 17.54)
            const elapsed = ((Date.now() - r4StartTime) / 1000).toFixed(2);
            setR4CompletionTime(elapsed); // 소수점 포함 초 단위
            setR4Cleared(true);
            setR4GameStarted(false); // 팝업 자동 닫힘
          } else if (r4CurrentSet < R4_GAME_DATA.length - 1) {
            // 다음 세트로 이동
            setR4CurrentSet(prev => prev + 1);
          }
        }
        break;
      }
    }

    // 오답 처리
    if (!hit) {
      R4Sounds.playError();
      const newMistakes = r4Mistakes + 1;
      setR4Mistakes(newMistakes);

      // 오답 마커 추가 (1초 후 자동 삭제) - markerX/Y는 컨테이너 기준 좌표
      const markerId = r4WrongMarkerIdRef.current++;
      setR4WrongMarkers(prev => [...prev, { x: markerX, y: markerY, id: markerId }]);
      setTimeout(() => {
        setR4WrongMarkers(prev => prev.filter(m => m.id !== markerId));
      }, 1000);

      // 화면 흔들림 효과
      setR4ScreenShake(true);
      setTimeout(() => setR4ScreenShake(false), 300);

      // 2번 실수 시 FAIL
      if (newMistakes >= 2) {
        setR4Failed(true);
        setR4FailReason('오답 과다 발생');
        setR4RetryCountdown(5);
        R4Sounds.playAlarm();
      }
    }
  };

  // R4 클리어 후 처리
  const handleR4Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR4GameStarted(false);
    setR4Cleared(false);
    setR4CompletionTime('');
    setViewState('factory');
  };

  // R4 총 찾은 차이점 수 계산
  const getR4TotalFoundDifferences = () => {
    return Object.values(r4FoundDifferences).reduce((sum, arr) => sum + arr.length, 0);
  };

  // R4 마커 위치 계산 (이미지 % -> 컨테이너 %)
  const getR4MarkerPosition = (imageXPercent: number, imageYPercent: number) => {
    const layout = getR4RenderedLayout();
    if (!layout) {
      // 폴백: 원래 퍼센트 그대로 사용
      return { x: imageXPercent, y: imageYPercent };
    }

    const { containerRect, renderWidth, renderHeight, offsetX, offsetY } = layout;

    // 이미지 내 퍼센트를 컨테이너 내 픽셀로 변환
    const pixelX = offsetX + (imageXPercent / 100 * renderWidth);
    const pixelY = offsetY + (imageYPercent / 100 * renderHeight);

    // 컨테이너 기준 퍼센트로 변환
    return {
      x: (pixelX / containerRect.width) * 100,
      y: (pixelY / containerRect.height) * 100
    };
  };

  // R4 현재 스테이지 정보
  const r4CurrentStage = R4_GAME_DATA[r4CurrentSet];
  const r4FoundInCurrentSet = r4FoundDifferences[r4CurrentSet] || [];

  // R5 이미지 업로드 처리
  const handleR5ImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setR5ImageFile(file);
    setR5Result(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setR5ImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // R5 이미지 검증
  const handleR5Verify = async () => {
    if (!r5ImagePreview || !r5ImageFile) return;

    setR5Verifying(true);
    setR5Result(null);

    try {
      const result = await geminiService.verifyPlantInPhoto(
        r5ImagePreview,
        r5ImageFile.type
      );
      setR5Result(result);
      if (result.pass) {
        setR5Cleared(true);
      }
    } catch (error) {
      setR5Result({ pass: false, message: '검증 중 오류가 발생했습니다.' });
    } finally {
      setR5Verifying(false);
    }
  };

  // R5 클리어 후 처리 (단체사진 Firebase Storage 업로드)
  const handleR5Clear = async () => {
    // 사진을 Firebase Storage에 저장
    if (r5ImageFile) {
      try {
        await firebaseService.uploadGroupPhoto(
          room.id,
          auth.teamId,
          room.groupName,
          r5ImageFile
        );
      } catch (error) {
        console.error('단체사진 업로드 실패:', error);
      }
    }

    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR5Cleared(false);
    setR5ImagePreview(null);
    setR5ImageFile(null);
    setR5Result(null);
    setViewState('factory');
  };

  // R6 정답 체크
  const handleR6Submit = () => {
    const normalizedAnswer = r6Answer.toUpperCase().replace(/\s/g, '');
    if (normalizedAnswer === R6_CORRECT_ANSWER) {
      setR6Cleared(true);
      setR6Error('');
    } else {
      setR6Error('정답이 아닙니다. 다시 시도해주세요.');
    }
  };

  // R6 클리어 후 처리
  const handleR6Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR6Cleared(false);
    setR6Answer('');
    setViewState('factory');
  };

  // R7 정답 체크 - "다음 주" + "20명" 또는 "스무명" 포함 시 정답
  const handleR7Submit = () => {
    const answer = r7Answer.trim();
    const normalizedAnswer = answer.replace(/\s/g, '');

    // "다음 주" 또는 "다음주" 포함 여부 체크
    const hasNextWeek = answer.includes('다음 주') || answer.includes('다음주') || normalizedAnswer.includes('다음주');

    // "20명" 또는 "스무명" 또는 "스무 명" 포함 여부 체크
    const hasTwenty = answer.includes('20명') || answer.includes('스무명') || answer.includes('스무 명') || normalizedAnswer.includes('20명') || normalizedAnswer.includes('스무명');

    if (hasNextWeek && hasTwenty) {
      setR7Cleared(true);
      setR7Error('');
    } else {
      setR7Error('정답이 아닙니다. (힌트: When/What 두 가지 모두 입력해주세요)');
    }
  };

  // R7 클리어 후 처리
  const handleR7Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR7Cleared(false);
    setR7Answer('');
    setViewState('factory');
  };

  // R8 정답 체크
  const handleR8Submit = () => {
    const normalizedAnswer = r8Answer.toUpperCase().replace(/\s/g, '');
    if (normalizedAnswer === R8_CORRECT_ANSWER) {
      setR8Cleared(true);
      setR8Error('');
    } else {
      setR8Error('정답이 아닙니다. 다시 시도해주세요.');
    }
  };

  // R8 클리어 후 처리
  const handleR8Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR8Cleared(false);
    setR8Answer('');
    setViewState('factory');
  };

  // R9 게임 시작
  const startR9Game = () => {
    setR9GameStarted(true);
  };

  // R9 게임 완료 (외부에서 호출 가능하도록)
  const handleR9GameComplete = (score: number) => {
    setR9Score(score);
    setR9CompletionTime(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    setR9Cleared(true);
    setR9GameStarted(false);
  };

  // R9 클리어 후 처리
  const handleR9Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR9Cleared(false);
    setR9CompletionTime('');
    setViewState('factory');
  };

  // R10 정답 체크 (강사가 알려준 시간)
  const handleR10Submit = () => {
    if (r10Answer.trim().length > 0) {
      setR10Cleared(true);
      setR10Error('');
    } else {
      setR10Error('강사님이 알려준 시간을 입력해주세요.');
    }
  };

  // R10 클리어 후 처리
  const handleR10Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR10Cleared(false);
    setR10Answer('');
    setViewState('factory');
  };

  // R11 채팅 자동 스크롤
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [r11ChatHistory, r11Sending]);

  // R11 고객 응대 대화 시작
  const startR11Chat = () => {
    const industryType = room.industryType || IndustryType.IT_SOLUTION;
    const scenario = CUSTOMER_SCENARIOS[industryType];
    setR11StartTime(Date.now());
    setR11MoodLevel(1); // 시작시 매우 화남
    setR11SatisfactionScore(0);
    setR11ChatHistory([{
      role: 'assistant',
      content: scenario.scenario
    }]);
  };

  // R11 메시지 전송
  const handleR11SendMessage = async () => {
    if (!r11UserInput.trim() || r11Sending) return;

    const userMessage = r11UserInput.trim();
    setR11UserInput('');
    setR11Sending(true);

    // 사용자 메시지 추가
    const newHistory = [...r11ChatHistory, { role: 'user' as const, content: userMessage }];
    setR11ChatHistory(newHistory);

    try {
      const industryType = room.industryType || IndustryType.IT_SOLUTION;
      const result = await geminiService.chatWithCustomer(industryType, r11ChatHistory, userMessage);

      // AI 응답 추가
      setR11ChatHistory([...newHistory, { role: 'assistant', content: result.response }]);
      setR11SatisfactionScore(result.satisfactionScore);
      setR11MoodLevel(result.moodLevel);
      setR11EvaluationScores(result.evaluationScores);

      // 80점 이상이면 대화 자동 종료 및 클리어
      if (result.satisfactionScore >= 80 && r11StartTime) {
        const elapsed = Math.floor((Date.now() - r11StartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        setR11CompletionTime(`${mins}분 ${secs}초`);
        setR11ChatEnded(true);  // 대화 자동 종료
        setR11Cleared(true);
      }
    } catch (error) {
      console.error('R11 chat error:', error);
    } finally {
      setR11Sending(false);
      // 전송 후 자동으로 입력창에 포커스
      setTimeout(() => {
        r11InputRef.current?.focus();
      }, 100);
    }
  };

  // R11 클리어 후 처리
  const handleR11Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR11Cleared(false);
    setR11ChatHistory([]);
    setR11SatisfactionScore(0);
    setR11MoodLevel(1);
    setR11EvaluationScores({ greeting: 0, listening: 0, empathy: 0, solution: 0, professionalism: 0, patience: 0, clarity: 0, positivity: 0, responsibility: 0, closing: 0 });
    setR11CompletionTime('');
    setR11ChatEnded(false);
    setR11Feedback(null);
    setViewState('factory');
  };

  // R11 대화 종료 및 피드백 생성
  const handleR11EndChat = async () => {
    if (r11FeedbackLoading) return;

    setR11FeedbackLoading(true);
    setR11ChatEnded(true);

    // 완료 시간 계산
    let completionTimeStr = '';
    if (r11StartTime) {
      const elapsed = Math.floor((Date.now() - r11StartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      completionTimeStr = `${mins}분 ${secs}초`;
      setR11CompletionTime(completionTimeStr);
    }

    try {
      const industryType = room.industryType || IndustryType.IT_SOLUTION;
      const result = await geminiService.generateCustomerServiceFeedback(
        r11ChatHistory,
        r11SatisfactionScore,
        industryType
      );

      if (result.success && result.feedback) {
        setR11Feedback(result.feedback);

        // Firebase에 피드백 저장
        await firebaseService.saveCustomerServiceFeedback(room.id, auth.teamId, {
          finalScore: r11SatisfactionScore,
          overallGrade: result.feedback.overallGrade,
          summary: result.feedback.summary,
          goodPoints: result.feedback.goodPoints,
          improvementPoints: result.feedback.improvementPoints,
          practicalTips: result.feedback.practicalTips,
          scoreComment: result.feedback.scoreComment,
          conversationHistory: r11ChatHistory,
          completionTime: completionTimeStr
        });
      } else {
        setR11Feedback({
          overallGrade: r11SatisfactionScore >= 80 ? 'A' : r11SatisfactionScore >= 70 ? 'B' : 'C',
          summary: '피드백을 생성하는 중 오류가 발생했습니다.',
          goodPoints: [],
          improvementPoints: [],
          practicalTips: '',
          scoreComment: `최종 점수: ${r11SatisfactionScore}점`
        });
      }

      setR11ShowFeedback(true);
    } catch (error) {
      console.error('R11 feedback error:', error);
      setR11Feedback({
        overallGrade: 'C',
        summary: '피드백 생성 중 오류가 발생했습니다.',
        goodPoints: [],
        improvementPoints: [],
        practicalTips: '',
        scoreComment: ''
      });
      setR11ShowFeedback(true);
    } finally {
      setR11FeedbackLoading(false);
    }
  };

  // R11 피드백 팝업 닫기 후 처리
  const handleR11CloseFeedback = () => {
    setR11ShowFeedback(false);
    // 80점 이상이면 자동 클리어 처리
    if (r11SatisfactionScore >= 80) {
      setR11Cleared(true);
    }
  };

  // R12 릴레이 레이싱 게임 시작
  const startR12Game = () => {
    setR12GameStarted(true);
  };

  // R12 릴레이 레이싱 게임 완료
  const handleR12GameComplete = (stats: {
    round: number;
    totalDistance: number;
    timeLeft: number;
    obstaclesHit: string[];
    obstaclesAvoided: number;
    fuelItemsCollected: number;
    roundTimes: number[];
  }) => {
    setR12GameStats(stats);
    setR12CompletionTime(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    setR12Cleared(true);
    setR12GameStarted(false);
  };

  // R12 클리어 후 처리 (다음 라운드로)
  const handleR12Clear = async () => {
    await firebaseService.advanceTeamRound(room.id, auth.teamId);
    setR12Cleared(false);
    setR12CompletionTime('');
    setR12GameStats(null);
    setViewState('factory');
  };

  // R12 보고서 검증 - 간소화된 검증 (1번 무조건 통과, 2/3/4번 100자 이상)
  const handleR12Validate = async () => {
    const { oneLine, bestMission, regret, futureHelp } = r12Report;

    // 1번 항목(한줄 소감)은 무조건 통과, 2/3/4번은 100자 이상 필요
    if (bestMission.trim().length < 100) {
      setR12ValidationResult({ pass: false, message: '2번 항목(가장 빛났던 미션)을 100자 이상 작성해주세요. (현재: ' + bestMission.trim().length + '자)' });
      return;
    }
    if (regret.trim().length < 100) {
      setR12ValidationResult({ pass: false, message: '3번 항목(아쉬웠던 점)을 100자 이상 작성해주세요. (현재: ' + regret.trim().length + '자)' });
      return;
    }
    if (futureHelp.trim().length < 100) {
      setR12ValidationResult({ pass: false, message: '4번 항목(현업 도움)을 100자 이상 작성해주세요. (현재: ' + futureHelp.trim().length + '자)' });
      return;
    }

    setR12Validating(true);
    setR12ValidationResult(null);

    try {
      // AI 검증 스킵하고 바로 PASS 처리
      setR12ValidationResult({ pass: true, message: 'PASS! 보고서가 승인되었습니다. AI 인포그래픽을 생성 중입니다... (최대 90초 소요)' });

      // Gemini 3 Pro Image Preview API로 인포그래픽 생성 (Canvas 폴백 없음)
      setR12Generating(true);
      try {
        const result = await geminiService.generateReportInfographic(r12Report, auth.teamId);

        if (result.success && result.imageData) {
          setR12InfographicUrl(result.imageData);
          setR12ValidationResult({ pass: true, message: '✨ AI 인포그래픽이 생성되었습니다! 다운로드 후 미션을 완료하세요.' });
          // Firebase에 보고서 저장
          await firebaseService.saveTeamReport(room.id, auth.teamId, r12Report, result.imageData);
        } else {
          // Gemini API 실패 시 에러 표시 (폴백 없음)
          console.error('Gemini image generation failed:', result.error);
          setR12ValidationResult({
            pass: true,
            message: `PASS! 보고서가 승인되었습니다. (이미지 생성 실패: ${result.error || '다시 시도해주세요'})`
          });
        }
      } catch (imgError) {
        console.error('Image generation failed:', imgError);
        setR12ValidationResult({
          pass: true,
          message: 'PASS! 보고서가 승인되었습니다. (이미지 생성 중 오류 발생 - 다시 시도해주세요)'
        });
      }
      setR12Generating(false);
    } catch (error) {
      console.error('R12 validation error:', error);
      // 에러가 발생해도 보고서 자체는 통과 처리
      setR12ValidationResult({ pass: true, message: 'PASS! 보고서가 승인되었습니다. (이미지 생성 중 오류 발생)' });
      setR12Generating(false);
    } finally {
      setR12Validating(false);
    }
  };

  // R12 이미지 다운로드 및 저장
  const handleR12Download = async () => {
    if (!r12InfographicUrl) return;

    // 다운로드
    const link = document.createElement('a');
    link.href = r12InfographicUrl;
    link.download = `team${auth.teamId}_팀활동보고서.png`;
    link.click();

    // Firebase에 저장 (아직 저장되지 않았다면)
    try {
      await firebaseService.saveTeamReport(room.id, auth.teamId, r12Report, r12InfographicUrl);
    } catch (error) {
      console.error('Report save error:', error);
    }

    // 폼 닫기
    setShowReportForm(false);
    setR12ValidationResult(null);
  };

  // 팀 보고서 다운로드 후 닫기
  const handleReportClose = () => {
    setShowReportForm(false);
    setR12Report({ oneLine: '', bestMission: '', regret: '', futureHelp: '' });
    setR12InfographicUrl(null);
    setR12ValidationResult(null);
  };

  // 전체 팀 성과 (순위 계산용)
  const allPerformances = firebaseService.calculateAllTeamPerformances(room);
  const myPerformanceWithRank = allPerformances.find(p => p.teamId === auth.teamId);

  // ============ WAITING 화면 ============
  if (!room.missionStarted || viewState === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
        <div className="animate-bounce mb-8">
            <h1 className="text-6xl gold-gradient mb-4">W A I T I N G</h1>
        </div>
        <BrutalistCard className="max-w-md w-full bg-black/80">
            <p className="text-xl font-bold mb-4">강사님의 [미션 스타트] 신호를 기다리는 중입니다.</p>
            <p className="text-gray-400">준비가 완료되면 자동으로 미션이 시작됩니다.</p>
        </BrutalistCard>
      </div>
    );
  }

  // ============ INTRO (오프닝) 화면 ============
  if (viewState === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 animate-fadeIn">
        {/* 헤더 - 메인가기 버튼 포함 */}
        <div className="flex justify-between items-center border-b-8 border-yellow-400 pb-4">
          <h1 className="text-5xl font-black">MISSION INTRO</h1>
          {onGoToMain && (
            <button
              onClick={onGoToMain}
              className="bg-white text-black px-4 py-2 font-black brutal-border hover:bg-gray-200 transition-colors text-sm"
            >
              메인가기
            </button>
          )}
        </div>

        <BrutalistCard className="aspect-video relative overflow-hidden bg-black p-0">
          <video
            className="w-full h-full"
            controls
            playsInline
            poster=""
          >
            <source src="/videos/opening.mp4" type="video/mp4" />
            브라우저가 영상 재생을 지원하지 않습니다.
          </video>
        </BrutalistCard>

        <div className="space-y-4">
          <img
            src={DIARY_IMAGE}
            alt="낡은 다이어리"
            className="w-full brutal-border brutalist-shadow"
            loading="lazy"
          />
          <div className="bg-[#ffd700] text-black p-8 brutal-border brutalist-shadow text-center">
            <p className="text-4xl font-black italic">"희망을 잃지 말고, 최선을 다해라"</p>
          </div>
        </div>

        <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={() => setViewState('factory')}>
          미션 현장으로 진입하기
        </BrutalistButton>
      </div>
    );
  }

  // ============ RESULT (결과 분석) 화면 ============
  if (viewState === 'result' && team?.missionClearTime && myPerformanceWithRank) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 animate-fadeIn">
        <div className="text-center space-y-4">
          <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow animate-pulse">
            <h1 className="text-6xl font-black">MISSION CLEAR!</h1>
            <p className="text-2xl mt-4">김부장님은 성공적으로 본사에 복귀하셨습니다!</p>
          </div>
        </div>

        <BrutalistCard className="space-y-6">
          <h2 className="text-3xl font-black gold-gradient text-center">팀 성과 분석</h2>

          <div className="grid grid-cols-2 gap-4">
            <BrutalistCard className="text-center bg-yellow-400/20">
              <p className="text-sm text-gray-400 uppercase">전체 순위</p>
              <p className="text-6xl font-black gold-gradient">#{myPerformanceWithRank.rank}</p>
              <p className="text-sm text-gray-400">{allPerformances.length}팀 중</p>
            </BrutalistCard>
            <BrutalistCard className="text-center">
              <p className="text-sm text-gray-400 uppercase">총 소요시간</p>
              <p className="text-4xl font-mono font-black">{formatTimeWithHours(myPerformanceWithRank.totalTime)}</p>
            </BrutalistCard>
          </div>

          <div>
            <h3 className="text-xl font-black mb-3">라운드별 소요시간</h3>
            <div className="grid grid-cols-5 gap-2">
              {ROUNDS.map(r => {
                const time = myPerformanceWithRank.roundTimes?.[r.id];
                return (
                  <div key={r.id} className="bg-white/10 p-3 text-center brutal-border">
                    <p className="text-xs text-gray-400">R{r.id}</p>
                    <p className="font-mono font-bold text-lg">{time ? formatTime(time) : '-'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </BrutalistCard>

        <section className="mt-8">
           <h4 className="text-xl font-black mb-4">TEAM ROLES</h4>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {team?.members?.map((m, idx) => (
                <div key={idx} className="bg-white/10 p-2 brutal-border text-sm">
                   <span className="text-yellow-400 font-bold block">{m.role}</span>
                   <span className="font-black">{m.name}</span>
                </div>
              ))}
           </div>
        </section>

        {/* 팀활동 결과보고서 섹션 */}
        <section className="mt-8">
          <h4 className="text-xl font-black mb-4">팀활동 결과보고서</h4>
          {team?.teamReport?.imageData ? (
            <div className="flex justify-center">
              <img
                src={team.teamReport.imageData}
                alt="팀활동 결과보고서"
                className="max-w-full brutal-border brutalist-shadow"
                style={{ maxHeight: '600px' }}
              />
            </div>
          ) : r12InfographicUrl ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={r12InfographicUrl}
                  alt="팀활동 결과보고서"
                  className="max-w-full brutal-border brutalist-shadow"
                  style={{ maxHeight: '600px' }}
                />
              </div>
              <BrutalistButton variant="gold" fullWidth onClick={handleR12Download}>
                보고서 다운로드 & 저장
              </BrutalistButton>
            </div>
          ) : (
            <div className="space-y-4">
              <BrutalistCard className="bg-yellow-400/10 border-yellow-400 text-center">
                <p className="text-lg text-gray-300 mb-4">
                  미션을 완료하셨습니다! 이제 팀활동 결과보고서를 작성해주세요.
                </p>
                <BrutalistButton variant="gold" onClick={() => setShowReportForm(true)}>
                  📝 팀활동 결과보고서 작성하기
                </BrutalistButton>
              </BrutalistCard>
            </div>
          )}
        </section>

        {/* 팀활동 결과보고서 작성 팝업 */}
        {showReportForm && (
          <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto my-8">
              <BrutalistCard className="space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-yellow-400 uppercase">팀활동 결과보고서</h3>
                  <button
                    onClick={() => setShowReportForm(false)}
                    className="text-gray-400 hover:text-white text-2xl font-black"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-gray-400">각 항목을 성의 있게 작성해주세요. AI가 내용을 검증합니다.</p>

                {/* 질문 1 */}
                <div>
                  <label className="text-sm font-bold text-yellow-400 block mb-2">1. 팀활동 전반에 대한 한줄 소감</label>
                  <BrutalistInput
                    fullWidth
                    placeholder="한 줄로 소감을 작성해주세요..."
                    value={r12Report.oneLine}
                    onChange={(e) => setR12Report({ ...r12Report, oneLine: e.target.value })}
                  />
                </div>

                {/* 질문 2 */}
                <div>
                  <label className="text-sm font-bold text-yellow-400 block mb-2">2. 팀 전원의 소통과 협업이 가장 빛났던 월 미션과 그 이유는?</label>
                  <BrutalistTextarea
                    fullWidth
                    rows={3}
                    placeholder="예: 4월 틀린그림찾기 - 팀원들이 각자 다른 영역을 맡아 빠르게 찾았습니다..."
                    value={r12Report.bestMission}
                    onChange={(e) => setR12Report({ ...r12Report, bestMission: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">현재: {r12Report.bestMission.trim().length}자 (최소 100자)</p>
                </div>

                {/* 질문 3 */}
                <div>
                  <label className="text-sm font-bold text-yellow-400 block mb-2">3. 반대로, 팀원들과 함께 미션을 풀어가면서 아쉬웠던 점이 있었다면?</label>
                  <BrutalistTextarea
                    fullWidth
                    rows={3}
                    placeholder="아쉬웠던 점과 그 이유를 작성해주세요..."
                    value={r12Report.regret}
                    onChange={(e) => setR12Report({ ...r12Report, regret: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">현재: {r12Report.regret.trim().length}자 (최소 100자)</p>
                </div>

                {/* 질문 4 */}
                <div>
                  <label className="text-sm font-bold text-yellow-400 block mb-2">4. 오늘 활동이 향후 현업에 어떤 도움이 될 수 있을까요?</label>
                  <BrutalistTextarea
                    fullWidth
                    rows={3}
                    placeholder="현업에 적용할 수 있는 점을 작성해주세요..."
                    value={r12Report.futureHelp}
                    onChange={(e) => setR12Report({ ...r12Report, futureHelp: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">현재: {r12Report.futureHelp.trim().length}자 (최소 100자)</p>
                </div>

                {r12ValidationResult && !r12Generating && (
                  <div className={`p-4 brutal-border text-center font-bold ${r12ValidationResult.pass ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {r12ValidationResult.message}
                  </div>
                )}

                {/* AI 보고서 생성 중 로딩 화면 */}
                {r12Generating && (
                  <div className="p-8 brutal-border bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-2xl font-black animate-pulse">AI 보고서가 생성 중입니다</p>
                    <p className="text-lg">잠시만 기다려주세요... ✨</p>
                    <p className="text-sm text-white/70">Gemini AI가 팀 활동 인포그래픽을 제작하고 있습니다</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <BrutalistButton variant="ghost" onClick={() => setShowReportForm(false)} className="flex-1">
                    취소
                  </BrutalistButton>
                  <BrutalistButton variant="gold" onClick={handleR12Validate} disabled={r12Validating || r12Generating} className="flex-1">
                    {r12Validating ? 'AI 검증 중...' : r12Generating ? '🎨 AI 보고서 생성 중...' : '보고서 제출하기'}
                  </BrutalistButton>
                </div>
              </BrutalistCard>
            </div>
          </div>
        )}

        {/* PDF 다운로드 버튼 */}
        <div className="mt-8">
          <BrutalistButton
            variant="gold"
            fullWidth
            className="text-xl"
            onClick={async () => {
              try {
                const pdfBlob = await generateResultPDF(
                  auth.teamId,
                  {
                    rank: myPerformanceWithRank.rank || 1,
                    totalRanks: allPerformances.length,
                    totalTime: myPerformanceWithRank.totalTime,
                    totalTimeWithBonus: myPerformanceWithRank.totalTimeWithBonus,
                    roundTimes: myPerformanceWithRank.roundTimes || {}
                  },
                  team?.members || [],
                  team?.teamReport?.imageData
                );
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `TEAM${auth.teamId}_결과보고서.pdf`;
                link.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error('PDF 생성 실패:', error);
                alert('PDF 생성 중 오류가 발생했습니다.');
              }
            }}
          >
            PDF 다운로드
          </BrutalistButton>
        </div>
      </div>
    );
  }

  // ============ FACTORY (공장) 화면 ============
  if (viewState === 'factory') {
    const isMissionComplete = team?.missionClearTime;
    const roundIndex = (team?.currentRound || 1) - 1;
    const currentRoundInfo = ROUNDS[roundIndex] || { id: 1, title: 'ROUND 1', description: '미션' };
    const canSkipForward = team && team.currentRound <= team.maxCompletedRound;

    // 완료된 라운드에 해당하는 월 목록
    const completedMonths = new Set<number>();
    for (let r = 1; r <= (team?.maxCompletedRound || 0); r++) {
      if (ROUND_TO_MONTH[r]) {
        completedMonths.add(ROUND_TO_MONTH[r]);
      }
    }

    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${FACTORY_BG}')` }}
      >
        <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
          {/* 헤더 */}
          <header className="flex justify-between items-center border-b-4 border-yellow-400 pb-4 pt-4">
            <div>
              <h2 className="text-3xl font-black italic text-yellow-400">TEAM {auth.teamId}</h2>
              <p className="font-bold text-white">김부장의 공장</p>
            </div>
            <div className="text-right">
              <span className="text-5xl font-black gold-gradient">R{team?.currentRound || 1}</span>
              <p className="text-xs font-bold uppercase tracking-widest text-white">Current</p>
            </div>
          </header>

          {/* 전체 미션 타이머 */}
          {remainingTime && (
            <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/70'}`}>
              <p className="text-sm text-gray-300 uppercase">남은 미션 시간</p>
              <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
                {remainingTime}
              </p>
              {team && team.totalBonusTime > 0 && (
                <p className="text-sm text-orange-400">헬프로 +{formatTime(team.totalBonusTime)} 추가됨</p>
              )}
            </div>
          )}

          {/* 연간 달력 카드 */}
          <BrutalistCard className="bg-black/80 space-y-6">
            <h3 className="text-2xl font-black text-center text-yellow-400">
              {isMissionComplete ? '🎉 모든 미션 완료!' : '김부장의 연간 미션 달력'}
            </h3>

            {/* 연간 달력 그리드 */}
            <div className="grid grid-cols-4 gap-3">
              {MONTHS.map((monthName, idx) => {
                const monthNum = idx + 1;
                const isCompleted = completedMonths.has(monthNum);
                const roundForMonth = Object.entries(ROUND_TO_MONTH).find(([_, m]) => m === monthNum)?.[0];
                const isCurrent = roundForMonth && team?.currentRound === parseInt(roundForMonth);

                return (
                  <div
                    key={monthNum}
                    className={`relative p-4 brutal-border text-center transition-all ${
                      isCompleted
                        ? 'bg-green-600/80'
                        : isCurrent
                        ? 'bg-yellow-400 text-black'
                        : 'bg-white/10'
                    }`}
                  >
                    <p className={`font-black text-lg ${isCurrent ? 'text-black' : ''}`}>{monthName}</p>
                    <p className={`text-xs ${isCurrent ? 'text-black/70' : 'text-gray-400'}`}>
                      R{roundForMonth}
                    </p>
                    {isCompleted && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-red-600 text-white px-2 py-1 rotate-[-15deg] font-black text-sm brutal-border shadow-lg">
                          CLEAR!
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 진행 상황 바 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>진행 상황</span>
                <span>{team?.maxCompletedRound || 0}/12 완료</span>
              </div>
              <div className="h-4 bg-black brutal-border overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-700"
                  style={{ width: `${((team?.maxCompletedRound || 0) / 12) * 100}%` }}
                />
              </div>
            </div>

            {/* 액션 버튼 */}
            {!isMissionComplete && (
              <div className="flex gap-4">
                {team && team.currentRound > 1 && (
                  <BrutalistButton
                    variant="ghost"
                    onClick={goToPreviousRound}
                    className="flex-shrink-0"
                  >
                    ← 이전
                  </BrutalistButton>
                )}

                <BrutalistButton
                  variant="gold"
                  fullWidth
                  className="text-xl"
                  onClick={() => setViewState('mission')}
                >
                  {canSkipForward ? `R${team?.currentRound} 확인하기` : `R${team?.currentRound} 미션 시작`}
                </BrutalistButton>
              </div>
            )}

            {isMissionComplete && (
              <BrutalistButton
                variant="gold"
                fullWidth
                className="text-xl"
                onClick={() => setViewState('result')}
              >
                결과 분석 보기
              </BrutalistButton>
            )}
          </BrutalistCard>

          {/* 팀 정보 */}
          <section>
             <h4 className="text-xl font-black mb-4 text-white">TEAM ROLES</h4>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {team?.members?.map((m, idx) => (
                  <div key={idx} className="bg-black/70 p-2 brutal-border text-sm">
                     <span className="text-yellow-400 font-bold block">{m.role}</span>
                     <span className="font-black text-white">{m.name}</span>
                  </div>
                ))}
             </div>
          </section>
        </div>

        {/* 달력보기 버튼 */}
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setViewState('factory')}
            className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // ============ MISSION (미션 수행) 화면 ============
  const missionRoundIndex = (team?.currentRound || 1) - 1;
  const currentRoundInfo = ROUNDS[missionRoundIndex] || { id: 1, title: 'ROUND 1', description: '미션' };
  const customInstruction = team?.roundInstructions?.[team?.currentRound || 1];
  const canSkipForward = team && team.currentRound <= team.maxCompletedRound;
  const isR1 = team?.currentRound === 1;
  const isR2 = team?.currentRound === 2;
  const isR3 = team?.currentRound === 3;
  const isR4 = team?.currentRound === 4;
  const isR5 = team?.currentRound === 5;
  const isR6 = team?.currentRound === 6;
  const isR7 = team?.currentRound === 7;
  const isR8 = team?.currentRound === 8;
  const isR9 = team?.currentRound === 9;
  const isR10 = team?.currentRound === 10;
  const isR11 = team?.currentRound === 11;
  const isR12 = team?.currentRound === 12;

  // 라운드별 완료 여부 체크
  const isR1Completed = (team?.maxCompletedRound || 0) >= 1;
  const isR2Completed = (team?.maxCompletedRound || 0) >= 2;
  const isR3Completed = (team?.maxCompletedRound || 0) >= 3;
  const isR4Completed = (team?.maxCompletedRound || 0) >= 4;
  const isR5Completed = (team?.maxCompletedRound || 0) >= 5;
  const isR6Completed = (team?.maxCompletedRound || 0) >= 6;
  const isR7Completed = (team?.maxCompletedRound || 0) >= 7;
  const isR8Completed = (team?.maxCompletedRound || 0) >= 8;
  const isR9Completed = (team?.maxCompletedRound || 0) >= 9;
  const isR10Completed = (team?.maxCompletedRound || 0) >= 10;
  const isR11Completed = (team?.maxCompletedRound || 0) >= 11;
  const isR12Completed = (team?.maxCompletedRound || 0) >= 12;

  // R1 신입사원 채용 서류전형 화면 (1월)
  if (isR1) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R1</span>
            <p className="text-xs font-bold uppercase tracking-widest">1월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
              {remainingTime}
            </p>
          </div>
        )}

        {r1Cleared ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
              <h2 className="text-5xl font-black mb-4">1월 미션 CLEAR!</h2>
              <p className="text-xl">축하합니다! 신입사원 채용 미션을 완료했습니다.</p>
            </div>
            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR1Clear}>
              월 업무 마감하기(클릭)
            </BrutalistButton>
          </div>
        ) : isR1Completed ? (
          <div className="space-y-6">
            <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
              <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              <p className="text-gray-400 mt-2">정답: {R1_CORRECT_ANSWER}</p>
            </div>
            <div className="flex gap-4">
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 2); setViewState('factory'); }}>
                다음 라운드로 →
              </BrutalistButton>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-3xl font-black uppercase tracking-tighter text-center">
              ROUND 1: 1월 미션 - 신입사원 채용
            </h3>

            {/* 브루탈리즘 스타일 시나리오 */}
            <div className="bg-black border-4 border-white p-4 md:p-6" style={{ boxShadow: '8px 8px 0px 0px #fbbf24' }}>
              <div className="space-y-4 font-mono">
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  여느 때처럼 나른한 오후를 즐기며 결재 서류를 뒤적이는 당신.
                </p>
                <p className="text-yellow-400 font-bold text-sm md:text-base italic">
                  "적당히 스펙 좋고, 시키는 대로 일할 사람 하나 뽑지 뭐."
                </p>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  관행에 젖어 기계적으로 이력서를 집어 든다.
                </p>
                <p className="text-red-400 font-bold text-sm md:text-base">
                  이 무심한 선택 하나가, 당신의 운명을 저 먼 아산 공장 바닥으로 내동댕이칠 트리거가 될 줄은 꿈에도 모른 채.
                </p>
              </div>
            </div>

            <div className="bg-yellow-400 text-black p-4 brutal-border text-center">
              <p className="text-xl md:text-2xl font-black">
                과연, 영업팀 김부장은 누구를 뽑았을까?
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {R1_PROFILES.map((profile) => (
                <div
                  key={profile.id}
                  className="cursor-pointer brutal-border overflow-hidden hover:scale-105 transition-transform bg-black"
                  onClick={() => setR1SelectedProfile(profile.id)}
                >
                  <img src={profile.image} alt={profile.name} className="w-full h-32 md:h-48 object-cover" loading="lazy" />
                  <p className="text-center font-black py-2 bg-white text-black text-sm md:text-base">{profile.name}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400">👆 이력서를 클릭하여 크게 보기</p>

            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
              <BrutalistInput
                fullWidth
                placeholder="김부장이 뽑은 사람의 이름은?"
                value={r1Answer}
                onChange={(e) => { setR1Answer(e.target.value); setR1Error(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleR1Submit(); }}
              />
              {r1Error && <p className="text-red-500 font-bold text-sm">{r1Error}</p>}
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={handleR1Submit}>
                정답 제출
              </BrutalistButton>
            </BrutalistCard>

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>월 업무 마감하기(클릭)</BrutalistButton>
          </div>
        )}

        {r1SelectedProfile && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setR1SelectedProfile(null)}>
            <div className="max-w-2xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black">{R1_PROFILES.find(p => p.id === r1SelectedProfile)?.name} 이력서</span>
                <button onClick={() => setR1SelectedProfile(null)} className="bg-black text-white px-4 py-2 font-black hover:bg-gray-800 brutal-border">
                  닫기 ✕
                </button>
              </div>
              <img src={R1_PROFILES.find(p => p.id === r1SelectedProfile)?.image} alt="이력서" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R2 매너리즘 김부장 화면 (2월)
  if (isR2) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R2</span>
            <p className="text-xs font-bold uppercase tracking-widest">2월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
              {remainingTime}
            </p>
          </div>
        )}

        {r2Cleared ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
              <h2 className="text-5xl font-black mb-4">2월 미션 CLEAR!</h2>
              <p className="text-xl">축하합니다! 노트북 비밀번호를 찾았습니다.</p>
            </div>
            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR2Clear}>
              월 업무 마감하기(클릭)
            </BrutalistButton>
          </div>
        ) : isR2Completed ? (
          <div className="space-y-6">
            <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
              <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              <p className="text-gray-400 mt-2">정답: {R2_CORRECT_ANSWER}</p>
            </div>
            <div className="flex gap-4">
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 3); setViewState('factory'); }}>
                다음 라운드로 →
              </BrutalistButton>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-3xl font-black uppercase tracking-tighter text-center">
              ROUND 2: 2월 미션 - 노트북 비밀번호
            </h3>

            {/* 브루탈리즘 스타일 시나리오 */}
            <div className="bg-black border-4 border-white p-4 md:p-6" style={{ boxShadow: '8px 8px 0px 0px #fbbf24' }}>
              <div className="space-y-4 font-mono">
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  1월 신입 채용을 마친 2월의 영업팀, 강화된 보안 규정 탓에 급하게 바꾼 노트북 비밀번호가 도무지 떠오르지 않는다.
                </p>
                <p className="text-yellow-400 font-bold text-sm md:text-base">
                  짜증을 내며 책상 위를 보니, 급하게 휘갈긴 메모와 찢겨진 다이어리 조각만이 덩그러니 놓여 있다.
                </p>
                <p className="text-red-400 font-bold text-sm md:text-base">
                  모두 함께 단서들을 조합해 김부장의 노트북 비밀번호를 알아내야 한다!
                </p>
              </div>
            </div>

            {/* 단서 이미지 */}
            <div
              className="cursor-pointer brutal-border overflow-hidden hover:scale-[1.02] transition-transform bg-black"
              onClick={() => setR2SelectedImage(1)}
            >
              <img src={R2_IMAGE} alt="단서" className="w-full object-contain" loading="lazy" />
              <p className="text-center font-black py-2 bg-white text-black">단서 이미지 (클릭하여 크게 보기)</p>
            </div>

            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">비밀번호 입력</label>
              <BrutalistInput
                fullWidth
                placeholder="숫자 4자리를 입력하세요"
                value={r2Answer}
                onChange={(e) => { setR2Answer(e.target.value); setR2Error(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleR2Submit(); }}
              />
              {r2Error && <p className="text-red-500 font-bold text-sm">{r2Error}</p>}
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={handleR2Submit}>
                정답 제출
              </BrutalistButton>
            </BrutalistCard>

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 달력보기 돌아가기</BrutalistButton>
          </div>
        )}

        {r2SelectedImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setR2SelectedImage(null)}>
            <div className="max-w-3xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black">단서 이미지</span>
                <button onClick={() => setR2SelectedImage(null)} className="bg-black text-white px-4 py-2 font-black hover:bg-gray-800 brutal-border">
                  닫기 ✕
                </button>
              </div>
              <img src={R2_IMAGE} alt="단서" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R3 공장위치 퀴즈 화면 (3월) - 기존 R1
  if (isR3) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R3</span>
            <p className="text-xs font-bold uppercase tracking-widest">3월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
              {remainingTime}
            </p>
          </div>
        )}

        {r3Cleared ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
              <h2 className="text-5xl font-black mb-4">3월 미션 CLEAR!</h2>
              <p className="text-xl">축하합니다! 공장 위치 미션을 완료했습니다.</p>
            </div>
            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR3Clear}>
              월 업무 마감하기(클릭)
            </BrutalistButton>
          </div>
        ) : isR3Completed ? (
          <div className="space-y-6">
            <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
              <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
            </div>
            <div className="flex gap-4">
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 4); setViewState('factory'); }}>
                다음 라운드로 →
              </BrutalistButton>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-3xl font-black uppercase tracking-tighter text-center">
              ROUND 3: 3월 미션 - 공장 위치 찾기
            </h3>

            {/* 브루탈리즘 스타일 시나리오 */}
            <div className="bg-black border-4 border-white p-4 md:p-6" style={{ boxShadow: '8px 8px 0px 0px #fbbf24' }}>
              <div className="space-y-4 font-mono">
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  간신히 로그인에 성공하자 화면을 가득 채운 건 승진 명단이 아닌, <span className="text-red-400 font-bold">[충청남도 아산 공장 발령]</span> 통지서였다.
                </p>
                <p className="text-yellow-400 font-bold text-sm md:text-base italic">
                  "내가... 지방 공장으로 좌천이라고?"
                </p>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  현실을 부정할 새도 없이, 당장 오늘까지 그곳으로 출근해야만 한다. 이제 서울 생활은 끝났다.
                </p>
                <p className="text-red-400 font-bold text-sm md:text-base">
                  아래 이미지를 터치하여, 지도에서 유배지나 다름없는 그 공장의 정확한 위치를 찾아라!
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <img
                src={R3_QUIZ_IMAGE}
                alt="공장 위치 힌트"
                className="w-full brutal-border brutalist-shadow cursor-pointer hover:scale-[1.02] transition-transform"
                onClick={() => setShowPadletPopup(true)}
              />
              <p className="text-center text-sm text-gray-400">👆 이미지를 클릭하면 크게 볼 수 있습니다</p>
            </div>

            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력 (전화번호)</label>
              <BrutalistInput
                fullWidth
                placeholder="전화번호를 입력하세요 (예: 010-1234-5678)"
                value={r3Answer}
                onChange={(e) => { setR3Answer(e.target.value); setR3Error(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleR3Submit(); }}
              />
              {r3Error && <p className="text-red-500 font-bold text-sm">{r3Error}</p>}
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={handleR3Submit}>
                정답 제출
              </BrutalistButton>
            </BrutalistCard>

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>월 업무 마감하기(클릭)</BrutalistButton>
          </div>
        )}

        {showPadletPopup && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-5xl max-h-[90vh] bg-white brutal-border brutalist-shadow flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black flex-shrink-0">
                <span className="font-black text-black">공장 위치 찾기 - Padlet</span>
                <button onClick={() => setShowPadletPopup(false)} className="bg-black text-white px-4 py-2 font-black hover:bg-red-600 brutal-border transition-colors">
                  ✕
                </button>
              </div>
              <iframe
                src={R3_PADLET_LINK}
                className="w-full flex-1 border-0"
                allow="camera;microphone;geolocation"
                title="Padlet"
              />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R4 틀린 그림 찾기 화면 (4월) - 인앱 팝업 방식
  if (isR4) {

    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R4</span>
            <p className="text-xs font-bold uppercase tracking-widest">4월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
              {remainingTime}
            </p>
          </div>
        )}

        {/* 메인 화면: 규칙 설명 및 결과 */}
        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">
            ROUND 4: 4월 미션 - 틀린 그림 찾기
          </h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R4_STORY}"</p>
          </BrutalistCard>

          <BrutalistCard className="space-y-4">
            <h4 className="text-xl font-black text-yellow-400">게임 규칙</h4>
            <ul className="space-y-2 text-lg">
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">▸</span> 총 3세트의 그림이 있습니다
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">▸</span> 각 그림당 3개의 틀린 부분을 찾으세요
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">▸</span> 제한 시간: <span className="font-black text-red-400">1분</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">▸</span> 실패 시 10초 후 재도전
              </li>
            </ul>
          </BrutalistCard>

          {r4Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">게임 완료!</h2>
                <p className="text-xl">틀린 그림 찾기를 완료했습니다.</p>
              </div>

              <BrutalistCard className="space-y-4">
                <label className="block text-lg font-black text-yellow-400 uppercase">정답 (완료 시간)</label>
                <BrutalistInput
                  fullWidth
                  value={`${r4CompletionTime}초`}
                  readOnly
                  className="text-center text-2xl font-mono"
                />
              </BrutalistCard>

              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR4Clear}>
                다음 라운드로 (R5) →
              </BrutalistButton>
            </div>
          ) : isR4Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 5); setViewState('factory'); }}>
                  다음 라운드로 →
                </BrutalistButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={startR4Game}>
                게임 시작!
              </BrutalistButton>
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          )}
        </div>

        {/* 인앱 팝업: 틀린 그림 찾기 게임 - 브루탈리즘 디자인 */}
        {r4GameStarted && !r4Cleared && (
          <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden"
            style={{
              backgroundColor: '#3333ff',
              backgroundImage: 'radial-gradient(#000 10%, transparent 10%)',
              backgroundPosition: '0 0',
              backgroundSize: '20px 20px',
            }}
          >
            {/* Header Stats - 브루탈리즘 */}
            <header className="w-full max-w-5xl flex justify-between items-stretch mb-2 md:mb-4 bg-white border-4 border-black" style={{ boxShadow: '8px 8px 0px 0px #000' }}>
              <div className="p-2 md:p-4 border-r-4 border-black bg-yellow-300 flex-1">
                <h1 className="text-lg md:text-2xl font-black tracking-tighter italic font-mono">틀린_그림_찾기_v2.0</h1>
                <p className="text-[10px] md:text-xs font-mono font-bold mt-1">© 김부장님_에디션</p>
              </div>

              <div className="flex">
                <div className="p-2 md:p-4 border-r-4 border-black text-center min-w-[60px] md:min-w-[100px] flex flex-col justify-center bg-white">
                  <p className="text-[10px] md:text-xs font-bold bg-black text-white inline-block px-1 mb-1">스테이지</p>
                  <p className="text-xl md:text-3xl font-black"><span>{r4CurrentSet + 1}</span><span className="text-sm md:text-base text-gray-500">/3</span></p>
                </div>
                <div className="p-2 md:p-4 border-r-4 border-black text-center min-w-[60px] md:min-w-[100px] flex flex-col justify-center bg-white">
                  <p className="text-[10px] md:text-xs font-bold bg-black text-white inline-block px-1 mb-1">찾음</p>
                  <p className="text-xl md:text-3xl font-black text-green-600"><span>{r4FoundInCurrentSet.length}</span><span className="text-sm md:text-base text-gray-500">/3</span></p>
                </div>
                <div className="p-2 md:p-4 text-center min-w-[60px] md:min-w-[100px] flex flex-col justify-center bg-red-100">
                  <p className="text-[10px] md:text-xs font-bold bg-red-600 text-white inline-block px-1 mb-1">목숨</p>
                  <div className="flex gap-1 justify-center mt-1">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="w-3 h-3 md:w-4 md:h-4 border-2 border-black"
                        style={{
                          backgroundColor: i < (2 - r4Mistakes) ? '#cc0000' : 'transparent',
                          opacity: i < (2 - r4Mistakes) ? 1 : 0.2
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </header>

            {/* Main Game Area - 브루탈리즘 */}
            <main
              className={`w-full max-w-5xl flex-grow relative flex bg-white border-4 border-black overflow-hidden ${r4ScreenShake ? 'animate-pulse' : ''}`}
              style={{
                boxShadow: '8px 8px 0px 0px #000',
                maxHeight: 'calc(100vh - 180px)',
                animation: r4ScreenShake ? 'glitch-skew 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none'
              }}
            >
              {/* Image Area */}
              <div className="relative flex-grow h-full overflow-hidden border-r-4 border-black">
                <div
                  ref={r4ContainerRef}
                  className="w-full h-full bg-gray-200 relative cursor-crosshair"
                  onClick={handleR4ImageClick}
                >
                  <img
                    ref={r4ImageRef}
                    src={r4CurrentStage?.img}
                    alt={`Stage ${r4CurrentSet + 1}`}
                    className="w-full h-full object-contain block select-none"
                    draggable={false}
                    onLoad={() => setR4LayoutKey(prev => prev + 1)}
                  />

                  {/* 찾은 정답 마커 (녹색 사각형) - 레이아웃 기반 위치 계산 */}
                  {r4CurrentStage?.answers.map((answer, idx) => {
                    if (!r4FoundInCurrentSet.includes(idx)) return null;
                    const pos = getR4MarkerPosition(answer.x, answer.y);
                    return (
                      <div
                        key={`${idx}-${r4LayoutKey}`}
                        className="absolute border-4 border-green-500 bg-green-500/30 pointer-events-none"
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          width: '40px',
                          height: '40px',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 10
                        }}
                      />
                    );
                  })}

                  {/* 오답 마커 (빨간 사각형) */}
                  {r4WrongMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className="absolute border-4 border-red-500 bg-red-500/50 pointer-events-none"
                      style={{
                        left: `${marker.x}%`,
                        top: `${marker.y}%`,
                        width: '40px',
                        height: '40px',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10
                      }}
                    />
                  ))}
                </div>

                {/* Warning Overlay (Fail) */}
                {r4Failed && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-600">
                    <h2 className="text-4xl md:text-8xl font-black text-white mb-4 text-center leading-none animate-pulse">
                      시스템<br/>오류
                    </h2>
                    <div className="bg-black text-yellow-300 p-4 border-4 border-white">
                      <p className="text-sm md:text-xl font-mono font-bold text-center">치명적 오류: {r4FailReason}</p>
                      <p className="text-2xl md:text-4xl font-mono font-bold text-center mt-2">시스템 재부팅 <span>{r4RetryCountdown}</span>초 전</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Vertical Timer Bar (Right Side) */}
              <div className="w-8 md:w-12 bg-black border-l-4 border-black relative flex flex-col justify-end">
                <div
                  className="w-full absolute top-0 left-0 transition-all duration-100 ease-linear"
                  style={{
                    height: `${((60 - r4TimeLeft) / 60) * 100}%`,
                    backgroundColor: r4TimeLeft <= 18 ? '#ff0000' : r4TimeLeft <= 36 ? '#ffff00' : '#00cc66'
                  }}
                />
                <div
                  className="z-10 absolute bottom-2 w-full text-center text-white font-mono font-bold text-xs"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  시간
                </div>
              </div>
            </main>

            {/* Footer */}
            <footer className="w-full text-center mt-2 md:mt-4">
              <p className="text-[10px] md:text-xs font-mono font-bold bg-white inline-block px-2 border-2 border-black">
                © 2026 JJ CREATIVE Edu with AI. All Rights Reserved.
              </p>
            </footer>

            {/* 닫기(X) 버튼 */}
            <button
              onClick={() => {
                setR4GameStarted(false);
                setR4TimeLeft(60);
                setR4CurrentSet(0);
                setR4FoundDifferences({});
                setR4Failed(false);
                setR4FailReason('');
                setR4Mistakes(0);
                setR4WrongMarkers([]);
                if (r4SoundIntervalRef.current) {
                  clearTimeout(r4SoundIntervalRef.current);
                }
              }}
              className="absolute top-4 right-4 z-[101] bg-white text-black w-10 h-10 md:w-12 md:h-12 border-4 border-black font-black text-xl hover:bg-yellow-300 transition-colors flex items-center justify-center"
              style={{ boxShadow: '4px 4px 0px 0px #000' }}
            >
              ✕
            </button>

            {/* CSS for glitch animation */}
            <style>{`
              @keyframes glitch-skew {
                0% { transform: translate(0) }
                20% { transform: translate(-5px, 5px) }
                40% { transform: translate(-5px, -5px) }
                60% { transform: translate(5px, 5px) }
                80% { transform: translate(5px, -5px) }
                100% { transform: translate(0) }
              }
            `}</style>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R5 팀 단체사진 (5월)
  if (isR5) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R5</span>
            <p className="text-xs font-bold uppercase tracking-widest">5월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 5: 5월 미션 - 팀 단체사진</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R5_STORY}"</p>
          </BrutalistCard>

          <BrutalistCard className="space-y-4">
            <p className="text-lg font-bold text-center">팀원 전원이 함께 찍은 단체사진을 업로드하세요!</p>
            <p className="text-center text-yellow-400 font-black">단, 사진에 식물(화초, 나무, 꽃 등)이 반드시 포함되어야 합니다!</p>
            <img src={R5_SAMPLE_IMAGE} alt="샘플 이미지" className="w-full max-w-md mx-auto brutal-border" loading="lazy" />
            <p className="text-center text-sm text-gray-400">↑ 샘플 이미지 (이런 식으로 식물과 함께!)</p>
          </BrutalistCard>

          {r5Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">5월 미션 CLEAR!</h2>
                <p className="text-xl">{r5Result?.message}</p>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR5Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR5Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 6); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <BrutalistCard className="space-y-4">
                <label className="block text-lg font-black text-yellow-400 uppercase">사진 업로드</label>
                <input type="file" accept="image/*" onChange={handleR5ImageUpload} className="w-full p-3 brutal-border bg-white text-black" />
                {r5ImagePreview && (
                  <div className="space-y-4">
                    <img src={r5ImagePreview} alt="미리보기" className="w-full max-w-md mx-auto brutal-border" />
                    <BrutalistButton variant="gold" fullWidth onClick={handleR5Verify} disabled={r5Verifying}>
                      {r5Verifying ? 'AI 검증 중...' : 'AI 검증하기'}
                    </BrutalistButton>
                  </div>
                )}
                {r5Result && (
                  <div className={`p-4 brutal-border text-center font-bold ${r5Result.pass ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {r5Result.message}
                  </div>
                )}
              </BrutalistCard>
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          )}
        </div>

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R6 사진 퀴즈 (6월)
  if (isR6) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R6</span>
            <p className="text-xs font-bold uppercase tracking-widest">6월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 6: 6월 미션 - 사진 퀴즈</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R6_STORY}"</p>
          </BrutalistCard>

          {/* 지령 이미지 */}
          <div className="cursor-pointer" onClick={() => setMissionImagePopup(R6_MISSION_IMAGE)}>
            <img src={R6_MISSION_IMAGE} alt="R6 지령" className="w-full max-w-md mx-auto brutal-border brutalist-shadow hover:scale-105 transition-transform" loading="lazy" />
            <p className="text-center text-sm text-gray-400 mt-2">👆 클릭하여 크게 보기</p>
          </div>

          {r6Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">6월 미션 CLEAR!</h2>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR6Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR6Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 7); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
              <BrutalistInput fullWidth placeholder="도시 이름을 영어로 입력하세요" value={r6Answer} onChange={(e) => { setR6Answer(e.target.value); setR6Error(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleR6Submit(); }} />
              {r6Error && <p className="text-red-500 font-bold text-sm">{r6Error}</p>}
              <BrutalistButton variant="gold" fullWidth onClick={handleR6Submit}>정답 제출</BrutalistButton>
            </BrutalistCard>
          )}
        </div>

        {/* 지령 이미지 팝업 */}
        {missionImagePopup && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setMissionImagePopup(null)}>
            <div className="max-w-4xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black text-lg">📋 지령서</span>
                <button onClick={() => setMissionImagePopup(null)} className="bg-black text-white px-4 py-2 font-black brutal-border hover:bg-red-600 transition-colors">✕</button>
              </div>
              <img src={missionImagePopup} alt="지령 이미지" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R7 영상 퀴즈 (7월)
  if (isR7) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R7</span>
            <p className="text-xs font-bold uppercase tracking-widest">7월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 7: 7월 미션 - 영상 퀴즈</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R7_STORY}"</p>
          </BrutalistCard>

          <BrutalistCard className="space-y-4">
            <p className="text-lg font-bold text-center">영상을 보고 인사팀장이 원하는 것을 맞추세요!</p>
            <video
              controls
              className="w-full brutal-border"
              playsInline
            >
              <source src={R7_VIDEO_URL} type="video/mp4" />
              브라우저가 영상을 지원하지 않습니다.
            </video>
          </BrutalistCard>

          {r7Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">7월 미션 CLEAR!</h2>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR7Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR7Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 달력</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 8); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
              <BrutalistInput fullWidth placeholder="인사팀장이 원하는 것을 입력하세요" value={r7Answer} onChange={(e) => { setR7Answer(e.target.value); setR7Error(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleR7Submit(); }} />
              {r7Error && <p className="text-red-500 font-bold text-sm">{r7Error}</p>}
              <BrutalistButton variant="gold" fullWidth onClick={handleR7Submit}>정답 제출</BrutalistButton>
            </BrutalistCard>
          )}
        </div>

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R8 문신 퀴즈 (8월)
  if (isR8) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R8</span>
            <p className="text-xs font-bold uppercase tracking-widest">8월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 8: 8월 미션 - 전무님의 문신</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R8_STORY}"</p>
          </BrutalistCard>

          {/* 지령 이미지 */}
          <div className="cursor-pointer" onClick={() => setMissionImagePopup(R8_MISSION_IMAGE)}>
            <img src={R8_MISSION_IMAGE} alt="R8 지령" className="w-full max-w-md mx-auto brutal-border brutalist-shadow hover:scale-105 transition-transform" loading="lazy" />
            <p className="text-center text-sm text-gray-400 mt-2">👆 클릭하여 크게 보기</p>
          </div>

          {r8Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">8월 미션 CLEAR!</h2>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR8Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR8Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 9); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
              <BrutalistInput fullWidth placeholder="문신에 새겨진 단어를 입력하세요 (영문)" value={r8Answer} onChange={(e) => { setR8Answer(e.target.value); setR8Error(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleR8Submit(); }} />
              {r8Error && <p className="text-red-500 font-bold text-sm">{r8Error}</p>}
              <BrutalistButton variant="gold" fullWidth onClick={handleR8Submit}>정답 제출</BrutalistButton>
            </BrutalistCard>
          )}
        </div>

        {/* 지령 이미지 팝업 */}
        {missionImagePopup && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setMissionImagePopup(null)}>
            <div className="max-w-4xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black text-lg">📋 지령서</span>
                <button onClick={() => setMissionImagePopup(null)} className="bg-black text-white px-4 py-2 font-black brutal-border hover:bg-red-600 transition-colors">✕</button>
              </div>
              <img src={missionImagePopup} alt="지령 이미지" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R9 심폐소생술 게임 (9월) - 플레이스홀더
  if (isR9) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R9</span>
            <p className="text-xs font-bold uppercase tracking-widest">9월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 9: 9월 미션 - 심폐소생술</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R9_STORY}"</p>
          </BrutalistCard>

          {r9Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">9월 미션 CLEAR!</h2>
                <p className="text-xl">점수: {r9Score}점</p>
                <p className="text-gray-300">완료 시간: {r9CompletionTime}</p>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR9Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR9Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 10); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <BrutalistCard className="text-center p-8">
                <p className="text-lg mb-4">게임을 시작하면 심폐소생술 미니게임이 시작됩니다.</p>
                <p className="text-sm text-gray-400 mb-6">(게임 코드는 추후 제공 예정)</p>
                <BrutalistButton variant="gold" fullWidth onClick={startR9Game}>게임 시작!</BrutalistButton>
              </BrutalistCard>
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          )}
        </div>

        {/* R9 CPR 게임 팝업 */}
        {r9GameStarted && (
          <CPRGame
            onComplete={handleR9GameComplete}
            onClose={() => setR9GameStarted(false)}
          />
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R10 팀워크 미션 (10월)
  if (isR10) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R10</span>
            <p className="text-xs font-bold uppercase tracking-widest">10월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 10: 10월 미션 - 팀워크</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R10_STORY}"</p>
          </BrutalistCard>

          {/* 지령 이미지 */}
          <div className="cursor-pointer" onClick={() => setMissionImagePopup(R10_MISSION_IMAGE)}>
            <img src={R10_MISSION_IMAGE} alt="R10 지령" className="w-full max-w-md mx-auto brutal-border brutalist-shadow hover:scale-105 transition-transform" loading="lazy" />
            <p className="text-center text-sm text-gray-400 mt-2">👆 클릭하여 크게 보기</p>
          </div>

          <BrutalistCard className="space-y-4 text-center">
            <p className="text-xl font-bold">팀원들과 함께 완벽한 3개의 정사각형을 완성하세요!</p>
            <p className="text-lg text-yellow-400">모두 앞으로 나오세요.</p>
            <p className="text-sm text-gray-400">완료 후 강사님이 알려주는 시간을 입력하세요.</p>
          </BrutalistCard>

          {r10Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">10월 미션 CLEAR!</h2>
                <p className="text-xl">기록: {r10Answer}</p>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR10Clear}>월 업무 마감하기(클릭)</BrutalistButton>
            </div>
          ) : isR10Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 공장</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 11); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : (
            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">강사님이 알려준 시간 입력</label>
              <BrutalistInput fullWidth placeholder="예: 2분 30초" value={r10Answer} onChange={(e) => { setR10Answer(e.target.value); setR10Error(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleR10Submit(); }} />
              {r10Error && <p className="text-red-500 font-bold text-sm">{r10Error}</p>}
              <BrutalistButton variant="gold" fullWidth onClick={handleR10Submit}>확인</BrutalistButton>
            </BrutalistCard>
          )}
        </div>

        {/* 지령 이미지 팝업 */}
        {missionImagePopup && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setMissionImagePopup(null)}>
            <div className="max-w-4xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black text-lg">📋 지령서</span>
                <button onClick={() => setMissionImagePopup(null)} className="bg-black text-white px-4 py-2 font-black brutal-border hover:bg-red-600 transition-colors">✕</button>
              </div>
              <img src={missionImagePopup} alt="지령 이미지" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R11 고객 응대 시뮬레이션 (11월)
  if (isR11) {
    const industryType = room.industryType || IndustryType.IT_SOLUTION;
    const scenario = CUSTOMER_SCENARIOS[industryType];
    const moodEmojis = ['😤', '😠', '😐', '🙂', '😊'];
    const moodLabels = ['매우 화남', '화남', '보통', '좋음', '만족'];

    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R11</span>
            <p className="text-xs font-bold uppercase tracking-widest">11월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 11: 고객 응대 시뮬레이션</h3>
          <p className="text-center text-sm text-gray-400">산업군: {IndustryTypeLabels[industryType]} | 시나리오: {scenario.title}</p>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R11_STORY}"</p>
          </BrutalistCard>

          {/* 고객 기분 게이지 */}
          {r11ChatHistory.length > 0 && (
            <div className="bg-black/30 p-4 brutal-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">고객 기분</span>
                <span className="text-3xl">{moodEmojis[r11MoodLevel - 1]}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(level => (
                  <div
                    key={level}
                    className={`flex-1 h-3 transition-all duration-300 ${
                      level <= r11MoodLevel
                        ? level <= 2 ? 'bg-red-500' : level === 3 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-center text-sm font-bold" style={{ color: r11MoodLevel <= 2 ? '#ef4444' : r11MoodLevel === 3 ? '#facc15' : '#22c55e' }}>
                {moodLabels[r11MoodLevel - 1]}
              </p>
            </div>
          )}

          {/* 만족도 점수 표시 */}
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">고객 만족도</p>
            <div className="w-full h-8 bg-gray-700 brutal-border overflow-hidden">
              <div className={`h-full transition-all duration-500 ${r11SatisfactionScore >= 80 ? 'bg-green-500' : r11SatisfactionScore >= 50 ? 'bg-yellow-400' : 'bg-orange-500'}`} style={{ width: `${r11SatisfactionScore}%` }} />
            </div>
            <p className={`text-4xl font-black mt-2 ${r11SatisfactionScore >= 80 ? 'text-green-400' : r11SatisfactionScore >= 50 ? 'text-yellow-400' : 'text-orange-400'}`}>{r11SatisfactionScore}점</p>
            {r11SatisfactionScore >= 80 && <p className="text-green-400 font-bold animate-pulse">목표 달성!</p>}
          </div>

          {r11Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">11월 미션 CLEAR!</h2>
                <p className="text-xl">소요 시간: {r11CompletionTime}</p>
                <p className="text-lg mt-2">고객의 마음을 사로잡았습니다!</p>
              </div>

              {/* 평가 점수 레이더 차트 대신 바 차트로 표시 */}
              <BrutalistCard className="space-y-3">
                <h4 className="text-lg font-black text-yellow-400 text-center">응대 평가 결과</h4>
                {[
                  { key: 'greeting', label: '인사/첫인상' },
                  { key: 'listening', label: '경청' },
                  { key: 'empathy', label: '공감 표현' },
                  { key: 'solution', label: '해결책 제시' },
                  { key: 'professionalism', label: '전문성' },
                  { key: 'patience', label: '인내심' },
                  { key: 'clarity', label: '명확한 의사소통' },
                  { key: 'positivity', label: '긍정적 태도' },
                  { key: 'responsibility', label: '책임감' },
                  { key: 'closing', label: '마무리' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs w-24 text-gray-400">{label}</span>
                    <div className="flex-1 h-4 bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all duration-500"
                        style={{ width: `${r11EvaluationScores[key as keyof typeof r11EvaluationScores]}%` }}
                      />
                    </div>
                    <span className="text-xs w-8 text-right font-bold">{r11EvaluationScores[key as keyof typeof r11EvaluationScores]}</span>
                  </div>
                ))}
              </BrutalistCard>

              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR11Clear}>미션 성공, 다음라운드로 →</BrutalistButton>
            </div>
          ) : isR11Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 이미 완료한 미션입니다</p>
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="ghost" onClick={() => setViewState('factory')} className="flex-shrink-0">← 달력</BrutalistButton>
                <BrutalistButton variant="gold" fullWidth onClick={() => { firebaseService.setTeamRound(room.id, auth.teamId, 12); setViewState('factory'); }}>다음 라운드로 →</BrutalistButton>
              </div>
            </div>
          ) : r11ChatHistory.length === 0 ? (
            <div className="space-y-4">
              <BrutalistCard className="text-center p-8 space-y-4">
                <div className="text-5xl">📞</div>
                <p className="text-xl font-bold text-red-400">{scenario.customerName}님으로부터 클레임 전화!</p>
                <p className="text-lg">{scenario.title}</p>
                <p className="text-sm text-gray-400">고객 만족도가 80점 이상이 되면 미션 클리어!</p>
                <BrutalistButton variant="gold" fullWidth onClick={startR11Chat}>전화 받기</BrutalistButton>
              </BrutalistCard>
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 달력보기</BrutalistButton>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 채팅 영역 */}
              <div ref={chatContainerRef} className="h-[350px] overflow-y-auto bg-black/50 brutal-border p-4 space-y-3">
                {r11ChatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 brutal-border ${msg.role === 'user' ? 'bg-yellow-400 text-black' : 'bg-white text-black'}`}>
                      <p className="text-xs font-bold mb-1">{msg.role === 'user' ? '나 (김부장)' : scenario.customerName}</p>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {r11Sending && <div className="text-center text-gray-400 animate-pulse">{scenario.customerName}님이 응답 중...</div>}
              </div>

              {/* 입력 영역 */}
              {!r11ChatEnded ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <BrutalistTextarea
                      ref={r11InputRef}
                      fullWidth
                      rows={2}
                      placeholder="고객에게 응대할 내용을 입력하세요... (Shift+Enter: 줄바꿈)"
                      value={r11UserInput}
                      onChange={(e) => setR11UserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleR11SendMessage();
                        }
                      }}
                      disabled={r11Sending}
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setR11ChatHistory([]);
                          setR11SatisfactionScore(0);
                          setR11MoodLevel(1);
                          setR11StartTime(Date.now());
                          const industryType = room.industryType || IndustryType.IT_SOLUTION;
                          const scenario = R11_SCENARIOS[industryType];
                          setR11ChatHistory([{ role: 'assistant', content: scenario.scenario }]);
                        }}
                        className="h-fit px-3 py-2 bg-red-600 text-white text-xs font-bold brutal-border hover:bg-red-500 transition-colors whitespace-nowrap"
                        title="처음부터 다시 시작"
                      >
                        🔄 다시 시작
                      </button>
                      <button
                        onClick={() => setR11ShowManual(true)}
                        className="h-fit px-3 py-2 bg-blue-600 text-white text-xs font-bold brutal-border hover:bg-blue-500 transition-colors whitespace-nowrap"
                        title="응대 팁 보기"
                      >
                        📖 매뉴얼
                      </button>
                    </div>
                    <BrutalistButton variant="gold" onClick={handleR11SendMessage} disabled={r11Sending || !r11UserInput.trim()} className="h-fit">전송</BrutalistButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-600/20 border-2 border-green-500 p-4 text-center">
                    <p className="text-green-400 font-bold text-lg">✓ 대화가 종료되었습니다</p>
                    <p className="text-gray-300 text-sm mt-1">최종 점수: {r11SatisfactionScore}점 {r11CompletionTime && `| 소요시간: ${r11CompletionTime}`}</p>
                  </div>
                  {r11SatisfactionScore >= 80 ? (
                    <BrutalistButton variant="gold" fullWidth onClick={handleR11Clear}>
                      다음 라운드로 →
                    </BrutalistButton>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-center text-yellow-400 text-sm">80점 이상 달성 시 다음 라운드로 이동할 수 있습니다.</p>
                      <div className="flex gap-2">
                        <BrutalistButton variant="secondary" fullWidth onClick={() => {
                          setR11ChatEnded(false);
                          setR11ChatHistory([]);
                          setR11SatisfactionScore(0);
                          setR11MoodLevel(1);
                          setR11Feedback(null);
                          initR11Chat();
                        }}>
                          처음부터 다시하기
                        </BrutalistButton>
                        <BrutalistButton variant="gold" fullWidth onClick={() => setR11ShowFeedback(true)}>
                          피드백 다시보기
                        </BrutalistButton>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 고객 대화 매뉴얼 팝업 */}
        {r11ShowManual && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-black max-w-lg w-full max-h-[80vh] overflow-y-auto brutal-border brutalist-shadow">
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h3 className="text-xl font-black">📖 B2B 고객 응대 매뉴얼</h3>
                <button onClick={() => setR11ShowManual(false)} className="text-2xl font-black hover:text-yellow-400">✕</button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-red-100 p-3 border-l-4 border-red-500">
                  <p className="font-bold text-red-800">⚠️ 상황: 화난 B2B 고객이 클레임을 제기했습니다</p>
                  <p className="text-sm text-red-700 mt-1">목표: 고객 만족도 80점 이상 달성하기</p>
                </div>

                <div className="bg-yellow-100 p-3 border-l-4 border-yellow-500">
                  <p className="font-bold text-yellow-800">💡 점수를 올리는 핵심 포인트</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="bg-gray-100 p-3 rounded">
                    <p className="font-black text-red-600">1. 즉각적인 사과 & 공감 (+15~20점)</p>
                    <p className="text-gray-600">• "불편을 드려 진심으로 죄송합니다"</p>
                    <p className="text-gray-600">• "업무에 차질이 생기셨을텐데 정말 송구합니다"</p>
                    <p className="text-gray-600">• 고객의 피해 상황을 구체적으로 인정하기</p>
                  </div>

                  <div className="bg-gray-100 p-3 rounded">
                    <p className="font-black text-orange-600">2. 문제 상황 정리 & 경청 (+5~10점)</p>
                    <p className="text-gray-600">• "말씀하신 내용 정리해보면..."</p>
                    <p className="text-gray-600">• 고객이 말한 문제를 다시 요약</p>
                    <p className="text-gray-600">• "제가 정확히 이해한 게 맞을까요?"</p>
                  </div>

                  <div className="bg-gray-100 p-3 rounded">
                    <p className="font-black text-blue-600">3. 구체적인 해결책 제시 (+10~15점)</p>
                    <p className="text-gray-600">• 즉시 처리: "지금 바로 담당자 연결해드리겠습니다"</p>
                    <p className="text-gray-600">• 일정 제시: "오늘 오후 3시까지 해결해드리겠습니다"</p>
                    <p className="text-gray-600">• 대안 제안: "임시로 ~를 지원해드리겠습니다"</p>
                  </div>

                  <div className="bg-gray-100 p-3 rounded">
                    <p className="font-black text-purple-600">4. 보상 & 재발 방지 (+10~15점)</p>
                    <p className="text-gray-600">• "손해 비용 전액 보상해드리겠습니다"</p>
                    <p className="text-gray-600">• "추가 서비스/할인을 제공해드리겠습니다"</p>
                    <p className="text-gray-600">• "재발 방지를 위해 프로세스를 개선하겠습니다"</p>
                  </div>

                  <div className="bg-gray-100 p-3 rounded">
                    <p className="font-black text-green-600">5. 책임감 있는 마무리 (+8~12점)</p>
                    <p className="text-gray-600">• "저희 책임입니다. 변명하지 않겠습니다"</p>
                    <p className="text-gray-600">• "제가 끝까지 책임지고 처리하겠습니다"</p>
                    <p className="text-gray-600">• "처리 결과 직접 연락드리겠습니다"</p>
                  </div>
                </div>

                <div className="bg-red-50 p-3 border-l-4 border-red-400">
                  <p className="font-bold text-red-700 mb-1">❌ 피해야 할 표현 (감점)</p>
                  <p className="text-sm text-red-600">• "그건 저희 잘못이 아닙니다" (변명)</p>
                  <p className="text-sm text-red-600">• "규정상 어렵습니다" (딱딱한 거절)</p>
                  <p className="text-sm text-red-600">• "확인해보고 연락드릴게요" (애매한 답변)</p>
                </div>

                <div className="bg-green-100 p-3 border-l-4 border-green-500">
                  <p className="font-bold text-green-800 mb-2">✅ 좋은 응대 예시</p>
                  <p className="text-sm text-green-700 italic">
                    "고객님, 업무에 큰 차질이 생기셨을텐데 진심으로 죄송합니다. 말씀하신 것처럼 저희 측 실수로 발생한 문제입니다. 지금 즉시 기술팀장을 투입하여 오후 2시까지 복구 완료하겠습니다. 손해 비용은 전액 보상드리고, 다음 달 서비스 비용 20% 할인도 적용해드리겠습니다. 제가 직접 처리 상황 1시간마다 문자로 안내드리겠습니다."
                  </p>
                </div>

                <BrutalistButton variant="primary" fullWidth onClick={() => setR11ShowManual(false)}>
                  닫기
                </BrutalistButton>
              </div>
            </div>
          </div>
        )}

        {/* AI 피드백 팝업 */}
        {r11ShowFeedback && r11Feedback && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-black max-w-2xl w-full max-h-[85vh] overflow-y-auto brutal-border brutalist-shadow">
              <div className={`p-4 flex justify-between items-center ${
                r11Feedback.overallGrade === 'S' ? 'bg-purple-600' :
                r11Feedback.overallGrade === 'A' ? 'bg-green-600' :
                r11Feedback.overallGrade === 'B' ? 'bg-blue-600' :
                r11Feedback.overallGrade === 'C' ? 'bg-yellow-600' : 'bg-red-600'
              } text-white`}>
                <h3 className="text-xl font-black">📊 AI 응대 피드백</h3>
                <button onClick={handleR11CloseFeedback} className="text-2xl font-black hover:text-yellow-400">✕</button>
              </div>
              <div className="p-6 space-y-5">
                {/* 등급 및 점수 */}
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className={`text-6xl font-black ${
                    r11Feedback.overallGrade === 'S' ? 'text-purple-600' :
                    r11Feedback.overallGrade === 'A' ? 'text-green-600' :
                    r11Feedback.overallGrade === 'B' ? 'text-blue-600' :
                    r11Feedback.overallGrade === 'C' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {r11Feedback.overallGrade}
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-black">{r11SatisfactionScore}점</p>
                    <p className="text-gray-500 text-sm">고객 만족도</p>
                  </div>
                </div>

                {/* 종합 평가 */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p className="font-bold text-gray-800 mb-2">📝 종합 평가</p>
                  <p className="text-gray-700">{r11Feedback.summary}</p>
                </div>

                {/* 잘한 점 */}
                {r11Feedback.goodPoints && r11Feedback.goodPoints.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                    <p className="font-bold text-green-800 mb-2">✅ 잘한 점</p>
                    <ul className="space-y-1">
                      {r11Feedback.goodPoints.map((point, idx) => (
                        <li key={idx} className="text-green-700 text-sm">• {point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 개선점 */}
                {r11Feedback.improvementPoints && r11Feedback.improvementPoints.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                    <p className="font-bold text-orange-800 mb-2">💡 개선 포인트</p>
                    <ul className="space-y-1">
                      {r11Feedback.improvementPoints.map((point, idx) => (
                        <li key={idx} className="text-orange-700 text-sm">• {point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 실무 팁 */}
                {r11Feedback.practicalTips && (
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="font-bold text-blue-800 mb-2">🎯 실무 활용 팁</p>
                    <p className="text-blue-700 text-sm">{r11Feedback.practicalTips}</p>
                  </div>
                )}

                {/* 점수 코멘트 */}
                {r11Feedback.scoreComment && (
                  <div className="bg-gray-200 p-3 rounded text-center">
                    <p className="text-gray-700 text-sm italic">{r11Feedback.scoreComment}</p>
                  </div>
                )}

                <BrutalistButton variant="primary" fullWidth onClick={handleR11CloseFeedback}>
                  확인
                </BrutalistButton>
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
            ← 달력보기
          </button>
        </div>
      </div>
    );
  }

  // R12 릴레이 레이싱 (12월)
  if (isR12) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <header className="flex justify-between items-center border-b-4 border-white pb-4">
          <div>
            <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
            <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black gold-gradient">R12</span>
            <p className="text-xs font-bold uppercase tracking-widest">12월 미션</p>
          </div>
        </header>

        {remainingTime && (
          <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
            <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
            <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>{remainingTime}</p>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter text-center">ROUND 12: 12월 미션 - 본사 복귀 릴레이</h3>

          <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
            <p className="text-xl font-bold italic text-center">"{R12_STORY}"</p>
          </BrutalistCard>

          {r12Cleared ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
                <h2 className="text-4xl font-black mb-4">🏆 KIM IS BACK!</h2>
                <p className="text-xl mb-4">축하합니다! 본사에 도착했습니다!</p>
                {r12GameStats && (
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-gray-300">완주 인원</p>
                      <p className="text-2xl font-black">{r12GameStats.round}/6</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-gray-300">장애물 회피</p>
                      <p className="text-2xl font-black text-green-400">{r12GameStats.obstaclesAvoided}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-gray-300">에너지 획득</p>
                      <p className="text-2xl font-black text-yellow-400">{r12GameStats.fuelItemsCollected}</p>
                    </div>
                  </div>
                )}
                <p className="text-gray-300 mt-4">완료 시간: {r12CompletionTime}</p>
              </div>
              <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR12Clear}>미션 최종 완료</BrutalistButton>
            </div>
          ) : isR12Completed ? (
            <div className="space-y-6">
              <div className="bg-green-600/20 border-2 border-green-500 text-white p-6 brutal-border text-center">
                <p className="text-2xl font-black text-green-400">✓ 모든 미션을 완료했습니다!</p>
              </div>
              <BrutalistButton variant="gold" fullWidth onClick={() => setViewState('result')}>결과 보기</BrutalistButton>
            </div>
          ) : (
            <div className="space-y-4">
              <BrutalistCard className="space-y-5 text-center">
                <div className="text-6xl mb-4">🏎️</div>
                <h4 className="text-2xl font-black text-yellow-400 uppercase">THE LAST MILE</h4>
                <p className="text-gray-300">6명의 팀원이 릴레이로 본사까지 레이싱합니다!</p>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div className="bg-red-600/20 p-3 rounded border border-red-500">
                    <p className="font-bold text-red-400">🚫 피해야 할 것</p>
                    <p className="text-gray-400">비꼬기, 책임회피, 꼰대문화</p>
                  </div>
                  <div className="bg-green-600/20 p-3 rounded border border-green-500">
                    <p className="font-bold text-green-400">⚡ 획득할 것</p>
                    <p className="text-gray-400">팀워크, 시너지, 협업 파워</p>
                  </div>
                </div>
                <BrutalistButton variant="gold" fullWidth className="text-xl mt-6" onClick={startR12Game}>
                  🏁 레이싱 시작!
                </BrutalistButton>
              </BrutalistCard>
              <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 달력보기 돌아가기</BrutalistButton>
            </div>
          )}
        </div>

        {/* R12 릴레이 레이싱 게임 팝업 - 전체화면 (z-index 최상위) */}
        {r12GameStarted && (
          <div className="fixed inset-0 z-[100] bg-black">
            <RelayRacingGame
              teamMembers={team?.members || []}
              onComplete={handleR12GameComplete}
              onCancel={() => setR12GameStarted(false)}
            />
          </div>
        )}

        {/* 게임 중이 아닐 때만 대시보드 버튼 표시 */}
        {!r12GameStarted && (
          <div className="fixed bottom-4 right-4 z-40">
            <button onClick={() => setViewState('factory')} className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow">
              ← 달력보기
            </button>
          </div>
        )}
      </div>
    );
  }

  // 기본 미션 화면 (fallback)
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
      <header className="flex justify-between items-center border-b-4 border-white pb-4">
        <div>
          <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
          <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
        </div>
        <div className="text-right">
          <span className="text-5xl font-black gold-gradient">R{team?.currentRound}</span>
          <p className="text-xs font-bold uppercase tracking-widest">Mission</p>
        </div>
      </header>

      {/* 전체 미션 타이머 */}
      {remainingTime && (
        <div className={`text-center p-4 brutal-border ${remainingTime === "00:00" ? 'bg-red-600 animate-pulse' : 'bg-black/50'}`}>
          <p className="text-sm text-gray-400 uppercase">남은 미션 시간</p>
          <p className={`text-4xl font-mono font-black ${remainingTime === "00:00" ? 'text-white' : 'text-yellow-400'}`}>
            {remainingTime}
          </p>
          {team && team.totalBonusTime > 0 && (
            <p className="text-sm text-orange-400">헬프로 +{formatTime(team.totalBonusTime)} 추가됨</p>
          )}
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-4xl font-black uppercase tracking-tighter">
          {currentRoundInfo?.title}: {currentRoundInfo?.description}
        </h3>

        <BrutalistCard className="min-h-[300px] flex flex-col items-start justify-start border-dashed">
            <div className="w-full space-y-6">
              {customInstruction ? (
                <div className="w-full bg-white text-black p-6 brutal-border brutalist-shadow">
                   <h4 className="text-xs font-black uppercase mb-4 text-gray-500 border-b pb-2">HQ Special Instructions</h4>
                   <p className="text-xl font-bold whitespace-pre-wrap">{customInstruction}</p>
                </div>
              ) : (
                <div className="text-center py-12 w-full">
                  <p className="text-2xl font-bold opacity-50">본 라운드의 구체적인 미션은 강사님께서 제공해주시는 오프라인 교구와 대조하여 해결하십시오.</p>
                </div>
              )}

              <div className="p-8 brutal-border border-yellow-400 bg-yellow-400/10 text-center w-full">
                 <span className="text-xl font-mono text-yellow-400 uppercase tracking-widest">[ MISSION ACTIVE ]</span>
              </div>
            </div>
        </BrutalistCard>

        {/* 네비게이션 버튼들 */}
        <div className="flex gap-4">
          {/* 월 업무 마감하기 */}
          <BrutalistButton
            variant="ghost"
            onClick={() => setViewState('factory')}
            className="flex-shrink-0"
          >
            ← 공장
          </BrutalistButton>

          {/* 메인 액션 버튼 */}
          {canSkipForward ? (
            <BrutalistButton
              variant="primary"
              fullWidth
              className="text-xl"
              onClick={goToNextRoundFromFactory}
            >
              다음 라운드로 →
            </BrutalistButton>
          ) : (
            <BrutalistButton
              variant="gold"
              fullWidth
              className="text-xl"
              onClick={completeRound}
              disabled={team?.currentRound === 10 && team?.missionClearTime !== undefined}
            >
              {team?.currentRound === 10 ? '최종 미션 완료!' : '미션 완수 → 다음'}
            </BrutalistButton>
          )}
        </div>
      </div>

      {/* 공장으로 버튼 (우측 하단 고정) */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setViewState('factory')}
          className="brutal-border font-black py-3 px-6 transition-all bg-gray-700 text-white hover:bg-gray-600 brutalist-shadow active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          ← 달력보기
        </button>
      </div>
    </div>
  );
};

export default LearnerMode;
