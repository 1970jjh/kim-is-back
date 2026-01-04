import React, { useRef, useEffect, useState, useCallback } from 'react';

// Game Types
enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  BATON = 'BATON',
  SUCCESS = 'SUCCESS',
  GAMEOVER = 'GAMEOVER'
}

enum EntityType {
  OBSTACLE_CAR_FAST = 'OBSTACLE_CAR_FAST',
  OBSTACLE_CAR_SLOW = 'OBSTACLE_CAR_SLOW',
  OBSTACLE_WALL = 'OBSTACLE_WALL',
  ITEM_FUEL = 'ITEM_FUEL',
  ITEM_BOOST = 'ITEM_BOOST',
  ITEM_SHIELD = 'ITEM_SHIELD'
}

interface GameEntity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  label: string;
  color: string;
}

interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  fuel: number;
  shield: boolean;
  boostTimer: number;
}

interface GameStats {
  round: number;
  totalDistance: number;
  currentDistance: number;
  timeLeft: number;
  obstaclesHit: string[];
  roundTimes: number[];
  obstaclesAvoided: number;
  fuelItemsCollected: number;
}

// Constants
const TOTAL_PLAYERS = 6;
const INITIAL_TIME_LIMIT = 360; // 6분 (팀당 1분)
const MAX_FUEL = 100;
const DISTANCE_PER_ROUND = 12000; // 라운드당 거리
const ROAD_WIDTH_PERCENT = 0.65;

// 부정적 요소 (장애물)
const OBSTACLES_HUMAN = [
  "비꼬기", "말 자르기", "감정적 비난", "무시하기", "편견",
  "비아냥", "일방적 훈수", "고집불통", "공로 가로채기", "냉소적 태도"
];

const OBSTACLES_WORK = [
  "정보 독점", "책임 회피", "독단적 결정", "불투명한 공유", "비협조",
  "성과 가로채기", "불명확한 R&R", "피드백 거부", "업무 지연", "마감 임박"
];

const OBSTACLES_CULTURE = [
  "수직적 권위", "눈치 문화", "정치질", "형식주의", "꼰대 문화",
  "사일로 현상", "무사안일", "변화 기피", "창의성 억압", "경직된 분위기"
];

// 긍정적 요소 (아이템)
const ITEMS_ENERGY = ["충전에너지", "활력", "열정", "집중력", "긍정 마인드"];
const ITEMS_SHIELD = ["방패", "신뢰", "심리적 안전", "동료 지지", "팀워크"];
const ITEMS_BOOST = ["번개", "시너지", "협업 파워", "집단 지성", "추진력"];

const PLAYER_NAMES = ["팀장", "전략가", "시간관리자", "협상가", "기록자", "지지자"];

const THEMES = [
  { name: '숲길', bg: '#064e3b', grass: '#065f46', horizon: '#022c22' },
  { name: '도심', bg: '#1e293b', grass: '#334155', horizon: '#0f172a' },
  { name: '해안도로', bg: '#0c4a6e', grass: '#075985', horizon: '#082f49' },
  { name: '시골길', bg: '#831843', grass: '#9d174d', horizon: '#500724' },
  { name: '산악도로', bg: '#7c2d12', grass: '#9a3412', horizon: '#431407' },
  { name: '본사 진입', bg: '#1e1b4b', grass: '#312e81', horizon: '#0a0a23' }
];

interface RelayRacingGameProps {
  teamMembers: Array<{ role: string; name: string }>;
  onComplete: (stats: GameStats) => void;
  onCancel: () => void;
}

