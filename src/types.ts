export enum UserRole {
  ADMIN = 'ADMIN',
  LEARNER = 'LEARNER',
  UNSET = 'UNSET'
}

export enum EventType {
  BREAK = 'BREAK',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SPORTS = 'SPORTS',
  ALL_HANDS = 'ALL_HANDS',
  BIRTHDAY = 'BIRTHDAY',
  WORKSHOP = 'WORKSHOP',
  HEALTH_CHECK = 'HEALTH_CHECK',
  VOLUNTEER = 'VOLUNTEER',
  SPONSORSHIP = 'SPONSORSHIP',
  NONE = 'NONE'
}

export enum IndustryType {
  IT_SOLUTION = 1,        // IT/솔루션
  MANUFACTURING = 2,      // 제조/원자재
  RETAIL = 3,             // 유통/리테일
  CONSTRUCTION = 4,       // 건설/인프라
  FINANCE = 5,            // 금융/보험
  ADVERTISING = 6,        // 광고/마케팅
  CHEMICAL_ENERGY = 7,    // 화학/에너지
  MEDICAL = 8,            // 의료/제약
  LOGISTICS = 9,          // 물류/운송
  FNB = 10                // 식음료(F&B)
}

export const IndustryTypeLabels: Record<IndustryType, string> = {
  [IndustryType.IT_SOLUTION]: 'IT/솔루션',
  [IndustryType.MANUFACTURING]: '제조/원자재',
  [IndustryType.RETAIL]: '유통/리테일',
  [IndustryType.CONSTRUCTION]: '건설/인프라',
  [IndustryType.FINANCE]: '금융/보험',
  [IndustryType.ADVERTISING]: '광고/마케팅',
  [IndustryType.CHEMICAL_ENERGY]: '화학/에너지',
  [IndustryType.MEDICAL]: '의료/제약',
  [IndustryType.LOGISTICS]: '물류/운송',
  [IndustryType.FNB]: '식음료(F&B)'
};

export interface TeamMember {
  role: string;
  name: string;
}

// 라운드별 시간 기록
export interface RoundTime {
  startTime: number;  // timestamp
  endTime?: number;   // timestamp
}

// 헬프 사용 기록
export interface HelpUsage {
  round: number;
  usedAt: number;  // timestamp
}

// 팀활동 결과보고서
export interface TeamReport {
  oneLine: string;
  bestMission: string;
  regret: string;
  futureHelp: string;
  imageData?: string;
  submittedAt?: number;
}

// R11 고객 응대 피드백
export interface R11Feedback {
  finalScore: number;
  overallGrade: string;
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
  practicalTips: string;
  scoreComment: string;
  conversationHistory: Array<{ role: string; content: string }>;
  completionTime: string;
  submittedAt?: number;
}

// R5 단체사진 정보
export interface GroupPhoto {
  teamId: number;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: number;
}

export interface TeamState {
  id: number;
  name: string;
  members: TeamMember[];
  currentRound: number; // 1 to 10
  maxCompletedRound: number; // 완수한 최대 라운드 (뒤로 가기 지원용)
  isJoined: boolean;
  // Per-team specific instructions for each round (R1-R10)
  roundInstructions: Record<number, string>;
  // 성과 분석용 데이터
  helpCount: number;  // 헬프 사용 횟수 (최대 3)
  helpUsages: HelpUsage[];  // 헬프 사용 기록
  roundTimes: Record<number, RoundTime>;  // 라운드별 시간 기록
  missionClearTime?: number;  // 미션 완료 시간
  totalBonusTime: number;  // 헬프로 추가된 시간 (초)
  teamReport?: TeamReport;  // R12 팀활동 결과보고서
  r11Feedback?: R11Feedback;  // R11 고객 응대 피드백
  groupPhoto?: GroupPhoto;  // R5 단체사진
}

export interface RoomState {
  id: string;  // 방 고유 ID
  groupName: string;
  industryType: IndustryType;  // 산업군 타입
  totalTeams: number;
  membersPerTeam: number;
  missionStarted: boolean;
  missionStartTime?: number;  // 미션 시작 시간
  missionTimerMinutes: number;  // 전체 미션 제한 시간 (분)
  activeEvent: EventType;
  eventEndTime?: number; // Timestamp in ms
  eventTargetTeams?: number[] | 'all';  // 이벤트 대상 팀 (특정 팀 또는 전체)
  eventStartedAt?: number;  // 현재 이벤트 시작 시간 (타이머 일시정지용)
  eventPausedTotal?: number;  // 이벤트로 인해 일시정지된 총 시간 (초)
  teams: Record<number, TeamState>;
  createdAt: number;  // 방 생성 시간
}

// 전체 앱 상태 (여러 방 관리)
export interface AppState {
  rooms: Record<string, RoomState>;
  currentRoomId?: string;
}

export interface AuthState {
  role: UserRole;
  authenticated: boolean;
  teamId?: number;
  learnerName?: string;
  roomId?: string;  // 현재 접속한 방 ID
}

// 팀 성과 분석 결과
export interface TeamPerformance {
  teamId: number;
  totalTime: number;  // 총 소요시간 (초)
  totalTimeWithBonus: number;  // 헬프 포함 시간 (초)
  helpCount: number;
  helpBonusTime: number;  // 헬프로 추가된 시간 (초)
  roundTimes: Record<number, number>;  // 라운드별 소요시간 (초)
  rank?: number;  // 전체 순위
  missionClearTime?: number;
}
