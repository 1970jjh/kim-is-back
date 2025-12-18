import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { RoomState, TeamState } from '../types';
import { BrutalistButton, BrutalistCard } from './BrutalistUI';
import { ROUNDS } from '../constants';

interface Props {
  auth: { teamId: number; learnerName: string };
}

const LearnerMode: React.FC<Props> = ({ auth }) => {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [team, setTeam] = useState<TeamState | undefined>(undefined);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribe((updatedRoom) => {
      setRoom(updatedRoom);
      setTeam(updatedRoom.teams[auth.teamId]);
    });
    return () => unsubscribe();
  }, [auth.teamId]);

  const completeRound = async () => {
    if (!team || !room) return;
    const nextRound = team.currentRound + 1;
    const newRoom = { ...room };
    newRoom.teams[auth.teamId].currentRound = Math.min(10, nextRound);
    await firebaseService.saveRoom(newRoom);
  };

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!room.missionStarted) {
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

  if (showIntro) {
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
            src="https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=1200"
            alt="낡은 노트"
            className="w-full brutal-border brutalist-shadow grayscale"
          />
          <div className="bg-[#ffd700] text-black p-8 brutal-border brutalist-shadow text-center">
            <p className="text-4xl font-black italic">"희망을 잃지 말고, 최선을 다해라"</p>
          </div>
        </div>

        <BrutalistButton variant="gold" fullWidth className="text-2xl" onClick={() => setShowIntro(false)}>
          미션 현장으로 진입하기
        </BrutalistButton>
      </div>
    );
  }

  const currentRoundInfo = ROUNDS[team!.currentRound - 1];
  const customInstruction = team?.roundInstructions?.[team.currentRound];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
      <header className="flex justify-between items-center border-b-4 border-white pb-4">
        <div>
          <h2 className="text-3xl font-black italic">TEAM {auth.teamId}</h2>
          <p className="font-bold text-yellow-400">Welcome, {auth.learnerName}</p>
        </div>
        <div className="text-right">
          <span className="text-5xl font-black gold-gradient">R{team?.currentRound}</span>
          <p className="text-xs font-bold uppercase tracking-widest">Progress</p>
        </div>
      </header>

      <div className="space-y-6">
        <h3 className="text-4xl font-black uppercase tracking-tighter">
          {currentRoundInfo.title}: {currentRoundInfo.description}
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

        <BrutalistButton
          variant="gold"
          fullWidth
          className="text-2xl"
          onClick={completeRound}
          disabled={team?.currentRound === 10}
        >
          {team?.currentRound === 10 ? '최종 미션 완료!' : '다음 라운드 잠금 해제'}
        </BrutalistButton>

        {team?.currentRound === 10 && (
          <div className="bg-green-600 text-white p-8 brutal-border brutalist-shadow text-center animate-bounce">
            <h2 className="text-4xl font-black">MISSION CLEAR!</h2>
            <p className="text-xl">김부장님은 성공적으로 본사에 복귀하셨습니다!</p>
          </div>
        )}
      </div>

      <section className="mt-12">
         <h4 className="text-xl font-black mb-4">TEAM ROLES</h4>
         <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {team?.members.map((m, idx) => (
              <div key={idx} className="bg-white/10 p-2 brutal-border text-sm">
                 <span className="text-yellow-400 font-bold block">{m.role}</span>
                 <span className="font-black">{m.name}</span>
              </div>
            ))}
         </div>
      </section>
    </div>
  );
};

export default LearnerMode;
