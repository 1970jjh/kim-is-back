import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { firebaseService } from '../services/firebaseService';
import { geminiService } from '../services/geminiService';
import { RoomState, EventType, TeamPerformance, IndustryType, IndustryTypeLabels, GroupPhoto } from '../types';
import { BrutalistButton, BrutalistCard, BrutalistInput } from './BrutalistUI';
import { EVENTS, ROUNDS } from '../constants';

const APP_URL = 'https://kim-is-back.vercel.app';

// 시간 포맷팅 유틸
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeWithHours = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
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
  const [eventMinutes, setEventMinutes] = useState<number>(1);
  const [missionTimerMinutes, setMissionTimerMinutes] = useState<number>(room.missionTimerMinutes || 60);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedPerformanceTeamId, setSelectedPerformanceTeamId] = useState<number | null>(null);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({ groupName: '', totalTeams: 5, membersPerTeam: 6, industryType: IndustryType.IT_SOLUTION });
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [eventTargetTeam, setEventTargetTeam] = useState<'all' | number>('all'); // 이벤트 대상 팀
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null); // 선택된 이벤트 타입
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

  // R11 Customer Service states
  const [showR11ConversationModal, setShowR11ConversationModal] = useState(false);
  const [selectedR11TeamId, setSelectedR11TeamId] = useState<number | null>(null);
  const [showR11AnalysisModal, setShowR11AnalysisModal] = useState(false);
  const [r11AnalysisLoading, setR11AnalysisLoading] = useState(false);
  const [r11AnalysisResult, setR11AnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [r11AnalysisStats, setR11AnalysisStats] = useState<Record<string, unknown> | null>(null);
  const [r11AnalysisError, setR11AnalysisError] = useState<string | null>(null);

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

  // 이벤트 타입 선택 (버튼 클릭 시)
  const selectEventType = (type: EventType) => {
    setSelectedEventType(selectedEventType === type ? null : type);
  };

  // 개별 팀 이벤트 시작
  const startIndividualEvent = async () => {
    if (!selectedEventType || eventTargetTeam === 'all') return;

    // 이벤트 URL 열기
    const eventUrls: Partial<Record<EventType, string>> = {
      [EventType.BIRTHDAY]: 'https://youtu.be/uoNK5xq2MhA?si=7jlzc9c7KnuMePlk',
      [EventType.LUNCH]: 'https://www.youtube.com/watch?v=sc-GnC84LCU',
      [EventType.HEALTH_CHECK]: 'https://i.namu.wiki/i/C5MYopgRw49Lzb-ncSwUiIsC0jFI3hKmh0M_qBNIPxs3J39lPfytx0FxwtkgNH__88TtIAWeDIqFZjLs93KNrA.webp',
    };
    const url = eventUrls[selectedEventType];
    if (url) {
      window.open(url, '_blank');
    }

    await firebaseService.startTeamEvent(room.id, eventTargetTeam, selectedEventType, eventMinutes);
  };

  // 개별 팀 이벤트 종료
  const endIndividualEvent = async () => {
    if (eventTargetTeam === 'all') return;
    await firebaseService.endTeamEvent(room.id, eventTargetTeam);
  };

  // 전체 팀 이벤트 시작
  const startAllTeamsEvent = async () => {
    if (!selectedEventType) return;

    // 이벤트 URL 열기
    const eventUrls: Partial<Record<EventType, string>> = {
      [EventType.BIRTHDAY]: 'https://youtu.be/uoNK5xq2MhA?si=7jlzc9c7KnuMePlk',
      [EventType.LUNCH]: 'https://www.youtube.com/watch?v=sc-GnC84LCU',
      [EventType.HEALTH_CHECK]: 'https://i.namu.wiki/i/C5MYopgRw49Lzb-ncSwUiIsC0jFI3hKmh0M_qBNIPxs3J39lPfytx0FxwtkgNH__88TtIAWeDIqFZjLs93KNrA.webp',
    };
    const url = eventUrls[selectedEventType];
    if (url) {
      window.open(url, '_blank');
    }

    await firebaseService.startAllTeamsEvent(room.id, selectedEventType, eventMinutes);
  };

  // 전체 팀 이벤트 종료
  const endAllTeamsEvent = async () => {
    await firebaseService.endAllTeamsEvent(room.id);
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
    await firebaseService.createRoom(newRoomData.groupName, newRoomData.totalTeams, newRoomData.membersPerTeam, newRoomData.industryType);
    setShowNewRoomModal(false);
    setNewRoomData({ groupName: '', totalTeams: 5, membersPerTeam: 6, industryType: IndustryType.IT_SOLUTION });
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

  // R11 Customer Service Analysis handler
  const handleAnalyzeR11CustomerService = async () => {
    setR11AnalysisLoading(true);
    setR11AnalysisError(null);
    setR11AnalysisResult(null);
    setR11AnalysisStats(null);
    setShowR11AnalysisModal(true);

    try {
      // R11 피드백이 있는 팀만 수집
      const teamData = Object.entries(room.teams || {})
        .filter(([, team]) => team.r11Feedback?.conversationHistory?.length > 0)
        .map(([teamIdStr, team]) => ({
          teamId: parseInt(teamIdStr),
          conversationHistory: team.r11Feedback?.conversationHistory || [],
          finalScore: team.r11Feedback?.finalScore || 0,
          overallGrade: team.r11Feedback?.overallGrade || 'D',
          completionTime: team.r11Feedback?.completionTime
        }));

      if (teamData.length === 0) {
        setR11AnalysisError('분석할 고객응대 데이터가 없습니다. 팀들이 R11 미션을 완료해야 합니다.');
        setR11AnalysisLoading(false);
        return;
      }

      const result = await geminiService.analyzeCustomerServiceComparison(
        room.groupName || '교육그룹',
        room.industryType || 1,
        teamData
      );

      if (result.success) {
        setR11AnalysisResult(result.analysis || null);
        setR11AnalysisStats(result.stats || null);
      } else {
        setR11AnalysisError(result.error || '분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('R11 Analysis error:', error);
      setR11AnalysisError('고객응대 분석 중 오류가 발생했습니다.');
    } finally {
      setR11AnalysisLoading(false);
    }
  };

  const handleDownloadAnalysisPDF = async () => {
    if (!analysisResult || !analysisStats) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // 로딩 표시
      const pdfButton = document.querySelector('[data-pdf-button]');
      const originalButtonText = pdfButton?.textContent;
      if (pdfButton) pdfButton.textContent = 'PDF 생성 중...';

      const stats = analysisStats as Record<string, unknown>;
      const result = analysisResult as Record<string, unknown>;

      // 시간 포맷팅 (초 단위까지만)
      const fmtTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      // 레이더차트 SVG 생성 함수
      const createRadarChartSVG = (data: Record<string, number>, title: string, color: string, size: number = 140): string => {
        const entries = Object.entries(data);
        const n = entries.length;
        if (n === 0) return '';

        const cx = size / 2;
        const cy = size / 2;
        const maxR = size / 2 - 25;
        const angleStep = (2 * Math.PI) / n;
        const maxVal = Math.max(...entries.map(([, v]) => v), 1);

        // 배경 그리드 (5단계)
        let gridLines = '';
        [0.2, 0.4, 0.6, 0.8, 1].forEach((scale) => {
          const points = entries.map((_, idx) => {
            const angle = -Math.PI / 2 + idx * angleStep;
            const r = maxR * scale;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(' ');
          gridLines += `<polygon points="${points}" fill="none" stroke="#ccc" stroke-width="0.5"/>`;
        });

        // 축 선
        let axisLines = '';
        entries.forEach((_, idx) => {
          const angle = -Math.PI / 2 + idx * angleStep;
          const x2 = cx + maxR * Math.cos(angle);
          const y2 = cy + maxR * Math.sin(angle);
          axisLines += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#aaa" stroke-width="0.5"/>`;
        });

        // 데이터 다각형
        const dataPoints = entries.map(([, value], idx) => {
          const angle = -Math.PI / 2 + idx * angleStep;
          const r = (value / maxVal) * maxR;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(' ');

        // 라벨
        let labels = '';
        entries.forEach(([label], idx) => {
          const angle = -Math.PI / 2 + idx * angleStep;
          const labelR = maxR + 15;
          const x = cx + labelR * Math.cos(angle);
          const y = cy + labelR * Math.sin(angle);
          const shortLabel = label.replace('지능', '');
          labels += `<text x="${x}" y="${y}" fill="#333" font-size="7" text-anchor="middle" dominant-baseline="middle">${shortLabel}</text>`;
        });

        return `
          <div style="text-align: center;">
            <p style="font-size: 11px; font-weight: bold; color: #333; margin: 0 0 8px 0;">${title}</p>
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              ${gridLines}
              ${axisLines}
              <polygon points="${dataPoints}" fill="${color}33" stroke="${color}" stroke-width="2"/>
              ${labels}
            </svg>
          </div>
        `;
      };

      // 라운드별 난이도 HTML
      const roundAvgTimes = (stats.roundAvgTimes as Record<number, number>) || {};
      const maxRoundTime = Math.max(...Object.values(roundAvgTimes), 1);
      const roundDifficultyHTML = Object.entries(roundAvgTimes)
        .map(([round, time]) => {
          const pct = (Number(time) / maxRoundTime) * 100;
          return `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="width: 30px; font-weight: bold;">R${round}</span>
            <div style="flex: 1; height: 20px; background: #e5e5e5; border: 1px solid #ccc;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(to right, #f59e0b, #ea580c);"></div>
            </div>
            <span style="width: 50px; text-align: right; font-family: monospace;">${fmtTime(Number(time))}</span>
          </div>`;
        }).join('');

      // 팀별 핵심요약 HTML (새 형식)
      const teamSummaries = (result.teamSummaries as Record<string, { teamId: number; summary: string; intelligenceScores?: Record<string, number>; competencyScores?: Record<string, number> }>) || {};
      const teamSummariesHTML = Object.entries(teamSummaries).map(([teamId, data]) => {
        const intelligenceChart = data.intelligenceScores ? createRadarChartSVG(data.intelligenceScores, '다중지능', '#a78bfa', 130) : '';
        const competencyChart = data.competencyScores ? createRadarChartSVG(data.competencyScores, '핵심역량', '#60a5fa', 150) : '';

        return `
          <div style="background: #f8f9fa; padding: 15px; margin-bottom: 15px; border-left: 4px solid #10b981; page-break-inside: avoid;">
            <h4 style="font-size: 14px; color: #10b981; margin: 0 0 10px 0;">🏷️ ${teamId}조</h4>
            ${(intelligenceChart || competencyChart) ? `
              <div style="display: flex; gap: 20px; margin-bottom: 12px; justify-content: center;">
                ${intelligenceChart}
                ${competencyChart}
              </div>
            ` : ''}
            <p style="font-size: 12px; line-height: 1.6; margin: 0; color: #444; white-space: pre-wrap;">${data.summary}</p>
          </div>
        `;
      }).join('');

      // 종합평가 및 토의 주제 (새 형식)
      const overallEvaluation = (result.overallEvaluation as { insights?: string; discussionTopics?: string[] }) || {};
      const discussionTopicsHTML = (overallEvaluation.discussionTopics || [])
        .map((topic, idx) => `<li style="margin-bottom: 8px;"><span style="color: #8b5cf6; font-weight: bold;">${idx + 1}.</span> ${topic}</li>`)
        .join('');

      // PDF용 깔끔한 HTML 생성
      const container = document.createElement('div');
      container.style.cssText = `position: absolute; left: 0; top: 0; width: 794px; background: white; padding: 30px; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #333; z-index: -1; opacity: 0; pointer-events: none;`;

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 3px solid #f59e0b; padding-bottom: 15px;">
          <h1 style="font-size: 28px; margin: 0; color: #1a1a1a;">AI 종합 성과 분석 리포트</h1>
          <p style="color: #666; margin-top: 5px;">${stats.groupName || ''}</p>
        </div>

        <div style="display: flex; gap: 15px; margin-bottom: 25px;">
          <div style="flex: 1; background: #f0fdf4; padding: 15px; border-left: 4px solid #16a34a; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0;">평균 소요시간</p>
            <p style="font-size: 22px; font-weight: bold; color: #16a34a; margin: 5px 0; font-family: monospace;">${fmtTime(Number(stats.avgTime) || 0)}</p>
          </div>
          <div style="flex: 1; background: #fefce8; padding: 15px; border-left: 4px solid #eab308; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0;">최단 기록</p>
            <p style="font-size: 22px; font-weight: bold; color: #ca8a04; margin: 5px 0; font-family: monospace;">${fmtTime(Number(stats.minTime) || 0)}</p>
          </div>
          <div style="flex: 1; background: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0;">최장 기록</p>
            <p style="font-size: 22px; font-weight: bold; color: #dc2626; margin: 5px 0; font-family: monospace;">${fmtTime(Number(stats.maxTime) || 0)}</p>
          </div>
        </div>

        <div style="background: #fafafa; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e5e5;">
          <h3 style="font-size: 16px; color: #f59e0b; margin: 0 0 15px 0;">📊 라운드별 난이도 (평균 소요시간)</h3>
          ${roundDifficultyHTML}
        </div>

        ${teamSummariesHTML ? `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; color: #10b981; margin: 0 0 15px 0;">📋 팀별 핵심요약</h3>
          ${teamSummariesHTML}
        </div>` : ''}

        ${overallEvaluation.insights ? `
        <div style="background: #eff6ff; padding: 15px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
          <h3 style="font-size: 14px; color: #1d4ed8; margin: 0 0 8px 0;">📈 종합평가</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0; color: #444;">${overallEvaluation.insights}</p>
        </div>` : ''}

        ${discussionTopicsHTML ? `
        <div style="background: #faf5ff; padding: 15px; margin-bottom: 15px; border-left: 4px solid #8b5cf6;">
          <h3 style="font-size: 14px; color: #7c3aed; margin: 0 0 10px 0;">💬 토의 주제 5가지</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #444;">${discussionTopicsHTML}</ul>
        </div>` : ''}
      `;

      document.body.appendChild(container);

      // 짧은 대기 후 렌더링 (SVG 렌더링 보장)
      await new Promise(resolve => setTimeout(resolve, 100));

      // html2canvas로 렌더링
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        onclone: (clonedDoc, element) => {
          // 클론된 요소를 visible하게 설정
          element.style.opacity = '1';
          element.style.position = 'static';
          element.style.zIndex = 'auto';
        }
      });

      document.body.removeChild(container);

      // 캔버스 유효성 체크
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has zero dimensions');
      }

      // PDF 생성
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      let pdfRemainingHeight = scaledHeight;
      let srcY = 0;
      let pageNum = 0;

      while (pdfRemainingHeight > 0) {
        if (pageNum > 0) pdf.addPage();

        const availableHeight = pageHeight - margin * 2;
        const drawHeight = Math.min(availableHeight, pdfRemainingHeight);
        const srcHeight = drawHeight / ratio;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = Math.ceil(srcHeight);
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, drawHeight);
        }

        srcY += srcHeight;
        pdfRemainingHeight -= drawHeight;
        pageNum++;
      }

      pdf.save(`${stats.groupName || '성과분석'}_analysis_report.pdf`);
      if (pdfButton && originalButtonText) pdfButton.textContent = originalButtonText;

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

          {room.missionStarted && (
            <BrutalistButton
              variant="danger"
              onClick={async () => {
                if (window.confirm('정말로 전체 미션을 종료하시겠습니까? 모든 팀의 진행 상황이 초기화됩니다.')) {
                  await firebaseService.endMission(room.id);
                }
              }}
              className="text-sm"
            >
              전체 미션 종료
            </BrutalistButton>
          )}

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
            {/* 2x5 그리드 이벤트 버튼 + 이력 표시 */}
            <div className="grid grid-cols-2 gap-3">
              {EVENTS.map((evt) => {
                const history = room.eventHistory?.[evt.type];
                const isSelected = selectedEventType === evt.type;

                return (
                  <div key={evt.type} className="flex flex-col">
                    <BrutalistButton
                      variant={isSelected ? 'gold' : 'primary'}
                      onClick={() => selectEventType(evt.type)}
                      className={`text-sm py-2 ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      {evt.label}
                    </BrutalistButton>
                    {/* 이벤트별 이력 표시 - 동그라미 + 라벨 */}
                    <div className="flex justify-center items-start gap-1 mt-1 bg-black/30 py-1.5 px-1 rounded">
                      {/* 전체 표시 제거 - 개별 조만 표시 */}
                      {Array.from({ length: room.totalTeams }).map((_, idx) => {
                        const teamId = idx + 1;
                        const team = room.teams?.[teamId];
                        // 현재 해당 팀이 이 이벤트를 진행 중인지
                        const isCurrentlyRunning = team?.currentEvent?.eventType === evt.type;
                        // 과거에 이벤트를 진행했던 대상인지
                        const wasTarget = history && (
                          history.targetTeams === 'all' ||
                          (Array.isArray(history.targetTeams) && history.targetTeams.includes(teamId))
                        );

                        return (
                          <div key={teamId} className="flex flex-col items-center">
                            <span
                              className={`text-sm ${
                                isCurrentlyRunning
                                  ? 'text-red-500'
                                  : wasTarget
                                    ? 'text-yellow-400'
                                    : 'text-gray-500'
                              }`}
                            >
                              ●
                            </span>
                            <span className="text-[8px] text-gray-400">{teamId}조</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 선택된 이벤트 표시 */}
            {selectedEventType && (
              <p className="text-xs text-center text-yellow-400 mt-2">
                선택된 이벤트: {EVENTS.find(e => e.type === selectedEventType)?.label}
              </p>
            )}

            {/* 개별/전체 시작/종료 버튼 */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <BrutalistButton
                variant="primary"
                onClick={startIndividualEvent}
                disabled={!selectedEventType || eventTargetTeam === 'all'}
                className="text-xs py-2"
              >
                개별 EVENT 시작
              </BrutalistButton>
              <BrutalistButton
                variant="ghost"
                onClick={endIndividualEvent}
                disabled={eventTargetTeam === 'all'}
                className="text-xs py-2"
              >
                개별 EVENT 종료
              </BrutalistButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <BrutalistButton
                variant="gold"
                onClick={startAllTeamsEvent}
                disabled={!selectedEventType}
                className="text-xs py-2"
              >
                전체 EVENT 시작
              </BrutalistButton>
              <BrutalistButton
                variant="danger"
                onClick={endAllTeamsEvent}
                className="text-xs py-2"
              >
                전체 EVENT 종료
              </BrutalistButton>
            </div>

            {/* 현재 이벤트 진행 중인 팀 표시 */}
            {(() => {
              const teamsInEvent = firebaseService.getTeamsInEvent(room);
              if (teamsInEvent.length === 0) return null;
              return (
                <div className="text-xs text-center text-red-400 mt-2">
                  현재 진행 중: {teamsInEvent.map(tid => {
                    const team = room.teams?.[tid];
                    const eventLabel = EVENTS.find(e => e.type === team?.currentEvent?.eventType)?.label;
                    return `${tid}조(${eventLabel})`;
                  }).join(', ')}
                </div>
              );
            })()}
          </div>
        </section>

        {/* Column 2: GROUP PHOTOS & MISSION POST */}
        <section className="lg:col-span-1 space-y-4">
          {/* GROUP PHOTOS Section - R5 단체사진 다운로드 */}
          <h2 className="text-2xl font-black italic mt-6">GROUP PHOTOS</h2>
          <BrutalistCard className="space-y-4">
            <p className="text-xs text-gray-400">
              R5 5월 미션에서 업로드된 조별 단체사진을 다운로드할 수 있습니다.
            </p>

            {(() => {
              const groupPhotos = firebaseService.getAllGroupPhotos(room);
              if (groupPhotos.length === 0) {
                return (
                  <p className="text-xs text-yellow-400 text-center py-4">
                    📷 아직 업로드된 단체사진이 없습니다.
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  {groupPhotos.map((photo: GroupPhoto) => (
                    <div key={photo.teamId} className="flex items-center gap-3 p-2 border-2 border-gray-600 bg-gray-800">
                      <img
                        src={photo.downloadUrl}
                        alt={`${photo.teamId}조 단체사진`}
                        className="w-16 h-16 object-cover brutal-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-yellow-400">{photo.teamId}조</p>
                        <p className="text-[10px] text-gray-400 truncate">{photo.fileName}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(photo.uploadedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <a
                        href={photo.downloadUrl}
                        download={photo.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="brutal-border bg-yellow-400 text-black font-bold px-3 py-1 text-xs hover:bg-yellow-300 transition-colors"
                      >
                        📥
                      </a>
                    </div>
                  ))}

                  {/* 전체 다운로드 안내 */}
                  <p className="text-[10px] text-gray-500 text-center mt-2">
                    💡 개별 사진을 클릭하여 다운로드하세요. (파일명: 과정명_#조_연월일시)
                  </p>
                </div>
              );
            })()}
          </BrutalistCard>

          {/* R11 CUSTOMER SERVICE Section */}
          <h2 className="text-2xl font-black italic mt-6">R11 고객응대 기록</h2>
          <BrutalistCard className="space-y-4">
            <p className="text-xs text-gray-400">
              R11 고객응대 시뮬레이션에서 각 팀이 AI 고객과 나눈 대화 내용입니다.
            </p>

            {(() => {
              const teamsWithR11 = Object.entries(room.teams || {})
                .filter(([, team]) => team.r11Feedback?.conversationHistory?.length > 0)
                .map(([teamIdStr, team]) => ({
                  teamId: parseInt(teamIdStr),
                  feedback: team.r11Feedback!
                }));

              if (teamsWithR11.length === 0) {
                return (
                  <p className="text-xs text-yellow-400 text-center py-4">
                    💬 아직 R11 미션을 완료한 팀이 없습니다.
                  </p>
                );
              }

              return (
                <div className="space-y-3">
                  {teamsWithR11.map(({ teamId, feedback }) => (
                    <div key={teamId} className="flex items-center gap-3 p-2 border-2 border-gray-600 bg-gray-800">
                      <div className={`w-12 h-12 flex items-center justify-center brutal-border font-black text-lg ${
                        feedback.overallGrade === 'S' ? 'bg-purple-500' :
                        feedback.overallGrade === 'A' ? 'bg-green-500' :
                        feedback.overallGrade === 'B' ? 'bg-blue-500' :
                        feedback.overallGrade === 'C' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}>
                        {feedback.overallGrade}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-yellow-400">{teamId}조</p>
                        <p className="text-[10px] text-gray-400">{feedback.finalScore}점 | {feedback.completionTime || '-'}</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          대화 {feedback.conversationHistory.length}턴
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedR11TeamId(teamId);
                          setShowR11ConversationModal(true);
                        }}
                        className="brutal-border bg-yellow-400 text-black font-bold px-3 py-1 text-xs hover:bg-yellow-300 transition-colors"
                      >
                        대화보기
                      </button>
                    </div>
                  ))}

                  {/* AI 종합분석 버튼 */}
                  <BrutalistButton
                    variant="gold"
                    fullWidth
                    className="text-xs mt-2"
                    onClick={handleAnalyzeR11CustomerService}
                  >
                    🤖 AI 고객응대 종합분석
                  </BrutalistButton>

                  <p className="text-[10px] text-gray-500 text-center">
                    💡 각 팀의 고객응대 스킬을 AI가 비교 분석합니다.
                  </p>
                </div>
              );
            })()}
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
              <div>
                <label className="block font-bold">산업군 선택</label>
                <select
                  className="w-full brutal-border bg-white text-black p-2 font-bold text-sm mt-1"
                  value={newRoomData.industryType}
                  onChange={(e) => setNewRoomData({...newRoomData, industryType: parseInt(e.target.value) as IndustryType})}
                >
                  {Object.entries(IndustryTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
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

            {/* R11 고객 응대 피드백 */}
            {room.teams[selectedPerformanceTeamId]?.r11Feedback && (
              <div className="border-t border-white/20 pt-4">
                <h3 className="text-xl font-black mb-3 flex items-center gap-2">
                  <span>📊 R11 고객 응대 피드백</span>
                  <span className={`text-lg px-2 py-0.5 rounded ${
                    room.teams[selectedPerformanceTeamId].r11Feedback?.overallGrade === 'S' ? 'bg-purple-600' :
                    room.teams[selectedPerformanceTeamId].r11Feedback?.overallGrade === 'A' ? 'bg-green-600' :
                    room.teams[selectedPerformanceTeamId].r11Feedback?.overallGrade === 'B' ? 'bg-blue-600' :
                    room.teams[selectedPerformanceTeamId].r11Feedback?.overallGrade === 'C' ? 'bg-yellow-600' : 'bg-red-600'
                  }`}>
                    {room.teams[selectedPerformanceTeamId].r11Feedback?.overallGrade}등급
                  </span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-4">
                    <div className="bg-white/10 p-3 brutal-border text-center flex-1">
                      <p className="text-xs text-gray-400">최종 점수</p>
                      <p className="text-2xl font-black">{room.teams[selectedPerformanceTeamId].r11Feedback?.finalScore}점</p>
                    </div>
                    <div className="bg-white/10 p-3 brutal-border text-center flex-1">
                      <p className="text-xs text-gray-400">소요시간</p>
                      <p className="text-lg font-bold">{room.teams[selectedPerformanceTeamId].r11Feedback?.completionTime || '-'}</p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-3 brutal-border">
                    <p className="text-xs text-gray-400 mb-1">AI 종합 평가</p>
                    <p className="text-white">{room.teams[selectedPerformanceTeamId].r11Feedback?.summary}</p>
                  </div>
                  {room.teams[selectedPerformanceTeamId].r11Feedback?.goodPoints && room.teams[selectedPerformanceTeamId].r11Feedback.goodPoints.length > 0 && (
                    <div className="bg-green-900/30 p-3 brutal-border border-green-500/50">
                      <p className="text-xs text-green-400 mb-1">✅ 잘한 점</p>
                      {room.teams[selectedPerformanceTeamId].r11Feedback?.goodPoints.map((point, idx) => (
                        <p key={idx} className="text-green-300 text-xs">• {point}</p>
                      ))}
                    </div>
                  )}
                  {room.teams[selectedPerformanceTeamId].r11Feedback?.improvementPoints && room.teams[selectedPerformanceTeamId].r11Feedback.improvementPoints.length > 0 && (
                    <div className="bg-orange-900/30 p-3 brutal-border border-orange-500/50">
                      <p className="text-xs text-orange-400 mb-1">💡 개선점</p>
                      {room.teams[selectedPerformanceTeamId].r11Feedback?.improvementPoints.map((point, idx) => (
                        <p key={idx} className="text-orange-300 text-xs">• {point}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  <BrutalistButton variant="gold" onClick={handleDownloadAnalysisPDF} className="text-sm" data-pdf-button>
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
              <div id="analysis-pdf-content" className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                </div>

                {/* Team Round Times Table & Chart */}
                <BrutalistCard>
                  <h3 className="text-lg font-black mb-4 text-yellow-400">📊 팀별 라운드 소요시간</h3>

                  {/* Table */}
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-yellow-400/20">
                          <th className="border border-gray-600 p-2 text-left">팀</th>
                          {Array.from({ length: 12 }, (_, i) => (
                            <th key={i + 1} className="border border-gray-600 p-1 text-center">R{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {((analysisStats as Record<string, unknown>).performances as Array<{ teamId: number; teamName: string; roundTimes: Record<number, number> }> || []).map((perf) => (
                          <tr key={perf.teamId} className="hover:bg-white/5">
                            <td className="border border-gray-600 p-2 font-bold">{perf.teamId}조</td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const time = perf.roundTimes[i + 1] || 0;
                              return (
                                <td key={i + 1} className="border border-gray-600 p-1 text-center font-mono text-[10px]">
                                  {time > 0 ? formatTime(time) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bar Chart by Round */}
                  <h4 className="text-sm font-bold mb-3 text-gray-400">라운드별 평균 소요시간</h4>
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

                {/* Team Summaries */}
                {(analysisResult as Record<string, unknown>).teamSummaries && (
                  <BrutalistCard className="border-yellow-400">
                    <h3 className="text-lg font-black mb-4 text-yellow-400">📋 팀별 핵심요약</h3>
                    <div className="space-y-4">
                      {Object.entries((analysisResult as Record<string, unknown>).teamSummaries as Record<string, { teamId: number; summary: string; intelligenceScores?: Record<string, number>; competencyScores?: Record<string, number> }>).map(([teamId, data]) => (
                        <div key={teamId} className="bg-black/30 p-4 brutal-border">
                          <h4 className="text-md font-black text-green-400 mb-2">🏷️ {teamId}조</h4>

                          {/* 레이더차트 */}
                          {(data.intelligenceScores || data.competencyScores) && (
                            <div className="flex flex-wrap gap-6 mb-4 justify-center">
                              {/* 다중지능 레이더차트 */}
                              {data.intelligenceScores && Object.keys(data.intelligenceScores).length > 0 && (
                                <div className="text-center">
                                  <p className="text-xs font-bold text-purple-400 mb-2">다중지능</p>
                                  <svg width="160" height="160" viewBox="0 0 160 160">
                                    {(() => {
                                      const scores = data.intelligenceScores!;
                                      const entries = Object.entries(scores);
                                      const n = entries.length;
                                      if (n === 0) return null;

                                      const cx = 80, cy = 80, maxR = 50;
                                      const angleStep = (2 * Math.PI) / n;

                                      // 배경 그리드 (5단계)
                                      const gridLines = [0.2, 0.4, 0.6, 0.8, 1].map((scale, gridIdx) => {
                                        const points = entries.map((_, idx) => {
                                          const angle = -Math.PI / 2 + idx * angleStep;
                                          const r = maxR * scale;
                                          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                                        }).join(' ');
                                        return <polygon key={gridIdx} points={points} fill="none" stroke="#444" strokeWidth="0.5" />;
                                      });

                                      // 축 선
                                      const axisLines = entries.map((_, idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const x2 = cx + maxR * Math.cos(angle);
                                        const y2 = cy + maxR * Math.sin(angle);
                                        return <line key={idx} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#555" strokeWidth="0.5" />;
                                      });

                                      // 데이터 다각형
                                      const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                                      const dataPoints = entries.map(([, value], idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const r = (value / maxVal) * maxR;
                                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                                      }).join(' ');

                                      // 라벨
                                      const labels = entries.map(([label], idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const labelR = maxR + 18;
                                        const x = cx + labelR * Math.cos(angle);
                                        const y = cy + labelR * Math.sin(angle);
                                        return (
                                          <text key={idx} x={x} y={y} fill="#a78bfa" fontSize="8" textAnchor="middle" dominantBaseline="middle">
                                            {label.replace('지능', '')}
                                          </text>
                                        );
                                      });

                                      return (
                                        <>
                                          {gridLines}
                                          {axisLines}
                                          <polygon points={dataPoints} fill="rgba(167, 139, 250, 0.3)" stroke="#a78bfa" strokeWidth="2" />
                                          {labels}
                                        </>
                                      );
                                    })()}
                                  </svg>
                                </div>
                              )}

                              {/* 핵심역량 레이더차트 */}
                              {data.competencyScores && Object.keys(data.competencyScores).length > 0 && (
                                <div className="text-center">
                                  <p className="text-xs font-bold text-blue-400 mb-2">핵심역량</p>
                                  <svg width="180" height="180" viewBox="0 0 180 180">
                                    {(() => {
                                      const scores = data.competencyScores!;
                                      const entries = Object.entries(scores);
                                      const n = entries.length;
                                      if (n === 0) return null;

                                      const cx = 90, cy = 90, maxR = 55;
                                      const angleStep = (2 * Math.PI) / n;

                                      // 배경 그리드 (5단계)
                                      const gridLines = [0.2, 0.4, 0.6, 0.8, 1].map((scale, gridIdx) => {
                                        const points = entries.map((_, idx) => {
                                          const angle = -Math.PI / 2 + idx * angleStep;
                                          const r = maxR * scale;
                                          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                                        }).join(' ');
                                        return <polygon key={gridIdx} points={points} fill="none" stroke="#444" strokeWidth="0.5" />;
                                      });

                                      // 축 선
                                      const axisLines = entries.map((_, idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const x2 = cx + maxR * Math.cos(angle);
                                        const y2 = cy + maxR * Math.sin(angle);
                                        return <line key={idx} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#555" strokeWidth="0.5" />;
                                      });

                                      // 데이터 다각형
                                      const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                                      const dataPoints = entries.map(([, value], idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const r = (value / maxVal) * maxR;
                                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                                      }).join(' ');

                                      // 라벨
                                      const labels = entries.map(([label], idx) => {
                                        const angle = -Math.PI / 2 + idx * angleStep;
                                        const labelR = maxR + 22;
                                        const x = cx + labelR * Math.cos(angle);
                                        const y = cy + labelR * Math.sin(angle);
                                        return (
                                          <text key={idx} x={x} y={y} fill="#60a5fa" fontSize="7" textAnchor="middle" dominantBaseline="middle">
                                            {label}
                                          </text>
                                        );
                                      });

                                      return (
                                        <>
                                          {gridLines}
                                          {axisLines}
                                          <polygon points={dataPoints} fill="rgba(96, 165, 250, 0.3)" stroke="#60a5fa" strokeWidth="2" />
                                          {labels}
                                        </>
                                      );
                                    })()}
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {data.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </BrutalistCard>
                )}

                {/* Overall Evaluation */}
                {(analysisResult as Record<string, unknown>).overallEvaluation && (
                  <>
                    <BrutalistCard>
                      <h3 className="text-lg font-black mb-2 text-blue-400">📈 종합평가</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {String(((analysisResult as Record<string, unknown>).overallEvaluation as Record<string, unknown>).insights || '')}
                      </p>
                    </BrutalistCard>

                    {/* Discussion Topics */}
                    {(((analysisResult as Record<string, unknown>).overallEvaluation as Record<string, unknown>).discussionTopics as string[])?.length > 0 && (
                      <BrutalistCard className="border-purple-400">
                        <h3 className="text-lg font-black mb-3 text-purple-400">💬 토의 주제 5가지</h3>
                        <ul className="space-y-3">
                          {(((analysisResult as Record<string, unknown>).overallEvaluation as Record<string, unknown>).discussionTopics as string[]).map((topic, idx) => (
                            <li key={idx} className="text-sm text-gray-300 flex gap-2 bg-purple-900/20 p-3 brutal-border">
                              <span className="text-purple-400 font-bold">{idx + 1}.</span>
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </BrutalistCard>
                    )}
                  </>
                )}
              </div>
            )}
          </BrutalistCard>
        </div>
      )}

      {/* R11 Conversation Modal - 개별 팀 대화 보기 */}
      {showR11ConversationModal && selectedR11TeamId && room.teams[selectedR11TeamId]?.r11Feedback && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto">
          <BrutalistCard className="max-w-2xl w-full space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center sticky top-0 bg-black/90 pb-4 -mt-2 pt-2">
              <h2 className="text-2xl font-black gold-gradient">
                {selectedR11TeamId}조 고객응대 대화
              </h2>
              <BrutalistButton variant="ghost" onClick={() => setShowR11ConversationModal(false)}>닫기</BrutalistButton>
            </div>

            {/* 요약 정보 */}
            <div className="flex gap-4 mb-4">
              <div className={`px-4 py-2 brutal-border font-black text-center ${
                room.teams[selectedR11TeamId].r11Feedback?.overallGrade === 'S' ? 'bg-purple-500' :
                room.teams[selectedR11TeamId].r11Feedback?.overallGrade === 'A' ? 'bg-green-500' :
                room.teams[selectedR11TeamId].r11Feedback?.overallGrade === 'B' ? 'bg-blue-500' :
                room.teams[selectedR11TeamId].r11Feedback?.overallGrade === 'C' ? 'bg-yellow-500' : 'bg-red-500'
              }`}>
                <p className="text-2xl">{room.teams[selectedR11TeamId].r11Feedback?.overallGrade}등급</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">최종 점수: <span className="text-white font-bold">{room.teams[selectedR11TeamId].r11Feedback?.finalScore}점</span></p>
                <p className="text-sm text-gray-400">소요시간: <span className="text-white font-bold">{room.teams[selectedR11TeamId].r11Feedback?.completionTime || '-'}</span></p>
              </div>
            </div>

            {/* 대화 내용 */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-yellow-400 uppercase">대화 기록</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto p-2 bg-gray-900 brutal-border">
                {room.teams[selectedR11TeamId].r11Feedback?.conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 brutal-border ${
                      msg.role === 'user'
                        ? 'bg-blue-900/50 ml-4 border-blue-500'
                        : 'bg-gray-800 mr-4 border-gray-600'
                    }`}
                  >
                    <p className={`text-xs font-bold mb-1 ${msg.role === 'user' ? 'text-blue-400' : 'text-gray-400'}`}>
                      {msg.role === 'user' ? '👤 직원 (학습자)' : '😠 고객 (AI)'}
                    </p>
                    <p className="text-sm text-white">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 피드백 요약 */}
            {room.teams[selectedR11TeamId].r11Feedback?.summary && (
              <div className="bg-white/10 p-4 brutal-border">
                <h3 className="text-sm font-black text-green-400 mb-2">AI 평가 요약</h3>
                <p className="text-sm text-gray-300">{room.teams[selectedR11TeamId].r11Feedback?.summary}</p>
              </div>
            )}
          </BrutalistCard>
        </div>
      )}

      {/* R11 Analysis Modal - AI 고객응대 종합분석 */}
      {showR11AnalysisModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 overflow-auto">
          <BrutalistCard className="max-w-4xl w-full space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center sticky top-0 bg-black/90 pb-4 -mt-2 pt-2">
              <h2 className="text-3xl font-black uppercase gold-gradient">AI 고객응대 종합분석</h2>
              <BrutalistButton variant="ghost" onClick={() => setShowR11AnalysisModal(false)}>닫기</BrutalistButton>
            </div>

            {r11AnalysisLoading && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4 animate-bounce">🤖</div>
                <p className="text-xl font-bold text-yellow-400">AI가 고객응대 대화를 분석하고 있습니다...</p>
                <p className="text-sm text-gray-400 mt-2">각 팀의 응대 스킬을 비교 분석 중입니다.</p>
              </div>
            )}

            {r11AnalysisError && (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">❌</div>
                <p className="text-xl font-bold text-red-400">분석 중 오류가 발생했습니다</p>
                <p className="text-sm text-gray-400 mt-2">{r11AnalysisError}</p>
                <BrutalistButton variant="primary" className="mt-4" onClick={handleAnalyzeR11CustomerService}>
                  다시 시도
                </BrutalistButton>
              </div>
            )}

            {r11AnalysisResult && r11AnalysisStats && (
              <div className="space-y-6">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <BrutalistCard className="text-center bg-gradient-to-br from-green-900/50 to-green-700/30">
                    <p className="text-xs text-gray-400 uppercase">평균 점수</p>
                    <p className="text-3xl font-black text-green-400">
                      {((r11AnalysisStats as Record<string, unknown>).avgScore as number)?.toFixed(1)}점
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-yellow-900/50 to-yellow-700/30">
                    <p className="text-xs text-gray-400 uppercase">최고 점수</p>
                    <p className="text-3xl font-black text-yellow-400">
                      {(r11AnalysisStats as Record<string, unknown>).maxScore as number}점
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-red-900/50 to-red-700/30">
                    <p className="text-xs text-gray-400 uppercase">최저 점수</p>
                    <p className="text-3xl font-black text-red-400">
                      {(r11AnalysisStats as Record<string, unknown>).minScore as number}점
                    </p>
                  </BrutalistCard>
                  <BrutalistCard className="text-center bg-gradient-to-br from-purple-900/50 to-purple-700/30">
                    <p className="text-xs text-gray-400 uppercase">참여 팀</p>
                    <p className="text-3xl font-black text-purple-400">
                      {(r11AnalysisStats as Record<string, unknown>).totalTeams as number}팀
                    </p>
                  </BrutalistCard>
                </div>

                {/* 전체 분석 */}
                {(r11AnalysisResult as Record<string, unknown>).overallAnalysis && (
                  <BrutalistCard className="border-yellow-400">
                    <h3 className="text-lg font-black mb-3 text-yellow-400">📊 종합 평가</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {String(((r11AnalysisResult as Record<string, unknown>).overallAnalysis as Record<string, unknown>).summary || '')}
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-green-900/30 p-3 brutal-border border-green-500/50">
                        <p className="text-xs text-green-400 mb-2 font-bold">✅ 공통 강점</p>
                        {(((r11AnalysisResult as Record<string, unknown>).overallAnalysis as Record<string, unknown>).commonStrengths as string[] || []).map((point, idx) => (
                          <p key={idx} className="text-xs text-green-300">• {point}</p>
                        ))}
                      </div>
                      <div className="bg-orange-900/30 p-3 brutal-border border-orange-500/50">
                        <p className="text-xs text-orange-400 mb-2 font-bold">💡 공통 개선점</p>
                        {(((r11AnalysisResult as Record<string, unknown>).overallAnalysis as Record<string, unknown>).commonWeaknesses as string[] || []).map((point, idx) => (
                          <p key={idx} className="text-xs text-orange-300">• {point}</p>
                        ))}
                      </div>
                    </div>
                  </BrutalistCard>
                )}

                {/* 팀별 비교 */}
                {(r11AnalysisResult as Record<string, unknown>).teamComparison && (
                  <BrutalistCard>
                    <h3 className="text-lg font-black mb-4 text-blue-400">🏆 팀별 분석</h3>
                    <div className="space-y-4">
                      {((r11AnalysisResult as Record<string, unknown>).teamComparison as Array<{ teamId: number; rank: number; highlights: string; improvements: string; bestMoment: string }>).map((team) => (
                        <div key={team.teamId} className="bg-black/30 p-4 brutal-border">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl font-black text-yellow-400">#{team.rank}</span>
                            <span className="text-lg font-black text-white">{team.teamId}조</span>
                          </div>
                          <div className="space-y-2">
                            <div className="bg-green-900/20 p-2 brutal-border">
                              <p className="text-xs text-green-400 font-bold mb-1">🌟 빛났던 점</p>
                              <p className="text-xs text-gray-300">{team.highlights}</p>
                            </div>
                            <div className="bg-blue-900/20 p-2 brutal-border">
                              <p className="text-xs text-blue-400 font-bold mb-1">💬 인상적인 순간</p>
                              <p className="text-xs text-gray-300 italic">"{team.bestMoment}"</p>
                            </div>
                            <div className="bg-orange-900/20 p-2 brutal-border">
                              <p className="text-xs text-orange-400 font-bold mb-1">📈 개선 포인트</p>
                              <p className="text-xs text-gray-300">{team.improvements}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </BrutalistCard>
                )}

                {/* 베스트 프랙티스 */}
                {(r11AnalysisResult as Record<string, unknown>).bestPractices && (
                  <BrutalistCard className="border-green-400">
                    <h3 className="text-lg font-black mb-3 text-green-400">⭐ 베스트 프랙티스</h3>
                    <ul className="space-y-2">
                      {((r11AnalysisResult as Record<string, unknown>).bestPractices as string[]).map((practice, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex gap-2 bg-green-900/20 p-3 brutal-border">
                          <span className="text-green-400 font-bold">{idx + 1}.</span>
                          <span>{practice}</span>
                        </li>
                      ))}
                    </ul>
                  </BrutalistCard>
                )}

                {/* 토의 주제 */}
                {(r11AnalysisResult as Record<string, unknown>).discussionTopics && (
                  <BrutalistCard className="border-purple-400">
                    <h3 className="text-lg font-black mb-3 text-purple-400">💬 토의 주제</h3>
                    <ul className="space-y-2">
                      {((r11AnalysisResult as Record<string, unknown>).discussionTopics as string[]).map((topic, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex gap-2 bg-purple-900/20 p-3 brutal-border">
                          <span className="text-purple-400 font-bold">{idx + 1}.</span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </BrutalistCard>
                )}

                {/* 격려 메시지 */}
                {(r11AnalysisResult as Record<string, unknown>).encouragement && (
                  <div className="text-center p-6 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 brutal-border border-yellow-400">
                    <p className="text-lg font-bold text-yellow-400">
                      🎉 {String((r11AnalysisResult as Record<string, unknown>).encouragement)}
                    </p>
                  </div>
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
