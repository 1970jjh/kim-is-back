import { ref, set, onValue, get, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../lib/firebase';
import { RoomState, EventType, AppState, TeamState, TeamPerformance, IndustryType, GroupPhoto } from '../types';

const ROOMS_REF = 'rooms';

const createDefaultTeamState = (id: number): TeamState => ({
  id,
  name: `Team ${id}`,
  members: [],
  currentRound: 1,
  maxCompletedRound: 0,
  isJoined: false,
  roundInstructions: {},
  helpCount: 0,
  helpUsages: [],
  roundTimes: {},
  totalBonusTime: 0
});

const createDefaultRoomState = (id: string, groupName: string, totalTeams: number, membersPerTeam: number, industryType: IndustryType = IndustryType.IT_SOLUTION): RoomState => ({
  id,
  groupName,
  industryType,
  totalTeams,
  membersPerTeam,
  missionStarted: false,
  missionTimerMinutes: 60,  // 기본 60분
  activeEvent: EventType.NONE,
  teams: {},
  createdAt: Date.now()
});

// 콜백 저장용
type RoomsCallback = (rooms: Record<string, RoomState>) => void;
const callbacks: Set<RoomsCallback> = new Set();

// 실시간 리스너 설정
let listenerSetup = false;

const setupRealtimeListener = () => {
  if (listenerSetup) return;

  const roomsRef = ref(database, ROOMS_REF);
  onValue(roomsRef, (snapshot) => {
    const data = snapshot.val();
    const rooms: Record<string, RoomState> = data || {};

    // 모든 등록된 콜백에 알림
    callbacks.forEach(callback => callback(rooms));
  });

  listenerSetup = true;
};

// 고유 ID 생성
const generateRoomId = (): string => {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const firebaseService = {
  // 새 방 생성
  createRoom: async (groupName: string, totalTeams: number, membersPerTeam: number, industryType: IndustryType = IndustryType.IT_SOLUTION): Promise<string> => {
    const roomId = generateRoomId();
    const newRoom = createDefaultRoomState(roomId, groupName, totalTeams, membersPerTeam, industryType);
    const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
    await set(roomRef, newRoom);
    return roomId;
  },

  // 방 삭제
  deleteRoom: async (roomId: string): Promise<void> => {
    const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
    await remove(roomRef);
  },

  // 특정 방 정보 저장
  saveRoom: async (room: RoomState): Promise<void> => {
    const roomRef = ref(database, `${ROOMS_REF}/${room.id}`);
    await set(roomRef, room);
  },

  // 특정 방 정보 조회
  getRoom: async (roomId: string): Promise<RoomState | null> => {
    const roomRef = ref(database, `${ROOMS_REF}/${roomId}`);
    const snapshot = await get(roomRef);
    return snapshot.val();
  },

  // 모든 방 목록 조회
  getAllRooms: async (): Promise<Record<string, RoomState>> => {
    const roomsRef = ref(database, ROOMS_REF);
    const snapshot = await get(roomsRef);
    return snapshot.val() || {};
  },

  // 실시간 구독 등록
  subscribe: (callback: RoomsCallback): (() => void) => {
    callbacks.add(callback);
    setupRealtimeListener();

    // 즉시 현재 상태 전달
    firebaseService.getAllRooms().then(callback);

    // 구독 해제 함수 반환
    return () => {
      callbacks.delete(callback);
    };
  },

  // 미션 시작
  startMission: async (roomId: string): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room) return;

    const now = Date.now();
    room.missionStarted = true;
    room.missionStartTime = now;

    // 모든 참가한 팀의 1라운드 시작 시간 기록
    Object.keys(room.teams).forEach(teamIdStr => {
      const teamId = parseInt(teamIdStr);
      if (room.teams[teamId]?.isJoined) {
        room.teams[teamId].roundTimes = {
          1: { startTime: now }
        };
      }
    });

    await firebaseService.saveRoom(room);
  },

  // 미션 타이머 설정
  setMissionTimer: async (roomId: string, minutes: number): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room) return;

    room.missionTimerMinutes = minutes;
    await firebaseService.saveRoom(room);
  },

  // 팀 라운드 진행 (다음 라운드로)
  advanceTeamRound: async (roomId: string, teamId: number): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room || !room.teams[teamId]) return;

    const team = room.teams[teamId];
    const now = Date.now();

    // 현재 라운드 종료 시간 기록
    if (team.roundTimes[team.currentRound]) {
      team.roundTimes[team.currentRound].endTime = now;
    }

    const nextRound = team.currentRound + 1;

    if (nextRound > 12) {
      // 미션 완료
      team.missionClearTime = now;
      team.maxCompletedRound = 12;
    } else {
      // 다음 라운드로 진행
      team.currentRound = nextRound;
      team.maxCompletedRound = Math.max(team.maxCompletedRound, team.currentRound - 1);

      // 다음 라운드 시작 시간 기록
      team.roundTimes[nextRound] = { startTime: now };
    }

    await firebaseService.saveRoom(room);
  },

  // 팀 라운드 이동 (뒤로가기/앞으로가기)
  setTeamRound: async (roomId: string, teamId: number, round: number): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room || !room.teams[teamId]) return;

    const team = room.teams[teamId];
    const now = Date.now();

    // 현재 라운드 종료 시간 기록 (아직 없으면)
    if (team.roundTimes[team.currentRound] && !team.roundTimes[team.currentRound].endTime) {
      team.roundTimes[team.currentRound].endTime = now;
    }

    // 라운드 이동
    team.currentRound = Math.max(1, Math.min(12, round));

    // 새 라운드 시작 시간이 없으면 추가
    if (!team.roundTimes[team.currentRound]) {
      team.roundTimes[team.currentRound] = { startTime: now };
    }

    await firebaseService.saveRoom(room);
  },

  // 헬프 사용
  useHelp: async (roomId: string, teamId: number): Promise<boolean> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room || !room.teams[teamId]) return false;

    const team = room.teams[teamId];

    // 이미 3번 사용했으면 불가
    if (team.helpCount >= 3) return false;

    const now = Date.now();
    team.helpCount += 1;
    team.helpUsages = team.helpUsages || [];
    team.helpUsages.push({
      round: team.currentRound,
      usedAt: now
    });
    team.totalBonusTime += 180;  // +3분 (180초)

    await firebaseService.saveRoom(room);
    return true;
  },

  // 이벤트 토글
  toggleEvent: async (roomId: string, type: EventType, minutes?: number, targetTeams?: number[] | 'all'): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room) return;

    const now = Date.now();

    if (room.activeEvent === type) {
      // 같은 이벤트를 다시 누르면 비활성화 (시간 유무에 상관없이)
      // 이벤트 일시정지 시간 계산 및 누적
      if (room.eventStartedAt) {
        const pausedSeconds = Math.floor((now - room.eventStartedAt) / 1000);
        room.eventPausedTotal = (room.eventPausedTotal || 0) + pausedSeconds;
      }
      room.activeEvent = EventType.NONE;
      room.eventEndTime = null as any;
      room.eventTargetTeams = null as any;
      room.eventStartedAt = null as any;
    } else {
      // 다른 이벤트 클릭: 새 이벤트로 교체 (기존 이벤트 자동 종료)
      // 기존 이벤트가 있었다면 그 시간도 누적
      if (room.activeEvent !== EventType.NONE && room.eventStartedAt) {
        const pausedSeconds = Math.floor((now - room.eventStartedAt) / 1000);
        room.eventPausedTotal = (room.eventPausedTotal || 0) + pausedSeconds;
      }
      room.activeEvent = type;
      // 타이머 설정이 있으면 모든 이벤트에 적용 (minutes > 0일 때만)
      room.eventEndTime = minutes && minutes > 0 ? now + minutes * 60000 : null as any;
      room.eventTargetTeams = targetTeams || 'all';
      room.eventStartedAt = now;  // 이벤트 시작 시간 기록

      // 이벤트 이력 저장
      if (!room.eventHistory) {
        room.eventHistory = {};
      }
      room.eventHistory[type] = {
        targetTeams: targetTeams || 'all',
        executedAt: now
      };
    }

    await firebaseService.saveRoom(room);
  },

  // 모든 이벤트 강제 종료 (즉시)
  forceEndAllEvents: async (roomId: string): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room) return;

    const now = Date.now();

    // 현재 이벤트가 있으면 일시정지 시간 누적
    if (room.activeEvent !== EventType.NONE && room.eventStartedAt) {
      const pausedSeconds = Math.floor((now - room.eventStartedAt) / 1000);
      room.eventPausedTotal = (room.eventPausedTotal || 0) + pausedSeconds;
    }

    // 모든 이벤트 관련 필드 강제 초기화
    room.activeEvent = EventType.NONE;
    room.eventEndTime = null as any;
    room.eventTargetTeams = null as any;
    room.eventStartedAt = null as any;

    await firebaseService.saveRoom(room);
  },

  // 팀 성과 분석 계산
  calculateTeamPerformance: (room: RoomState, teamId: number): TeamPerformance | null => {
    const team = room.teams[teamId];
    if (!team || !team.missionClearTime || !room.missionStartTime) return null;

    const totalTime = Math.floor((team.missionClearTime - room.missionStartTime) / 1000);
    const totalTimeWithBonus = totalTime + team.totalBonusTime;

    // 라운드별 소요시간 계산
    const roundTimes: Record<number, number> = {};
    for (let r = 1; r <= 12; r++) {
      const rt = team.roundTimes[r];
      if (rt && rt.startTime && rt.endTime) {
        roundTimes[r] = Math.floor((rt.endTime - rt.startTime) / 1000);
      }
    }

    return {
      teamId,
      totalTime,
      totalTimeWithBonus,
      helpCount: team.helpCount,
      helpBonusTime: team.totalBonusTime,
      roundTimes,
      missionClearTime: team.missionClearTime
    };
  },

  // 전체 팀 성과 분석 (순위 포함)
  calculateAllTeamPerformances: (room: RoomState): TeamPerformance[] => {
    const performances: TeamPerformance[] = [];

    if (!room.teams) return performances;

    Object.keys(room.teams).forEach(teamIdStr => {
      const teamId = parseInt(teamIdStr);
      const perf = firebaseService.calculateTeamPerformance(room, teamId);
      if (perf) {
        performances.push(perf);
      }
    });

    // 순위 정렬 (시간이 짧을수록 높은 순위)
    performances.sort((a, b) => a.totalTimeWithBonus - b.totalTimeWithBonus);
    performances.forEach((perf, index) => {
      perf.rank = index + 1;
    });

    return performances;
  },

  // 팀 참가 처리
  joinTeam: async (roomId: string, teamId: number, teamData: Partial<TeamState>): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room) return;

    // teams가 없으면 초기화
    if (!room.teams) {
      room.teams = {};
    }

    const existingTeam = room.teams[teamId];
    const now = Date.now();

    room.teams[teamId] = {
      ...createDefaultTeamState(teamId),
      ...existingTeam,
      ...teamData,
      isJoined: true,
      roundTimes: existingTeam?.roundTimes || (room.missionStarted ? { 1: { startTime: now } } : {})
    };

    await firebaseService.saveRoom(room);
  },

  // R12: 팀활동 결과보고서 저장
  saveTeamReport: async (
    roomId: string,
    teamId: number,
    report: { oneLine: string; bestMission: string; regret: string; futureHelp: string },
    imageData?: string
  ): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room || !room.teams[teamId]) return;

    const team = room.teams[teamId];
    team.teamReport = {
      ...report,
      imageData,
      submittedAt: Date.now()
    };

    await firebaseService.saveRoom(room);
  },

  // R11: 고객 응대 피드백 저장
  saveCustomerServiceFeedback: async (
    roomId: string,
    teamId: number,
    feedback: {
      finalScore: number;
      overallGrade: string;
      summary: string;
      goodPoints: string[];
      improvementPoints: string[];
      practicalTips: string;
      scoreComment: string;
      conversationHistory: Array<{ role: string; content: string }>;
      completionTime: string;
    }
  ): Promise<void> => {
    const room = await firebaseService.getRoom(roomId);
    if (!room || !room.teams[teamId]) return;

    const team = room.teams[teamId];
    team.r11Feedback = {
      ...feedback,
      submittedAt: Date.now()
    };

    await firebaseService.saveRoom(room);
  },

  // R5: 단체사진 Firebase Storage 업로드
  uploadGroupPhoto: async (
    roomId: string,
    teamId: number,
    groupName: string,
    file: File
  ): Promise<GroupPhoto | null> => {
    try {
      const room = await firebaseService.getRoom(roomId);
      if (!room || !room.teams[teamId]) return null;

      // 파일명 생성: "과정명+(#조)+연월일시" 형식
      const now = new Date();
      const dateTimeStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

      // 파일 확장자 추출
      const fileExtension = file.name.split('.').pop() || 'jpg';

      // 파일명: 과정명_#조_연월일시.확장자
      const fileName = `${groupName}_#${teamId}조_${dateTimeStr}.${fileExtension}`;

      // Storage 경로: group-photos/방ID/파일명
      const storagePath = `group-photos/${roomId}/${fileName}`;
      const fileRef = storageRef(storage, storagePath);

      // 파일 업로드
      await uploadBytes(fileRef, file);

      // 다운로드 URL 가져오기
      const downloadUrl = await getDownloadURL(fileRef);

      // GroupPhoto 객체 생성
      const groupPhoto: GroupPhoto = {
        teamId,
        fileName,
        storagePath,
        downloadUrl,
        uploadedAt: Date.now()
      };

      // 팀 상태에 사진 정보 저장
      room.teams[teamId].groupPhoto = groupPhoto;
      await firebaseService.saveRoom(room);

      return groupPhoto;
    } catch (error) {
      console.error('Group photo upload failed:', error);
      return null;
    }
  },

  // 모든 팀의 단체사진 목록 가져오기
  getAllGroupPhotos: (room: RoomState): GroupPhoto[] => {
    const photos: GroupPhoto[] = [];
    if (!room.teams) return photos;

    Object.values(room.teams).forEach((team) => {
      if (team.groupPhoto) {
        photos.push(team.groupPhoto);
      }
    });

    // 업로드 시간순 정렬
    photos.sort((a, b) => a.uploadedAt - b.uploadedAt);
    return photos;
  }
};
