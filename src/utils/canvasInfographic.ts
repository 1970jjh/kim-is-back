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

// PDF 생성을 위한 유틸리티 (html2canvas로 한글 완벽 지원)
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
  const html2canvas = (await import('html2canvas')).default;

  const formatTimeForPDF = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // HTML 컨텐츠 생성
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 794px;
    background: white;
    padding: 40px;
    font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
  `;

  // 라운드 시간 HTML 생성
  const roundTimesHTML = Array.from({ length: 12 }, (_, i) => {
    const roundNum = i + 1;
    const time = performance.roundTimes[roundNum];
    return `<div style="width: 80px; text-align: center; padding: 4px;">
      <span style="font-weight: bold;">R${roundNum}:</span> ${time ? formatTimeForPDF(time) : '-'}
    </div>`;
  }).join('');

  // 멤버 HTML 생성 (한글 역할과 이름 사용)
  const membersHTML = members.map(member => `
    <div style="width: 180px; padding: 8px 0;">
      <span style="color: #d4a600; font-weight: bold;">${member.role}:</span> ${member.name || '미지정'}
    </div>
  `).join('');

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="font-size: 32px; margin: 0; color: #333;">TEAM ${teamId} - 결과 보고서</h1>
      <div style="height: 4px; background: linear-gradient(to right, #ffd700, #ffaa00); margin: 20px auto; width: 80%;"></div>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 20px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 8px;">📊 팀 성과 분석</h2>
      <div style="display: flex; gap: 30px; margin-top: 15px; font-size: 16px; color: #555;">
        <div><strong>순위:</strong> #${performance.rank} / ${performance.totalRanks}팀</div>
        <div><strong>총 소요시간:</strong> ${formatTimeForPDF(performance.totalTimeWithBonus)}</div>
        <div><strong>순수 미션시간:</strong> ${formatTimeForPDF(performance.totalTime)}</div>
      </div>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 20px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 8px;">⏱️ 라운드별 소요시간</h2>
      <div style="display: flex; flex-wrap: wrap; margin-top: 15px; font-size: 14px; color: #555;">
        ${roundTimesHTML}
      </div>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 20px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 8px;">👥 팀 구성원</h2>
      <div style="display: flex; flex-wrap: wrap; margin-top: 15px; font-size: 14px; color: #555;">
        ${membersHTML}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // html2canvas로 첫 페이지 렌더링
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_clonedDoc, element) => {
        // 클론된 요소를 visible하게 설정
        element.style.opacity = '1';
        element.style.position = 'static';
        element.style.zIndex = 'auto';
      }
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 첫 페이지 이미지 추가
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));

    // 인포그래픽 이미지 추가 (2페이지)
    if (reportImageData) {
      pdf.addPage();

      // 이미지 크기 계산 (3:4 비율 유지)
      const maxWidth = pageWidth - 40;
      const maxHeight = pageHeight - 40;
      let imgW = maxWidth;
      let imgH = imgW / 0.75;

      if (imgH > maxHeight) {
        imgH = maxHeight;
        imgW = imgH * 0.75;
      }

      const imgX = (pageWidth - imgW) / 2;
      const imgY = (pageHeight - imgH) / 2;
      pdf.addImage(reportImageData, 'PNG', imgX, imgY, imgW, imgH);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}
