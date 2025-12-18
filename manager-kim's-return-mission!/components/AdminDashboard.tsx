import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { RoomState, EventType, TeamState } from '../types';
import { BrutalistButton, BrutalistCard, BrutalistInput } from './BrutalistUI';
import { EVENTS, ROUNDS } from '../constants';

const AdminDashboard: React.FC = () => {
  const [room, setRoom] = useState<RoomState>(storageService.getRoom());
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [editRound, setEditRound] = useState<number>(1);
  const [instructionText, setInstructionText] = useState("");
  const [eventMinutes, setEventMinutes] = useState<number>(10);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleUpdate = () => setRoom(storageService.getRoom());
    window.addEventListener('roomStateChanged', handleUpdate);
    return () => window.removeEventListener('roomStateChanged', handleUpdate);
  }, []);

  useEffect(() => {
    // If birthday event is deactivated, stop the music
    if (room.activeEvent !== EventType.BIRTHDAY && isMusicPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsMusicPlaying(false);
    }
  }, [room.activeEvent]);

  const handleStartMission = () => {
    storageService.saveRoom({ ...room, missionStarted: true });
  };

  const toggleEvent = (type: EventType) => {
    if (room.activeEvent === type) {
      storageService.saveRoom({ ...room, activeEvent: EventType.NONE, eventEndTime: undefined });
    } else {
      const needsTimer = type === EventType.BREAK || type === EventType.LUNCH;
      const endTime = needsTimer ? Date.now() + eventMinutes * 60000 : undefined;
      storageService.saveRoom({ ...room, activeEvent: type, eventEndTime: endTime });
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isMusicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  const updateRound = (teamId: number, round: number) => {
    const newRoom = { ...room };
    if (newRoom.teams[teamId]) {
      newRoom.teams[teamId].currentRound = Math.min(10, Math.max(1, round));
      storageService.saveRoom(newRoom);
    }
  };

  const saveInstruction = () => {
    if (selectedTeamId === null) return;
    const newRoom = { ...room };
    if (!newRoom.teams[selectedTeamId]) {
      newRoom.teams[selectedTeamId] = {
        id: selectedTeamId,
        name: `Team ${selectedTeamId}`,
        members: [],
        currentRound: 1,
        isJoined: false,
        roundInstructions: {}
      };
    }
    if (!newRoom.teams[selectedTeamId].roundInstructions) {
      newRoom.teams[selectedTeamId].roundInstructions = {};
    }
    newRoom.teams[selectedTeamId].roundInstructions[editRound] = instructionText;
    storageService.saveRoom(newRoom);
    alert(`팀 ${selectedTeamId} R${editRound} 미션 내용이 저장되었습니다.`);
  };

  const selectTeamForEdit = (id: number) => {
    setSelectedTeamId(id);
    setInstructionText(room.teams[id]?.roundInstructions?.[editRound] || "");
  };

  useEffect(() => {
    if (selectedTeamId !== null) {
      setInstructionText(room.teams[selectedTeamId]?.roundInstructions?.[editRound] || "");
    }
  }, [editRound, selectedTeamId, room.teams]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-end gap-4 border-b-8 border-black pb-4 mb-8">
        <div>
          <h1 className="text-4xl md:text-6xl gold-gradient uppercase">ADMIN CONTROL</h1>
          <p className="text-xl font-bold text-gray-400">그룹: {room.groupName || '미설정'}</p>
        </div>
        <BrutalistButton variant="gold" onClick={handleStartMission} disabled={room.missionStarted}>
          {room.missionStarted ? '미션 진행 중' : '미션 스타트'}
        </BrutalistButton>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Column 1: Event Controls */}
        <section className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-black italic">EVENT CONTROL</h2>
            
            {/* Music Player for Birthday */}
            <audio 
              ref={audioRef} 
              src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
              loop
            />
            
            {room.activeEvent === EventType.BIRTHDAY && (
              <BrutalistCard className="bg-pink-600 text-white animate-pulse">
                <h3 className="font-black text-center mb-2 uppercase tracking-tighter">🎵 BIRTHDAY BGM</h3>
                <BrutalistButton 
                  variant="primary" 
                  fullWidth 
                  onClick={toggleMusic}
                  className="text-xs"
                >
                  {isMusicPlaying ? 'STOP MUSIC' : 'PLAY SONG'}
                </BrutalistButton>
              </BrutalistCard>
            )}

            <div className="bg-black/20 p-4 border-2 border-white/10 space-y-4">
              <label className="block text-xs font-bold uppercase">타이머 설정 (분)</label>
              <BrutalistInput 
                type="number" 
                value={eventMinutes} 
                onChange={(e) => setEventMinutes(parseInt(e.target.value) || 0)} 
                className="w-full text-center"
              />
              <p className="text-[10px] text-gray-500 uppercase">휴게/점심시간 활성화 시 적용됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {EVENTS.map((evt) => (
                <BrutalistButton 
                  key={evt.type}
                  variant={room.activeEvent === evt.type ? 'gold' : 'primary'}
                  onClick={() => toggleEvent(evt.type)}
                  className="text-sm py-2"
                >
                  {evt.label}
                </BrutalistButton>
              ))}
            </div>
          </div>
        </section>

        {/* Column 2: Mission Content Manager */}
        <section className="lg:col-span-1 space-y-4">
          <h2 className="text-2xl font-black italic">MISSION CONTENT</h2>
          <BrutalistCard className="space-y-4">
             <div>
                <label className="text-xs font-bold uppercase">대상 팀 선택</label>
                <select 
                  className="w-full brutal-border bg-white text-black p-2 font-bold text-sm mt-1"
                  value={selectedTeamId || ""}
                  onChange={(e) => selectTeamForEdit(parseInt(e.target.value))}
                >
                  <option value="" disabled>팀 선택</option>
                  {Array.from({ length: room.totalTeams }).map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}조</option>
                  ))}
                </select>
             </div>
             <div>
                <label className="text-xs font-bold uppercase">라운드 선택</label>
                <select 
                  className="w-full brutal-border bg-white text-black p-2 font-bold text-sm mt-1"
                  value={editRound}
                  onChange={(e) => setEditRound(parseInt(e.target.value))}
                >
                  {ROUNDS.map(r => (
                    <option key={r.id} value={r.id}>R{r.id}</option>
                  ))}
                </select>
             </div>
             <div>
                <label className="text-xs font-bold uppercase">미션 상세 지침</label>
                <textarea 
                  className="w-full brutal-border bg-white text-black p-2 font-bold text-sm mt-1 min-h-[100px]"
                  placeholder="팀별 맞춤 미션 지시사항을 입력하세요..."
                  value={instructionText}
                  onChange={(e) => setInstructionText(e.target.value)}
                />
             </div>
             <BrutalistButton variant="gold" fullWidth className="text-xs" onClick={saveInstruction} disabled={!selectedTeamId}>
                지침 저장하기
             </BrutalistButton>
          </BrutalistCard>
        </section>

        {/* Column 3&4: Real-time Team Monitoring */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-black italic">PROGRESS MONITORING</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[700px] pr-2 scrollbar-thin">
            {Array.from({ length: room.totalTeams }).map((_, idx) => {
              const teamId = idx + 1;
              const team = room.teams[teamId];
              return (
                <BrutalistCard key={teamId} className={`${team?.isJoined ? 'border-yellow-400' : 'opacity-40'} relative group`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-2xl font-black">T{teamId}</span>
                    <div className="flex gap-1">
                      {team?.isJoined && (
                        <div className="px-2 py-0.5 text-[10px] bg-green-500 font-bold">ONLINE</div>
                      )}
                    </div>
                  </div>
                  
                  {team ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-black brutal-border overflow-hidden">
                          <div 
                            className="h-full bg-yellow-400 transition-all duration-700 ease-out" 
                            style={{ width: `${(team.currentRound / 10) * 100}%` }}
                          />
                        </div>
                        <span className="font-black text-sm">R{team.currentRound}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-1">
                           <button 
                            className="w-8 h-8 brutal-border bg-white text-black font-black text-xs hover:bg-gray-200" 
                            onClick={() => updateRound(teamId, team.currentRound - 1)}
                           >-</button>
                           <button 
                            className="w-8 h-8 brutal-border bg-white text-black font-black text-xs hover:bg-gray-200" 
                            onClick={() => updateRound(teamId, team.currentRound + 1)}
                           >+</button>
                        </div>
                        <button 
                          className="text-[10px] font-bold underline opacity-60 hover:opacity-100"
                          onClick={() => selectTeamForEdit(teamId)}
                        >EDIT CONTENT</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">No activity yet</p>
                  )}
                </BrutalistCard>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
