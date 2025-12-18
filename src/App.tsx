import React, { useState, useEffect } from 'react';
import { UserRole, AuthState, RoomState, EventType, TeamMember } from './types';
import { firebaseService } from './services/firebaseService';
import { ADMIN_PASSWORD, ROLES, EVENTS } from './constants';
import { BrutalistButton, BrutalistCard, BrutalistInput } from './components/BrutalistUI';
import AdminDashboard from './components/AdminDashboard';
import LearnerMode from './components/LearnerMode';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ role: UserRole.UNSET, authenticated: false });
  const [rooms, setRooms] = useState<Record<string, RoomState>>({});
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin이 조별 공간을 볼 때 사용
  const [adminViewTeamId, setAdminViewTeamId] = useState<number | null>(null);

  // Login States
  const [pwInput, setPwInput] = useState('');
  const [setupData, setSetupData] = useState({ groupName: '', totalTeams: 5, membersPerTeam: 6 });
  const [joinData, setJoinData] = useState<{ teamId: number; members: Record<string, string> }>({
    teamId: 1,
    members: {}
  });

  useEffect(() => {
    // Firebase 실시간 구독
    const unsubscribe = firebaseService.subscribe((newRooms) => {
      setRooms(newRooms);
      setLoading(false);

      // 현재 선택된 방이 삭제되었거나 없으면 첫 번째 방 선택
      if (currentRoomId && !newRooms[currentRoomId]) {
        const roomIds = Object.keys(newRooms);
        setCurrentRoomId(roomIds.length > 0 ? roomIds[0] : null);
      }
    });

    // 세션 복구
    const savedAuth = localStorage.getItem('KIM_BUJANG_AUTH');
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth);
      setAuth(parsed);
      if (parsed.roomId) {
        setCurrentRoomId(parsed.roomId);
      }
    }

    return () => unsubscribe();
  }, []);

  // 첫 로드 시 방이 있으면 첫 번째 방 선택
  useEffect(() => {
    if (!loading && !currentRoomId && Object.keys(rooms).length > 0) {
      setCurrentRoomId(Object.keys(rooms)[0]);
    }
  }, [loading, rooms, currentRoomId]);

  const currentRoom = currentRoomId ? rooms[currentRoomId] : null;

  const saveAuth = (newAuth: AuthState) => {
    setAuth(newAuth);
    localStorage.setItem('KIM_BUJANG_AUTH', JSON.stringify(newAuth));
  };

  const handleAdminLogin = () => {
    if (pwInput === ADMIN_PASSWORD) {
      saveAuth({ role: UserRole.ADMIN, authenticated: true });
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleCreateRoom = async () => {
    if (!setupData.groupName.trim()) {
      alert('교육 그룹명을 입력해주세요.');
      return;
    }
    const newRoomId = await firebaseService.createRoom(
      setupData.groupName,
      setupData.totalTeams,
      setupData.membersPerTeam
    );
    setCurrentRoomId(newRoomId);
    setSetupData({ groupName: '', totalTeams: 5, membersPerTeam: 6 });
  };

  const handleJoinTeam = async () => {
    if (!currentRoom || !currentRoomId) {
      alert('참가할 교육 그룹이 없습니다.');
      return;
    }

    const leaderName = joinData.members['leader'];
    if (!leaderName) {
      alert('최소한 리더(김부장)의 이름은 입력해야 합니다.');
      return;
    }

    // Check reconnection logic: same team + same leader name
    const existingTeam = currentRoom.teams[joinData.teamId];
    if (existingTeam && existingTeam.isJoined) {
        const existingLeader = existingTeam.members.find(m => m.role === '리더 (김부장)');
        if (existingLeader?.name !== leaderName) {
            alert('해당 팀은 이미 다른 멤버가 선점하고 있습니다.');
            return;
        }
    }

    const memberList: TeamMember[] = ROLES.map(r => ({
      role: r.label,
      name: joinData.members[r.id] || '미지정'
    }));

    await firebaseService.joinTeam(currentRoomId, joinData.teamId, {
      members: memberList,
      roundInstructions: existingTeam?.roundInstructions || {}
    });

    saveAuth({
      role: UserRole.LEARNER,
      authenticated: true,
      teamId: joinData.teamId,
      learnerName: leaderName,
      roomId: currentRoomId
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('KIM_BUJANG_AUTH');
    setAuth({ role: UserRole.UNSET, authenticated: false });
  };

  const handleSelectRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
  };

  // Event Overlay Component with Countdown
  const EventOverlay = () => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
      if (!currentRoom?.eventEndTime) {
        setTimeLeft("");
        return;
      }

      const timer = setInterval(() => {
        const now = Date.now();
        const diff = currentRoom.eventEndTime! - now;
        if (diff <= 0) {
          setTimeLeft("00:00");
          clearInterval(timer);
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);

      return () => clearInterval(timer);
    }, [currentRoom?.eventEndTime]);

    if (!currentRoom || currentRoom.activeEvent === EventType.NONE || auth.role === UserRole.ADMIN) return null;
    const eventInfo = EVENTS.find(e => e.type === currentRoom.activeEvent);
    if (!eventInfo) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-8 animate-fadeIn">
        <BrutalistCard className="max-w-4xl w-full text-center space-y-8 bg-white text-black p-12">
           <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter">{eventInfo.label}</h2>

           {timeLeft && (
             <div className="bg-yellow-400 p-4 brutal-border brutalist-shadow inline-block mx-auto">
                <span className="text-6xl md:text-8xl font-mono font-black">{timeLeft}</span>
             </div>
           )}

           <img src={eventInfo.image} alt={eventInfo.label} className="w-full h-48 md:h-80 object-cover brutal-border brutalist-shadow" />
           <p className="text-xl md:text-3xl font-bold italic animate-pulse">본 팝업은 강사님이 대시보드에서 해제할 때까지 닫을 수 없습니다.</p>
        </BrutalistCard>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-4xl font-black gold-gradient animate-pulse">LOADING...</div>
          <p className="text-gray-400">Firebase 연결 중</p>
        </div>
      </div>
    );
  }

  // 1. Initial Selection
  if (auth.role === UserRole.UNSET) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-12">
        <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-8xl gold-gradient font-black tracking-tighter drop-shadow-2xl">
              김부장의 <br/> 본사 복귀 미션!
            </h1>
            <p className="text-xl font-bold bg-white text-black px-4 py-2 inline-block">MISSION: RETURN TO HEADQUARTER</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <BrutalistCard className="flex flex-col space-y-6 hover:scale-105 transition-transform">
             <h2 className="text-3xl font-black">관리자(강사)</h2>
             <p className="text-gray-400 font-bold">방 개설, 미션 진행 컨트롤, 대시보드 모니터링</p>
             <div className="space-y-4 pt-4">
                <BrutalistInput
                  type="password"
                  placeholder="보안 코드 입력"
                  fullWidth
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                />
                <BrutalistButton variant="primary" fullWidth onClick={handleAdminLogin}>ADMIN LOGIN</BrutalistButton>
             </div>
          </BrutalistCard>

          <BrutalistCard className="flex flex-col space-y-6 hover:scale-105 transition-transform border-yellow-400">
             <h2 className="text-3xl font-black gold-gradient">학습자(참가자)</h2>
             <p className="text-gray-400 font-bold">미션 수행, 스토리 감상, 팀워크 챌린지</p>
             <div className="pt-4 mt-auto">
                <BrutalistButton variant="gold" fullWidth onClick={() => saveAuth({ ...auth, role: UserRole.LEARNER })}>LEARNER JOIN</BrutalistButton>
             </div>
          </BrutalistCard>
        </div>
      </div>
    );
  }

  // 2. Admin Logic
  if (auth.role === UserRole.ADMIN) {
    // 방이 하나도 없으면 생성 화면
    if (Object.keys(rooms).length === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <BrutalistCard className="max-w-md w-full space-y-6">
            <h2 className="text-3xl font-black uppercase">첫 번째 교육 그룹 생성</h2>
            <div className="space-y-4">
              <label className="block font-bold">교육 그룹명</label>
              <BrutalistInput
                fullWidth
                placeholder="예: 2024 신입사원 입문교육"
                value={setupData.groupName}
                onChange={(e) => setSetupData({...setupData, groupName: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold">조 편성 (1-30)</label>
                  <BrutalistInput
                    type="number"
                    fullWidth
                    value={setupData.totalTeams}
                    min={1} max={30}
                    onChange={(e) => setSetupData({...setupData, totalTeams: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div>
                  <label className="block font-bold">조별 인원 (2-12)</label>
                  <BrutalistInput
                    type="number"
                    fullWidth
                    value={setupData.membersPerTeam}
                    min={2} max={12}
                    onChange={(e) => setSetupData({...setupData, membersPerTeam: parseInt(e.target.value) || 2})}
                  />
                </div>
              </div>
              <BrutalistButton variant="gold" fullWidth className="mt-4" onClick={handleCreateRoom}>
                방 개설하기
              </BrutalistButton>
              <BrutalistButton variant="ghost" fullWidth onClick={handleLogout}>취소</BrutalistButton>
            </div>
          </BrutalistCard>
        </div>
      );
    }

    // 관리자가 특정 조의 화면을 보고 있는 경우
    if (adminViewTeamId !== null && currentRoom) {
      return (
        <div className="min-h-screen relative">
          {/* 관리자용 상단 네비게이션 바 */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 border-b-4 border-yellow-400 p-3">
            <div className="max-w-4xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-yellow-400 font-black text-sm uppercase">Admin Preview</span>
                <span className="text-white font-bold">Team {adminViewTeamId} 화면</span>
              </div>
              <BrutalistButton
                variant="gold"
                className="text-sm py-2 px-4"
                onClick={() => setAdminViewTeamId(null)}
              >
                ← 대시보드로 돌아가기
              </BrutalistButton>
            </div>
          </div>
          <div className="pt-16">
            <LearnerMode
              room={currentRoom}
              auth={{ teamId: adminViewTeamId, learnerName: '관리자(미리보기)' }}
            />
          </div>
        </div>
      );
    }

    // 방이 있으면 대시보드
    if (currentRoom) {
      return (
        <div className="min-h-screen">
          <AdminDashboard
            room={currentRoom}
            rooms={rooms}
            onSelectRoom={handleSelectRoom}
            onLogout={handleLogout}
            onViewTeam={setAdminViewTeamId}
          />
        </div>
      );
    }
  }

  // 3. Learner Logic
  if (auth.role === UserRole.LEARNER) {
    // 방 선택 & 팀 참가 화면
    if (!auth.authenticated) {
      const roomList = Object.values(rooms);

      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <BrutalistCard className="max-w-2xl w-full space-y-8 bg-black/90">
            <h2 className="text-4xl font-black uppercase gold-gradient">MISSION JOIN</h2>

            <div className="space-y-6">
              {/* 방 선택 */}
              <div>
                <label className="block font-black text-yellow-400 mb-2 uppercase">교육 그룹 선택</label>
                {roomList.length === 0 ? (
                  <div className="brutal-border p-4 bg-white text-black font-black">
                    현재 활성화된 교육이 없습니다.
                  </div>
                ) : (
                  <select
                    className="w-full brutal-border bg-white text-black p-4 font-bold brutalist-shadow"
                    value={currentRoomId || ''}
                    onChange={(e) => setCurrentRoomId(e.target.value)}
                  >
                    {roomList.map(room => (
                      <option key={room.id} value={room.id}>{room.groupName}</option>
                    ))}
                  </select>
                )}
              </div>

              {currentRoom && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="block font-black text-yellow-400 uppercase">본인의 조(Team) 선택</label>
                      <select
                        className="w-full brutal-border bg-white text-black p-4 font-bold brutalist-shadow h-[60px]"
                        value={joinData.teamId}
                        onChange={(e) => setJoinData({...joinData, teamId: parseInt(e.target.value)})}
                      >
                        {Array.from({ length: currentRoom.totalTeams }).map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1}조 (Team {i+1})</option>
                        ))}
                      </select>
                   </div>

                   <div className="space-y-4">
                      <label className="block font-black text-yellow-400 uppercase">팀원 정보 입력</label>
                      <div className="space-y-2 overflow-y-auto max-h-[300px] pr-2">
                        {ROLES.map(role => (
                          <div key={role.id}>
                            <label className="text-xs font-bold text-gray-400">{role.label}</label>
                            <BrutalistInput
                              placeholder="이름 입력"
                              className="w-full text-sm py-2 px-3"
                              value={joinData.members[role.id] || ''}
                              onChange={(e) => setJoinData({
                                ...joinData,
                                members: { ...joinData.members, [role.id]: e.target.value }
                              })}
                            />
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              )}

              <div className="flex gap-4">
                <BrutalistButton
                  variant="gold"
                  className="flex-1 text-2xl"
                  onClick={handleJoinTeam}
                  disabled={!currentRoom}
                >
                  JOIN MISSION
                </BrutalistButton>
                <BrutalistButton variant="ghost" onClick={handleLogout}>뒤로</BrutalistButton>
              </div>
            </div>
          </BrutalistCard>
        </div>
      );
    }

    // 팀 참가 완료 - 미션 화면
    const learnerRoom = auth.roomId ? rooms[auth.roomId] : null;

    if (!learnerRoom) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <BrutalistCard className="text-center space-y-4">
            <p className="text-xl font-bold">교육 그룹을 찾을 수 없습니다.</p>
            <BrutalistButton variant="ghost" onClick={handleLogout}>돌아가기</BrutalistButton>
          </BrutalistCard>
        </div>
      );
    }

    return (
      <div className="min-h-screen">
        <EventOverlay />
        <LearnerMode
          room={learnerRoom}
          auth={{ teamId: auth.teamId!, learnerName: auth.learnerName! }}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-screen">
      <BrutalistButton variant="ghost" onClick={handleLogout}>돌아가기</BrutalistButton>
    </div>
  );
};

export default App;
