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
  {
    type: EventType.BREAK,
    label: '휴게시간',
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=800',
    instruction: ''
  },
  {
    type: EventType.LUNCH,
    label: '점심시간',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
    instruction: '지금은 점심시간!  조금만 늦어도 국물도 없다. 강사(전무)가 \'밥 먹자!\'를 크게 외치면, 이와 동시에 각 팀의 리더(김부장)는 앞쪽에 비치된 다과를 챙겨와서 팀원들을 먹여살려야 한다!'
  },
  {
    type: EventType.ALL_HANDS,
    label: '전사회의',
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=800',
    instruction: ''
  },
  {
    type: EventType.BIRTHDAY,
    label: '생일파티',
    image: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 이번 달 생일자 이벤트가 있는 날!  각 팀에서 오늘 기준으로 다가오는 생일이 가장 가까운 한 사람은 앞으로 나오세요!'
  },
  {
    type: EventType.DINNER,
    label: '회식타임',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 즐거운 회식 날! 팀원 모두는 잔(종이컵)을 들고 일어서서, 리더(김부장)의 선창에 따라 다 함께 건배사를 외쳐야 한다. 건배사는 10자 이상, 팀원 모두 참여!'
  },
  {
    type: EventType.SPORTS,
    label: '체육대회',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 단합을 위한 체육대회가 있는 날!  각 팀의 지지자는 앞으로 나와서 체육대회 진행자로 부터 체육행사 물품을 수령하세요'
  },
  {
    type: EventType.WORKSHOP,
    label: '워크숍',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 지나온 날을 돌아보고, 앞으로를 함께 다짐하는 워크숍이 있는 날.  역시 남는 건 사진 뿐!  단체사진 촬영을 위해 모두 앞으로 나오세요.'
  },
  {
    type: EventType.HEALTH_CHECK,
    label: '건강검진',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 건강검진이 있는 날.  시력검사를 받으러 다 함께 나오세요.'
  },
  {
    type: EventType.VOLUNTEER,
    label: '봉사활동',
    image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 ESG활동의 일환으로 지역 봉사활동이 있는 날!  모든 팀원이 함께 교육장 내 모든 책상 위에 있는 쓰레기를 모두 모아 분리수거를 완료하고, 전무님(강사)께 완료보고 하세요.'
  },
  {
    type: EventType.SPONSORSHIP,
    label: '협찬활동',
    image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&q=80&w=800',
    instruction: '오늘은 우리가 협찬한 지역 마라톤 대회가 열리는 날!  전 팀원이 함께 2열 종대로 줄을 맞추어 교육장을 크게 3바퀴 뛰고, 결승선(강사)으로 들어와 인증을 받으세요'
  },
];

export const ROUNDS = [
  { id: 1, title: 'ROUND 1', description: '1월: 신입사원 채용' },
  { id: 2, title: 'ROUND 2', description: '2월: 노트북 비밀번호' },
  { id: 3, title: 'ROUND 3', description: '3월: 공장 위치 찾기' },
  { id: 4, title: 'ROUND 4', description: '4월: 틀린 그림 찾기' },
  { id: 5, title: 'ROUND 5', description: '5월: 팀 단체사진' },
  { id: 6, title: 'ROUND 6', description: '6월: 출장지 추적' },
  { id: 7, title: 'ROUND 7', description: '7월: VOC 분석' },
  { id: 8, title: 'ROUND 8', description: '8월: 전무님의 문신' },
  { id: 9, title: 'ROUND 9', description: '9월: 심폐소생술' },
  { id: 10, title: 'ROUND 10', description: '10월: 현장 정상화(5S)' },
  { id: 11, title: 'ROUND 11', description: '11월: 공감대화' },
  { id: 12, title: 'ROUND 12', description: '12월: 최종 보고서' },
];
