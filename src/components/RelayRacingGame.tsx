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
  OBSTACLE_TRUCK = 'OBSTACLE_TRUCK',
  ITEM_FUEL = 'ITEM_FUEL',
  ITEM_BOOST = 'ITEM_BOOST',
  ITEM_SHIELD = 'ITEM_SHIELD'
}

interface GameEntity {
  id: number;
  type: EntityType;
  x: number; // Road position (-1 to 1, 0 = center)
  z: number; // Distance ahead
  width: number;
  height: number;
  speed: number;
  label: string;
  color: string;
}

interface Scenery {
  type: 'tree' | 'palm' | 'building' | 'sign' | 'rock';
  side: 'left' | 'right';
  z: number;
  offset: number;
}

interface PlayerState {
  x: number; // -1 to 1
  speed: number;
  fuel: number;
  shield: boolean;
  shieldTimer: number;
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
const INITIAL_TIME_LIMIT = 360;
const MAX_FUEL = 100;
const DISTANCE_PER_ROUND = 8000;
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const DRAW_DISTANCE = 100;
const FOV = 100;
const CAMERA_HEIGHT = 1500;

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

// 테마별 설정
const THEMES = [
  {
    name: '해안도로',
    sky1: '#87CEEB', sky2: '#1E90FF',
    ground: '#C2B280', road: '#404040',
    rumble1: '#ff0000', rumble2: '#ffffff',
    grass1: '#10b981', grass2: '#059669',
    line: '#ffffff', fog: '#87CEEB',
    sceneryTypes: ['palm', 'rock'] as const
  },
  {
    name: '도심 고속도로',
    sky1: '#2c3e50', sky2: '#1a252f',
    ground: '#34495e', road: '#2c3e50',
    rumble1: '#f39c12', rumble2: '#2c3e50',
    grass1: '#27ae60', grass2: '#229954',
    line: '#f1c40f', fog: '#34495e',
    sceneryTypes: ['building', 'sign'] as const
  },
  {
    name: '숲길',
    sky1: '#87CEEB', sky2: '#5DADE2',
    ground: '#2E7D32', road: '#424242',
    rumble1: '#ff5722', rumble2: '#ffffff',
    grass1: '#388E3C', grass2: '#2E7D32',
    line: '#ffffff', fog: '#90CAF9',
    sceneryTypes: ['tree', 'rock'] as const
  },
  {
    name: '석양 드라이브',
    sky1: '#FF6B35', sky2: '#F7C59F',
    ground: '#8B4513', road: '#363636',
    rumble1: '#DC143C', rumble2: '#FFD700',
    grass1: '#D2691E', grass2: '#A0522D',
    line: '#FFD700', fog: '#FF8C00',
    sceneryTypes: ['palm', 'rock'] as const
  },
  {
    name: '야간 질주',
    sky1: '#0c0c1e', sky2: '#1a1a3e',
    ground: '#1a1a2e', road: '#16213e',
    rumble1: '#e94560', rumble2: '#0f3460',
    grass1: '#1a1a2e', grass2: '#0f0f1e',
    line: '#e94560', fog: '#1a1a3e',
    sceneryTypes: ['building', 'sign'] as const
  },
  {
    name: '본사 진입',
    sky1: '#667eea', sky2: '#764ba2',
    ground: '#2d3436', road: '#2d3436',
    rumble1: '#fdcb6e', rumble2: '#6c5ce7',
    grass1: '#00b894', grass2: '#00a085',
    line: '#fdcb6e', fog: '#a29bfe',
    sceneryTypes: ['building', 'tree'] as const
  }
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

  const handleStart = () => setGameState(GameState.PLAYING);

  const handleBatonTouch = () => {
    if (stats.round >= TOTAL_PLAYERS) {
      setGameState(GameState.SUCCESS);
    } else {
      setGameState(GameState.PLAYING);
      setStats(prev => ({ ...prev, round: prev.round + 1, currentDistance: 0 }));
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

  const handleGameOver = () => setGameState(GameState.GAMEOVER);

  const handleRetry = (fullReset: boolean) => {
    if (fullReset) {
      setStats({
        round: 1, totalDistance: 0, currentDistance: 0,
        timeLeft: INITIAL_TIME_LIMIT, obstaclesHit: [],
        roundTimes: [], obstaclesAvoided: 0, fuelItemsCollected: 0
      });
      setLastRoundTimeLeft(INITIAL_TIME_LIMIT);
    } else {
      setStats(prev => ({ ...prev, currentDistance: 0 }));
    }
    setGameState(GameState.PLAYING);
  };

  const getPlayerName = (round: number) => {
    if (teamMembers && teamMembers[round - 1]) {
      return `${teamMembers[round - 1].name} (${teamMembers[round - 1].role})`;
    }
    return PLAYER_NAMES[round - 1] || `주자 ${round}`;
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-slate-900 text-white">
      {gameState === GameState.START && (
        <StartScreen onStart={handleStart} onCancel={onCancel} />
      )}

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

      {gameState === GameState.BATON && (
        <BatonOverlay
          currentRound={stats.round}
          onBatonComplete={handleBatonTouch}
          nextPlayer={getPlayerName(stats.round + 1)}
        />
      )}

      {(gameState === GameState.SUCCESS || gameState === GameState.GAMEOVER) && (
        <ResultOverlay
          isSuccess={gameState === GameState.SUCCESS}
          stats={stats}
          onRetry={handleRetry}
          onComplete={() => onComplete(stats)}
        />
      )}
    </div>
  );
};

// Start Screen
const StartScreen: React.FC<{ onStart: () => void; onCancel: () => void }> = ({ onStart, onCancel }) => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900">
    <div className="mb-2 uppercase tracking-[0.3em] text-cyan-400 text-xs font-black animate-pulse">
      Team Mission: HQ Arrival
    </div>
    <h1 className="text-4xl md:text-6xl font-black mb-1 text-white italic tracking-tight">
      THE LAST <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">MILE</span>
    </h1>
    <h2 className="text-lg md:text-xl font-light mb-8 tracking-[0.5em] text-slate-400">RELAY RACING</h2>

    <div className="bg-slate-800/80 p-6 rounded-xl max-w-lg w-full border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
      <h3 className="text-cyan-400 font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></span>
        MISSION BRIEFING
      </h3>
      <div className="space-y-3 text-slate-300 text-sm">
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">01</span><span>6명의 팀원이 릴레이로 본사까지 주행합니다.</span></p>
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">02</span><span>🔴 빨간 차량 = 조직의 부정적 요소 (충돌 시 에너지 -25)</span></p>
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">03</span><span>🟢 녹색/파랑/노랑 아이템 = 긍정 에너지</span></p>
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">04</span><span>제한 시간: {Math.floor(INITIAL_TIME_LIMIT / 60)}분</span></p>
      </div>

      <button onClick={onStart} className="mt-6 w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest">
        🏁 Start Race
      </button>
      <button onClick={onCancel} className="mt-2 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm">
        돌아가기
      </button>
    </div>
  </div>
);

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
  const [hitFlash, setHitFlash] = useState(false);

  const stateRef = useRef<PlayerState>({
    x: 0, speed: 0, fuel: MAX_FUEL, shield: false, shieldTimer: 0, boostTimer: 0
  });

  const entitiesRef = useRef<GameEntity[]>([]);
  const sceneryRef = useRef<Scenery[]>([]);
  const positionRef = useRef(0);
  const controlRef = useRef({ left: false, right: false });
  const gameActiveRef = useRef(true);
  const shakeRef = useRef(0);
  const lastSpawnRef = useRef(0);

  // Generate road curve
  const getCurve = (z: number) => {
    const curve1 = Math.sin(z * 0.0003) * 0.8;
    const curve2 = Math.sin(z * 0.0007) * 0.4;
    return curve1 + curve2;
  };

  const getHill = (z: number) => {
    return Math.sin(z * 0.0002) * 800 + Math.sin(z * 0.0005) * 400;
  };

  // Initialize
  useEffect(() => {
    stateRef.current = { x: 0, speed: 0, fuel: MAX_FUEL, shield: false, shieldTimer: 0, boostTimer: 0 };
    setDistance(0);
    setFuelUI(MAX_FUEL);
    entitiesRef.current = [];
    gameActiveRef.current = true;
    shakeRef.current = 0;
    positionRef.current = 0;
    lastSpawnRef.current = 0;

    // Generate initial scenery
    sceneryRef.current = [];
    for (let i = 0; i < 100; i++) {
      const theme = THEMES[(round - 1) % THEMES.length];
      const type = theme.sceneryTypes[Math.floor(Math.random() * theme.sceneryTypes.length)];
      sceneryRef.current.push({
        type,
        side: Math.random() > 0.5 ? 'left' : 'right',
        z: i * 300 + Math.random() * 200,
        offset: 1.2 + Math.random() * 0.8
      });
    }
  }, [round]);

  // Controls
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

  // Spawn entity
  const spawnEntity = useCallback(() => {
    const roll = Math.random();
    let type: EntityType;
    let label = '';
    let color = '';

    if (roll < 0.20) {
      type = EntityType.ITEM_FUEL;
      label = ITEMS_ENERGY[Math.floor(Math.random() * ITEMS_ENERGY.length)];
      color = '#10b981';
    } else if (roll < 0.28) {
      type = EntityType.ITEM_BOOST;
      label = ITEMS_BOOST[Math.floor(Math.random() * ITEMS_BOOST.length)];
      color = '#fbbf24';
    } else if (roll < 0.35) {
      type = EntityType.ITEM_SHIELD;
      label = ITEMS_SHIELD[Math.floor(Math.random() * ITEMS_SHIELD.length)];
      color = '#3b82f6';
    } else if (roll < 0.55) {
      type = EntityType.OBSTACLE_CAR_FAST;
      label = OBSTACLES_HUMAN[Math.floor(Math.random() * OBSTACLES_HUMAN.length)];
      color = '#ef4444';
    } else if (roll < 0.75) {
      type = EntityType.OBSTACLE_CAR_SLOW;
      label = OBSTACLES_WORK[Math.floor(Math.random() * OBSTACLES_WORK.length)];
      color = '#dc2626';
    } else {
      type = EntityType.OBSTACLE_TRUCK;
      label = OBSTACLES_CULTURE[Math.floor(Math.random() * OBSTACLES_CULTURE.length)];
      color = '#991b1b';
    }

    // Spawn on road only (-0.7 to 0.7 of road width)
    const laneX = (Math.random() - 0.5) * 1.4;

    entitiesRef.current.push({
      id: Date.now() + Math.random(),
      type,
      x: laneX,
      z: positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH,
      width: type === EntityType.OBSTACLE_TRUCK ? 0.3 : 0.2,
      height: type === EntityType.OBSTACLE_TRUCK ? 0.15 : 0.1,
      speed: type === EntityType.OBSTACLE_CAR_FAST ? 150 : (type === EntityType.OBSTACLE_CAR_SLOW ? 50 : 0),
      label, color
    });
  }, []);

  // Main game loop
  const update = useCallback((time: number) => {
    if (!gameActiveRef.current) return;

    const player = stateRef.current;
    const theme = THEMES[(round - 1) % THEMES.length];

    // Player movement
    const steerSpeed = 0.03 * (1 + player.speed / 400);
    if (controlRef.current.left) player.x -= steerSpeed;
    if (controlRef.current.right) player.x += steerSpeed;
    player.x = Math.max(-1.5, Math.min(1.5, player.x));

    // Speed control
    const isOffRoad = Math.abs(player.x) > 1;
    let maxSpeed = player.boostTimer > 0 ? 350 : 250;
    if (isOffRoad) maxSpeed = 80;

    player.speed += (maxSpeed - player.speed) * 0.02;
    if (player.boostTimer > 0) player.boostTimer -= 16;
    if (player.shieldTimer > 0) player.shieldTimer -= 16;
    if (player.shieldTimer <= 0) player.shield = false;

    // Fuel consumption
    player.fuel -= (player.boostTimer > 0 ? 0.008 : 0.012);
    setFuelUI(player.fuel);

    if (player.fuel <= 0) {
      gameActiveRef.current = false;
      onGameOver();
      return;
    }

    // Update position
    positionRef.current += player.speed;
    const newDistance = positionRef.current / 100;
    setDistance(newDistance);

    if (newDistance >= DISTANCE_PER_ROUND) {
      gameActiveRef.current = false;
      onRoundComplete();
      return;
    }

    // Spawn entities
    if (positionRef.current - lastSpawnRef.current > 800) {
      if (Math.random() < 0.7) spawnEntity();
      lastSpawnRef.current = positionRef.current;
    }

    // Update scenery (recycle)
    sceneryRef.current.forEach(s => {
      if (s.z < positionRef.current - 500) {
        s.z += 30000;
        s.type = theme.sceneryTypes[Math.floor(Math.random() * theme.sceneryTypes.length)];
        s.side = Math.random() > 0.5 ? 'left' : 'right';
        s.offset = 1.2 + Math.random() * 0.8;
      }
    });

    // Update entities and collision
    entitiesRef.current = entitiesRef.current.filter(e => {
      e.z -= e.speed * 0.016;

      const relZ = e.z - positionRef.current;
      if (relZ < -500) {
        if (e.type.startsWith('OBSTACLE')) onAvoidObstacle();
        return false;
      }
      if (relZ > DRAW_DISTANCE * SEGMENT_LENGTH) return true;

      // Collision detection
      const playerWidth = 0.25;
      const collisionZ = 200;

      if (relZ > 0 && relZ < collisionZ) {
        const dx = Math.abs(e.x - player.x);
        if (dx < (playerWidth + e.width) / 2) {
          if (e.type.startsWith('OBSTACLE') || e.type.startsWith('OBSTACLE')) {
            if (player.shield) {
              player.shield = false;
              player.shieldTimer = 0;
              shakeRef.current = 20;
              player.speed *= 0.6;
            } else {
              onHitObstacle(e.label);
              player.speed = -50;
              player.fuel = Math.max(0, player.fuel - 25);
              shakeRef.current = 50;
              setHitFlash(true);
              setTimeout(() => setHitFlash(false), 150);
            }
            return false;
          } else {
            // Item pickup
            if (e.type === EntityType.ITEM_FUEL) {
              player.fuel = Math.min(MAX_FUEL, player.fuel + 20);
              onCollectFuel();
            }
            if (e.type === EntityType.ITEM_BOOST) player.boostTimer = 4000;
            if (e.type === EntityType.ITEM_SHIELD) {
              player.shield = true;
              player.shieldTimer = 8000;
            }
            return false;
          }
        }
      }
      return true;
    });

    // Shake decay
    if (shakeRef.current > 0) shakeRef.current *= 0.92;

    // Draw
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    if (shakeRef.current > 1) {
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
    }

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, theme.sky1);
    skyGrad.addColorStop(1, theme.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.5);

    // Draw clouds
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 200 + positionRef.current * 0.01) % (w + 100)) - 50;
      const cy = 50 + i * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, 30 + i * 5, 0, Math.PI * 2);
      ctx.arc(cx + 25, cy - 10, 25 + i * 3, 0, Math.PI * 2);
      ctx.arc(cx + 50, cy, 20 + i * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mountains/horizon
    ctx.fillStyle = theme.fog;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 50) {
      const mountainY = h * 0.5 - 20 - Math.sin((x + positionRef.current * 0.02) * 0.02) * 30 - Math.sin((x + positionRef.current * 0.01) * 0.01) * 50;
      ctx.lineTo(x, mountainY);
    }
    ctx.lineTo(w, h * 0.5);
    ctx.closePath();
    ctx.fill();

    // Ground
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    // Road segments (OutRun style)
    const baseSegment = Math.floor(positionRef.current / SEGMENT_LENGTH);
    const basePercent = (positionRef.current % SEGMENT_LENGTH) / SEGMENT_LENGTH;

    const segments: Array<{
      x: number; y: number; w: number; scale: number;
      curve: number; clip: number; index: number;
    }> = [];

    let maxY = h;
    for (let i = 0; i < DRAW_DISTANCE; i++) {
      const segIndex = baseSegment + i;
      const segZ = (i - basePercent) * SEGMENT_LENGTH;

      if (segZ <= 0) continue;

      const scale = FOV / segZ;
      const projY = h * 0.5 + (CAMERA_HEIGHT - getHill(segIndex * SEGMENT_LENGTH)) * scale;
      const projW = ROAD_WIDTH * scale;
      const projX = w / 2 - (player.x * projW * 0.5) + getCurve(segIndex * SEGMENT_LENGTH) * projW;

      if (projY < maxY) {
        segments.push({ x: projX, y: projY, w: projW, scale, curve: getCurve(segIndex * SEGMENT_LENGTH), clip: maxY, index: segIndex });
        maxY = projY;
      }
    }

    // Draw road from back to front
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const nextSeg = segments[i - 1];
      if (!nextSeg) continue;

      const isStripe = (seg.index % 2) === 0;

      // Grass
      ctx.fillStyle = isStripe ? theme.grass1 : theme.grass2;
      ctx.fillRect(0, nextSeg.y, w, seg.y - nextSeg.y);

      // Rumble strips
      const rumbleW = seg.w * 0.1;
      ctx.fillStyle = isStripe ? theme.rumble1 : theme.rumble2;

      ctx.beginPath();
      ctx.moveTo(seg.x - seg.w / 2, seg.y);
      ctx.lineTo(nextSeg.x - nextSeg.w / 2, nextSeg.y);
      ctx.lineTo(nextSeg.x - nextSeg.w / 2 - rumbleW * nextSeg.scale / seg.scale, nextSeg.y);
      ctx.lineTo(seg.x - seg.w / 2 - rumbleW, seg.y);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(seg.x + seg.w / 2, seg.y);
      ctx.lineTo(nextSeg.x + nextSeg.w / 2, nextSeg.y);
      ctx.lineTo(nextSeg.x + nextSeg.w / 2 + rumbleW * nextSeg.scale / seg.scale, nextSeg.y);
      ctx.lineTo(seg.x + seg.w / 2 + rumbleW, seg.y);
      ctx.fill();

      // Road surface
      ctx.fillStyle = theme.road;
      ctx.beginPath();
      ctx.moveTo(seg.x - seg.w / 2, seg.y);
      ctx.lineTo(nextSeg.x - nextSeg.w / 2, nextSeg.y);
      ctx.lineTo(nextSeg.x + nextSeg.w / 2, nextSeg.y);
      ctx.lineTo(seg.x + seg.w / 2, seg.y);
      ctx.fill();

      // Center line
      if (isStripe) {
        ctx.fillStyle = theme.line;
        const lineW = seg.w * 0.02;
        ctx.beginPath();
        ctx.moveTo(seg.x - lineW, seg.y);
        ctx.lineTo(nextSeg.x - lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(nextSeg.x + lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(seg.x + lineW, seg.y);
        ctx.fill();
      }
    }

    // Draw scenery
    const sortedScenery = [...sceneryRef.current]
      .filter(s => s.z > positionRef.current && s.z < positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH)
      .sort((a, b) => b.z - a.z);

    sortedScenery.forEach(s => {
      const relZ = s.z - positionRef.current;
      const scale = FOV / relZ;
      const projY = h * 0.5 + (CAMERA_HEIGHT - getHill(s.z)) * scale;
      const projW = ROAD_WIDTH * scale;
      const roadX = w / 2 - (player.x * projW * 0.5) + getCurve(s.z) * projW;
      const projX = roadX + (s.side === 'left' ? -1 : 1) * (projW * 0.5 + projW * s.offset * 0.3);

      const size = 300 * scale;
      if (size < 3) return;

      drawScenery(ctx, s.type, projX, projY, size, theme);
    });

    // Draw entities
    const sortedEntities = [...entitiesRef.current]
      .filter(e => e.z > positionRef.current && e.z < positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH)
      .sort((a, b) => b.z - a.z);

    sortedEntities.forEach(e => {
      const relZ = e.z - positionRef.current;
      const scale = FOV / relZ;
      const projY = h * 0.5 + (CAMERA_HEIGHT - getHill(e.z)) * scale;
      const projW = ROAD_WIDTH * scale;
      const roadX = w / 2 - (player.x * projW * 0.5) + getCurve(e.z) * projW;
      const projX = roadX + e.x * projW * 0.5;

      const size = 200 * scale;
      if (size < 5) return;

      if (e.type.includes('OBSTACLE')) {
        drawCar(ctx, projX, projY, size, e.color, e.type === EntityType.OBSTACLE_TRUCK);
      } else {
        drawItem(ctx, projX, projY, size, e.type, e.color);
      }

      // Label
      if (size > 15) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(14, size * 0.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(e.label, projX, projY - size * 0.6);
        ctx.shadowBlur = 0;
      }
    });

    // Draw player car
    drawPlayerCar(ctx, w / 2, h * 0.85, player.boostTimer > 0, player.shield);

    // Boost flames
    if (player.boostTimer > 0) {
      ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 25, h * 0.85 + 50);
      ctx.lineTo(w / 2 - 15, h * 0.85 + 80 + Math.random() * 30);
      ctx.lineTo(w / 2 - 5, h * 0.85 + 50);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w / 2 + 5, h * 0.85 + 50);
      ctx.lineTo(w / 2 + 15, h * 0.85 + 80 + Math.random() * 30);
      ctx.lineTo(w / 2 + 25, h * 0.85 + 50);
      ctx.fill();
    }

    ctx.restore();

    // Hit flash overlay
    if (hitFlash) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.fillRect(0, 0, w, h);
    }

    requestRef.current = requestAnimationFrame(update);
  }, [onRoundComplete, onGameOver, spawnEntity, onHitObstacle, onAvoidObstacle, onCollectFuel, round, hitFlash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-20 pointer-events-none flex justify-between items-start px-4 pt-3">
        <div className="flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
            주자 {round}/6: {playerName}
          </div>
          <div className="text-xl font-black text-white">
            {Math.floor(distance)}m <span className="text-xs text-slate-500">/ {DISTANCE_PER_ROUND}m</span>
          </div>
          <div className="w-32 h-2 bg-slate-800 mt-2 rounded-full overflow-hidden border border-slate-600">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100"
              style={{ width: `${(distance / DISTANCE_PER_ROUND) * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">{THEMES[(round - 1) % THEMES.length].name}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">TIME</div>
          <div className={`text-2xl font-black tabular-nums ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
          <div className="mt-2 flex flex-col items-end">
            <div className={`text-[9px] font-bold ${fuelUI < 25 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
              ENERGY {Math.round(fuelUI)}%
            </div>
            <div className="flex gap-0.5 mt-1">
              {[...Array(fuelSegments)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-4 rounded-sm transition-all ${
                    i < activeSegments
                      ? (fuelUI < 25 ? 'bg-red-500' : 'bg-green-500')
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Speed indicator */}
      <div className="absolute bottom-24 left-4 z-20 pointer-events-none">
        <div className="text-4xl font-black text-white tabular-nums">
          {Math.floor(stateRef.current.speed)}
          <span className="text-sm text-slate-400 ml-1">km/h</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Mobile Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-between px-4 pointer-events-none">
        <button
          onTouchStart={(e) => { e.preventDefault(); controlRef.current.left = true; }}
          onTouchEnd={(e) => { e.preventDefault(); controlRef.current.left = false; }}
          onMouseDown={() => controlRef.current.left = true}
          onMouseUp={() => controlRef.current.left = false}
          onMouseLeave={() => controlRef.current.left = false}
          className="w-24 h-24 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-cyan-600 active:scale-90 transition-all border-2 border-white/30"
        >
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); controlRef.current.right = true; }}
          onTouchEnd={(e) => { e.preventDefault(); controlRef.current.right = false; }}
          onMouseDown={() => controlRef.current.right = true}
          onMouseUp={() => controlRef.current.right = false}
          onMouseLeave={() => controlRef.current.right = false}
          className="w-24 h-24 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-cyan-600 active:scale-90 transition-all border-2 border-white/30"
        >
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Drawing functions
function drawPlayerCar(ctx: CanvasRenderingContext2D, x: number, y: number, boosting: boolean, shield: boolean) {
  const carW = 70;
  const carH = 100;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + carH * 0.45, carW * 0.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shield effect
  if (shield) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.ellipse(x, y, carW * 0.8, carH * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Car body
  const bodyColor = boosting ? '#fbbf24' : '#2563eb';

  // Main body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(x - carW * 0.4, y + carH * 0.4);
  ctx.lineTo(x - carW * 0.45, y);
  ctx.lineTo(x - carW * 0.3, y - carH * 0.3);
  ctx.lineTo(x + carW * 0.3, y - carH * 0.3);
  ctx.lineTo(x + carW * 0.45, y);
  ctx.lineTo(x + carW * 0.4, y + carH * 0.4);
  ctx.closePath();
  ctx.fill();

  // Hood
  ctx.fillStyle = boosting ? '#f59e0b' : '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(x - carW * 0.3, y - carH * 0.3);
  ctx.lineTo(x - carW * 0.2, y - carH * 0.45);
  ctx.lineTo(x + carW * 0.2, y - carH * 0.45);
  ctx.lineTo(x + carW * 0.3, y - carH * 0.3);
  ctx.closePath();
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#87CEEB';
  ctx.beginPath();
  ctx.moveTo(x - carW * 0.25, y - carH * 0.15);
  ctx.lineTo(x - carW * 0.2, y - carH * 0.28);
  ctx.lineTo(x + carW * 0.2, y - carH * 0.28);
  ctx.lineTo(x + carW * 0.25, y - carH * 0.15);
  ctx.closePath();
  ctx.fill();

  // Headlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x - carW * 0.25, y - carH * 0.42, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + carW * 0.25, y - carH * 0.42, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - carW * 0.5, y - carH * 0.2, 10, 30);
  ctx.fillRect(x + carW * 0.5 - 10, y - carH * 0.2, 10, 30);
  ctx.fillRect(x - carW * 0.5, y + carH * 0.1, 10, 30);
  ctx.fillRect(x + carW * 0.5 - 10, y + carH * 0.1, 10, 30);
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, isTruck: boolean) {
  const w = size * (isTruck ? 1.5 : 1);
  const h = size * (isTruck ? 2 : 1.5);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, w * 0.4, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  if (isTruck) {
    ctx.rect(x - w * 0.4, y - h * 0.4, w * 0.8, h * 0.8);
  } else {
    ctx.moveTo(x - w * 0.35, y + h * 0.3);
    ctx.lineTo(x - w * 0.4, y - h * 0.1);
    ctx.lineTo(x - w * 0.25, y - h * 0.35);
    ctx.lineTo(x + w * 0.25, y - h * 0.35);
    ctx.lineTo(x + w * 0.4, y - h * 0.1);
    ctx.lineTo(x + w * 0.35, y + h * 0.3);
    ctx.closePath();
  }
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#374151';
  if (isTruck) {
    ctx.fillRect(x - w * 0.3, y - h * 0.3, w * 0.6, h * 0.2);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.2, y - h * 0.1);
    ctx.lineTo(x - w * 0.15, y - h * 0.25);
    ctx.lineTo(x + w * 0.15, y - h * 0.25);
    ctx.lineTo(x + w * 0.2, y - h * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  // Warning stripes for obstacles
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, y);
  ctx.lineTo(x + w * 0.3, y);
  ctx.stroke();
}

function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: EntityType, color: string) {
  ctx.save();
  ctx.shadowBlur = size * 0.3;
  ctx.shadowColor = color;

  if (type === EntityType.ITEM_FUEL) {
    // Energy orb
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.4);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, y + size * 0.1);
  } else if (type === EntityType.ITEM_BOOST) {
    // Lightning bolt
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.4);
    ctx.lineTo(x - size * 0.2, y);
    ctx.lineTo(x - size * 0.05, y);
    ctx.lineTo(x - size * 0.15, y + size * 0.4);
    ctx.lineTo(x + size * 0.2, y - size * 0.1);
    ctx.lineTo(x + size * 0.05, y - size * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (type === EntityType.ITEM_SHIELD) {
    // Shield
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.35);
    ctx.lineTo(x - size * 0.3, y - size * 0.2);
    ctx.lineTo(x - size * 0.3, y + size * 0.1);
    ctx.quadraticCurveTo(x, y + size * 0.4, x + size * 0.3, y + size * 0.1);
    ctx.lineTo(x + size * 0.3, y - size * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🛡', x, y + size * 0.05);
  }

  ctx.restore();
}

function drawScenery(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, size: number, theme: typeof THEMES[0]) {
  if (type === 'palm') {
    // Palm tree trunk
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.05, y);
    ctx.lineTo(x - size * 0.08, y - size * 0.8);
    ctx.lineTo(x + size * 0.08, y - size * 0.8);
    ctx.lineTo(x + size * 0.05, y);
    ctx.fill();

    // Palm leaves
    ctx.fillStyle = '#228B22';
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.8);
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * size * 0.5,
        y - size * 0.9 + Math.sin(angle) * size * 0.2,
        x + Math.cos(angle) * size * 0.6,
        y - size * 0.7 + Math.sin(angle) * size * 0.3
      );
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * size * 0.3,
        y - size * 0.8,
        x, y - size * 0.8
      );
      ctx.fill();
    }
  } else if (type === 'tree') {
    // Tree trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - size * 0.06, y - size * 0.5, size * 0.12, size * 0.5);

    // Tree foliage
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.3, y - size * 0.5);
    ctx.lineTo(x + size * 0.3, y - size * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.8);
    ctx.lineTo(x - size * 0.35, y - size * 0.35);
    ctx.lineTo(x + size * 0.35, y - size * 0.35);
    ctx.fill();
  } else if (type === 'building') {
    // Building
    const buildingH = size * (0.8 + Math.random() * 0.4);
    ctx.fillStyle = '#37474F';
    ctx.fillRect(x - size * 0.2, y - buildingH, size * 0.4, buildingH);

    // Windows
    ctx.fillStyle = '#FFC107';
    const rows = Math.floor(buildingH / (size * 0.15));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 3; col++) {
        if (Math.random() > 0.3) {
          ctx.fillRect(
            x - size * 0.15 + col * size * 0.12,
            y - buildingH + size * 0.1 + row * size * 0.15,
            size * 0.08,
            size * 0.08
          );
        }
      }
    }
  } else if (type === 'rock') {
    ctx.fillStyle = '#78909C';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y);
    ctx.lineTo(x - size * 0.25, y - size * 0.15);
    ctx.lineTo(x - size * 0.1, y - size * 0.3);
    ctx.lineTo(x + size * 0.15, y - size * 0.25);
    ctx.lineTo(x + size * 0.2, y - size * 0.1);
    ctx.lineTo(x + size * 0.15, y);
    ctx.fill();
  } else if (type === 'sign') {
    // Sign post
    ctx.fillStyle = '#757575';
    ctx.fillRect(x - 3, y - size * 0.6, 6, size * 0.6);

    // Sign board
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(x - size * 0.25, y - size * 0.7, size * 0.5, size * 0.25);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('→', x, y - size * 0.55);
  }
}

// Baton Overlay
const BatonOverlay: React.FC<{ currentRound: number; nextPlayer: string; onBatonComplete: () => void }> = ({ currentRound, nextPlayer, onBatonComplete }) => {
  const [isHighFived, setIsHighFived] = useState(false);

  const handleHighFive = () => {
    setIsHighFived(true);
    setTimeout(onBatonComplete, 700);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6 text-center">
      <div className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-3">Relay Transition</div>
      <h2 className="text-3xl font-black italic mb-2">ROUND {currentRound} CLEAR!</h2>
      <p className="text-slate-400 text-sm mb-8">다음 주자: <span className="text-white font-bold">{nextPlayer}</span></p>

      {!isHighFived ? (
        <button onClick={handleHighFive} className="relative w-36 h-36 rounded-full flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-600/20 animate-ping" />
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-600 to-blue-800 shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform">
            <span className="text-5xl mb-1">🤝</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Baton Pass!</span>
          </div>
        </button>
      ) : (
        <div className="flex flex-col items-center animate-bounce">
          <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <span className="text-5xl">🏃</span>
          </div>
          <div className="mt-4 text-lg font-black text-green-400 uppercase">GO!</div>
        </div>
      )}
    </div>
  );
};

// Result Overlay
const ResultOverlay: React.FC<{ isSuccess: boolean; stats: GameStats; onRetry: (full: boolean) => void; onComplete: () => void }> = ({ isSuccess, stats, onRetry, onComplete }) => {
  const topObstacle = stats.obstaclesHit.length > 0
    ? Object.entries(stats.obstaclesHit.reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {} as Record<string, number>))
        .sort((a, b) => b[1] - a[1])[0][0]
    : "퍼펙트 런!";

  const fastestRound = stats.roundTimes.length > 0 ? Math.min(...stats.roundTimes) : 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-xl p-4 text-center overflow-y-auto">
      <div className="w-full max-w-lg py-6 flex flex-col items-center">
        {isSuccess ? (
          <div className="flex flex-col items-center mb-6">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <h1 className="text-4xl font-black italic mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              본사 복귀 성공!
            </h1>
            <p className="text-cyan-400 text-xs uppercase tracking-widest font-bold">Mission Complete</p>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-6">
            <div className="text-6xl mb-4">💥</div>
            <h1 className="text-4xl font-black italic mb-1 text-red-400">미션 실패</h1>
            <p className="text-slate-500 text-xs">다시 도전하세요!</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-500 uppercase">최단 라운드</div>
            <div className="text-xl font-black text-cyan-400">{fastestRound > 0 ? `${fastestRound}s` : '--'}</div>
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
            <span className="font-bold text-red-400">{topObstacle}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {isSuccess ? (
            <button onClick={onComplete} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black rounded-xl uppercase tracking-widest active:scale-95 transition-all">
              미션 완료! 🎉
            </button>
          ) : (
            <>
              <button onClick={() => onRetry(false)} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl uppercase tracking-widest active:scale-95 transition-all">
                현재 단계 재시도
              </button>
              <button onClick={() => onRetry(true)} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl active:scale-95 transition-all">
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
