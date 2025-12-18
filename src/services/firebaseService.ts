import { ref, set, onValue, off, get } from 'firebase/database';
import { database } from '../lib/firebase';
import { RoomState, EventType } from '../types';

const ROOM_REF = 'room';

const DEFAULT_STATE: RoomState = {
  groupName: '',
  totalTeams: 1,
  membersPerTeam: 6,
  missionStarted: false,
  activeEvent: EventType.NONE,
  teams: {}
};

// 콜백 저장용
type RoomCallback = (room: RoomState) => void;
const callbacks: Set<RoomCallback> = new Set();

// 실시간 리스너 설정
let unsubscribed = true;

const setupRealtimeListener = () => {
  if (!unsubscribed) return;

  const roomRef = ref(database, ROOM_REF);
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    const roomState = data ? { ...DEFAULT_STATE, ...data } : DEFAULT_STATE;

    // 모든 등록된 콜백에 알림
    callbacks.forEach(callback => callback(roomState));
  });

  unsubscribed = false;
};

export const firebaseService = {
  // 방 정보 저장
  saveRoom: async (state: RoomState): Promise<void> => {
    const roomRef = ref(database, ROOM_REF);
    await set(roomRef, state);
  },

  // 방 정보 1회 조회
  getRoom: async (): Promise<RoomState> => {
    const roomRef = ref(database, ROOM_REF);
    const snapshot = await get(roomRef);
    const data = snapshot.val();
    return data ? { ...DEFAULT_STATE, ...data } : DEFAULT_STATE;
  },

  // 방 초기화
  resetRoom: async (): Promise<void> => {
    const roomRef = ref(database, ROOM_REF);
    await set(roomRef, DEFAULT_STATE);
  },

  // 실시간 구독 등록
  subscribe: (callback: RoomCallback): (() => void) => {
    callbacks.add(callback);
    setupRealtimeListener();

    // 즉시 현재 상태 전달
    firebaseService.getRoom().then(callback);

    // 구독 해제 함수 반환
    return () => {
      callbacks.delete(callback);
    };
  },

  // 팀 라운드 업데이트
  updateTeamRound: async (teamId: number, round: number): Promise<void> => {
    const currentRoom = await firebaseService.getRoom();
    if (currentRoom.teams[teamId]) {
      currentRoom.teams[teamId].currentRound = Math.min(10, Math.max(1, round));
      await firebaseService.saveRoom(currentRoom);
    }
  },

  // 이벤트 토글
  toggleEvent: async (type: EventType, minutes?: number): Promise<void> => {
    const currentRoom = await firebaseService.getRoom();
    if (currentRoom.activeEvent === type) {
      await firebaseService.saveRoom({
        ...currentRoom,
        activeEvent: EventType.NONE,
        eventEndTime: undefined
      });
    } else {
      const needsTimer = type === EventType.BREAK || type === EventType.LUNCH;
      const endTime = needsTimer && minutes ? Date.now() + minutes * 60000 : undefined;
      await firebaseService.saveRoom({
        ...currentRoom,
        activeEvent: type,
        eventEndTime: endTime
      });
    }
  }
};
