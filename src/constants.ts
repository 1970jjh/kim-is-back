import { EventType } from './types';

export const ADMIN_PASSWORD = '6749467';

export const ROLES = [
  { id: 'leader', label: '리더 (김부장)' },
  { id: 'strategist', label: '전략가' },
  { id: 'timekeeper', label: '시간관리자' },
  { id: 'negotiator', label: '협상가' },
  { id: 'recorder', label: '기록자' },
  { id: 'supporter', label: '지지자' },
];

export const EVENTS = [
  { type: EventType.BREAK, label: '휴게시간', image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=800' },
  { type: EventType.LUNCH, label: '점심시간', image: 'https://images.unsplash.com/photo-1547573854-74d2a71d0827?auto=format&fit=crop&q=80&w=800' },
  { type: EventType.ALL_HANDS, label: '전사회의', image: 'https://images.unsplash.com/photo-1475721027185-39a12947c048?auto=format&fit=crop&q=80&w=800' },
  { type: EventType.BIRTHDAY, label: '생일파티', image: 'https://images.unsplash.com/photo-1464349172961-10492ec86537?auto=format&fit=crop&q=80&w=800' },
  { type: EventType.DINNER, label: '회식타임', image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800' },
  { type: EventType.SPORTS, label: '체육대회', image: 'https://images.unsplash.com/photo-1526676023601-d75a42bf18b4?auto=format&fit=crop&q=80&w=800' },
];

export const ROUNDS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: `ROUND ${i + 1}`,
  description: `과업 ${i + 1}: 본사 복귀를 위한 핵심 미션을 수행하십시오.`
}));
