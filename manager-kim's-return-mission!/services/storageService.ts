
import { RoomState, EventType } from '../types';

const STORAGE_KEY = 'KIM_BUJANG_ROOM_STATE';

const DEFAULT_STATE: RoomState = {
  groupName: '',
  totalTeams: 1,
  membersPerTeam: 6,
  missionStarted: false,
  activeEvent: EventType.NONE,
  teams: {}
};

export const storageService = {
  saveRoom: (state: RoomState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('roomStateChanged'));
  },
  
  getRoom: (): RoomState => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATE;
  },

  resetRoom: () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('roomStateChanged'));
  }
};