const RelayRacingGame: React.FC<RelayRacingGameProps> = ({ teamMembers, onComplete, onCancel }) => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({
    round: 1,
    totalDistance: 0,
    currentDistance: 0,
    timeLeft: INITIAL_TIME_LIMIT,
    obstaclesHit: [],
    roundTimes: [],
    obstaclesAvoided: 0,
    fuelItemsCollected: 0
  });

  const [lastRoundTimeLeft, setLastRoundTimeLeft] = useState(INITIAL_TIME_LIMIT);
  const timerRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerRef.current = window.setInterval(() => {
        setStats(prev => {
          if (prev.timeLeft <= 0) {
            setGameState(GameState.GAMEOVER);
            return prev;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState]);

  const handleStart = () => {
    setGameState(GameState.PLAYING);
  };

  const handleBatonTouch = () => {
    if (stats.round >= TOTAL_PLAYERS) {
      setGameState(GameState.SUCCESS);
    } else {
      setGameState(GameState.PLAYING);
      setStats(prev => ({
        ...prev,
        round: prev.round + 1,
        currentDistance: 0
      }));
    }
  };

  const handleRoundComplete = () => {
    const timeTaken = lastRoundTimeLeft - stats.timeLeft;
    setStats(prev => ({
      ...prev,
      roundTimes: [...prev.roundTimes, timeTaken],
      totalDistance: prev.totalDistance + DISTANCE_PER_ROUND
    }));
    setLastRoundTimeLeft(stats.timeLeft);
    setGameState(GameState.BATON);
  };

  const handleGameOver = () => {
    setGameState(GameState.GAMEOVER);
  };

  const handleRetry = (fullReset: boolean) => {
    if (fullReset) {
      setStats({
        round: 1,
        totalDistance: 0,
        currentDistance: 0,
        timeLeft: INITIAL_TIME_LIMIT,
        obstaclesHit: [],
        roundTimes: [],
        obstaclesAvoided: 0,
        fuelItemsCollected: 0
      });
      setLastRoundTimeLeft(INITIAL_TIME_LIMIT);
      setGameState(GameState.PLAYING);
    } else {
      setStats(prev => ({ ...prev, currentDistance: 0 }));
      setGameState(GameState.PLAYING);
    }
  };

  const handleSuccess = () => {
    onComplete(stats);
  };

  const getPlayerName = (round: number) => {
    if (teamMembers && teamMembers[round - 1]) {
      return `${teamMembers[round - 1].name} (${teamMembers[round - 1].role})`;
    }
    return PLAYER_NAMES[round - 1] || `주자 ${round}`;
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-slate-900 text-white">
      {/* START Screen */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950">
          <div className="mb-2 uppercase tracking-[0.3em] text-blue-400 text-xs font-black animate-pulse">Team Mission: HQ Arrival</div>
          <h1 className="text-3xl md:text-5xl font-black mb-1 text-white italic">
            THE LAST <span className="text-blue-500">MILE</span>
          </h1>
          <h2 className="text-lg md:text-xl font-light mb-8 tracking-widest text-slate-400">RELAY RACING</h2>

          <div className="bg-slate-800/80 p-6 rounded-xl max-w-lg w-full border border-white/10 shadow-2xl">
            <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
              MISSION BRIEFING
            </h3>
            <div className="space-y-3 text-slate-300 text-sm">
              <p className="flex gap-3">
                <span className="text-blue-500 font-bold">01</span>
                <span>6명의 팀원이 릴레이로 주행하여 본사에 도착하세요.</span>
              </p>
              <p className="flex gap-3">
                <span className="text-blue-500 font-bold">02</span>
                <span>조직의 부정적 요소(빨간 장애물)를 피하세요.</span>
              </p>
              <p className="flex gap-3">
                <span className="text-blue-500 font-bold">03</span>
                <span>긍정 에너지(충전/방패/번개)를 획득하세요.</span>
              </p>
              <p className="flex gap-3">
                <span className="text-blue-500 font-bold">04</span>
                <span>제한 시간: {Math.floor(INITIAL_TIME_LIMIT / 60)}분</span>
              </p>
            </div>

            <button
              onClick={handleStart}
              className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest italic"
            >
              Start Mission
            </button>
            <button
              onClick={onCancel}
              className="mt-2 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm"
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {/* PLAYING Screen */}
      {gameState === GameState.PLAYING && (
        <GameCanvas
          round={stats.round}
          onRoundComplete={handleRoundComplete}
          onGameOver={handleGameOver}
          timeLeft={stats.timeLeft}
          playerName={getPlayerName(stats.round)}
          onHitObstacle={(label) => setStats(prev => ({ ...prev, obstaclesHit: [...prev.obstaclesHit, label] }))}
          onAvoidObstacle={() => setStats(prev => ({ ...prev, obstaclesAvoided: prev.obstaclesAvoided + 1 }))}
          onCollectFuel={() => setStats(prev => ({ ...prev, fuelItemsCollected: prev.fuelItemsCollected + 1 }))}
        />
      )}

      {/* BATON Screen */}
      {gameState === GameState.BATON && (
        <BatonOverlay
          currentRound={stats.round}
          onBatonComplete={handleBatonTouch}
          nextPlayer={getPlayerName(stats.round + 1)}
        />
      )}

      {/* RESULT Screen */}
      {(gameState === GameState.SUCCESS || gameState === GameState.GAMEOVER) && (
        <ResultOverlay
          isSuccess={gameState === GameState.SUCCESS}
          stats={stats}
          onRetry={handleRetry}
          onComplete={handleSuccess}
        />
      )}
    </div>
  );
};

// Game Canvas Component
interface GameCanvasProps {
  round: number;
  onRoundComplete: () => void;
  onGameOver: () => void;
  timeLeft: number;
  playerName: string;
  onHitObstacle: (label: string) => void;
  onAvoidObstacle: () => void;
  onCollectFuel: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  round, onRoundComplete, onGameOver, timeLeft, playerName,
  onHitObstacle, onAvoidObstacle, onCollectFuel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [fuelUI, setFuelUI] = useState(MAX_FUEL);
  const shakeRef = useRef(0);

  const stateRef = useRef<PlayerState>({
    x: 0.5, y: 0.8, width: 0.06, height: 0.1,
    speed: 0, fuel: MAX_FUEL, shield: false, boostTimer: 0
  });

  const entitiesRef = useRef<GameEntity[]>([]);
  const roadOffsetRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const controlRef = useRef({ left: false, right: false });
  const curveRef = useRef(0);
  const gameActiveRef = useRef(true);

  const getRoadX = (t: number) => {
    const baseCurve = Math.sin(t * 0.4) * 0.2;
    const miniCurve = Math.sin(t * 1.5) * 0.03;
    const straightness = Math.cos(t * 0.12) > 0.4 ? 0 : 1;
    return 0.5 + (baseCurve + miniCurve) * straightness;
  };

  useEffect(() => {
    stateRef.current = {
      x: 0.5, y: 0.8, width: 0.06, height: 0.1,
      speed: 0, fuel: MAX_FUEL, shield: false, boostTimer: 0
    };
    setDistance(0);
    setFuelUI(MAX_FUEL);
    entitiesRef.current = [];
    gameActiveRef.current = true;
    shakeRef.current = 0;
  }, [round]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') controlRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') controlRef.current.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') controlRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') controlRef.current.right = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEntity = useCallback(() => {
    const roll = Math.random();
    let type: EntityType;
    let label = '';
    let color = '';

    if (roll < 0.22) {
      type = EntityType.ITEM_FUEL;
      label = ITEMS_ENERGY[Math.floor(Math.random() * ITEMS_ENERGY.length)];
      color = '#10b981';
    } else if (roll < 0.30) {
      type = EntityType.ITEM_BOOST;
      label = ITEMS_BOOST[Math.floor(Math.random() * ITEMS_BOOST.length)];
      color = '#fbbf24';
    } else if (roll < 0.38) {
      type = EntityType.ITEM_SHIELD;
      label = ITEMS_SHIELD[Math.floor(Math.random() * ITEMS_SHIELD.length)];
      color = '#3b82f6';
    } else if (roll < 0.60) {
      type = EntityType.OBSTACLE_CAR_FAST;
      label = OBSTACLES_HUMAN[Math.floor(Math.random() * OBSTACLES_HUMAN.length)];
      color = '#ef4444';
    } else if (roll < 0.80) {
      type = EntityType.OBSTACLE_CAR_SLOW;
      label = OBSTACLES_WORK[Math.floor(Math.random() * OBSTACLES_WORK.length)];
      color = '#dc2626';
    } else {
      type = EntityType.OBSTACLE_WALL;
      label = OBSTACLES_CULTURE[Math.floor(Math.random() * OBSTACLES_CULTURE.length)];
      color = '#facc15';
    }

    const roadXAtSpawn = getRoadX(curveRef.current);
    const safeLaneWidth = ROAD_WIDTH_PERCENT * 0.7;
    const x = roadXAtSpawn - (safeLaneWidth / 2) + Math.random() * safeLaneWidth;

    entitiesRef.current.push({
      id: Date.now() + Math.random(),
      type, x, y: -0.2, width: 0.06, height: 0.09,
      speed: type === EntityType.OBSTACLE_CAR_FAST ? 0.003 : (type === EntityType.OBSTACLE_CAR_SLOW ? -0.001 : 0),
      label, color
    });
  }, []);

  const update = useCallback((time: number) => {
    if (!gameActiveRef.current) return;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    const player = stateRef.current;
    const theme = THEMES[(round - 1) % THEMES.length];

    curveRef.current += 0.005;
    const currentRoadX = getRoadX(curveRef.current);

    const moveSpeed = 0.012;
    if (controlRef.current.left) player.x -= moveSpeed;
    if (controlRef.current.right) player.x += moveSpeed;
    player.x = Math.max(0.05, Math.min(0.95, player.x));

    const halfRoad = ROAD_WIDTH_PERCENT / 2;
    const isOffRoad = Math.abs(player.x - currentRoadX) > halfRoad;
    let targetSpeed = 0.004;
    if (player.boostTimer > 0) {
      targetSpeed = 0.007;
      player.boostTimer -= deltaTime;
    } else if (isOffRoad) {
      targetSpeed = 0.001;
    }

    player.speed += (targetSpeed - player.speed) * 0.15;
    player.fuel -= (player.boostTimer > 0 ? 0.01 : 0.015);
    setFuelUI(player.fuel);

    if (player.fuel <= 0) {
      gameActiveRef.current = false;
      onGameOver();
      return;
    }

    roadOffsetRef.current = (roadOffsetRef.current + player.speed * 160) % 160;

    setDistance(prev => {
      const newDist = prev + player.speed * 1000;
      if (newDist >= DISTANCE_PER_ROUND) {
        gameActiveRef.current = false;
        onRoundComplete();
      }
      return newDist;
    });

    if (Math.random() < 0.025) spawnEntity();

    entitiesRef.current.forEach((e, idx) => {
      e.y += player.speed + e.speed;
      if (e.y + e.height > player.y && e.y < player.y + player.height &&
          e.x + e.width > player.x && e.x < player.x + player.width) {
        if (e.type.startsWith('OBSTACLE')) {
          if (player.shield) {
            player.shield = false;
            shakeRef.current = 15;
            player.speed *= 0.4;
          } else {
            onHitObstacle(e.label);
            player.speed = -0.005;
            player.fuel = Math.max(0, player.fuel - 15);
            shakeRef.current = 40;
          }
        } else {
          if (e.type === EntityType.ITEM_FUEL) {
            player.fuel = Math.min(MAX_FUEL, player.fuel + 12);
            onCollectFuel();
          }
          if (e.type === EntityType.ITEM_BOOST) player.boostTimer = 3500;
          if (e.type === EntityType.ITEM_SHIELD) player.shield = true;
        }
        entitiesRef.current.splice(idx, 1);
      } else if (e.y > 1.1) {
        if (e.type.startsWith('OBSTACLE')) onAvoidObstacle();
        entitiesRef.current.splice(idx, 1);
      }
    });

    if (shakeRef.current > 0) {
      shakeRef.current *= 0.9;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    // Draw
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        if (shakeRef.current > 0) {
          ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
        }

        // Background
        ctx.fillStyle = theme.horizon;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, h * 0.35, w, h * 0.65);

        // Road
        const roadSegments = 28;
        const segH = h / roadSegments;
        for (let i = 0; i <= roadSegments; i++) {
          const t = curveRef.current - (i * 0.025);
          const rx = getRoadX(t) * w;
          const rW = ROAD_WIDTH_PERCENT * w * (1 - i * 0.022);
          const nextT = curveRef.current - ((i + 1) * 0.025);
          const nextRX = getRoadX(nextT) * w;
          const nextRW = ROAD_WIDTH_PERCENT * w * (1 - (i + 1) * 0.022);
          const ry = h - i * segH;
          const nextRY = h - (i + 1) * segH;

          // Road surface
          ctx.fillStyle = '#1f2937';
          ctx.beginPath();
          ctx.moveTo(rx - rW / 2, ry);
          ctx.lineTo(rx + rW / 2, ry);
          ctx.lineTo(nextRX + nextRW / 2, nextRY);
          ctx.lineTo(nextRX - nextRW / 2, nextRY);
          ctx.fill();

          // Curbs
          ctx.fillStyle = (Math.floor(t * 14)) % 2 === 0 ? '#ef4444' : '#ffffff';
          const curbW = 14 * (1 - i * 0.022);
          ctx.beginPath();
          ctx.moveTo(rx - rW / 2, ry);
          ctx.lineTo(rx - rW / 2 - curbW, ry);
          ctx.lineTo(nextRX - nextRW / 2 - curbW, nextRY);
          ctx.lineTo(nextRX - nextRW / 2, nextRY);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(rx + rW / 2, ry);
          ctx.lineTo(rx + rW / 2 + curbW, ry);
          ctx.lineTo(nextRX + nextRW / 2 + curbW, nextRY);
          ctx.lineTo(nextRX + nextRW / 2, nextRY);
          ctx.fill();
        }

        // Center line
        ctx.setLineDash([24, 32]);
        ctx.lineDashOffset = -roadOffsetRef.current * 8;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= roadSegments; i++) {
          const t = curveRef.current - (i * 0.025);
          const rx = getRoadX(t) * w;
          const ry = h - i * segH;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Entities
        entitiesRef.current.forEach(e => {
          const ex = e.x * w;
          const ey = e.y * h;
          const ew = e.width * w;
          const eh = e.height * h;

          if (e.type.includes('CAR')) {
            // Draw car
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(ex + 3, ey + 3, ew, eh);
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.roundRect(ex, ey, ew, eh, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(ex + 4, ey + 6, ew - 8, eh / 4);
          } else if (e.type === EntityType.OBSTACLE_WALL) {
            ctx.fillStyle = '#475569';
            ctx.fillRect(ex, ey, ew * 1.5, eh * 0.4);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 6;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(ex - 10, ey);
            ctx.lineTo(ex + ew * 1.5 + 10, ey + eh * 0.4);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Items
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            if (e.type === EntityType.ITEM_FUEL) {
              ctx.beginPath();
              ctx.roundRect(ex, ey, ew, eh, 4);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 14px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('⚡', ex + ew / 2, ey + eh / 2 + 5);
            } else if (e.type === EntityType.ITEM_BOOST) {
              ctx.beginPath();
              ctx.moveTo(ex + ew / 2, ey);
              ctx.lineTo(ex, ey + eh / 2);
              ctx.lineTo(ex + ew / 3, ey + eh / 2);
              ctx.lineTo(ex + ew / 4, ey + eh);
              ctx.lineTo(ex + ew, ey + eh / 3);
              ctx.lineTo(ex + ew * 0.6, ey + eh / 3);
              ctx.closePath();
              ctx.fill();
            } else if (e.type === EntityType.ITEM_SHIELD) {
              ctx.beginPath();
              ctx.moveTo(ex, ey);
              ctx.lineTo(ex + ew, ey);
              ctx.lineTo(ex + ew, ey + eh * 0.6);
              ctx.quadraticCurveTo(ex + ew / 2, ey + eh, ex, ey + eh * 0.6);
              ctx.closePath();
              ctx.fill();
            }
            ctx.restore();
          }

          // Label
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(e.label, ex + ew / 2, e.type.includes('OBSTACLE') ? ey - 8 : ey + eh + 14);
        });

        // Player car
        const p = stateRef.current;
        const px = p.x * w;
        const py = p.y * h;
        const pw = p.width * w;
        const ph = p.height * h;

        if (p.shield) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.lineDashOffset = -time / 12;
          ctx.beginPath();
          ctx.arc(px + pw / 2, py + ph / 2, pw * 1.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Player car body
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px + 3, py + 3, pw, ph);
        ctx.fillStyle = p.boostTimer > 0 ? '#fbbf24' : '#2563eb';
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(px + 4, py + 6, pw - 8, ph / 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 3, py, 6, 3);
        ctx.fillRect(px + pw - 9, py, 6, 3);

        // Boost flame
        if (p.boostTimer > 0) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
          ctx.beginPath();
          ctx.moveTo(px + 6, py + ph);
          ctx.lineTo(px + pw - 6, py + ph);
          ctx.lineTo(px + pw / 2, py + ph + 35 + Math.random() * 15);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    }
    requestRef.current = requestAnimationFrame(update);
  }, [onRoundComplete, onGameOver, spawnEntity, onHitObstacle, onAvoidObstacle, onCollectFuel, round]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    requestRef.current = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  const fuelSegments = 10;
  const activeSegments = Math.ceil((fuelUI / MAX_FUEL) * fuelSegments);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/90 to-transparent z-20 pointer-events-none flex justify-between items-start px-4 pt-3">
        <div className="flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">
            주자 {round}/6: {playerName}
          </div>
          <div className="text-xl font-black text-white">
            {Math.floor(distance)} <span className="text-xs text-slate-500">/ {DISTANCE_PER_ROUND}m</span>
          </div>
          <div className="w-36 h-1.5 bg-slate-800 mt-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
              style={{ width: `${(distance / DISTANCE_PER_ROUND) * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-500 mt-1">{THEMES[(round - 1) % THEMES.length].name}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">TIME</div>
          <div className={`text-xl font-black ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
          <div className="mt-3 flex flex-col items-end">
            <div className={`text-[9px] font-bold ${fuelUI < 25 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
              ENERGY {Math.round(fuelUI)}%
            </div>
            <div className="flex gap-1 mt-1">
              {[...Array(fuelSegments)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${
                    i < activeSegments
                      ? (fuelUI < 25 ? 'bg-red-500' : 'bg-blue-400')
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Mobile Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between px-6 pointer-events-none">
        <button
          onTouchStart={(e) => { e.preventDefault(); controlRef.current.left = true; }}
          onTouchEnd={(e) => { e.preventDefault(); controlRef.current.left = false; }}
          onMouseDown={() => controlRef.current.left = true}
          onMouseUp={() => controlRef.current.left = false}
          onMouseLeave={() => controlRef.current.left = false}
          className="w-20 h-20 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-blue-600 active:scale-90 transition-all border border-white/20"
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); controlRef.current.right = true; }}
          onTouchEnd={(e) => { e.preventDefault(); controlRef.current.right = false; }}
          onMouseDown={() => controlRef.current.right = true}
          onMouseUp={() => controlRef.current.right = false}
          onMouseLeave={() => controlRef.current.right = false}
          className="w-20 h-20 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-blue-600 active:scale-90 transition-all border border-white/20"
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Baton Overlay Component
interface BatonOverlayProps {
  currentRound: number;
  nextPlayer: string;
  onBatonComplete: () => void;
}

const BatonOverlay: React.FC<BatonOverlayProps> = ({ currentRound, nextPlayer, onBatonComplete }) => {
  const [isHighFived, setIsHighFived] = useState(false);

  const handleHighFive = () => {
    setIsHighFived(true);
    setTimeout(onBatonComplete, 700);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6 text-center">
      <div className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-3">Relay Transition</div>
      <h2 className="text-2xl font-black italic mb-2">ROUND {currentRound} COMPLETE!</h2>
      <p className="text-slate-400 text-sm mb-8">
        다음 주자: <span className="text-white font-bold">{nextPlayer}</span>
      </p>

      {!isHighFived ? (
        <button
          onClick={handleHighFive}
          className="relative w-36 h-36 rounded-full flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full bg-blue-600/20 animate-ping" />
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform">
            <span className="text-4xl mb-1">✋</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">High Five!</span>
          </div>
        </button>
      ) : (
        <div className="flex flex-col items-center animate-bounce">
          <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="mt-4 text-lg font-black text-green-400 uppercase">GO!</div>
        </div>
      )}
    </div>
  );
};

// Result Overlay Component
interface ResultOverlayProps {
  isSuccess: boolean;
  stats: GameStats;
  onRetry: (fullReset: boolean) => void;
  onComplete: () => void;
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ isSuccess, stats, onRetry, onComplete }) => {
  const topObstacle = stats.obstaclesHit.length > 0
    ? stats.obstaclesHit.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : null;

  const mostHitObstacle = topObstacle
    ? Object.entries(topObstacle).sort((a, b) => b[1] - a[1])[0][0]
    : "퍼펙트 런!";

  const fastestRound = stats.roundTimes.length > 0
    ? Math.min(...stats.roundTimes)
    : 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-xl p-4 text-center overflow-y-auto">
      <div className="w-full max-w-lg py-6 flex flex-col items-center">
        {isSuccess ? (
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center border-2 border-yellow-500/50 shadow-lg">
                <span className="text-5xl">🏆</span>
              </div>
            </div>
            <h1 className="text-3xl font-black italic mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              본사 복귀 성공!
            </h1>
            <p className="text-blue-400 text-xs uppercase tracking-widest font-bold">Mission Complete</p>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/50">
              <span className="text-4xl">💥</span>
            </div>
            <h1 className="text-3xl font-black italic mb-1 text-red-400">미션 실패</h1>
            <p className="text-slate-500 text-xs">다시 도전하세요!</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-500 uppercase">최단 라운드</div>
            <div className="text-xl font-black text-blue-400">{fastestRound > 0 ? `${fastestRound}s` : '--'}</div>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-500 uppercase">장애물 회피</div>
            <div className="text-xl font-black text-green-400">{stats.obstaclesAvoided}</div>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-500 uppercase">에너지 획득</div>
            <div className="text-xl font-black text-yellow-400">{stats.fuelItemsCollected}</div>
          </div>
        </div>

        <div className="bg-slate-800/60 p-4 rounded-xl border border-white/10 w-full mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">완주 인원</span>
            <span className="font-bold">{stats.round} / 6</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">총 이동 거리</span>
            <span className="font-bold">{Math.floor(stats.totalDistance / 1000)}km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">최다 충돌</span>
            <span className="font-bold text-red-400">{mostHitObstacle}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {isSuccess ? (
            <button
              onClick={onComplete}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl uppercase tracking-widest active:scale-95 transition-all"
            >
              미션 완료! 🎉
            </button>
          ) : (
            <>
              <button
                onClick={() => onRetry(false)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase tracking-widest active:scale-95 transition-all"
              >
                현재 단계 재시도
              </button>
              <button
                onClick={() => onRetry(true)}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl active:scale-95 transition-all"
              >
                처음부터 다시
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelayRacingGame;
