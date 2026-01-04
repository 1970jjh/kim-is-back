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
  x: number;
  z: number;
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
  x: number;
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

// Constants - 위에서 내려다보는 3인칭 뷰 (더 넓은 도로, 느린 속도)
const TOTAL_PLAYERS = 6;
const INITIAL_TIME_LIMIT = 420; // 7분 (주자당 1분+)
const MAX_FUEL = 100;
const DISTANCE_PER_ROUND = 800; // 1분 정도 걸리도록
const ROAD_WIDTH = 8000; // 도로 폭 더 확대
const SEGMENT_LENGTH = 200;
const DRAW_DISTANCE = 80; // 더 가까이 보이게
const FOV = 60; // 좁은 FOV로 위에서 보는 느낌
const CAMERA_HEIGHT = 1800; // 카메라 높이 올림 (위에서 내려다보기)

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

// ============ SOUND ENGINE ============
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const GameSounds = {
  // 엔진 드론 사운드 (지속적)
  engineOsc: null as OscillatorNode | null,
  engineGain: null as GainNode | null,

  startEngine: () => {
    const ctx = getAudioContext();
    if (GameSounds.engineOsc) return;

    GameSounds.engineOsc = ctx.createOscillator();
    GameSounds.engineGain = ctx.createGain();

    GameSounds.engineOsc.type = 'sawtooth';
    GameSounds.engineOsc.frequency.setValueAtTime(80, ctx.currentTime);
    GameSounds.engineGain.gain.setValueAtTime(0.03, ctx.currentTime);

    GameSounds.engineOsc.connect(GameSounds.engineGain);
    GameSounds.engineGain.connect(ctx.destination);
    GameSounds.engineOsc.start();
  },

  updateEngine: (speed: number) => {
    if (!GameSounds.engineOsc || !GameSounds.engineGain) return;
    const ctx = getAudioContext();
    // 속도에 따라 엔진 피치 변경 (새 속도 기준 max 40)
    const freq = 50 + (speed / 40) * 80;
    const vol = 0.02 + (speed / 40) * 0.04;
    GameSounds.engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
    GameSounds.engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  },

  stopEngine: () => {
    if (GameSounds.engineOsc) {
      GameSounds.engineOsc.stop();
      GameSounds.engineOsc = null;
      GameSounds.engineGain = null;
    }
  },

  // 아이템 획득 사운드
  playPickup: () => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  },

  // 부스트 사운드
  playBoost: () => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  },

  // 충돌 사운드
  playCrash: () => {
    const ctx = getAudioContext();

    // 노이즈 생성
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  },

  // 방패 획득 사운드
  playShield: () => {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(523, ctx.currentTime); // C5
    osc2.frequency.setValueAtTime(659, ctx.currentTime); // E5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.4);
    osc2.stop(ctx.currentTime + 0.4);
  }
};

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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showYouTube, setShowYouTube] = useState(false);

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

  // 게임 종료 시 엔진 사운드 정지
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      GameSounds.stopEngine();
    }
    return () => GameSounds.stopEngine();
  }, [gameState]);

  const handleStart = () => {
    setGameState(GameState.PLAYING);
    if (soundEnabled) {
      GameSounds.startEngine();
    }
  };

  const handleBatonTouch = () => {
    if (stats.round >= TOTAL_PLAYERS) {
      setGameState(GameState.SUCCESS);
    } else {
      setGameState(GameState.PLAYING);
      setStats(prev => ({ ...prev, round: prev.round + 1, currentDistance: 0 }));
      if (soundEnabled) GameSounds.startEngine();
    }
  };

  const handleRoundComplete = () => {
    GameSounds.stopEngine();
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
    GameSounds.stopEngine();
    setGameState(GameState.GAMEOVER);
  };

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
    if (soundEnabled) GameSounds.startEngine();
  };

  const getPlayerName = (round: number) => {
    if (teamMembers && teamMembers[round - 1]) {
      return `${teamMembers[round - 1].name} (${teamMembers[round - 1].role})`;
    }
    return PLAYER_NAMES[round - 1] || `주자 ${round}`;
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-slate-900 text-white">
      {/* YouTube Background Audio */}
      {showYouTube && (
        <div className="absolute top-16 right-4 z-30">
          <div className="bg-black/80 p-2 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-white">🎵 레이싱 BGM</span>
              <button
                onClick={() => setShowYouTube(false)}
                className="text-white text-xs bg-red-600 px-2 py-1 rounded"
              >
                ✕ 끄기
              </button>
            </div>
            <iframe
              width="200"
              height="40"
              src="https://www.youtube.com/embed/HTREarRyiTA?autoplay=1&loop=1"
              title="Racing BGM"
              allow="autoplay"
              className="rounded"
            />
          </div>
        </div>
      )}

      {/* Sound Controls */}
      {gameState === GameState.START && (
        <div className="absolute top-4 right-4 z-30 flex gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
              soundEnabled ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            {soundEnabled ? '🔊 효과음 ON' : '🔇 효과음 OFF'}
          </button>
          <button
            onClick={() => setShowYouTube(!showYouTube)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
              showYouTube ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            {showYouTube ? '🎵 BGM OFF' : '🎵 BGM ON'}
          </button>
        </div>
      )}

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
          soundEnabled={soundEnabled}
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
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">02</span><span>🔴 빨간 차량 = 부정적 요소 (에너지 -25, 딜레이)</span></p>
        <p className="flex gap-3"><span className="text-cyan-500 font-bold">03</span><span>⬅️ ➡️ 좌우 버튼으로 피하거나 아이템 획득!</span></p>
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
  soundEnabled: boolean;
  onHitObstacle: (label: string) => void;
  onAvoidObstacle: () => void;
  onCollectFuel: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  round, onRoundComplete, onGameOver, timeLeft, playerName, soundEnabled,
  onHitObstacle, onAvoidObstacle, onCollectFuel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [fuelUI, setFuelUI] = useState(MAX_FUEL);
  const [hitFlash, setHitFlash] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 충돌 시 일시정지

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
  const pauseTimerRef = useRef<number | null>(null);

  const getCurve = (z: number) => {
    const curve1 = Math.sin(z * 0.0004) * 0.6;
    const curve2 = Math.sin(z * 0.0008) * 0.3;
    return curve1 + curve2;
  };

  const getHill = (z: number) => {
    return Math.sin(z * 0.0003) * 500 + Math.sin(z * 0.0006) * 300;
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
    setIsPaused(false);

    sceneryRef.current = [];
    for (let i = 0; i < 80; i++) {
      const theme = THEMES[(round - 1) % THEMES.length];
      const type = theme.sceneryTypes[Math.floor(Math.random() * theme.sceneryTypes.length)];
      sceneryRef.current.push({
        type,
        side: Math.random() > 0.5 ? 'left' : 'right',
        z: i * 400 + Math.random() * 200,
        offset: 1.3 + Math.random() * 1.0
      });
    }

    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
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

  // Spawn entity - 다른 차량들도 같이 달리는 느낌
  const spawnEntity = useCallback(() => {
    const roll = Math.random();
    let type: EntityType;
    let label = '';
    let color = '';
    let driveSpeed = 0; // 차량이 앞으로 달리는 속도 (플레이어보다 느리면 추월)

    if (roll < 0.25) {
      type = EntityType.ITEM_FUEL;
      label = ITEMS_ENERGY[Math.floor(Math.random() * ITEMS_ENERGY.length)];
      color = '#10b981';
      driveSpeed = 0; // 아이템은 정지
    } else if (roll < 0.35) {
      type = EntityType.ITEM_BOOST;
      label = ITEMS_BOOST[Math.floor(Math.random() * ITEMS_BOOST.length)];
      color = '#fbbf24';
      driveSpeed = 0;
    } else if (roll < 0.42) {
      type = EntityType.ITEM_SHIELD;
      label = ITEMS_SHIELD[Math.floor(Math.random() * ITEMS_SHIELD.length)];
      color = '#3b82f6';
      driveSpeed = 0;
    } else if (roll < 0.62) {
      type = EntityType.OBSTACLE_CAR_FAST;
      label = OBSTACLES_HUMAN[Math.floor(Math.random() * OBSTACLES_HUMAN.length)];
      color = '#ef4444';
      driveSpeed = 18; // 빠른 차 (플레이어 25보다 느림 → 추월 가능)
    } else if (roll < 0.82) {
      type = EntityType.OBSTACLE_CAR_SLOW;
      label = OBSTACLES_WORK[Math.floor(Math.random() * OBSTACLES_WORK.length)];
      color = '#dc2626';
      driveSpeed = 12; // 느린 차
    } else {
      type = EntityType.OBSTACLE_TRUCK;
      label = OBSTACLES_CULTURE[Math.floor(Math.random() * OBSTACLES_CULTURE.length)];
      color = '#991b1b';
      driveSpeed = 8; // 트럭은 가장 느림
    }

    // 5개 레인으로 확대 (더 넓은 도로)
    const lanes = [-0.7, -0.35, 0, 0.35, 0.7];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];

    entitiesRef.current.push({
      id: Date.now() + Math.random(),
      type,
      x: laneX,
      z: positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH * 0.7,
      width: type === EntityType.OBSTACLE_TRUCK ? 0.4 : 0.3, // 크기 증가
      height: type === EntityType.OBSTACLE_TRUCK ? 0.25 : 0.2,
      speed: driveSpeed, // 앞으로 달리는 속도
      label, color
    });
  }, []);

  // Main game loop
  const update = useCallback((time: number) => {
    if (!gameActiveRef.current) return;
    if (isPaused) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const player = stateRef.current;
    const theme = THEMES[(round - 1) % THEMES.length];

    // Player movement - 넓은 도로에 맞게 조향 속도 증가
    const steerSpeed = 0.06;
    if (controlRef.current.left) player.x -= steerSpeed;
    if (controlRef.current.right) player.x += steerSpeed;
    player.x = Math.max(-1.0, Math.min(1.0, player.x)); // 도로 안에서만 이동

    // Speed control - 대폭 감소
    const isOffRoad = Math.abs(player.x) > 0.9;
    let maxSpeed = player.boostTimer > 0 ? 35 : 25; // 속도 30%로 감소 (1분 플레이)
    if (isOffRoad) maxSpeed = 10;

    player.speed += (maxSpeed - player.speed) * 0.03;
    if (player.boostTimer > 0) player.boostTimer -= 16;
    if (player.shieldTimer > 0) player.shieldTimer -= 16;
    if (player.shieldTimer <= 0) player.shield = false;

    // 엔진 사운드 업데이트
    if (soundEnabled) {
      GameSounds.updateEngine(player.speed);
    }

    // Fuel consumption - 더 느리게
    player.fuel -= (player.boostTimer > 0 ? 0.004 : 0.006);
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

    // Spawn entities - 더 간격 넓게
    if (positionRef.current - lastSpawnRef.current > 1500) {
      if (Math.random() < 0.8) spawnEntity();
      lastSpawnRef.current = positionRef.current;
    }

    // Update scenery
    sceneryRef.current.forEach(s => {
      if (s.z < positionRef.current - 500) {
        s.z += 32000;
        s.type = theme.sceneryTypes[Math.floor(Math.random() * theme.sceneryTypes.length)];
        s.side = Math.random() > 0.5 ? 'left' : 'right';
        s.offset = 1.3 + Math.random() * 1.0;
      }
    });

    // Update entities and collision - 다른 차량도 앞으로 달림
    entitiesRef.current = entitiesRef.current.filter(e => {
      // 차량들도 앞으로 달림 (플레이어보다 느리면 추월당함)
      e.z += e.speed;

      const relZ = e.z - positionRef.current;
      if (relZ < -300) {
        if (e.type.startsWith('OBSTACLE')) onAvoidObstacle();
        return false;
      }
      if (relZ > DRAW_DISTANCE * SEGMENT_LENGTH) return true;

      // Collision - 더 넓은 판정
      const playerWidth = 0.3;
      const collisionZ = 400;

      if (relZ > 0 && relZ < collisionZ) {
        const dx = Math.abs(e.x - player.x);
        if (dx < (playerWidth + e.width) / 2) {
          if (e.type.startsWith('OBSTACLE')) {
            if (player.shield) {
              player.shield = false;
              player.shieldTimer = 0;
              shakeRef.current = 30;
              player.speed *= 0.5;
              if (soundEnabled) GameSounds.playCrash();
            } else {
              onHitObstacle(e.label);
              player.speed = 0;
              player.fuel = Math.max(0, player.fuel - 25);
              shakeRef.current = 100; // 더 강한 화면 흔들림

              // 모바일 진동 효과
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100]); // 진동 패턴
              }

              setHitFlash(true);

              // 충돌 시 0.5초 딜레이
              setIsPaused(true);
              if (soundEnabled) GameSounds.playCrash();

              pauseTimerRef.current = window.setTimeout(() => {
                setIsPaused(false);
                setHitFlash(false);
              }, 500);
            }
            return false;
          } else {
            // Item pickup
            if (e.type === EntityType.ITEM_FUEL) {
              player.fuel = Math.min(MAX_FUEL, player.fuel + 25);
              onCollectFuel();
              if (soundEnabled) GameSounds.playPickup();
            }
            if (e.type === EntityType.ITEM_BOOST) {
              player.boostTimer = 5000;
              if (soundEnabled) GameSounds.playBoost();
            }
            if (e.type === EntityType.ITEM_SHIELD) {
              player.shield = true;
              player.shieldTimer = 10000;
              if (soundEnabled) GameSounds.playShield();
            }
            return false;
          }
        }
      }
      return true;
    });

    // Shake decay
    if (shakeRef.current > 0) shakeRef.current *= 0.9;

    // Draw
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    if (shakeRef.current > 1) {
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
    }

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    skyGrad.addColorStop(0, theme.sky1);
    skyGrad.addColorStop(1, theme.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.45);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 180 + positionRef.current * 0.008) % (w + 100)) - 50;
      const cy = 40 + i * 25;
      ctx.beginPath();
      ctx.arc(cx, cy, 25 + i * 4, 0, Math.PI * 2);
      ctx.arc(cx + 20, cy - 8, 20 + i * 3, 0, Math.PI * 2);
      ctx.arc(cx + 40, cy, 18 + i * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mountains
    ctx.fillStyle = theme.fog;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45);
    for (let x = 0; x <= w; x += 40) {
      const mountainY = h * 0.45 - 15 - Math.sin((x + positionRef.current * 0.015) * 0.025) * 25 - Math.sin((x + positionRef.current * 0.008) * 0.012) * 40;
      ctx.lineTo(x, mountainY);
    }
    ctx.lineTo(w, h * 0.45);
    ctx.closePath();
    ctx.fill();

    // Ground - 잔디색으로 바닥 전체 채움
    ctx.fillStyle = theme.grass1;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // Road segments
    const baseSegment = Math.floor(positionRef.current / SEGMENT_LENGTH);
    const basePercent = (positionRef.current % SEGMENT_LENGTH) / SEGMENT_LENGTH;

    const segments: Array<{
      x: number; y: number; w: number; scale: number;
      curve: number; index: number;
    }> = [];

    let maxY = h;
    for (let i = 0; i < DRAW_DISTANCE; i++) {
      const segIndex = baseSegment + i;
      const segZ = (i - basePercent) * SEGMENT_LENGTH;

      if (segZ <= 0) continue;

      const scale = FOV / segZ;
      const projY = h * 0.45 + (CAMERA_HEIGHT - getHill(segIndex * SEGMENT_LENGTH)) * scale;
      const projW = ROAD_WIDTH * scale;
      const projX = w / 2 - (player.x * projW * 0.4) + getCurve(segIndex * SEGMENT_LENGTH) * projW * 0.5;

      if (projY < maxY && projY > h * 0.3) {
        segments.push({ x: projX, y: projY, w: projW, scale, curve: getCurve(segIndex * SEGMENT_LENGTH), index: segIndex });
        maxY = projY;
      }
    }

    // Draw road
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const nextSeg = segments[i - 1];
      if (!nextSeg) continue;

      const isStripe = (seg.index % 2) === 0;

      // Grass
      ctx.fillStyle = isStripe ? theme.grass1 : theme.grass2;
      ctx.fillRect(0, nextSeg.y, w, seg.y - nextSeg.y);

      // Rumble strips
      const rumbleW = seg.w * 0.08;
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

      // Lane markers
      if (isStripe) {
        ctx.fillStyle = theme.line;
        const lineW = seg.w * 0.015;

        // Left lane
        ctx.beginPath();
        ctx.moveTo(seg.x - seg.w * 0.25 - lineW, seg.y);
        ctx.lineTo(nextSeg.x - nextSeg.w * 0.25 - lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(nextSeg.x - nextSeg.w * 0.25 + lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(seg.x - seg.w * 0.25 + lineW, seg.y);
        ctx.fill();

        // Right lane
        ctx.beginPath();
        ctx.moveTo(seg.x + seg.w * 0.25 - lineW, seg.y);
        ctx.lineTo(nextSeg.x + nextSeg.w * 0.25 - lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(nextSeg.x + nextSeg.w * 0.25 + lineW * nextSeg.scale / seg.scale, nextSeg.y);
        ctx.lineTo(seg.x + seg.w * 0.25 + lineW, seg.y);
        ctx.fill();
      }
    }

    // 화면 하단까지 도로 확장 (초록색 띠 제거)
    if (segments.length > 0) {
      const lastSeg = segments[0]; // 가장 가까운 세그먼트
      const bottomY = h + 50; // 화면 바깥까지 확장

      // 하단 도로 폭 계산 (더 넓게)
      const bottomScale = lastSeg.scale * 2;
      const bottomW = ROAD_WIDTH * bottomScale;
      const bottomX = w / 2 - (player.x * bottomW * 0.4) + lastSeg.curve * bottomW * 0.5;

      // 잔디 (하단)
      ctx.fillStyle = theme.grass1;
      ctx.fillRect(0, lastSeg.y, w, bottomY - lastSeg.y);

      // Rumble strips (하단)
      const rumbleW = lastSeg.w * 0.08;
      ctx.fillStyle = theme.rumble1;
      ctx.beginPath();
      ctx.moveTo(lastSeg.x - lastSeg.w / 2, lastSeg.y);
      ctx.lineTo(bottomX - bottomW / 2, bottomY);
      ctx.lineTo(bottomX - bottomW / 2 - rumbleW * 3, bottomY);
      ctx.lineTo(lastSeg.x - lastSeg.w / 2 - rumbleW, lastSeg.y);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(lastSeg.x + lastSeg.w / 2, lastSeg.y);
      ctx.lineTo(bottomX + bottomW / 2, bottomY);
      ctx.lineTo(bottomX + bottomW / 2 + rumbleW * 3, bottomY);
      ctx.lineTo(lastSeg.x + lastSeg.w / 2 + rumbleW, lastSeg.y);
      ctx.fill();

      // 도로 표면 (하단까지)
      ctx.fillStyle = theme.road;
      ctx.beginPath();
      ctx.moveTo(lastSeg.x - lastSeg.w / 2, lastSeg.y);
      ctx.lineTo(bottomX - bottomW / 2, bottomY);
      ctx.lineTo(bottomX + bottomW / 2, bottomY);
      ctx.lineTo(lastSeg.x + lastSeg.w / 2, lastSeg.y);
      ctx.fill();
    }

    // Draw scenery
    const sortedScenery = [...sceneryRef.current]
      .filter(s => s.z > positionRef.current && s.z < positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH)
      .sort((a, b) => b.z - a.z);

    sortedScenery.forEach(s => {
      const relZ = s.z - positionRef.current;
      if (relZ <= 0) return;
      const scale = FOV / relZ;
      const projY = h * 0.45 + (CAMERA_HEIGHT - getHill(s.z)) * scale;
      const projW = ROAD_WIDTH * scale;
      const roadX = w / 2 - (player.x * projW * 0.4) + getCurve(s.z) * projW * 0.5;
      const projX = roadX + (s.side === 'left' ? -1 : 1) * (projW * 0.5 + projW * s.offset * 0.25);

      const size = 250 * scale;
      if (size < 4) return;

      drawScenery(ctx, s.type, projX, projY, size, theme);
    });

    // Draw entities (다른 차량들) - 더 크게, 더 잘 보이게
    const sortedEntities = [...entitiesRef.current]
      .filter(e => e.z > positionRef.current && e.z < positionRef.current + DRAW_DISTANCE * SEGMENT_LENGTH)
      .sort((a, b) => b.z - a.z);

    sortedEntities.forEach(e => {
      const relZ = e.z - positionRef.current;
      if (relZ <= 0) return;
      const scale = FOV / relZ;
      const projY = h * 0.45 + (CAMERA_HEIGHT - getHill(e.z)) * scale;
      const projW = ROAD_WIDTH * scale;
      const roadX = w / 2 - (player.x * projW * 0.4) + getCurve(e.z) * projW * 0.5;
      const projX = roadX + e.x * projW * 0.4;

      // 차량/아이템 크기 2배 증가
      const size = 700 * scale;
      if (size < 15) return;

      if (e.type.includes('OBSTACLE')) {
        // 다른 차량 그리기 (2배 크기)
        drawOtherCar(ctx, projX, projY, size, e.color, e.type === EntityType.OBSTACLE_TRUCK);
      } else {
        drawItem(ctx, projX, projY, size, e.type, e.color);
      }

      // Label - 글자 크기 2배
      if (size > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(40, size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 12;
        ctx.fillText(e.label, projX, projY - size * 0.9);
        ctx.shadowBlur = 0;
      }
    });

    // Draw player car (3인칭 - 내 차가 화면 하단에 보임)
    drawPlayerCar(ctx, w, h, player.x, player.boostTimer > 0, player.shield);

    // Draw speedometer gauge (속도계)
    drawSpeedometer(ctx, w, h, player.speed);

    ctx.restore();

    // Hit flash overlay (충돌 시 빨간 플래시만, 검정화면 없음)
    if (hitFlash) {
      // 빨간 테두리 플래시 효과
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 20;
      ctx.strokeRect(5, 5, w * window.devicePixelRatio - 10, h * window.devicePixelRatio - 10);

      // 충돌 텍스트 (화면 상단)
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      ctx.fillText('💥 충돌!', w / 2 * window.devicePixelRatio, 80);
      ctx.shadowBlur = 0;
    }

    requestRef.current = requestAnimationFrame(update);
  }, [onRoundComplete, onGameOver, spawnEntity, onHitObstacle, onAvoidObstacle, onCollectFuel, round, hitFlash, isPaused, soundEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
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
      {/* HUD - 게임 중 대시보드 버튼 없음 */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/70 to-transparent z-20 pointer-events-none flex justify-between items-start px-4 pt-2">
        <div className="flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
            주자 {round}/6: {playerName}
          </div>
          <div className="text-lg font-black text-white">
            {Math.floor(distance)}m <span className="text-xs text-slate-500">/ {DISTANCE_PER_ROUND}m</span>
          </div>
          <div className="w-28 h-2 bg-slate-800 mt-1 rounded-full overflow-hidden border border-slate-600">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100"
              style={{ width: `${(distance / DISTANCE_PER_ROUND) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">TIME</div>
          <div className={`text-xl font-black tabular-nums ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
          <div className="mt-1 flex flex-col items-end">
            <div className={`text-[9px] font-bold ${fuelUI < 25 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
              ENERGY {Math.round(fuelUI)}%
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {[...Array(fuelSegments)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3 rounded-sm transition-all ${
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


      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Mobile Controls - 대시보드 버튼 없이 순수 컨트롤만 */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 pointer-events-none z-30">
        <button
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); controlRef.current.left = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); controlRef.current.left = false; }}
          onMouseDown={(e) => { e.stopPropagation(); controlRef.current.left = true; }}
          onMouseUp={(e) => { e.stopPropagation(); controlRef.current.left = false; }}
          onMouseLeave={() => controlRef.current.left = false}
          className="w-28 h-28 bg-cyan-600/40 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-cyan-500 active:scale-95 transition-all border-4 border-cyan-400/50 shadow-lg shadow-cyan-500/30"
        >
          <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); controlRef.current.right = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); controlRef.current.right = false; }}
          onMouseDown={(e) => { e.stopPropagation(); controlRef.current.right = true; }}
          onMouseUp={(e) => { e.stopPropagation(); controlRef.current.right = false; }}
          onMouseLeave={() => controlRef.current.right = false}
          className="w-28 h-28 bg-cyan-600/40 backdrop-blur rounded-2xl flex items-center justify-center pointer-events-auto active:bg-cyan-500 active:scale-95 transition-all border-4 border-cyan-400/50 shadow-lg shadow-cyan-500/30"
        >
          <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 3인칭 플레이어 자동차 그리기 (화면 하단 중앙, 크기 2배)
function drawPlayerCar(ctx: CanvasRenderingContext2D, w: number, h: number, playerX: number, boosting: boolean, shield: boolean) {
  const carW = 200; // 2배 크기
  const carH = 280;
  const baseX = w / 2 + playerX * w * 0.25; // 좌우 이동에 따라 위치 변경
  const baseY = h - 80; // 도로 위에 차가 보이도록

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 10, carW * 0.5, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // 부스트 불꽃 (차량 뒤에서)
  if (boosting) {
    ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, 0.9)`;
    // 왼쪽 배기구
    ctx.beginPath();
    ctx.moveTo(baseX - 30, baseY);
    ctx.lineTo(baseX - 35, baseY + 40 + Math.random() * 30);
    ctx.lineTo(baseX - 25, baseY);
    ctx.fill();
    // 오른쪽 배기구
    ctx.beginPath();
    ctx.moveTo(baseX + 30, baseY);
    ctx.lineTo(baseX + 35, baseY + 40 + Math.random() * 30);
    ctx.lineTo(baseX + 25, baseY);
    ctx.fill();
  }

  // 차체 (뒤에서 본 모습)
  // 뒤 범퍼
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(baseX - carW * 0.45, baseY - 15, carW * 0.9, 20);

  // 차체 메인
  ctx.fillStyle = '#2563eb'; // 파란색 스포츠카
  ctx.beginPath();
  ctx.moveTo(baseX - carW * 0.5, baseY - 15);
  ctx.lineTo(baseX - carW * 0.48, baseY - carH * 0.5);
  ctx.lineTo(baseX - carW * 0.35, baseY - carH * 0.7);
  ctx.lineTo(baseX + carW * 0.35, baseY - carH * 0.7);
  ctx.lineTo(baseX + carW * 0.48, baseY - carH * 0.5);
  ctx.lineTo(baseX + carW * 0.5, baseY - 15);
  ctx.closePath();
  ctx.fill();

  // 후면 유리창
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(baseX - carW * 0.32, baseY - carH * 0.5);
  ctx.lineTo(baseX - carW * 0.25, baseY - carH * 0.65);
  ctx.lineTo(baseX + carW * 0.25, baseY - carH * 0.65);
  ctx.lineTo(baseX + carW * 0.32, baseY - carH * 0.5);
  ctx.closePath();
  ctx.fill();

  // 지붕
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(baseX - carW * 0.25, baseY - carH * 0.65);
  ctx.lineTo(baseX - carW * 0.2, baseY - carH * 0.82);
  ctx.lineTo(baseX + carW * 0.2, baseY - carH * 0.82);
  ctx.lineTo(baseX + carW * 0.25, baseY - carH * 0.65);
  ctx.closePath();
  ctx.fill();

  // 테일라이트 (빨간색)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(baseX - carW * 0.45, baseY - 35, carW * 0.2, 12);
  ctx.fillRect(baseX + carW * 0.25, baseY - 35, carW * 0.2, 12);

  // 테일라이트 발광 효과
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#dc2626';
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(baseX - carW * 0.42, baseY - 32, carW * 0.15, 6);
  ctx.fillRect(baseX + carW * 0.27, baseY - 32, carW * 0.15, 6);
  ctx.shadowBlur = 0;

  // 뒷바퀴 (좌우)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(baseX - carW * 0.42, baseY - 8, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(baseX + carW * 0.42, baseY - 8, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 휠캡
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.ellipse(baseX - carW * 0.42, baseY - 8, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(baseX + carW * 0.42, baseY - 8, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 방패 효과
  if (shield) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.ellipse(baseX, baseY - carH * 0.4, carW * 0.7, carH * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 방패 글리프
    ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ SHIELD', baseX, baseY - carH - 20);
  }

  // 부스트 표시
  if (boosting) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 BOOST!', baseX, baseY - carH - 20);
  }
}

// 속도계 게이지 (왼쪽 하단, 방향키 위에 배치)
function drawSpeedometer(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number) {
  const centerX = 75;
  const centerY = h - 200; // 방향키 위로 올림
  const radius = 50;

  // 배경 원
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
  ctx.stroke();

  // 속도계 눈금 배경
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // 눈금선
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const innerR = i % 2 === 0 ? radius - 12 : radius - 8;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
    ctx.lineTo(centerX + Math.cos(angle) * (radius - 3), centerY + Math.sin(angle) * (radius - 3));
    ctx.stroke();
  }

  // 숫자 표시 (0, 20, 40)
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  const nums = [0, 20, 40];
  const numAngles = [Math.PI * 0.75, Math.PI * 1.5, Math.PI * 2.25];
  nums.forEach((num, i) => {
    const angle = numAngles[i];
    ctx.fillText(num.toString(), centerX + Math.cos(angle) * (radius - 20), centerY + Math.sin(angle) * (radius - 20) + 3);
  });

  // 속도 바늘 (최대 40km/h 기준)
  const maxSpeed = 40;
  const speedAngle = Math.PI * 0.75 + (Math.min(speed, maxSpeed) / maxSpeed) * Math.PI * 1.5;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(speedAngle) * (radius - 6), centerY + Math.sin(speedAngle) * (radius - 6));
  ctx.stroke();

  // 바늘 중심점
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // 속도 숫자 표시
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.floor(speed).toString(), centerX, centerY + 22);
  ctx.font = '7px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('km/h', centerX, centerY + 32);
}

// 다른 차량 그리기 (전방에서 오는 차량, 더 크고 선명하게)
function drawOtherCar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, isTruck: boolean) {
  const w = size * (isTruck ? 1.8 : 1.3);
  const h = size * (isTruck ? 2.5 : 1.8);

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5, w * 0.5, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isTruck) {
    // 트럭 차체
    ctx.fillStyle = color;
    ctx.fillRect(x - w * 0.4, y - h * 0.8, w * 0.8, h * 0.9);

    // 트럭 캐빈
    ctx.fillStyle = '#333';
    ctx.fillRect(x - w * 0.35, y - h * 0.75, w * 0.7, h * 0.2);

    // 앞유리
    ctx.fillStyle = '#1a3050';
    ctx.fillRect(x - w * 0.3, y - h * 0.7, w * 0.6, h * 0.12);

    // 헤드라이트
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffeb3b';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.25, y - h * 0.55, w * 0.08, h * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.25, y - h * 0.55, w * 0.08, h * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // 승용차 - 앞에서 본 모습 (마주 오는 차량)
    // 차체 메인
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y);
    ctx.lineTo(x - w * 0.48, y - h * 0.35);
    ctx.lineTo(x - w * 0.35, y - h * 0.55);
    ctx.lineTo(x - w * 0.25, y - h * 0.75);
    ctx.lineTo(x + w * 0.25, y - h * 0.75);
    ctx.lineTo(x + w * 0.35, y - h * 0.55);
    ctx.lineTo(x + w * 0.48, y - h * 0.35);
    ctx.lineTo(x + w * 0.45, y);
    ctx.closePath();
    ctx.fill();

    // 앞유리
    ctx.fillStyle = '#1a3050';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.25, y - h * 0.55);
    ctx.lineTo(x - w * 0.2, y - h * 0.7);
    ctx.lineTo(x + w * 0.2, y - h * 0.7);
    ctx.lineTo(x + w * 0.25, y - h * 0.55);
    ctx.closePath();
    ctx.fill();

    // 그릴
    ctx.fillStyle = '#111';
    ctx.fillRect(x - w * 0.3, y - h * 0.32, w * 0.6, h * 0.08);

    // 헤드라이트 (발광 효과)
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffeb3b';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.35, y - h * 0.38, w * 0.1, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y - h * 0.38, w * 0.1, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 범퍼
    ctx.fillStyle = '#222';
    ctx.fillRect(x - w * 0.45, y - h * 0.15, w * 0.9, h * 0.08);
  }

  // 바퀴 (앞에서 보이는 것처럼)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.4, y - 3, w * 0.12, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.4, y - 3, w * 0.12, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, isTruck: boolean) {
  const w = size * (isTruck ? 1.6 : 1.1);
  const h = size * (isTruck ? 2.2 : 1.6);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5, w * 0.45, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  if (isTruck) {
    ctx.rect(x - w * 0.4, y - h * 0.45, w * 0.8, h * 0.9);
  } else {
    ctx.moveTo(x - w * 0.38, y + h * 0.35);
    ctx.lineTo(x - w * 0.42, y - h * 0.05);
    ctx.lineTo(x - w * 0.28, y - h * 0.38);
    ctx.lineTo(x + w * 0.28, y - h * 0.38);
    ctx.lineTo(x + w * 0.42, y - h * 0.05);
    ctx.lineTo(x + w * 0.38, y + h * 0.35);
    ctx.closePath();
  }
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#1a3050';
  if (isTruck) {
    ctx.fillRect(x - w * 0.32, y - h * 0.35, w * 0.64, h * 0.22);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.22, y - h * 0.08);
    ctx.lineTo(x - w * 0.18, y - h * 0.28);
    ctx.lineTo(x + w * 0.18, y - h * 0.28);
    ctx.lineTo(x + w * 0.22, y - h * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  // Headlights
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.25, y - h * 0.35, w * 0.08, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.25, y - h * 0.35, w * 0.08, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: EntityType, color: string) {
  ctx.save();
  ctx.shadowBlur = size * 0.4;
  ctx.shadowColor = color;

  if (type === EntityType.ITEM_FUEL) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.45);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, y + size * 0.12);
  } else if (type === EntityType.ITEM_BOOST) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.45);
    ctx.lineTo(x - size * 0.25, y);
    ctx.lineTo(x - size * 0.05, y);
    ctx.lineTo(x - size * 0.18, y + size * 0.45);
    ctx.lineTo(x + size * 0.25, y - size * 0.1);
    ctx.lineTo(x + size * 0.05, y - size * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (type === EntityType.ITEM_SHIELD) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.4);
    ctx.lineTo(x - size * 0.35, y - size * 0.2);
    ctx.lineTo(x - size * 0.35, y + size * 0.15);
    ctx.quadraticCurveTo(x, y + size * 0.45, x + size * 0.35, y + size * 0.15);
    ctx.lineTo(x + size * 0.35, y - size * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.25}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🛡', x, y + size * 0.08);
  }

  ctx.restore();
}

