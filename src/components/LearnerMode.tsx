import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { RoomState, TeamState, TeamPerformance } from '../types';
import { BrutalistButton, BrutalistCard, BrutalistInput } from './BrutalistUI';
import { ROUNDS } from '../constants';

// 시간 포맷팅 유틸
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

const FACTORY_BG = 'https://i.imgur.com/G66myVZ.jpeg';
const DIARY_IMAGE = 'https://i.imgur.com/vvbLGIm.jpeg';

// R1 신입사원 채용 서류전형 미션 (1월)
const R1_PROFILES = [
  {
    id: 1,
    name: '지원자 A',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
  },
  {
    id: 2,
    name: '지원자 B',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
  },
  {
    id: 3,
    name: '지원자 C',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
  }
];
const R1_CORRECT_ANSWER = '주도형';

// R2 매너리즘 김부장 미션 (2월)
const R2_IMAGES = [
  {
    id: 1,
    title: '독수리 타법',
    image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&h=600&fit=crop',
  },
  {
    id: 2,
    title: '시계만 바라보며',
    image: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=800&h=600&fit=crop',
  }
];
const R2_CORRECT_ANSWER = '4035';

// R3 공장 위치 퀴즈 이미지 및 정답 (3월) - 기존 R1
const R3_QUIZ_IMAGE = 'https://i.imgur.com/nswRxmd.jpeg';
const R3_PADLET_LINK = 'https://padlet.com/ksajhjeon/padlet-idnyc8suzfsy502s';
const R3_CORRECT_ANSWERS = [
  '010-4454-2252',
  '010-2319-4323',
  '010-3228-3143',
  '010-9476-7825',
  '010-8448-2354'
];

// R4 틀린 그림 찾기 이미지 세트 (4월) - 기존 R2
const R4_IMAGE_SETS = [
  {
    name: '공장',
    original: 'https://i.imgur.com/suTemUX.png',
    modified: 'https://i.imgur.com/yvJheGC.png',
    differences: [
      { id: 1, x: 15, y: 25, width: 12, height: 12 },
      { id: 2, x: 55, y: 40, width: 12, height: 12 },
      { id: 3, x: 80, y: 70, width: 12, height: 12 },
    ]
  },
  {
    name: '강아지',
    original: 'https://i.imgur.com/o5HD18z.png',
    modified: 'https://i.imgur.com/95JRBSC.png',
    differences: [
      { id: 1, x: 20, y: 30, width: 12, height: 12 },
      { id: 2, x: 50, y: 55, width: 12, height: 12 },
      { id: 3, x: 75, y: 20, width: 12, height: 12 },
    ]
  },
  {
    name: '기중기',
    original: 'https://i.imgur.com/sV8YkaB.png',
    modified: 'https://i.imgur.com/lb9TykR.png',
    differences: [
      { id: 1, x: 25, y: 45, width: 12, height: 12 },
      { id: 2, x: 60, y: 25, width: 12, height: 12 },
      { id: 3, x: 45, y: 75, width: 12, height: 12 },
    ]
  }
];

