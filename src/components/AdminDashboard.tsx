import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { firebaseService } from '../services/firebaseService';
import { RoomState, EventType, TeamPerformance } from '../types';
import { BrutalistButton, BrutalistCard, BrutalistInput } from './BrutalistUI';
import { EVENTS, ROUNDS } from '../constants';

const APP_URL = 'https://kim-is-back.vercel.app';

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

interface Props {
  room: RoomState;
  rooms: Record<string, RoomState>;
  onSelectRoom: (roomId: string) => void;
  onLogout: () => void;
  onViewTeam?: (teamId: number) => void;
}

const AdminDashboard: React.FC<Props> = ({ room, rooms, onSelectRoom, onLogout, onViewTeam }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | 'all' | null>(null);
  const [editRound, setEditRound] = useState<number | 'all'>(1);
  const [instructionText, setInstructionText] = useState("");
  const [eventMinutes, setEventMinutes] = useState<number>(10);
  const [missionTimerMinutes, setMissionTimerMinutes] = useState<number>(room.missionTimerMinutes || 60);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedPerformanceTeamId, setSelectedPerformanceTeamId] = useState<number | null>(null);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({ groupName: '', totalTeams: 5, membersPerTeam: 6 });
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [eventTargetTeam, setEventTargetTeam] = useState<'all' | number>('all'); // 이벤트 대상 팀
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 전체 미션 타이머
  useEffect(() => {
    if (!room.missionStarted || !room.missionStartTime) {
      setRemainingTime("");
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - room.missionStartTime!) / 1000);
      const totalSeconds = room.missionTimerMinutes * 60;
      const remaining = totalSeconds - elapsed;

      if (remaining <= 0) {
        setRemainingTime("00:00");
      } else {
        setRemainingTime(formatTimeWithHours(remaining));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [room.missionStarted, room.missionStartTime, room.missionTimerMinutes]);

  useEffect(() => {
    if (room.activeEvent !== EventType.BIRTHDAY && isMusicPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsMusicPlaying(false);
    }
  }, [room.activeEvent, isMusicPlaying]);

  const handleStartMission = async () => {
    await firebaseService.startMission(room.id);
  };

  const handleSetTimer = async () => {
    await firebaseService.setMissionTimer(room.id, missionTimerMinutes);
  };

  const toggleEvent = async (type: EventType) => {
    const targetTeams = eventTargetTeam === 'all' ? 'all' : [eventTargetTeam];
    await firebaseService.toggleEvent(room.id, type, eventMinutes, targetTeams);
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

  const updateRound = async (teamId: number, round: number) => {
    await firebaseService.setTeamRound(room.id, teamId, round);
  };

  const saveInstruction = async () => {
    if (selectedTeamId === null) return;
    const updatedRoom = { ...room };
    if (!updatedRoom.teams) {
      updatedRoom.teams = {};
    }

    // 대상 팀 목록 결정
    const targetTeams: number[] = selectedTeamId === 'all'
      ? Array.from({ length: room.totalTeams }, (_, i) => i + 1)
      : [selectedTeamId];

    // 대상 라운드 목록 결정
    const targetRounds: number[] = editRound === 'all'
      ? ROUNDS.map(r => r.id)
      : [editRound];

    // 각 팀과 라운드에 지침 저장
    for (const teamId of targetTeams) {
      if (!updatedRoom.teams[teamId]) {
        updatedRoom.teams[teamId] = {
          id: teamId,
          name: `Team ${teamId}`,
          members: [],
          currentRound: 1,
          maxCompletedRound: 0,
          isJoined: false,
          roundInstructions: {},
          helpCount: 0,
          helpUsages: [],
          roundTimes: {},
          totalBonusTime: 0
        };
      }
      if (!updatedRoom.teams[teamId].roundInstructions) {
        updatedRoom.teams[teamId].roundInstructions = {};
      }
      for (const round of targetRounds) {
        updatedRoom.teams[teamId].roundInstructions[round] = instructionText;
      }
    }

    await firebaseService.saveRoom(updatedRoom);

    const teamLabel = selectedTeamId === 'all' ? '전체 팀' : `팀 ${selectedTeamId}`;
    const roundLabel = editRound === 'all' ? '전체 라운드' : `R${editRound}`;
    alert(`${teamLabel} ${roundLabel} 미션 내용이 저장되었습니다.`);
  };

  const selectTeamForEdit = (id: number | 'all') => {
    setSelectedTeamId(id);
    // 전체팀 선택 시에는 지침 텍스트 초기화
    if (id === 'all') {
      setInstructionText("");
    } else if (editRound !== 'all') {
      setInstructionText(room.teams?.[id]?.roundInstructions?.[editRound] || "");
    } else {
      setInstructionText("");
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomData.groupName.trim()) {
      alert('교육 그룹명을 입력해주세요.');
      return;
    }
    await firebaseService.createRoom(newRoomData.groupName, newRoomData.totalTeams, newRoomData.membersPerTeam);
    setShowNewRoomModal(false);
    setNewRoomData({ groupName: '', totalTeams: 5, membersPerTeam: 6 });
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (window.confirm('정말로 이 교육 그룹을 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) {
      await firebaseService.deleteRoom(roomId);
    }
  };

  useEffect(() => {
    if (selectedTeamId !== null && selectedTeamId !== 'all' && editRound !== 'all') {
      setInstructionText(room.teams?.[selectedTeamId]?.roundInstructions?.[editRound] || "");
    } else if (selectedTeamId === 'all' || editRound === 'all') {
      // 전체팀이나 전체라운드 선택 시에는 기존 지침 로드 안함
      setInstructionText("");
    }
  }, [editRound, selectedTeamId, room.teams]);

  // 성과 분석 데이터
  const allPerformances = firebaseService.calculateAllTeamPerformances(room);
  const completedTeams = room.teams ? Object.values(room.teams).filter(t => t.missionClearTime) : [];

  // 선택된 팀의 성과 분석
  const selectedPerformance = selectedPerformanceTeamId
    ? firebaseService.calculateTeamPerformance(room, selectedPerformanceTeamId)
    : null;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 pb-32">
      {/* Header with QR Code */}
      <header className="flex flex-col md:flex-row justify-between items-start gap-4 border-b-8 border-black pb-4 mb-8">
        <div className="flex items-start gap-6">
          {/* QR Code */}
          <div className="bg-white p-2 brutal-border brutalist-shadow">
            <QRCodeSVG value={APP_URL} size={100} />
            <p className="text-[8px] text-black text-center mt-1 font-bold">SCAN TO JOIN</p>
          </div>

          <div>
            <h1 className="text-4xl md:text-6xl gold-gradient uppercase">ADMIN CONTROL</h1>
            <p className="text-xl font-bold text-gray-400">그룹: {room.groupName || '미설정'}</p>

            {/* 전체 미션 타이머 표시 */}
            {room.missionStarted && remainingTime && (
              <div className={`mt-2 text-3xl font-mono font-black ${remainingTime === "00:00" ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                남은 시간: {remainingTime}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <BrutalistButton variant="gold" onClick={handleStartMission} disabled={room.missionStarted}>
            {room.missionStarted ? '미션 진행 중' : '미션 스타트'}
          </BrutalistButton>

          {completedTeams.length > 0 && (
            <BrutalistButton variant="primary" onClick={() => setShowPerformanceModal(true)} className="text-sm">
              전체 성과 분석 ({completedTeams.length}팀 완료)
            </BrutalistButton>
          )}
        </div>
      </header>

      {/* Room Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-bold text-sm">교육 그룹:</span>
        {Object.values(rooms).map(r => (
          <button
            key={r.id}
            onClick={() => onSelectRoom(r.id)}
            className={`px-3 py-1 brutal-border font-bold text-sm transition-all ${r.id === room.id ? 'bg-yellow-400 text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {r.groupName}
          </button>
        ))}
        <BrutalistButton variant="ghost" className="text-sm py-1 px-3" onClick={() => setShowNewRoomModal(true)}>
          + 새 그룹
        </BrutalistButton>
        <BrutalistButton variant="danger" className="text-sm py-1 px-3" onClick={() => handleDeleteRoom(room.id)}>
          현재 그룹 삭제
        </BrutalistButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Column 1: Event Controls + Timer */}
        <section className="lg:col-span-1 space-y-6">
          {/* Mission Timer Settings */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black italic">MISSION TIMER</h2>
            <BrutalistCard className="space-y-4">
              <label className="block text-xs font-bold uppercase">전체 미션 제한 시간 (분)</label>
              <div className="flex gap-2">
                <BrutalistInput
                  type="number"
                  value={missionTimerMinutes}
                  onChange={(e) => setMissionTimerMinutes(parseInt(e.target.value) || 60)}
                  className="flex-1 text-center"
                  min={1}
                  max={300}
                />
                <BrutalistButton variant="gold" onClick={handleSetTimer} className="text-xs">
                  설정
                </BrutalistButton>
              </div>
              <p className="text-[10px] text-gray-500">현재 설정: {room.missionTimerMinutes}분</p>
            </BrutalistCard>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-black italic">EVENT CONTROL</h2>

            <audio
              ref={audioRef}
              src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
              loop
            />

            {room.activeEvent === EventType.BIRTHDAY && (
              <BrutalistCard className="bg-pink-600 text-white animate-pulse">
                <h3 className="font-black text-center mb-2 uppercase tracking-tighter">BIRTHDAY BGM</h3>
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
              {/* 이벤트 대상 팀 선택 */}
              <div>
                <label className="block text-xs font-bold uppercase mb-1">이벤트 대상</label>
                <select
                  className="w-full brutal-border bg-white text-black p-2 font-bold text-sm"
                  value={eventTargetTeam}
                  onChange={(e) => setEventTargetTeam(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                >
                  <option value="all">전체 팀</option>
                  {Array.from({ length: room.totalTeams }).map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}조</option>
                  ))}
                </select>
              </div>
              {/* 타이머 설정 */}
              <div>
                <label className="block text-xs font-bold uppercase mb-1">이벤트 타이머 (분)</label>
                <BrutalistInput
                  type="number"
                  value={eventMinutes}
                  onChange={(e) => setEventMinutes(parseInt(e.target.value) || 0)}
                  className="w-full text-center"
                />
                <p className="text-[10px] text-gray-500 mt-1">0 입력 시 수동 종료 (타이머 없음)</p>
              </div>
            </div>
            {/* 2x5 그리드 이벤트 버튼 */}
            <div className="grid grid-cols-2 gap-2">
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
            {room.activeEvent !== EventType.NONE && (
              <p className="text-xs text-center text-yellow-400">
                현재 활성: {EVENTS.find(e => e.type === room.activeEvent)?.label}
                {room.eventTargetTeams !== 'all' && room.eventTargetTeams && ` (${room.eventTargetTeams.join(', ')}조)`}
              </p>
            )}
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
                  value={selectedTeamId === null ? "" : selectedTeamId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all') {
                      selectTeamForEdit('all');
                    } else {
                      selectTeamForEdit(parseInt(val));
                    }
                  }}
                >
                  <option value="" disabled>팀 선택</option>
                  <option value="all">전체 팀</option>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all') {
                      setEditRound('all');
                    } else {
                      setEditRound(parseInt(val));
                    }
                  }}
                >
                  <option value="all">전체 라운드</option>
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
             <BrutalistButton variant="gold" fullWidth className="text-xs" onClick={saveInstruction} disabled={selectedTeamId === null}>
                지침 저장하기
             </BrutalistButton>
             {(selectedTeamId === 'all' || editRound === 'all') && (
               <p className="text-[10px] text-yellow-400 text-center">
                 ⚠️ {selectedTeamId === 'all' && editRound === 'all' ? '전체 팀의 전체 라운드에' : selectedTeamId === 'all' ? '전체 팀에' : '전체 라운드에'} 동일한 지침이 저장됩니다.
               </p>
             )}
          </BrutalistCard>
        </section>

        {/* Column 3&4: Real-time Team Monitoring */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-black italic">PROGRESS MONITORING</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[700px] pr-2 scrollbar-thin">
            {Array.from({ length: room.totalTeams }).map((_, idx) => {
              const teamId = idx + 1;
              const team = room.teams?.[teamId];
              const isMissionClear = team?.missionClearTime;

              return (
                <BrutalistCard
                  key={teamId}
                  className={`${isMissionClear ? 'border-green-500 bg-green-900/30' : team?.isJoined ? 'border-yellow-400' : 'opacity-40'} relative group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-2xl font-black">T{teamId}</span>
                    <div className="flex gap-1">
                      {isMissionClear && (
                        <div className="px-2 py-0.5 text-[10px] bg-green-500 font-bold">CLEAR!</div>
                      )}
                      {team?.isJoined && !isMissionClear && (
                        <div className="px-2 py-0.5 text-[10px] bg-green-500 font-bold">ONLINE</div>
                      )}
                      {team && team.helpCount > 0 && (
                        <div className="px-2 py-0.5 text-[10px] bg-orange-500 font-bold">HELP x{team.helpCount}</div>
                      )}
                    </div>
                  </div>

                  {team ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-black brutal-border overflow-hidden">
                          <div
                            className={`h-full transition-all duration-700 ease-out ${isMissionClear ? 'bg-green-500' : 'bg-yellow-400'}`}
                            style={{ width: `${(isMissionClear ? 12 : team.currentRound) / 12 * 100}%` }}
                          />
                        </div>
                        <span className="font-black text-sm">{isMissionClear ? 'DONE' : `R${team.currentRound}`}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-1">
                           <button
                            className="w-8 h-8 brutal-border bg-white text-black font-black text-xs hover:bg-gray-200"
                            onClick={() => updateRound(teamId, team.currentRound - 1)}
                            disabled={isMissionClear}
                           >-</button>
                           <button
                            className="w-8 h-8 brutal-border bg-white text-black font-black text-xs hover:bg-gray-200"
                            onClick={() => updateRound(teamId, team.currentRound + 1)}
                            disabled={isMissionClear}
                           >+</button>
                        </div>
                        <div className="flex gap-2">
                          {onViewTeam && (
                            <button
                              className="text-[10px] font-bold underline text-yellow-400 hover:text-yellow-300"
                              onClick={() => onViewTeam(teamId)}
                            >VIEW PAGE</button>
                          )}
                          {isMissionClear && (
                            <button
                              className="text-[10px] font-bold underline text-green-400 hover:text-green-300"
                              onClick={() => {
                                setSelectedPerformanceTeamId(teamId);
                              }}
                            >RESULT</button>
                          )}
                          <button
                            className="text-[10px] font-bold underline opacity-60 hover:opacity-100"
                            onClick={() => selectTeamForEdit(teamId)}
                          >EDIT</button>
                        </div>
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

      {/* Nav buttons */}
      <nav className="fixed bottom-4 right-4 flex gap-2 z-40">
        <BrutalistButton variant="danger" onClick={onLogout}>LOGOUT</BrutalistButton>
      </nav>

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <BrutalistCard className="max-w-md w-full space-y-6">
            <h2 className="text-3xl font-black uppercase">새 교육 그룹</h2>
            <div className="space-y-4">
              <label className="block font-bold">교육 그룹명</label>
              <BrutalistInput
                fullWidth
                placeholder="예: 2024 신입사원 입문교육"
                value={newRoomData.groupName}
                onChange={(e) => setNewRoomData({...newRoomData, groupName: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold">조 편성 (1-30)</label>
                  <BrutalistInput
                    type="number"
                    fullWidth
                    value={newRoomData.totalTeams}
                    min={1} max={30}
                    onChange={(e) => setNewRoomData({...newRoomData, totalTeams: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div>
                  <label className="block font-bold">조별 인원 (2-12)</label>
                  <BrutalistInput
                    type="number"
                    fullWidth
                    value={newRoomData.membersPerTeam}
                    min={2} max={12}
                    onChange={(e) => setNewRoomData({...newRoomData, membersPerTeam: parseInt(e.target.value) || 2})}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <BrutalistButton variant="gold" fullWidth onClick={handleCreateRoom}>
                  생성하기
                </BrutalistButton>
                <BrutalistButton variant="ghost" fullWidth onClick={() => setShowNewRoomModal(false)}>
                  취소
                </BrutalistButton>
              </div>
            </div>
          </BrutalistCard>
        </div>
      )}

      {/* Performance Modal - All Teams */}
      {showPerformanceModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto">
          <BrutalistCard className="max-w-4xl w-full space-y-6 my-8">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-black uppercase gold-gradient">전체 성과 분석</h2>
              <BrutalistButton variant="ghost" onClick={() => setShowPerformanceModal(false)}>닫기</BrutalistButton>
            </div>

            <div className="space-y-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-4 border-yellow-400">
                    <th className="p-2 font-black">순위</th>
                    <th className="p-2 font-black">팀</th>
                    <th className="p-2 font-black">총 소요시간</th>
                    <th className="p-2 font-black">헬프(+시간)</th>
                    <th className="p-2 font-black">최종 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {allPerformances.map((perf) => (
                    <tr key={perf.teamId} className="border-b border-white/20 hover:bg-white/10">
                      <td className="p-2">
                        <span className={`font-black text-2xl ${perf.rank === 1 ? 'text-yellow-400' : perf.rank === 2 ? 'text-gray-300' : perf.rank === 3 ? 'text-orange-400' : ''}`}>
                          #{perf.rank}
                        </span>
                      </td>
                      <td className="p-2 font-bold">Team {perf.teamId}</td>
                      <td className="p-2 font-mono">{formatTimeWithHours(perf.totalTime)}</td>
                      <td className="p-2">
                        {perf.helpCount > 0 ? (
                          <span className="text-orange-400">x{perf.helpCount} (+{formatTime(perf.helpBonusTime)})</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-2 font-mono font-bold text-yellow-400">{formatTimeWithHours(perf.totalTimeWithBonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BrutalistCard>
        </div>
      )}

      {/* Performance Modal - Single Team */}
      {selectedPerformanceTeamId && selectedPerformance && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto">
          <BrutalistCard className="max-w-2xl w-full space-y-6 my-8">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-black uppercase gold-gradient">Team {selectedPerformanceTeamId} 성과</h2>
              <BrutalistButton variant="ghost" onClick={() => setSelectedPerformanceTeamId(null)}>닫기</BrutalistButton>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <BrutalistCard className="text-center">
                <p className="text-sm text-gray-400 uppercase">전체 순위</p>
                <p className="text-5xl font-black gold-gradient">#{selectedPerformance.rank}</p>
              </BrutalistCard>
              <BrutalistCard className="text-center">
                <p className="text-sm text-gray-400 uppercase">총 소요시간</p>
                <p className="text-3xl font-mono font-black">{formatTimeWithHours(selectedPerformance.totalTimeWithBonus)}</p>
              </BrutalistCard>
              <BrutalistCard className="text-center">
                <p className="text-sm text-gray-400 uppercase">헬프 사용</p>
                <p className="text-3xl font-black text-orange-400">
                  {selectedPerformance.helpCount}회 (+{formatTime(selectedPerformance.helpBonusTime)})
                </p>
              </BrutalistCard>
              <BrutalistCard className="text-center">
                <p className="text-sm text-gray-400 uppercase">순수 미션 시간</p>
                <p className="text-3xl font-mono font-black">{formatTimeWithHours(selectedPerformance.totalTime)}</p>
              </BrutalistCard>
            </div>

            <div>
              <h3 className="text-xl font-black mb-3">라운드별 소요시간</h3>
              <div className="grid grid-cols-5 gap-2">
                {ROUNDS.map(r => {
                  const time = selectedPerformance.roundTimes?.[r.id];
                  return (
                    <div key={r.id} className="bg-white/10 p-2 text-center brutal-border">
                      <p className="text-xs text-gray-400">R{r.id}</p>
                      <p className="font-mono font-bold">{time ? formatTime(time) : '-'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </BrutalistCard>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
