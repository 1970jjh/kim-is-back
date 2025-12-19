import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { firebaseService } from '../services/firebaseService';
import { geminiService } from '../services/geminiService';
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

  // MISSION POST states
  const [posterTeamId, setPosterTeamId] = useState<number>(1);
  const [posterImagePreview, setPosterImagePreview] = useState<string | null>(null);
  const [posterGenerating, setPosterGenerating] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const posterFileInputRef = useRef<HTMLInputElement | null>(null);

  // TOTAL PERFORMANCE states
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [analysisStats, setAnalysisStats] = useState<Record<string, unknown> | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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
      if (room.activeEvent !== EventType.NONE && room.eventStartedAt) {
        const currentEventPaused = Math.floor((now - room.eventStartedAt) / 1000);
        pausedSeconds += currentEventPaused;
      }

      // 실제 경과 시간 = 총 경과 시간 - 일시정지된 시간
      const totalElapsed = Math.floor((now - room.missionStartTime!) / 1000);
      const elapsed = totalElapsed - pausedSeconds;

      const totalSeconds = room.missionTimerMinutes * 60;
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
  }, [room.missionStarted, room.missionStartTime, room.missionTimerMinutes, room.eventPausedTotal, room.activeEvent, room.eventStartedAt]);

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

    // 이벤트 활성화 시 특정 URL 새 창으로 열기
    if (room.activeEvent !== type) {
      // 이벤트가 비활성화 상태에서 활성화될 때만 URL 열기
      const eventUrls: Partial<Record<EventType, string>> = {
        [EventType.BIRTHDAY]: 'https://youtu.be/uoNK5xq2MhA?si=7jlzc9c7KnuMePlk',
        [EventType.LUNCH]: 'https://www.youtube.com/watch?v=sc-GnC84LCU',
        [EventType.HEALTH_CHECK]: 'https://i.namu.wiki/i/C5MYopgRw49Lzb-ncSwUiIsC0jFI3hKmh0M_qBNIPxs3J39lPfytx0FxwtkgNH__88TtIAWeDIqFZjLs93KNrA.webp',
      };

      const url = eventUrls[type];
      if (url) {
        window.open(url, '_blank');
      }
    }

    await firebaseService.toggleEvent(room.id, type, eventMinutes, targetTeams);
  };

  // 모든 이벤트 강제 종료 (즉시)
  const endAllEvents = async () => {
    await firebaseService.forceEndAllEvents(room.id);
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

  // MISSION POST handlers
  const handlePosterImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPosterError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPosterImagePreview(event.target?.result as string);
      setPosterError(null);
      setGeneratedPoster(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePoster = async () => {
    if (!posterImagePreview) {
      setPosterError('먼저 이미지를 업로드해주세요.');
      return;
    }

    setPosterGenerating(true);
    setPosterError(null);
    setGeneratedPoster(null);

    try {
      // Get team info for poster
      const team = room.teams?.[posterTeamId];
      const performances = firebaseService.calculateAllTeamPerformances(room);
      const teamPerf = performances.find(p => p.teamId === posterTeamId);

      const result = await geminiService.generateWinnerPoster(
        posterImagePreview,
        'image/jpeg',
        posterTeamId,
        {
          teamName: team?.name || `Team ${posterTeamId}`,
          rank: teamPerf?.rank,
          groupName: room.groupName
        }
      );

      if (result.success && result.imageData) {
        setGeneratedPoster(result.imageData);
      } else {
        setPosterError(result.error || '포스터 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Poster generation error:', error);
      setPosterError('포스터 생성 중 오류가 발생했습니다.');
    } finally {
      setPosterGenerating(false);
    }
  };

  const handleDownloadPoster = () => {
    if (!generatedPoster) return;

    const link = document.createElement('a');
    link.href = generatedPoster;
    link.download = `team${posterTeamId}_winner_poster.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TOTAL PERFORMANCE handlers
  const handleAnalyzeTotalPerformance = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setAnalysisStats(null);
    setShowAnalysisModal(true);

    try {
      const performances = firebaseService.calculateAllTeamPerformances(room);

      // 팀 리포트 수집
      const teamReports = Object.entries(room.teams || {})
        .filter(([, team]) => team.teamReport)
        .map(([teamIdStr, team]) => ({
          teamId: parseInt(teamIdStr),
          oneLine: team.teamReport?.oneLine || '',
          bestMission: team.teamReport?.bestMission || '',
          regret: team.teamReport?.regret || '',
          futureHelp: team.teamReport?.futureHelp || ''
        }));

      const performancesWithNames = performances.map(p => ({
        ...p,
        teamName: room.teams?.[p.teamId]?.name || `Team ${p.teamId}`,
        members: room.teams?.[p.teamId]?.members
      }));

      const result = await geminiService.analyzeTotalPerformance(
        room.groupName || '교육그룹',
        room.totalTeams,
        performancesWithNames,
        teamReports
      );

      if (result.success) {
        setAnalysisResult(result.analysis || null);
        setAnalysisStats(result.rawStats || null);
      } else {
        setAnalysisError(result.error || '분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError('성과 분석 중 오류가 발생했습니다.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleDownloadAnalysisPDF = async () => {
    if (!analysisResult || !analysisStats) return;

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let y = 20;

      const stats = analysisStats as Record<string, unknown>;
      const analysis = analysisResult as Record<string, unknown>;

      // Helper functions
      const addTitle = (text: string, size: number = 18) => {
        pdf.setFontSize(size);
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.text(text, pageWidth / 2, y, { align: 'center' });
        y += size * 0.5;
      };

      const addSection = (title: string) => {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFontSize(14);
        pdf.setTextColor(60, 60, 60);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, y);
        y += 8;
      };

      const addText = (text: string, indent: number = 0) => {
        if (y > pageHeight - 20) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(text, pageWidth - margin * 2 - indent);
        pdf.text(lines, margin + indent, y);
        y += lines.length * 5;
      };

      const formatTimeForPDF = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
      };

      // Title
      addTitle(`${stats.groupName || 'Education'} Performance Report`, 20);
      y += 5;
      addTitle(`Analysis Date: ${stats.dateStr}`, 12);
      y += 10;

      // Draw separator line
      pdf.setDrawColor(255, 215, 0);
      pdf.setLineWidth(1);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Executive Summary
      addSection('Executive Summary');
      if (analysis.executiveSummary) {
        addText(String(analysis.executiveSummary));
      }
      y += 5;

      // Statistics Overview
      addSection('Performance Statistics');
      addText(`Total Teams: ${stats.totalTeams}`);
      addText(`Average Time: ${formatTimeForPDF(Number(stats.avgTime) || 0)}`);
      addText(`Fastest Time: ${formatTimeForPDF(Number(stats.minTime) || 0)}`);
      addText(`Slowest Time: ${formatTimeForPDF(Number(stats.maxTime) || 0)}`);
      addText(`Total HELP Usage: ${stats.totalHelps} times`);
      y += 5;

      // Draw simple bar chart for round difficulty
      addSection('Round Difficulty (Average Time)');
      const roundAvgTimes = stats.roundAvgTimes as Record<number, number> || {};
      const maxRoundTime = Math.max(...Object.values(roundAvgTimes).map(Number), 1);
      const chartWidth = pageWidth - margin * 2;
      const barHeight = 6;
      const chartStartY = y;

      Object.entries(roundAvgTimes).forEach(([round, time], idx) => {
        if (y > pageHeight - 30) {
          pdf.addPage();
          y = 20;
        }
        const barWidth = (Number(time) / maxRoundTime) * (chartWidth - 40);

        // Label
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`R${round}`, margin, y + 4);

        // Bar
        pdf.setFillColor(255, 215, 0);
        pdf.rect(margin + 15, y, barWidth, barHeight, 'F');

        // Time value
        pdf.text(formatTimeForPDF(Number(time)), margin + 20 + barWidth, y + 4);

        y += barHeight + 3;
      });
      y += 10;

      // Overall Assessment
      if (analysis.overallAssessment) {
        addSection('Overall Assessment');
        addText(String(analysis.overallAssessment));
        y += 5;
      }

      // Team Ranking Analysis
      if (analysis.teamRankingAnalysis) {
        addSection('Team Ranking Analysis');
        addText(String(analysis.teamRankingAnalysis));
        y += 5;
      }

      // Round Analysis
      const roundAnalysis = analysis.roundAnalysis as Record<string, unknown>;
      if (roundAnalysis) {
        addSection('Round Analysis');
        if (roundAnalysis.keyInsights) {
          addText(String(roundAnalysis.keyInsights));
        }
        y += 5;
      }

      // Recommendations
      const recommendations = analysis.recommendations as string[];
      if (recommendations && recommendations.length > 0) {
        addSection('Recommendations');
        recommendations.forEach((rec, idx) => {
          addText(`${idx + 1}. ${rec}`, 5);
        });
        y += 5;
      }

      // Best Practices
      const bestPractices = analysis.bestPractices as string[];
      if (bestPractices && bestPractices.length > 0) {
        addSection('Best Practices');
        bestPractices.forEach((practice, idx) => {
          addText(`${idx + 1}. ${practice}`, 5);
        });
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by Kim Is Back - AI Performance Analysis', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Download
      pdf.save(`${stats.groupName || 'performance'}_analysis_report.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    }
  };

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
            {/* All EVENT 종료 버튼 */}
            <BrutalistButton
              variant="danger"
              fullWidth
              onClick={endAllEvents}
              disabled={room.activeEvent === EventType.NONE}
              className="text-sm py-2 mt-2"
            >
              All EVENT 종료
            </BrutalistButton>
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

          {/* MISSION POST Section */}
          <h2 className="text-2xl font-black italic mt-6">MISSION POST</h2>
          <BrutalistCard className="space-y-4">
            <p className="text-xs text-gray-400">
              우승팀 단체사진을 업로드하면 AI가 멋진 축하 포스터를 생성합니다.
            </p>

            {/* Team Selection */}
            <div>
              <label className="text-xs font-bold uppercase">대상 팀 선택</label>
              <select
                className="w-full brutal-border bg-white text-black p-2 font-bold text-sm mt-1"
                value={posterTeamId}
                onChange={(e) => setPosterTeamId(parseInt(e.target.value))}
              >
                {Array.from({ length: room.totalTeams }).map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}조</option>
                ))}
              </select>
            </div>

            {/* Image Upload */}
            <div>
              <label className="text-xs font-bold uppercase">단체사진 업로드</label>
              <input
                ref={posterFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePosterImageSelect}
                className="hidden"
              />
              <BrutalistButton
                variant="primary"
                fullWidth
                className="text-xs mt-1"
                onClick={() => posterFileInputRef.current?.click()}
              >
                이미지 선택
              </BrutalistButton>
            </div>

            {/* Preview Original Image */}
            {posterImagePreview && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">원본 이미지</label>
                <img
                  src={posterImagePreview}
                  alt="Original"
                  className="w-full h-auto brutal-border object-cover"
                  style={{ maxHeight: '150px' }}
                />
              </div>
            )}

            {/* Generate Button */}
            <BrutalistButton
              variant="gold"
              fullWidth
              className="text-xs"
              onClick={handleGeneratePoster}
              disabled={!posterImagePreview || posterGenerating}
            >
              {posterGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  AI 포스터 생성 중...
                </span>
              ) : (
                '🎨 우승 포스터 생성'
              )}
            </BrutalistButton>

            {/* Error Message */}
            {posterError && (
              <p className="text-xs text-red-400 text-center">{posterError}</p>
            )}

            {/* Generated Poster Preview */}
            {generatedPoster && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-yellow-400">생성된 포스터</label>
                <img
                  src={generatedPoster}
                  alt="Generated Poster"
                  className="w-full h-auto brutal-border border-yellow-400"
                />
                <BrutalistButton
                  variant="gold"
                  fullWidth
                  className="text-xs"
                  onClick={handleDownloadPoster}
                >
                  📥 포스터 다운로드
                </BrutalistButton>
              </div>
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

      {/* TOTAL PERFORMANCE Section */}
      <section className="mt-8 space-y-4">
        <h2 className="text-2xl font-black italic">TOTAL PERFORMANCE</h2>
        <BrutalistCard className="space-y-4">
          <p className="text-xs text-gray-400">
            모든 팀의 미션이 종료된 후, AI가 전체 성과를 종합 분석하여 상세 리포트를 생성합니다.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/10 p-3 brutal-border">
              <p className="text-[10px] text-gray-400 uppercase">완료 팀</p>
              <p className="text-2xl font-black text-green-400">{completedTeams.length}</p>
            </div>
            <div className="bg-white/10 p-3 brutal-border">
              <p className="text-[10px] text-gray-400 uppercase">전체 팀</p>
              <p className="text-2xl font-black">{room.totalTeams}</p>
            </div>
            <div className="bg-white/10 p-3 brutal-border">
              <p className="text-[10px] text-gray-400 uppercase">완료율</p>
              <p className="text-2xl font-black text-yellow-400">
                {Math.round((completedTeams.length / room.totalTeams) * 100)}%
              </p>
            </div>
            <div className="bg-white/10 p-3 brutal-border">
              <p className="text-[10px] text-gray-400 uppercase">상태</p>
              <p className={`text-lg font-black ${completedTeams.length === room.totalTeams ? 'text-green-400' : 'text-orange-400'}`}>
                {completedTeams.length === room.totalTeams ? 'READY' : 'IN PROGRESS'}
              </p>
            </div>
          </div>

          <BrutalistButton
            variant="gold"
            fullWidth
            className="text-sm"
            onClick={handleAnalyzeTotalPerformance}
            disabled={completedTeams.length === 0 || analysisLoading}
          >
            {analysisLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                AI 종합 분석 중...
              </span>
            ) : (
              '📊 AI 종합 성과 분석 시작'
            )}
          </BrutalistButton>

          {completedTeams.length === 0 && (
            <p className="text-xs text-orange-400 text-center">
              ⚠️ 최소 1개 팀 이상 미션을 완료해야 분석이 가능합니다.
            </p>
          )}
        </BrutalistCard>
      </section>

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

      {/* Analysis Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 overflow-auto">
          <BrutalistCard className="max-w-4xl w-full space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center sticky top-0 bg-black/90 pb-4 -mt-2 pt-2">
              <h2 className="text-3xl font-black uppercase gold-gradient">AI 종합 성과 분석</h2>
              <div className="flex gap-2">
                {analysisResult && (
                  <BrutalistButton variant="gold" onClick={handleDownloadAnalysisPDF} className="text-sm">
                    📥 PDF 다운로드
                  </BrutalistButton>
                )}
                <BrutalistButton variant="ghost" onClick={() => setShowAnalysisModal(false)}>닫기</BrutalistButton>
              </div>
            </div>

            {analysisLoading && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 animate-bounce">🤖</div>
                <p className="text-xl font-bold text-yellow-400">AI가 데이터를 분석하고 있습니다...</p>
                <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요.</p>
              </div>
            )}

            {analysisError && (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">❌</div>
                <p className="text-xl font-bold text-red-400">분석 중 오류가 발생했습니다</p>
                <p className="text-sm text-gray-400 mt-2">{analysisError}</p>
                <BrutalistButton variant="primary" className="mt-4" onClick={handleAnalyzeTotalPerformance}>
                  다시 시도
                </BrutalistButton>
              </div>
            )}

            {analysisResult && analysisStats && (
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <BrutalistCard className="text-center bg-gradient-to-br from-green-900/50 to-green-700/30">
                    <p className="text-xs text-gray-400 uppercase">평균 소요시간</p>
                    <p className="text-2xl font-mono font-black text-green-400">
                      {formatTimeWithHours(Number((analysisStats as Record<string, unknown>).avgTime) || 0)}
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-yellow-900/50 to-yellow-700/30">
                    <p className="text-xs text-gray-400 uppercase">최단 기록</p>
                    <p className="text-2xl font-mono font-black text-yellow-400">
                      {formatTimeWithHours(Number((analysisStats as Record<string, unknown>).minTime) || 0)}
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-red-900/50 to-red-700/30">
                    <p className="text-xs text-gray-400 uppercase">최장 기록</p>
                    <p className="text-2xl font-mono font-black text-red-400">
                      {formatTimeWithHours(Number((analysisStats as Record<string, unknown>).maxTime) || 0)}
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-orange-900/50 to-orange-700/30">
                    <p className="text-xs text-gray-400 uppercase">총 HELP 사용</p>
                    <p className="text-2xl font-black text-orange-400">
                      {(analysisStats as Record<string, unknown>).totalHelps || 0}회
                    </p>
                  </BrutalistCard>
                </div>

                {/* Round Difficulty Chart */}
                <BrutalistCard>
                  <h3 className="text-lg font-black mb-4 text-yellow-400">📊 라운드별 난이도 (평균 소요시간)</h3>
                  <div className="space-y-2">
                    {Object.entries((analysisStats as Record<string, unknown>).roundAvgTimes as Record<number, number> || {}).map(([round, time]) => {
                      const maxTime = Math.max(...Object.values((analysisStats as Record<string, unknown>).roundAvgTimes as Record<number, number> || {}));
                      const percentage = (Number(time) / maxTime) * 100;
                      return (
                        <div key={round} className="flex items-center gap-2">
                          <span className="w-8 text-xs font-bold">R{round}</span>
                          <div className="flex-1 h-6 bg-white/10 brutal-border overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-16 text-xs font-mono text-right">
                            {formatTime(Number(time))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </BrutalistCard>

                {/* Executive Summary */}
                {(analysisResult as Record<string, unknown>).executiveSummary && (
                  <BrutalistCard className="border-yellow-400">
                    <h3 className="text-lg font-black mb-2 text-yellow-400">📋 핵심 요약</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {String((analysisResult as Record<string, unknown>).executiveSummary)}
                    </p>
                  </BrutalistCard>
                )}

                {/* Overall Assessment */}
                {(analysisResult as Record<string, unknown>).overallAssessment && (
                  <BrutalistCard>
                    <h3 className="text-lg font-black mb-2 text-blue-400">📈 종합 평가</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {String((analysisResult as Record<string, unknown>).overallAssessment)}
                    </p>
                  </BrutalistCard>
                )}

                {/* Team Ranking Analysis */}
                {(analysisResult as Record<string, unknown>).teamRankingAnalysis && (
                  <BrutalistCard>
                    <h3 className="text-lg font-black mb-2 text-green-400">🏆 팀 순위 분석</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {String((analysisResult as Record<string, unknown>).teamRankingAnalysis)}
                    </p>
                  </BrutalistCard>
                )}

                {/* Teamwork Insights */}
                {(analysisResult as Record<string, unknown>).teamworkInsights && (
                  <BrutalistCard>
                    <h3 className="text-lg font-black mb-2 text-purple-400">🤝 팀워크 인사이트</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {String((analysisResult as Record<string, unknown>).teamworkInsights)}
                    </p>
                  </BrutalistCard>
                )}

                {/* Recommendations */}
                {((analysisResult as Record<string, unknown>).recommendations as string[])?.length > 0 && (
                  <BrutalistCard>
                    <h3 className="text-lg font-black mb-2 text-cyan-400">💡 개선 제안</h3>
                    <ul className="space-y-2">
                      {((analysisResult as Record<string, unknown>).recommendations as string[]).map((rec, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex gap-2">
                          <span className="text-yellow-400 font-bold">{idx + 1}.</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </BrutalistCard>
                )}

                {/* Best Practices */}
                {((analysisResult as Record<string, unknown>).bestPractices as string[])?.length > 0 && (
                  <BrutalistCard className="border-green-400">
                    <h3 className="text-lg font-black mb-2 text-green-400">⭐ 베스트 프랙티스</h3>
                    <ul className="space-y-2">
                      {((analysisResult as Record<string, unknown>).bestPractices as string[]).map((practice, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex gap-2">
                          <span className="text-green-400">✓</span>
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </BrutalistCard>
                )}
              </div>
            )}
          </BrutalistCard>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
