import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { RoomState, TeamState, TeamPerformance } from '../types';
import { BrutalistButton, BrutalistCard } from './BrutalistUI';
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
const DIARY_IMAGE = 'https://i.imgur.com/p6AU8yF.png';

interface Props {
  room: RoomState;
  auth: { teamId: number; learnerName: string };
}

const LearnerMode: React.FC<Props> = ({ room, auth }) => {
  const [team, setTeam] = useState<TeamState | undefined>(room.teams?.[auth.teamId]);
  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [helpLoading, setHelpLoading] = useState(false);

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

  // 전체 미션 타이머
  useEffect(() => {
    if (!room.missionStarted || !room.missionStartTime) {
      setRemainingTime("");
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - room.missionStartTime!) / 1000);
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
  }, [room.missionStarted, room.missionStartTime, room.missionTimerMinutes, team?.totalBonusTime]);

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
        <h1 className="text-5xl font-black text-center border-b-8 border-yellow-400 pb-4">MISSION INTRO</h1>

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
                const time = myPerformanceWithRank.roundTimes[r.id];
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
    const currentRoundInfo = ROUNDS[(team?.currentRound || 1) - 1];
    const canSkipForward = team && team.currentRound <= team.maxCompletedRound;

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

          {/* 진행 상황 카드 */}
          <BrutalistCard className="bg-black/80 space-y-6">
            <h3 className="text-2xl font-black text-center text-yellow-400">
              {isMissionComplete ? '🎉 모든 미션 완료!' : `다음 미션: ${currentRoundInfo?.title}`}
            </h3>

            {/* 라운드 진행 바 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>진행 상황</span>
                <span>{team?.maxCompletedRound || 0}/10 완료</span>
              </div>
              <div className="h-4 bg-black brutal-border overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-700"
                  style={{ width: `${((team?.maxCompletedRound || 0) / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* 라운드 버튼들 */}
            <div className="grid grid-cols-5 gap-2">
              {ROUNDS.map(r => {
                const isCompleted = (team?.maxCompletedRound || 0) >= r.id;
                const isCurrent = team?.currentRound === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (isCompleted || isCurrent) {
                        firebaseService.setTeamRound(room.id, auth.teamId, r.id);
                      }
                    }}
                    disabled={!isCompleted && !isCurrent}
                    className={`p-3 brutal-border font-black text-lg transition-all ${
                      isCurrent
                        ? 'bg-yellow-400 text-black'
                        : isCompleted
                        ? 'bg-green-600 text-white hover:bg-green-500'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    R{r.id}
                  </button>
                );
              })}
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
  const currentRoundInfo = ROUNDS[(team?.currentRound || 1) - 1];
  const customInstruction = team?.roundInstructions?.[team?.currentRound || 1];
  const canSkipForward = team && team.currentRound <= team.maxCompletedRound;

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