function drawScenery(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, size: number, theme: typeof THEMES[0]) {
  if (type === 'palm') {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.04, y);
    ctx.lineTo(x - size * 0.06, y - size * 0.75);
    ctx.lineTo(x + size * 0.06, y - size * 0.75);
    ctx.lineTo(x + size * 0.04, y);
    ctx.fill();

    ctx.fillStyle = '#228B22';
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.75);
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * size * 0.45,
        y - size * 0.85 + Math.sin(angle) * size * 0.15,
        x + Math.cos(angle) * size * 0.55,
        y - size * 0.65 + Math.sin(angle) * size * 0.25
      );
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * size * 0.25,
        y - size * 0.75,
        x, y - size * 0.75
      );
      ctx.fill();
    }
  } else if (type === 'tree') {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - size * 0.05, y - size * 0.45, size * 0.1, size * 0.45);

    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.95);
    ctx.lineTo(x - size * 0.28, y - size * 0.45);
    ctx.lineTo(x + size * 0.28, y - size * 0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.75);
    ctx.lineTo(x - size * 0.32, y - size * 0.3);
    ctx.lineTo(x + size * 0.32, y - size * 0.3);
    ctx.fill();
  } else if (type === 'building') {
    const buildingH = size * (0.7 + Math.random() * 0.3);
    ctx.fillStyle = '#37474F';
    ctx.fillRect(x - size * 0.18, y - buildingH, size * 0.36, buildingH);

    ctx.fillStyle = '#FFC107';
    const rows = Math.floor(buildingH / (size * 0.12));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        if (Math.random() > 0.25) {
          ctx.fillRect(
            x - size * 0.12 + col * size * 0.14,
            y - buildingH + size * 0.08 + row * size * 0.12,
            size * 0.08,
            size * 0.06
          );
        }
      }
    }
  } else if (type === 'rock') {
    ctx.fillStyle = '#78909C';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.18, y);
    ctx.lineTo(x - size * 0.22, y - size * 0.12);
    ctx.lineTo(x - size * 0.08, y - size * 0.25);
    ctx.lineTo(x + size * 0.12, y - size * 0.2);
    ctx.lineTo(x + size * 0.18, y - size * 0.08);
    ctx.lineTo(x + size * 0.12, y);
    ctx.fill();
  } else if (type === 'sign') {
    ctx.fillStyle = '#757575';
    ctx.fillRect(x - 2, y - size * 0.55, 4, size * 0.55);

    ctx.fillStyle = '#1565C0';
    ctx.fillRect(x - size * 0.22, y - size * 0.65, size * 0.44, size * 0.22);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.12}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('→', x, y - size * 0.5);
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
