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
}

export interface RoomState {
  id: string;  // 방 고유 ID
  groupName: string;
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
