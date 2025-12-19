// Canvas 기반 인포그래픽 생성기 - 완벽한 한글 지원

import { jsPDF } from 'jspdf';

interface ReportData {
  oneLine: string;
  bestMission: string;
  regret: string;
  futureHelp: string;
}

// 텍스트 줄바꿈 헬퍼
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// 그라데이션 배경 그리기
function drawGradientBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 장식 요소 - 골드 라인
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, 40);
  ctx.lineTo(width - 40, 40);
  ctx.lineTo(width - 40, height - 40);
  ctx.lineTo(40, height - 40);
  ctx.closePath();
  ctx.stroke();

  // 코너 장식
  const cornerSize = 30;
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(30, 30, cornerSize, 8);
  ctx.fillRect(30, 30, 8, cornerSize);
  ctx.fillRect(width - 30 - cornerSize, 30, cornerSize, 8);
  ctx.fillRect(width - 38, 30, 8, cornerSize);
  ctx.fillRect(30, height - 38, cornerSize, 8);
  ctx.fillRect(30, height - 30 - cornerSize, 8, cornerSize);
  ctx.fillRect(width - 30 - cornerSize, height - 38, cornerSize, 8);
  ctx.fillRect(width - 38, height - 30 - cornerSize, 8, cornerSize);
}

// 섹션 박스 그리기
function drawSectionBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  content: string,
  accentColor: string
) {
  // 박스 배경
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(x, y, width, height);

  // 왼쪽 강조 바
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y, 6, height);

  // 제목
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 22px "Noto Sans KR", "Malgun Gothic", sans-serif';
  ctx.fillText(title, x + 20, y + 32);

  // 내용
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px "Noto Sans KR", "Malgun Gothic", sans-serif';
  const lines = wrapText(ctx, content, width - 40);
  let lineY = y + 60;
  for (const line of lines.slice(0, 5)) { // 최대 5줄
    ctx.fillText(line, x + 20, lineY);
    lineY += 28;
  }
  if (lines.length > 5) {
    ctx.fillStyle = '#888888';
    ctx.fillText('...', x + 20, lineY);
  }
}

export async function generateReportInfographic(
  report: ReportData,
  teamId: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 3:4 비율 (750x1000)
      const width = 750;
      const height = 1000;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 폰트 로드 대기
      document.fonts.ready.then(() => {
        // 배경
        drawGradientBackground(ctx, width, height);

        // 헤더
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 42px "Noto Sans KR", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`TEAM ${teamId}`, width / 2, 100);

        ctx.font = 'bold 28px "Noto Sans KR", "Malgun Gothic", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('팀활동 결과보고서', width / 2, 145);

        // 구분선
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(100, 175);
        ctx.lineTo(width - 100, 175);
        ctx.stroke();

        ctx.textAlign = 'left';

        // 섹션들
        const sectionHeight = 170;
        const sectionWidth = width - 120;
        const startX = 60;
        let currentY = 200;

        // 1. 한줄 소감
        drawSectionBox(ctx, startX, currentY, sectionWidth, sectionHeight,
          '💬 오늘의 한줄 소감', report.oneLine, '#ff6b6b');
        currentY += sectionHeight + 20;

        // 2. 가장 빛났던 미션
        drawSectionBox(ctx, startX, currentY, sectionWidth, sectionHeight,
          '⭐ 가장 빛났던 미션', report.bestMission, '#ffd700');
        currentY += sectionHeight + 20;

        // 3. 아쉬웠던 점
        drawSectionBox(ctx, startX, currentY, sectionWidth, sectionHeight,
          '💭 아쉬웠던 점과 다짐', report.regret, '#4ecdc4');
        currentY += sectionHeight + 20;

        // 4. 현업 도움
        drawSectionBox(ctx, startX, currentY, sectionWidth, sectionHeight,
          '🚀 현업에 도움이 될 점', report.futureHelp, '#a855f7');

        // 푸터
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px "Noto Sans KR", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        ctx.fillText(`김부장의 복귀 프로젝트 | ${dateStr}`, width / 2, height - 60);

        // Canvas를 데이터 URL로 변환
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        resolve(dataUrl);
      }).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

