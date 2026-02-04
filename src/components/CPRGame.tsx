import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CPRGameProps {
  onComplete: (score: number) => void;
  onClose: () => void;
}

// Web Audio API 사운드
const createAudioContext = () => {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

const CPRGame: React.FC<CPRGameProps> = ({ onComplete, onClose }) => {
  const [gamePhase, setGamePhase] = useState<'intro' | 'step1' | 'step2' | 'step3' | 'result'>('intro');
  const [score, setScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [bpm, setBpm] = useState(0);
  const [feedback, setFeedback] = useState('READY');
  const [feedbackColor, setFeedbackColor] = useState('#ffffff');
  const [perfectCount, setPerfectCount] = useState(0);
  const [heartBeat, setHeartBeat] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPass, setIsPass] = useState(false);

  const lastClickTime = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const playSound = useCallback((type: 'tick' | 'correct' | 'error') => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    switch (type) {
      case 'correct':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        break;
      default:
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }, []);

  // Start game
  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setAiScore(0);
    setTimeLeft(30);
    setPerfectCount(0);
    setFeedback('START!');
    lastClickTime.current = 0;

    // Timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // AI scoring - 난이도 하향 조정: 점수 15-20% 감소
    aiTimerRef.current = setInterval(() => {
      if (Math.random() < 0.88) {
        // 88% 확률로 정상 점수 (기존 96%)
        setAiScore(prev => prev + 95 + Math.floor(Math.random() * 20));
      } else {
        // 12% 확률로 낮은 점수 (기존 4%)
        setAiScore(prev => prev + 30);
      }
    }, 650); // 기존 600ms -> 650ms로 늦춤
  };

  const endGame = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    setGamePhase('result');
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    };
  }, []);

  // Handle compression
  const handleCompression = useCallback(() => {
    if (!isPlaying) return;

    const now = Date.now();

    // 태블릿 터치 이슈 방지: 최소 200ms 간격 필요 (300 BPM 제한)
    if (lastClickTime.current !== 0 && now - lastClickTime.current < 200) {
      return; // 너무 빠른 연속 터치 무시
    }

    setHeartBeat(true);
    setTimeout(() => setHeartBeat(false), 150);

    if (lastClickTime.current === 0) {
      lastClickTime.current = now;
      playSound('tick');
      return;
    }

    const delta = now - lastClickTime.current;
    lastClickTime.current = now;
    const currentBpm = Math.round(60000 / delta);
    setBpm(currentBpm);

    let scoreAdd = 0;

    // CPR 적정 속도: 100-120 BPM
    if (currentBpm >= 100 && currentBpm <= 120) {
      // Perfect: 정확한 CPR 리듬
      setFeedback('PERFECT!');
      setFeedbackColor('#00ff88');
      playSound('correct');
      scoreAdd = 150 + (perfectCount * 20);
      setPerfectCount(prev => prev + 1);
    } else if (currentBpm >= 85 && currentBpm < 100) {
      // 약간 느림 - 보통 점수
      setFeedback('GOOD');
      setFeedbackColor('#88ff00');
      playSound('tick');
      scoreAdd = 60;
      setPerfectCount(0);
    } else if (currentBpm > 120 && currentBpm <= 140) {
      // 약간 빠름 - 보통 점수
      setFeedback('GOOD');
      setFeedbackColor('#88ff00');
      playSound('tick');
      scoreAdd = 60;
      setPerfectCount(0);
    } else if (currentBpm < 85) {
      // 너무 느림 - 점수 없음
      setFeedback('TOO SLOW!');
      setFeedbackColor('#ffcc00');
      playSound('error');
      scoreAdd = 0;
      setPerfectCount(0);
    } else if (currentBpm > 140 && currentBpm <= 200) {
      // 너무 빠름 - 점수 없음
      setFeedback('TOO FAST!');
      setFeedbackColor('#ff3366');
      playSound('error');
      scoreAdd = 0;
      setPerfectCount(0);
    } else {
      // 마구잡이 연타 (200 BPM 초과) - 감점
      setFeedback('WRONG!');
      setFeedbackColor('#ff0000');
      playSound('error');
      scoreAdd = -50;
      setPerfectCount(0);
    }

    setScore(prev => Math.max(0, prev + scoreAdd));
  }, [isPlaying, perfectCount, playSound]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPlaying) {
        e.preventDefault();
        handleCompression();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handleCompression]);

  // Calculate result
  useEffect(() => {
    if (gamePhase === 'result') {
      setIsPass(score > aiScore);
    }
  }, [gamePhase, score, aiScore]);

  const handleFinish = () => {
    if (isPass) {
      onComplete(score);
    }
  };

  const bpmPercent = Math.min((bpm / 200) * 100, 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #240b36 0%, #c31432 100%)'
    }}>
      {/* Background orbs */}
      <div className="absolute w-72 h-72 rounded-full opacity-60 -top-12 -left-12" style={{ background: '#ff00cc', filter: 'blur(80px)' }} />
      <div className="absolute w-96 h-96 rounded-full opacity-60 -bottom-24 -right-24" style={{ background: '#333399', filter: 'blur(80px)' }} />

      <div className="relative w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="p-4 text-center border-b border-white/10 bg-black/20">
          <h1 className="text-xl font-bold text-white">CPR 마스터 : AI 배틀</h1>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 text-white font-bold flex items-center justify-center hover:bg-red-600 z-10"
        >
          ✕
        </button>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {/* Intro */}
          {gamePhase === 'intro' && (
            <div className="text-center space-y-6 animate-fadeIn">
              <div className="text-6xl">🚑</div>
              <h2 className="text-2xl font-bold text-white">MISSION START</h2>
              <p className="text-white/80">
                <span className="text-pink-400 font-bold text-lg">VS CPR 마스터 AI</span><br /><br />
                AI 구조대원보다 더 정확한 리듬으로<br />
                생명을 살리는 골든타임을 확보하세요.<br /><br />
                <span className="border border-cyan-400 text-cyan-400 px-3 py-1 rounded-lg font-bold">
                  PASS 조건: AI 점수 이기기
                </span>
              </p>
              <button
                onClick={() => setGamePhase('step1')}
                className="w-full py-4 text-lg font-bold text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg, #ff00cc, #9900ff)' }}
              >
                대결 시작하기
              </button>
            </div>
          )}

          {/* Step 1: Check consciousness */}
          {gamePhase === 'step1' && (
            <div className="text-center space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white">STEP 1: 의식 확인</h2>
              <p className="text-white/80">쓰러진 사람을 발견했습니다!<br />어깨를 두드려 의식을 확인하세요.</p>
              <button
                onClick={() => setGamePhase('step2')}
                className="w-32 h-32 rounded-full bg-white/10 border-2 border-white/50 text-5xl mx-auto flex items-center justify-center hover:bg-white/20 transition-all"
              >
                👆
              </button>
              <p className="text-white/60 text-sm">화면을 터치하세요</p>
            </div>
          )}

          {/* Step 2: Call 119 */}
          {gamePhase === 'step2' && (
            <div className="text-center space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white">STEP 2: 구조 요청</h2>
              <p className="text-white/80">환자의 반응이 없습니다!<br />즉시 119에 신고하세요.</p>
              <button
                onClick={() => { setGamePhase('step3'); startGame(); }}
                className="w-24 h-24 rounded-3xl text-2xl font-bold text-white mx-auto flex items-center justify-center animate-pulse"
                style={{ background: 'linear-gradient(135deg, #ff416c, #ff4b1f)', boxShadow: '0 10px 20px rgba(255, 75, 31, 0.4)' }}
              >
                119
              </button>
            </div>
          )}

          {/* Step 3: CPR Game */}
          {gamePhase === 'step3' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Status bar */}
              <div className="flex justify-between bg-black/20 rounded-xl p-3 text-white font-bold">
                <span className="text-cyan-400">나: {score}</span>
                <span>⏱ {timeLeft}s</span>
                <span className="text-white/70">AI: {aiScore}</span>
              </div>

              {/* Feedback */}
              <div className="text-center text-3xl font-black uppercase" style={{ color: feedbackColor, textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
                {feedback}
              </div>

              {/* Heart */}
              <div className="text-center py-4">
                <span
                  className={`text-8xl inline-block transition-transform ${heartBeat ? 'scale-110' : 'scale-100'}`}
                  style={{ filter: 'drop-shadow(0 10px 20px rgba(255, 0, 204, 0.4))' }}
                >
                  ❤️
                </span>
              </div>

              <p className="text-center text-white/60 text-sm">화면을 터치하거나 스페이스바를 누르세요</p>

              {/* BPM Gauge - 100-120 BPM 적정 구간 표시 */}
              <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                {/* 적정 구간 표시 (100-120 BPM = 50%-60% 위치) */}
                <div className="absolute top-0 bottom-0 bg-green-500/30 rounded" style={{ left: '50%', width: '10%' }} />
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${bpmPercent}%`,
                    background: bpm >= 100 && bpm <= 120 ? 'linear-gradient(90deg, #00ff88, #00c6ff)' :
                               bpm >= 85 && bpm <= 140 ? '#88ff00' :
                               '#ff3366'
                  }}
                />
              </div>
              <p className="text-center text-cyan-400 font-bold text-lg">BPM: {bpm}</p>

              {/* Click area - 태블릿/모바일 터치 최적화 */}
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleCompression();
                }}
                className="w-full py-8 bg-white/10 rounded-xl text-white font-bold text-xl border border-white/20 hover:bg-white/20 active:scale-95 transition-all touch-manipulation select-none"
                style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
              >
                여기를 탭하세요!
              </button>
            </div>
          )}

          {/* Result */}
          {gamePhase === 'result' && (
            <div className="text-center space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white">BATTLE RESULT</h2>

              <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                <span className={`inline-block px-6 py-2 rounded-full text-xl font-black ${isPass ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                  {isPass ? 'SUCCESS' : 'DEFEAT'}
                </span>

                <p className="text-white/60 text-sm mt-4">나의 최종 점수</p>
                <p className="text-4xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #00c6ff, #0072ff)' }}>
                  {score}
                </p>

                <p className="text-white font-bold mt-4">
                  {isPass ? `AI를 ${score - aiScore}점 차이로 이겼습니다! 🏆` : `AI에게 ${aiScore - score}점 차이로 졌습니다. 🤖`}
                </p>
              </div>

              {isPass ? (
                <button
                  onClick={handleFinish}
                  className="w-full py-4 text-lg font-bold text-white rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #00b09b, #96c93d)' }}
                >
                  미션 완료!
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setGamePhase('step1'); setScore(0); setAiScore(0); setTimeLeft(30); setBpm(0); }}
                    className="w-full py-4 text-lg font-bold text-white rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #ff00cc, #9900ff)' }}
                  >
                    다시 도전하기
                  </button>
                  <button onClick={onClose} className="w-full py-3 text-white/60 hover:text-white">
                    닫기
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 text-center text-white/40 text-xs border-t border-white/10 bg-black/10">
          © 2026 JJ CREATIVE Edu with AI
        </div>
      </div>
    </div>
  );
};

export default CPRGame;