const R4_STORY = "본사 복귀를 꿈꾼다면, 먼저 이 낯선 현장의 공기부터 완벽하게 파악해야 한다. 일상처럼 보이는 이 풍경 속에 숨겨진 진실을 찾아라!";

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
  const [helpLoading, setHelpLoading] = useState(false);

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

  // R4 틀린 그림 찾기 상태 (4월) - 기존 R2
  const [r4GameStarted, setR4GameStarted] = useState(false);
  const [r4TimeLeft, setR4TimeLeft] = useState(60);
  const [r4CurrentSet, setR4CurrentSet] = useState(0);
  const [r4FoundDifferences, setR4FoundDifferences] = useState<{[setIndex: number]: number[]}>({});
  const [r4Failed, setR4Failed] = useState(false);
  const [r4RetryCountdown, setR4RetryCountdown] = useState(0);
  const [r4Cleared, setR4Cleared] = useState(false);
  const [r4CompletionTime, setR4CompletionTime] = useState('');
  const [r4StartTime, setR4StartTime] = useState<number | null>(null);

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

  const handleUseHelp = async () => {
    if (!team || team.helpCount >= 3) return;

    if (!window.confirm(`HELP를 사용하시겠습니까?\n\n• 남은 횟수: ${3 - team.helpCount}회\n• 사용 시 미션 시간 +3분 추가됩니다.`)) {
      return;
    }

    setHelpLoading(true);
    const success = await firebaseService.useHelp(room.id, auth.teamId);
    setHelpLoading(false);

    if (success) {
      alert('HELP 사용 완료! 미션 시간이 3분 추가되었습니다.');
    } else {
      alert('HELP를 사용할 수 없습니다.');
    }
  };

  // R1 신입사원 채용 정답 체크 (1월)
  const handleR1Submit = () => {
    const normalizedAnswer = r1Answer.replace(/\s/g, '').trim();
    if (normalizedAnswer === R1_CORRECT_ANSWER || normalizedAnswer === '주도형') {
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

  // R4 게임 타이머 (4월 틀린그림찾기)
  useEffect(() => {
    if (!r4GameStarted || r4Failed || r4Cleared) return;

    if (r4TimeLeft <= 0) {
      setR4Failed(true);
      setR4RetryCountdown(10);
      return;
    }

    const timer = setInterval(() => {
      setR4TimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [r4GameStarted, r4TimeLeft, r4Failed, r4Cleared]);

  // R4 재도전 카운트다운
  useEffect(() => {
    if (!r4Failed || r4RetryCountdown <= 0) return;

    const timer = setInterval(() => {
      setR4RetryCountdown(prev => {
        if (prev <= 1) {
          // 리셋 및 재시작
          setR4Failed(false);
          setR4TimeLeft(60);
          setR4CurrentSet(0);
          setR4FoundDifferences({});
          setR4StartTime(Date.now());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [r4Failed, r4RetryCountdown]);

  // R4 게임 시작
  const startR4Game = () => {
    setR4GameStarted(true);
    setR4TimeLeft(60);
    setR4CurrentSet(0);
    setR4FoundDifferences({});
    setR4Failed(false);
    setR4Cleared(false);
    setR4CompletionTime('');
    setR4StartTime(Date.now());
  };

  // R4 틀린 부분 클릭 처리
  const handleR4DifferenceClick = (setIndex: number, diffId: number) => {
    if (r4Failed || r4Cleared) return;

    const currentFound = r4FoundDifferences[setIndex] || [];
    if (currentFound.includes(diffId)) return; // 이미 찾은 것

    const newFound = {
      ...r4FoundDifferences,
      [setIndex]: [...currentFound, diffId]
    };
    setR4FoundDifferences(newFound);

    // 현재 세트의 모든 차이점을 찾았는지 확인
    if (newFound[setIndex]?.length === 3) {
      // 모든 세트 완료 확인
      const allComplete = R4_IMAGE_SETS.every((_, idx) =>
        newFound[idx]?.length === 3
      );

      if (allComplete && r4StartTime) {
        // 게임 완료!
        const elapsed = Math.floor((Date.now() - r4StartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = `${mins}분 ${secs}초`;
        setR4CompletionTime(timeStr);
        setR4Cleared(true);
      } else if (r4CurrentSet < R4_IMAGE_SETS.length - 1) {
        // 다음 세트로 이동
        setR4CurrentSet(prev => prev + 1);
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

        <BrutalistCard className="aspect-video relative overflow-hidden bg-black flex items-center justify-center">
          <div className="text-center space-y-4">
             <div className="text-yellow-400 text-6xl">🎬</div>
             <p className="text-2xl font-bold">좌천된 김부장의 본사 복귀 스토리 영상</p>
             <p className="text-gray-500 italic">[선배들의 낡은 노트를 발견하다...]</p>
          </div>
        </BrutalistCard>

        <div className="space-y-4">
          <img
            src={DIARY_IMAGE}
            alt="낡은 다이어리"
            className="w-full brutal-border brutalist-shadow"
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
              <p className="text-4xl font-mono font-black">{formatTimeWithHours(myPerformanceWithRank.totalTimeWithBonus)}</p>
              <p className="text-sm text-gray-400">헬프 포함</p>
            </BrutalistCard>
            <BrutalistCard className="text-center">
              <p className="text-sm text-gray-400 uppercase">헬프 사용</p>
              <p className="text-4xl font-black text-orange-400">
                {myPerformanceWithRank.helpCount}회
              </p>
              <p className="text-sm text-orange-400">+{formatTime(myPerformanceWithRank.helpBonusTime)}</p>
            </BrutalistCard>
            <BrutalistCard className="text-center">
              <p className="text-sm text-gray-400 uppercase">순수 미션 시간</p>
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

        {/* HELP 버튼 */}
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={handleUseHelp}
            disabled={!team || team.helpCount >= 3 || helpLoading}
            className={`brutal-border font-black py-3 px-6 transition-all ${
              team && team.helpCount < 3
                ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow active:translate-x-1 active:translate-y-1 active:shadow-none'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
          </button>
          <p className="text-[10px] text-center text-white mt-1">사용 시 +3분</p>
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

  // 라운드별 완료 여부 체크
  const isR1Completed = (team?.maxCompletedRound || 0) >= 1;
  const isR2Completed = (team?.maxCompletedRound || 0) >= 2;
  const isR3Completed = (team?.maxCompletedRound || 0) >= 3;
  const isR4Completed = (team?.maxCompletedRound || 0) >= 4;

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
              공장으로 돌아가기
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

            <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
              <p className="text-xl font-bold text-center">
                "조직의 성장과 발전에 기여할 인재의 조건은?<br/>김부장은 과연 누구를 뽑을 것인가?"
              </p>
            </BrutalistCard>

            <div className="grid grid-cols-3 gap-4">
              {R1_PROFILES.map((profile) => (
                <div
                  key={profile.id}
                  className="cursor-pointer brutal-border overflow-hidden hover:scale-105 transition-transform bg-black"
                  onClick={() => setR1SelectedProfile(profile.id)}
                >
                  <img src={profile.image} alt={profile.name} className="w-full h-40 object-cover" />
                  <p className="text-center font-black py-2 bg-white text-black">{profile.name}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400">👆 이력서를 클릭하여 크게 보기</p>

            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
              <BrutalistInput
                fullWidth
                placeholder="인재의 조건을 입력하세요"
                value={r1Answer}
                onChange={(e) => { setR1Answer(e.target.value); setR1Error(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleR1Submit(); }}
              />
              {r1Error && <p className="text-red-500 font-bold text-sm">{r1Error}</p>}
              <BrutalistButton variant="gold" fullWidth className="text-xl" onClick={handleR1Submit}>
                정답 제출
              </BrutalistButton>
            </BrutalistCard>

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 공장으로 돌아가기</BrutalistButton>
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
          <button onClick={handleUseHelp} disabled={!team || team.helpCount >= 3 || helpLoading}
            className={`brutal-border font-black py-3 px-6 transition-all ${team && team.helpCount < 3 ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
            {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-1">사용 시 +3분</p>
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
              <p className="text-xl">축하합니다! 매너리즘 미션을 완료했습니다.</p>
            </div>
            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR2Clear}>
              공장으로 돌아가기
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
              ROUND 2: 2월 미션 - 매너리즘 김부장
            </h3>

            <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
              <p className="text-xl font-bold text-center">
                "학습민첩성이 없는 김부장은 AI시대인데도 불구하고<br/>
                독수리 타법으로 키보드를 치고,<br/>
                시계와 달력만 보면서 퇴근시간이 빨리 오기만을 기다리고 있다."
              </p>
            </BrutalistCard>

            <div className="grid grid-cols-2 gap-4">
              {R2_IMAGES.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer brutal-border overflow-hidden hover:scale-105 transition-transform bg-black"
                  onClick={() => setR2SelectedImage(item.id)}
                >
                  <img src={item.image} alt={item.title} className="w-full h-48 object-cover" />
                  <p className="text-center font-black py-2 bg-white text-black">{item.title}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400">👆 이미지를 클릭하여 크게 보기</p>

            <BrutalistCard className="bg-red-900/20 border-red-500">
              <p className="text-xl font-bold text-center text-red-400">
                "아직도 독수리 타법에..<br/>
                마냥 시계만 바라보며 허송세월을 보내는 김부장.."
              </p>
            </BrutalistCard>

            <BrutalistCard className="space-y-4">
              <label className="block text-lg font-black text-yellow-400 uppercase">정답 입력</label>
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

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 공장으로 돌아가기</BrutalistButton>
          </div>
        )}

        {r2SelectedImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setR2SelectedImage(null)}>
            <div className="max-w-3xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black">{R2_IMAGES.find(p => p.id === r2SelectedImage)?.title}</span>
                <button onClick={() => setR2SelectedImage(null)} className="bg-black text-white px-4 py-2 font-black hover:bg-gray-800 brutal-border">
                  닫기 ✕
                </button>
              </div>
              <img src={R2_IMAGES.find(p => p.id === r2SelectedImage)?.image} alt="이미지" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={handleUseHelp} disabled={!team || team.helpCount >= 3 || helpLoading}
            className={`brutal-border font-black py-3 px-6 transition-all ${team && team.helpCount < 3 ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
            {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-1">사용 시 +3분</p>
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
              공장으로 돌아가기
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

            <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
              <p className="text-xl font-bold text-center">
                "좌천된 김부장은 발령된 공장으로 떠나야 한다.<br/>
                공장의 위치를 찾아라!"
              </p>
            </BrutalistCard>

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

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 공장으로 돌아가기</BrutalistButton>
          </div>
        )}

        {showPadletPopup && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowPadletPopup(false)}>
            <div className="max-w-4xl w-full bg-white brutal-border brutalist-shadow" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 bg-yellow-400 border-b-4 border-black">
                <span className="font-black text-black">공장 위치 힌트</span>
                <button onClick={() => setShowPadletPopup(false)} className="bg-black text-white px-4 py-2 font-black hover:bg-gray-800 brutal-border">
                  닫기 ✕
                </button>
              </div>
              <img src={R3_QUIZ_IMAGE} alt="공장 위치 힌트" className="w-full" />
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={handleUseHelp} disabled={!team || team.helpCount >= 3 || helpLoading}
            className={`brutal-border font-black py-3 px-6 transition-all ${team && team.helpCount < 3 ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
            {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-1">사용 시 +3분</p>
        </div>
      </div>
    );
  }

  // R4 틀린 그림 찾기 화면 (4월) - 기존 R2
  if (isR4) {
    const currentSet = R4_IMAGE_SETS[r4CurrentSet];
    const foundInCurrentSet = r4FoundDifferences[r4CurrentSet] || [];

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

        {r4Cleared ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center">
              <h2 className="text-5xl font-black mb-4">4월 미션 CLEAR!</h2>
              <p className="text-xl">축하합니다! 틀린 그림 찾기를 완료했습니다.</p>
              <p className="text-2xl mt-4 font-mono">완료 시간: {r4CompletionTime}</p>
            </div>
            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={handleR4Clear}>
              공장으로 돌아가기
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
        ) : r4Failed ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-red-600 text-white p-8 brutal-border brutalist-shadow text-center">
              <h2 className="text-4xl font-black mb-4">시간 초과!</h2>
              <p className="text-xl">1분 안에 모든 차이점을 찾지 못했습니다.</p>
              <p className="text-6xl font-mono font-black mt-6">{r4RetryCountdown}초</p>
              <p className="text-lg mt-2">후 자동으로 재도전합니다...</p>
            </div>
          </div>
        ) : !r4GameStarted ? (
          <div className="space-y-6">
            <h3 className="text-3xl font-black uppercase tracking-tighter text-center">
              ROUND 4: 4월 미션 - 틀린 그림 찾기
            </h3>

            <BrutalistCard className="bg-yellow-400/10 border-yellow-400">
              <p className="text-xl font-bold italic text-center">"{R4_STORY}"</p>
            </BrutalistCard>

            <BrutalistCard className="space-y-4">
              <h4 className="text-xl font-black text-yellow-400">틀린 그림 찾기</h4>
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

            <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={startR4Game}>
              게임 시작!
            </BrutalistButton>

            <BrutalistButton variant="ghost" onClick={() => setViewState('factory')}>← 공장으로 돌아가기</BrutalistButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className={`px-4 py-2 brutal-border ${r4TimeLeft <= 10 ? 'bg-red-600 animate-pulse' : 'bg-black/70'}`}>
                <span className="text-sm text-gray-400">남은 시간</span>
                <p className={`text-3xl font-mono font-black ${r4TimeLeft <= 10 ? 'text-white' : 'text-yellow-400'}`}>
                  {formatTime(r4TimeLeft)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-400">찾은 차이점</span>
                <p className="text-3xl font-black text-yellow-400">{getR4TotalFoundDifferences()}/9</p>
              </div>
            </div>

            <div className="text-center">
              <span className="bg-yellow-400 text-black px-4 py-2 font-black inline-block brutal-border">
                {r4CurrentSet + 1}/3: {currentSet.name}
              </span>
            </div>

            <div className="flex gap-2">
              {R4_IMAGE_SETS.map((set, idx) => {
                const foundCount = (r4FoundDifferences[idx] || []).length;
                return (
                  <div
                    key={idx}
                    className={`flex-1 p-2 brutal-border text-center ${
                      idx === r4CurrentSet
                        ? 'bg-yellow-400 text-black'
                        : foundCount === 3
                        ? 'bg-green-600 text-white'
                        : 'bg-black/50'
                    }`}
                  >
                    <p className="text-xs font-bold">{set.name}</p>
                    <p className="font-black">{foundCount}/3</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <p className="text-xs text-center text-gray-400 mb-1">원본</p>
                <div className="relative brutal-border overflow-hidden bg-black">
                  <img src={currentSet.original} alt={`${currentSet.name} 원본`} className="w-full h-auto" />
                  {currentSet.differences.map(diff => (
                    foundInCurrentSet.includes(diff.id) && (
                      <div
                        key={diff.id}
                        className="absolute border-4 border-green-400 rounded-full animate-pulse"
                        style={{
                          left: `${diff.x}%`,
                          top: `${diff.y}%`,
                          width: `${diff.width}%`,
                          height: `${diff.height}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    )
                  ))}
                </div>
              </div>

              <div className="relative">
                <p className="text-xs text-center text-gray-400 mb-1">틀린 그림 👆</p>
                <div className="relative brutal-border overflow-hidden bg-black cursor-pointer">
                  <img src={currentSet.modified} alt={`${currentSet.name} 수정본`} className="w-full h-auto" />
                  {currentSet.differences.map(diff => (
                    <div
                      key={diff.id}
                      onClick={() => handleR4DifferenceClick(r4CurrentSet, diff.id)}
                      className={`absolute cursor-pointer transition-all ${
                        foundInCurrentSet.includes(diff.id)
                          ? 'border-4 border-green-400 rounded-full bg-green-400/30'
                          : 'hover:bg-yellow-400/20'
                      }`}
                      style={{
                        left: `${diff.x - diff.width/2}%`,
                        top: `${diff.y - diff.height/2}%`,
                        width: `${diff.width}%`,
                        height: `${diff.height}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-gray-400">오른쪽 그림에서 틀린 부분을 클릭하세요!</p>

            <div className="text-center">
              <span className="text-lg">
                현재 세트: <span className="font-black text-yellow-400">{foundInCurrentSet.length}/3</span> 찾음
              </span>
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <button onClick={handleUseHelp} disabled={!team || team.helpCount >= 3 || helpLoading}
            className={`brutal-border font-black py-3 px-6 transition-all ${team && team.helpCount < 3 ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
            {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-1">사용 시 +3분</p>
        </div>
      </div>
    );
  }

  // 기본 미션 화면 (R5-R12)
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
          {/* 공장으로 돌아가기 */}
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

      {/* HELP 버튼 (우측 하단 고정) */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={handleUseHelp}
          disabled={!team || team.helpCount >= 3 || helpLoading}
          className={`brutal-border font-black py-3 px-6 transition-all ${
            team && team.helpCount < 3
              ? 'bg-orange-500 text-white hover:bg-orange-400 brutalist-shadow active:translate-x-1 active:translate-y-1 active:shadow-none'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {helpLoading ? '...' : `HELP (${team ? 3 - team.helpCount : 0})`}
        </button>
        <p className="text-[10px] text-center text-gray-400 mt-1">사용 시 +3분</p>
      </div>
    </div>
  );
};

export default LearnerMode;
