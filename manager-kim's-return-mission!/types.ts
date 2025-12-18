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
  NONE = 'NONE'
}

export interface TeamMember {
  role: string;
  name: string;
}

export interface TeamState {
  id: number;
  name: string;
  members: TeamMember[];
  currentRound: number; // 1 to 10
  isJoined: boolean;
  // Per-team specific instructions for each round (R1-R10)
  roundInstructions: Record<number, string>;
}

export interface RoomState {
  groupName: string;
  totalTeams: number;
  membersPerTeam: number;
  missionStarted: boolean;
  activeEvent: EventType;
  eventEndTime?: number; // Timestamp in ms
  teams: Record<number, TeamState>;
}

export interface AuthState {
  role: UserRole;
  authenticated: boolean;
  teamId?: number;
  learnerName?: string;
}