// 역할명 영문 변환 맵 (실제 앱에서 사용하는 모든 역할명 포함)
const roleNameMap: Record<string, string> = {
  // 메인 역할
  '팀장': 'Team Leader',
  '서기': 'Secretary',
  '타임키퍼': 'Timekeeper',
  '발표자': 'Presenter',
  '아이디어뱅크': 'Idea Bank',
  '응원단장': 'Cheerleader',
  // constants.ts의 ROLES
  '리더 (김부장)': 'Leader',
  '전략가': 'Strategist',
  '시간관리자': 'Timekeeper',
  '협상가': 'Negotiator',
  '기록자': 'Recorder',
  '지지자': 'Supporter',
  // 기타 가능한 역할명
  '리더': 'Leader',
  '부리더': 'Sub-Leader',
  '팀원': 'Member'
};

// PDF 생성을 위한 유틸리티 (jsPDF 기본 폰트는 한글 미지원 - 영문으로 출력)
export async function generateResultPDF(
  teamId: number,
  performance: {
    rank: number;
    totalRanks: number;
    totalTime: number;
    totalTimeWithBonus: number;
    roundTimes: Record<number, number>;
  },
  members: Array<{ role: string; name: string }>,
  reportImageData?: string
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  pdf.setFont('helvetica');

  // 제목 (영문)
  pdf.setFontSize(24);
  pdf.setTextColor(40, 40, 40);
  pdf.text(`TEAM ${teamId} - Result Report`, pageWidth / 2, y, { align: 'center' });
  y += 20;

  // 구분선
  pdf.setDrawColor(255, 215, 0);
  pdf.setLineWidth(1);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 15;

  // 팀 성과 분석
  pdf.setFontSize(16);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Team Performance Analysis', margin, y);
  y += 10;

  pdf.setFontSize(12);
  pdf.setTextColor(80, 80, 80);

  const formatTimeForPDF = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  pdf.text(`Rank: #${performance.rank} / ${performance.totalRanks} teams`, margin, y);
  y += 8;
  pdf.text(`Total Time: ${formatTimeForPDF(performance.totalTimeWithBonus)}`, margin, y);
  y += 8;
  pdf.text(`Pure Mission Time: ${formatTimeForPDF(performance.totalTime)}`, margin, y);
  y += 15;

  // 라운드별 소요시간
  pdf.setFontSize(14);
  pdf.text('Round Times', margin, y);
  y += 8;

  pdf.setFontSize(10);
  const roundsPerRow = 6;
  for (let i = 1; i <= 12; i++) {
    const time = performance.roundTimes[i];
    const col = ((i - 1) % roundsPerRow);
    const row = Math.floor((i - 1) / roundsPerRow);
    const x = margin + col * 28;
    const rowY = y + row * 12;
    pdf.text(`R${i}: ${time ? formatTimeForPDF(time) : '-'}`, x, rowY);
  }
  y += 30;

  // 팀 역할 (완전 영문으로 - 한글 역할명을 영문으로 변환, 매칭 안되면 Role N으로 표시)
  pdf.setFontSize(14);
  pdf.text('Team Members', margin, y);
  y += 8;

  pdf.setFontSize(10);
  members.forEach((member, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + col * 55;
    const rowY = y + row * 8;
    // 한글 역할명을 영문으로 변환, 매칭 안되면 Role N으로 표시
    const englishRole = roleNameMap[member.role] || `Role ${idx + 1}`;
    pdf.text(`${englishRole}: Member ${idx + 1}`, x, rowY);
  });
  y += Math.ceil(members.length / 3) * 8 + 15;

  // 인포그래픽 이미지 추가
  if (reportImageData) {
    // 새 페이지 추가
    pdf.addPage();

    pdf.setFontSize(14);
    pdf.text('Team Activity Report (AI Generated)', margin, 20);

    // 이미지 크기 계산 (3:4 비율 유지, 페이지에 맞게)
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = 250;
    const imgWidth = Math.min(maxWidth, maxHeight * 0.75);
    const imgHeight = imgWidth / 0.75;

    const imgX = (pageWidth - imgWidth) / 2;
    pdf.addImage(reportImageData, 'PNG', imgX, 30, imgWidth, imgHeight);
  }

  // PDF Blob 반환
  return pdf.output('blob');
}
