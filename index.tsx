import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Target, RotateCcw, Trophy, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, BookOpen, Settings2, X, CheckCircle2, CircleDashed, ArrowUpRight, Magnet, ArrowUp, Play, Disc } from 'lucide-react';

// --- Constants & Math ---
const BALL_DIAMETER = 30; // Plan view size
const SHOOTER_DIAMETER = 260; 

// Plan View Layout Configuration
const PLAN_WIDTH = 400;
const PLAN_HEIGHT = 600;
const PLAN_CENTER_X = PLAN_WIDTH / 2;
const PLAN_GB_Y = 300; // Ghost Ball Y (Object Ball reference) - Moved down to allow more space above
const PLAN_CB_Y = 550; // Cue Ball Y - Moved down to maintain relative distance (250px gap)

// Mapping EI to Cut Angle (Degrees)
const eiToAngle = (ei: number) => {
  const sinTheta = ei / 8;
  return (Math.asin(sinTheta) * 180) / Math.PI;
};

const angleToEi = (angle: number) => {
  const sinTheta = Math.sin((angle * Math.PI) / 180);
  return sinTheta * 8;
};

// --- Difficulty Logic ---
// Defines which EIs can be chosen as TARGETS
const getTargetEIs = (level: number) => {
    // Level is 1-based (1 to 10)
    let eis = [0, 1, 2, 3, 4];
    
    if (level >= 2) eis.push(5);
    if (level >= 3) eis.push(6);
    if (level >= 4) eis.push(7); // EI 8 (90deg) excluded per spec
    
    // Halves introduction
    if (level >= 5) eis.push(0.5, 1.5);
    if (level >= 6) eis.push(2.5, 3.5);
    if (level >= 7) eis.push(4.5);
    if (level >= 8) eis.push(5.5);
    if (level >= 9) eis.push(6.5);
    if (level >= 10) eis.push(7.5);
    
    return eis.sort((a,b) => a-b);
};

// Returns the EIs that are introduced in this specific level to give them higher weight
const getNewEIsForLevel = (level: number) => {
    switch(level) {
        case 1: return []; // Base set
        case 2: return [5];
        case 3: return [6];
        case 4: return [7];
        case 5: return [0.5, 1.5];
        case 6: return [2.5, 3.5];
        case 7: return [4.5];
        case 8: return [5.5];
        case 9: return [6.5];
        case 10: return [7.5];
        default: return [];
    }
};

const selectTargetShot = (level: number) => {
    const allowed = getTargetEIs(level);
    const newEIs = getNewEIsForLevel(level);
    
    // Weighted Random Selection
    // Weights: 0 = 1, New = 7, Standard = 4
    // Note: Non-zero EIs implicitly have 2x probability mass because they can be Left or Right.
    // The weights below represent the weight per SIDE.
    
    let candidates: { ei: number, weight: number }[] = [];
    let totalWeight = 0;
    
    for (const ei of allowed) {
        let weight = 0;
        if (ei === 0) {
            weight = 1; // Straight in is rare
        } else {
            // Check if this EI is "new" for this level
            const isNew = newEIs.includes(ei);
            const singleSideWeight = isNew ? 7 : 4;
            // We add the weight for both sides combined for the selection of the EI magnitude
            weight = singleSideWeight * 2; 
        }
        candidates.push({ ei, weight });
        totalWeight += weight;
    }
    
    let r = Math.random() * totalWeight;
    let selectedEi = 0;
    
    for (const c of candidates) {
        if (r < c.weight) {
            selectedEi = c.ei;
            break;
        }
        r -= c.weight;
    }
    
    // Determine direction
    let direction: 'left' | 'right' = 'right';
    if (selectedEi > 0) {
        direction = Math.random() > 0.5 ? 'right' : 'left';
    }
    
    return { ei: selectedEi, direction };
};

// Defines the precision of the grid snapping (Interaction)
const getSnapInterval = (level: number) => {
    return level >= 5 ? 0.5 : 1.0;
};

// --- Ball Colors & Graphics ---
const BALL_COLORS = [
    '#facc15', // 1 Yellow
    '#2563eb', // 2 Blue
    '#ef4444', // 3 Red
    '#7c3aed', // 4 Purple
    '#f97316', // 5 Orange
    '#16a34a', // 6 Green
    '#991b1b', // 7 Maroon
    '#171717', // 8 Black
];

const getBallVisuals = (num: number) => {
    const colorIdx = (num - 1) % 8;
    const isStriped = num > 8;
    const color = BALL_COLORS[colorIdx];
    return { color, isStriped };
};

const drawPoolBall = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    diameter: number, 
    ballNum: number
) => {
    const radius = diameter / 2;
    const { color, isStriped } = getBallVisuals(ballNum);
    
    // 1. Base Body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (isStriped) {
        ctx.fillStyle = '#fffff0'; // Ivory
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = color;
        const stripeHeight = diameter * 0.55;
        ctx.fillRect(x - radius, y - stripeHeight/2, diameter, stripeHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = color;
        ctx.fill();
    }

    // 2. Shading
    const grad = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.2,
        x, y, radius
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.1)'); 
    grad.addColorStop(1, 'rgba(0,0,0,0.5)'); 
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    const shineSize = radius * 0.35; 
    ctx.ellipse(x - radius * 0.3, y - radius * 0.35, shineSize, shineSize * 0.7, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
};

const UserGuideModal = ({ onClose }: { onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative flex flex-col">
                <div className="p-6 border-b border-neutral-800 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
                    <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                        <BookOpen size={20}/> User Guide
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
                        <X size={20} className="text-neutral-400"/>
                    </button>
                </div>
                
                <div className="p-6 space-y-6 text-neutral-300 leading-relaxed">
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">The Eclipse Index (EI) System</h3>
                        <p className="text-sm">
                            The Eclipse Index is an aiming system that quantifies the overlap between the Cue Ball (CB) and the Object Ball (OB). 
                            By visualizing how much of the OB is "eclipsed" by the CB, you can determine the precise cut angle.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">EI Values & Angles</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-neutral-500 uppercase bg-neutral-800/50">
                                    <tr>
                                        <th className="px-4 py-2 rounded-tl-lg">EI</th>
                                        <th className="px-4 py-2">Cut Angle</th>
                                        <th className="px-4 py-2 rounded-tr-lg">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    <tr><td className="px-4 py-2 font-mono text-emerald-400">0</td><td className="px-4 py-2">0.0°</td><td className="px-4 py-2">Full Hit / Straight</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-blue-400">1</td><td className="px-4 py-2">7.2°</td><td className="px-4 py-2">Thick Hit</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-blue-400">2</td><td className="px-4 py-2">14.5°</td><td className="px-4 py-2">3/4 Ball Hit</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-blue-400">3</td><td className="px-4 py-2">22.0°</td><td className="px-4 py-2">Moderate Cut</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-blue-400">4</td><td className="px-4 py-2">30.0°</td><td className="px-4 py-2">1/2 Ball Hit</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-amber-400">5</td><td className="px-4 py-2">38.7°</td><td className="px-4 py-2">Thin Cut</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-amber-400">6</td><td className="px-4 py-2">48.6°</td><td className="px-4 py-2">1/4 Ball Hit</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-rose-400">7</td><td className="px-4 py-2">61.0°</td><td className="px-4 py-2">Very Thin (1/8)</td></tr>
                                    <tr><td className="px-4 py-2 font-mono text-rose-400">8</td><td className="px-4 py-2">90.0°</td><td className="px-4 py-2">Edge (Practice)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
                
                <div className="p-6 border-t border-neutral-800 bg-neutral-900 sticky bottom-0">
                    <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors">
                        Got it, Let's Shoot
                    </button>
                </div>
            </div>
        </div>
    );
}

const SplashScreen = ({ onStart }: { onStart: (mode: '8'|'9'|'10') => void }) => {
    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px]" />

            <div className="z-10 text-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center justify-center p-4 bg-emerald-900/30 rounded-full mb-6 border border-emerald-800 shadow-2xl shadow-emerald-900/50">
                    <Target size={48} className="text-emerald-400" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2">
                    ECLIPSE <span className="text-emerald-500">SIGHT</span>
                </h1>
                <p className="text-neutral-400 text-lg md:text-xl font-light tracking-wide">
                    Precision Aim Trainer
                </p>
            </div>

            <div className="z-10 w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                <button 
                    onClick={() => onStart('8')}
                    className="w-full group relative overflow-hidden bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 p-4 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-black border-2 border-neutral-600 flex items-center justify-center shadow-lg relative">
                             <span className="text-white font-black text-xl">8</span>
                             <div className="absolute top-2 left-2 w-3 h-2 bg-white/20 rounded-full -rotate-45" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">8-Ball Mode</h3>
                            <p className="text-neutral-500 text-xs">Standard aids. Magnetic aim. Play to 8.</p>
                        </div>
                        <ChevronRight className="ml-auto text-neutral-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                </button>

                <button 
                    onClick={() => onStart('9')}
                    className="w-full group relative overflow-hidden bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 p-4 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#facc15] border-2 border-yellow-600 flex items-center justify-center shadow-lg relative overflow-hidden">
                             <div className="absolute inset-x-0 top-[20%] bottom-[20%] bg-white" />
                             <span className="relative text-black font-black text-xl">9</span>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg group-hover:text-yellow-400 transition-colors">9-Ball Mode</h3>
                            <p className="text-neutral-500 text-xs">No Ghost Ball or OB Lines. Play to 9.</p>
                        </div>
                        <ChevronRight className="ml-auto text-neutral-600 group-hover:text-yellow-400 transition-colors" />
                    </div>
                </button>

                 <button 
                    onClick={() => onStart('10')}
                    className="w-full group relative overflow-hidden bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 p-4 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center shadow-lg relative overflow-hidden">
                             <div className="absolute inset-x-0 top-[20%] bottom-[20%] bg-white" />
                             <span className="relative text-black font-black text-xl">10</span>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">10-Ball Mode</h3>
                            <p className="text-neutral-500 text-xs">No Aids. Smooth Aiming. Play to 10.</p>
                        </div>
                        <ChevronRight className="ml-auto text-neutral-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                </button>
            </div>
            
            <p className="absolute bottom-6 text-neutral-600 text-xs text-center">
                v1.0 &bull; Eclipse Aim Trainer
            </p>
        </div>
    );
};

const EclipseSight = () => {
  // Game Configuration
  const [gameState, setGameState] = useState<'SPLASH' | 'PLAYING'>('SPLASH');
  const [gameMode, setGameMode] = useState<'8' | '9' | '10'>('8');
  const [maxBalls, setMaxBalls] = useState(8);

  // Game State
  const [currentBall, setCurrentBall] = useState(1);
  const [difficultyLevel, setDifficultyLevel] = useState(1); // 1-10
  const [score, setScore] = useState(0);
  
  // Pending State (for Next Shot transitions)
  const [pendingBall, setPendingBall] = useState<number | null>(null);
  const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
  
  // Shot State
  const [targetAngle, setTargetAngle] = useState(0); 
  const [targetDirection, setTargetDirection] = useState<'left' | 'right'>('right');
  const [pocketDistance, setPocketDistance] = useState(180);
  const [selectedEi, setSelectedEi] = useState(0);
  const [selectedDirection, setSelectedDirection] = useState<'left' | 'right'>('right');
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; color: string } | null>(null);
  
  // Visual Settings
  const [isTestMode, setIsTestMode] = useState(false);
  const [showAimLine, setShowAimLine] = useState(true);
  const [showGhostBall, setShowGhostBall] = useState(true);
  const [showObLine, setShowObLine] = useState(true);
  const [snapMode, setSnapMode] = useState(false); 
  const [showGuide, setShowGuide] = useState(false);

  // Refs
  const planCanvasRef = useRef<HTMLCanvasElement>(null);
  const shooterCanvasRef = useRef<HTMLCanvasElement>(null);
  const planSectionRef = useRef<HTMLDivElement>(null);
  const shooterSectionRef = useRef<HTMLDivElement>(null);

  const startGame = (mode: '8'|'9'|'10') => {
      setGameMode(mode);
      setGameState('PLAYING');
      setCurrentBall(1);
      setDifficultyLevel(1);
      setScore(0);
      setPendingBall(null);
      setPendingDifficulty(null);
      
      // Set Defaults based on Mode
      if (mode === '8') {
          setMaxBalls(8);
          setShowAimLine(true);
          setShowGhostBall(true);
          setShowObLine(true);
          setSnapMode(true);
      } else if (mode === '9') {
          setMaxBalls(9);
          setShowAimLine(true); // Keep CB Path
          setShowGhostBall(false); // Eliminate Ghost Ball
          setShowObLine(false); // Eliminate OB Path
          setSnapMode(true);
      } else {
          // 10 Ball
          setMaxBalls(10);
          setShowAimLine(false);
          setShowGhostBall(false);
          setShowObLine(false);
          setSnapMode(false); // Disable magnet
      }

      startNewRound(true);
  };

  const handleReturnToMenu = () => {
      setGameState('SPLASH');
  };

  // Helper to calculate max visible pocket distance
  const calculateMaxPocketDistance = (angleDeg: number, direction: 'left' | 'right') => {
    // Canvas Geometry
    const w = PLAN_WIDTH;
    const h = PLAN_HEIGHT;
    const originX = PLAN_CENTER_X; 
    const originY = PLAN_GB_Y;
    const padding = 35; // Pocket radius (22) + margin

    const angleRad = (angleDeg * Math.PI) / 180;
    const dirMult = direction === 'right' ? 1 : -1;
    
    // Vector from Origin to Pocket
    const dx = Math.sin(angleRad * dirMult);
    const dy = -Math.cos(angleRad * dirMult); // Upwards is negative Y

    let minT = 10000; // Large number

    // Right Wall (x = w - padding)
    if (dx > 0) {
        const t = (w - padding - originX) / dx;
        if (t > 0) minT = Math.min(minT, t);
    }
    // Left Wall (x = padding)
    if (dx < 0) {
        const t = (padding - originX) / dx;
        if (t > 0) minT = Math.min(minT, t);
    }
    // Top Wall (y = padding)
    if (dy < 0) {
        const t = (padding - originY) / dy;
        if (t > 0) minT = Math.min(minT, t);
    }
    // Bottom Wall (y = h - padding) - unlikely given standard angles, but good for robustness
    if (dy > 0) {
        const t = (h - padding - originY) / dy;
        if (t > 0) minT = Math.min(minT, t);
    }

    return minT;
  };

  // Initialize a new round
  const startNewRound = useCallback((reset = false) => {
    // If it's a hard reset, use default values
    let effectiveDifficulty = difficultyLevel;
    
    if (reset) {
        effectiveDifficulty = 1;
    } else {
         // Apply Pending Updates
        if (pendingBall !== null) {
            setCurrentBall(pendingBall);
            setPendingBall(null);
        }
        if (pendingDifficulty !== null) {
            setDifficultyLevel(pendingDifficulty);
            setPendingDifficulty(null);
            effectiveDifficulty = pendingDifficulty;
        }
    }

    // Weighted selection logic replacement
    const { ei, direction } = selectTargetShot(effectiveDifficulty);
    const angle = eiToAngle(ei);
    
    // Calculate Pocket Distance
    const maxDist = calculateMaxPocketDistance(angle, direction);
    // Range: [30 + 0.5*(max-30), max]
    const safeMin = 30; // Min distance to clear the OB
    if (maxDist > safeMin) {
        const range = maxDist - safeMin;
        const dist = safeMin + (range * 0.5) + (Math.random() * range * 0.5);
        setPocketDistance(dist);
    } else {
        setPocketDistance(maxDist); // Fallback if tight squeeze
    }
    
    setTargetAngle(angle);
    setTargetDirection(direction);
    
    setSelectedEi(0);
    setSelectedDirection('right');
    
    setIsEvaluated(false);
    setFeedback(null);

    // Auto-scroll to plan view (only if not initial load/reset to avoid jumping on mobile)
    if (!reset) {
        planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [difficultyLevel, pendingBall, pendingDifficulty]);


  const scrollToShooter = () => {
    shooterSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPlan = () => {
    planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Custom reset without reload
  const handleResetRack = () => {
      setScore(0);
      setCurrentBall(1);
      setDifficultyLevel(1);
      setPendingBall(null);
      setPendingDifficulty(null);
      
      // Manually set new round params for Level 1
      const { ei, direction } = selectTargetShot(1);
      setTargetAngle(eiToAngle(ei));
      setTargetDirection(direction);
      setPocketDistance(180);
      setSelectedEi(0);
      setIsEvaluated(false);
      setFeedback(null);
      planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Rendering Plan View ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = planCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Geometry
    const centerX = PLAN_CENTER_X;
    const cbY = PLAN_CB_Y;
    const gbY = PLAN_GB_Y; 
    
    // 1. Aim Line (CB -> GB) [TOGGLEABLE]
    if (showAimLine) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, cbY);
        ctx.lineTo(centerX, gbY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 2. Positions
    const angleRad = (targetAngle * Math.PI) / 180;
    const dirMult = targetDirection === 'right' ? 1 : -1;
    
    const obDist = BALL_DIAMETER;
    const obX = centerX + Math.sin(angleRad * dirMult) * obDist;
    const obY_pos = gbY - Math.cos(angleRad * dirMult) * obDist;

    const pocketDist = pocketDistance;
    const pocketX = centerX + Math.sin(angleRad * dirMult) * pocketDist;
    const pocketY = gbY - Math.cos(angleRad * dirMult) * pocketDist;

    // 3. Shot Line (OB -> Pocket) [TOGGLEABLE]
    if (showObLine) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obX, obY_pos);
        ctx.lineTo(pocketX, pocketY);
        ctx.stroke();
    }

    // 4. Pocket
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(pocketX, pocketY, 22, 0, Math.PI * 2);
    ctx.fill();

    // 5. Ghost Ball [TOGGLEABLE]
    if (showGhostBall) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(centerX, gbY, BALL_DIAMETER / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 6. Object Ball (Custom Render)
    drawPoolBall(ctx, obX, obY_pos, BALL_DIAMETER, currentBall);

    // 7. Cue Ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX, cbY, BALL_DIAMETER / 2, 0, Math.PI * 2);
    ctx.fill();

  }, [targetAngle, targetDirection, currentBall, showAimLine, showGhostBall, showObLine, pocketDistance, gameState]);

  // --- Rendering Shooter View ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const canvas = shooterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const obY = height / 2 - 20; 
    const cbY = height / 2 + 20; 

    // Draw OB (Background)
    const sign = selectedDirection === 'right' ? 1 : -1;
    const offset = (selectedEi / 8) * SHOOTER_DIAMETER * sign;
    const obX = cx + offset;

    drawPoolBall(ctx, obX, obY, SHOOTER_DIAMETER, currentBall);

    // Draw CB (Foreground)
    ctx.fillStyle = 'rgba(240, 240, 240, 0.94)'; 
    ctx.beginPath();
    ctx.arc(cx, cbY, SHOOTER_DIAMETER / 2, 0, Math.PI * 2);
    ctx.fill();

    // CB Shading
    const gradCb = ctx.createRadialGradient(cx-50, cbY-60, 20, cx, cbY, SHOOTER_DIAMETER/2);
    gradCb.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradCb.addColorStop(1, 'rgba(180,180,180,0.4)'); 
    ctx.fillStyle = gradCb;
    ctx.fill();

    // Crosshair in Test Mode
    if (isTestMode) {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
    }

  }, [selectedEi, selectedDirection, isTestMode, currentBall, gameState]);

  // --- Interaction Logic (Pointer Events) ---
  const calculateEiFromEvent = (e: React.PointerEvent, canvas: HTMLCanvasElement): { rawEi: number; dir: 'left' | 'right' } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const width = canvas.width;
    
    const dx = x - width / 2;
    
    // Scale user input to EI (Allow full 0-8 range regardless of level)
    const rawEi = Math.min((Math.abs(dx) / SHOOTER_DIAMETER) * 8, 8);
    const dir = dx >= 0 ? 'right' : 'left';
    return { rawEi, dir };
  };

  const snapValue = (val: number) => {
    const snapInterval = getSnapInterval(difficultyLevel);
    // Snap to nearest grid point
    let snappedVal = Math.round(val / snapInterval) * snapInterval;
    // Clamp to 8 (max EI)
    return Math.min(snappedVal, 8);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleDrag(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
       if (e.buttons === 1) handleDrag(e);
  }

  const handlePointerUp = (e: React.PointerEvent) => {
       (e.target as HTMLElement).releasePointerCapture(e.pointerId);
       if (!isEvaluated && !snapMode) {
            // Snap on Release Mode: Snap now
            const canvas = shooterCanvasRef.current;
            if (!canvas) return;
            const { rawEi, dir } = calculateEiFromEvent(e, canvas);
            
            const snapped = snapValue(rawEi);
            setSelectedEi(snapped);
            setSelectedDirection(dir);
       }
  }

  const handleDrag = (e: React.PointerEvent) => {
    if (isEvaluated) return;
    const canvas = shooterCanvasRef.current;
    if (!canvas) return;
    
    const { rawEi, dir } = calculateEiFromEvent(e, canvas);

    if (snapMode) {
        // Snap-on-Drag Mode (Classic/Easy)
        const snapped = snapValue(rawEi);
        setSelectedEi(snapped);
        setSelectedDirection(dir);
    } else {
        // Smooth Mode (Analog)
        setSelectedEi(rawEi);
        setSelectedDirection(dir);
    }
  };

  const evaluateShot = () => {
    // Check match
    const targetEi = Math.round(angleToEi(targetAngle) * 2) / 2; // precision to 0.5
    // Ensure we are comparing rounded values for logic check
    const currentRoundedEi = Math.round(selectedEi * 2) / 2;
    
    const isCorrectEi = currentRoundedEi === targetEi;
    const isCorrectDir = selectedDirection === targetDirection || targetEi === 0;

    if (isCorrectEi && isCorrectDir) {
      // SUCCESS
      setFeedback({ msg: `Correct! EI ${currentRoundedEi} ${currentRoundedEi > 0 ? selectedDirection : ''}.`, color: 'text-emerald-400' });
      setScore(s => s + 10);
      
      // Progression Logic (Queued)
      if (currentBall === maxBalls) {
          if (difficultyLevel < 10) {
            setPendingDifficulty(difficultyLevel + 1);
            setFeedback(prev => ({ msg: (prev?.msg || '') + ` Level Up! Entering Level ${difficultyLevel + 1}.`, color: 'text-yellow-400' }));
          } else {
            setFeedback(prev => ({ msg: (prev?.msg || '') + " Rack Clear! Max Level achieved!", color: 'text-yellow-400' }));
          }
          setPendingBall(1);
      } else {
          setPendingBall(currentBall + 1);
      }
      
    } else {
      // FAILURE
      let hint = "";
      if (!isCorrectDir && targetEi !== 0) {
        hint = `Wrong cut direction. Needed ${targetDirection}.`;
      } else {
        hint = currentRoundedEi > targetEi ? "Too thin." : "Too full.";
      }
      setFeedback({ msg: `Miss! Target was EI ${targetEi} ${targetDirection}. ${hint}`, color: 'text-rose-400' });
      
      // Regression Logic (Queued)
      if (currentBall > 1) {
          setPendingBall(currentBall - 1);
      } else {
          setPendingBall(1);
      }
    }
    // Snap visually to result just in case they were between steps in smooth mode (optional but clean)
    setSelectedEi(currentRoundedEi);
    setIsEvaluated(true);
  };

  // UI Helpers
  const { color: ballColor, isStriped: ballStriped } = getBallVisuals(currentBall);

  // --- RENDER ---
  if (gameState === 'SPLASH') {
      return <SplashScreen onStart={startGame} />;
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-neutral-900 min-h-screen shadow-2xl overflow-hidden relative">
      {showGuide && <UserGuideModal onClose={() => setShowGuide(false)} />}
      
      {/* --- PLAN VIEW SECTION --- */}
      <div 
        ref={planSectionRef}
        className="min-h-screen flex flex-col items-center justify-between p-6 relative snap-start"
      >
        {/* Header */}
        <div className="w-full flex justify-between items-center">
            <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-100 flex items-center gap-2">
                    <Target className="text-emerald-500" size={24} /> 
                    Eclipse Sight
                </h1>
                <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700">
                         <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: ballStriped ? '#fffff0' : ballColor }}>
                            {ballStriped && <div className="w-full h-2 mt-1" style={{ backgroundColor: ballColor }}></div>}
                         </div>
                         <span className="text-xs font-bold text-neutral-300">Ball {currentBall}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-900/50">
                        <Trophy size={12} /> Level {difficultyLevel}
                    </div>
                </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={handleReturnToMenu} 
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
                    title="Menu"
                >
                    <Settings2 size={24}/>
                </button>
                <button 
                    onClick={() => setShowGuide(true)}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
                    title="User Guide"
                >
                    <BookOpen size={24}/>
                </button>
            </div>
        </div>

        {/* Plan Canvas Container */}
        <div className="flex-1 flex flex-col justify-center items-center w-full my-4 relative">
            <div className="bg-neutral-800/50 p-1 rounded-2xl border border-neutral-700 shadow-xl w-full max-w-[360px] relative">
                
                {/* Visual Settings Toolbar */}
                <div className="absolute -right-3 top-12 flex flex-col gap-2">
                     <button 
                        onClick={() => setShowAimLine(!showAimLine)}
                        className={`p-2 rounded-full shadow-lg border backdrop-blur-md transition-all ${showAimLine ? 'bg-emerald-900/80 border-emerald-500 text-emerald-400' : 'bg-neutral-900/80 border-neutral-700 text-neutral-500'}`}
                        title="Toggle Aim Line"
                     >
                        <ArrowUp size={16} />
                     </button>
                     <button 
                        onClick={() => setShowGhostBall(!showGhostBall)}
                        className={`p-2 rounded-full shadow-lg border backdrop-blur-md transition-all ${showGhostBall ? 'bg-emerald-900/80 border-emerald-500 text-emerald-400' : 'bg-neutral-900/80 border-neutral-700 text-neutral-500'}`}
                        title="Toggle Ghost Ball"
                     >
                        <CircleDashed size={16} />
                     </button>
                     <button 
                        onClick={() => setShowObLine(!showObLine)}
                        className={`p-2 rounded-full shadow-lg border backdrop-blur-md transition-all ${showObLine ? 'bg-emerald-900/80 border-emerald-500 text-emerald-400' : 'bg-neutral-900/80 border-neutral-700 text-neutral-500'}`}
                        title="Toggle Object Ball Line"
                     >
                        <ArrowUpRight size={16} />
                     </button>
                </div>

                <div className="flex justify-between items-center px-4 py-2 border-b border-neutral-700 mb-2">
                    <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">Plan View</span>
                    {isTestMode || isEvaluated ? (
                        <span className="text-xs font-mono text-emerald-400">{targetAngle.toFixed(1)}° {targetDirection}</span>
                    ) : (
                        <span className="text-xs font-mono text-neutral-600">HIDDEN</span>
                    )}
                </div>
                <canvas 
                    ref={planCanvasRef} 
                    width={PLAN_WIDTH} 
                    height={PLAN_HEIGHT} 
                    className="w-full aspect-[2/3] rounded-lg shadow-inner bg-[#2c5d3f]" 
                />
            </div>
            <p className="mt-6 text-sm text-neutral-400 text-center max-w-xs">
                Visualize the overlap required for the <span style={{ color: ballColor }} className="font-bold">{ballStriped ? 'Striped' : 'Solid'} {currentBall}-Ball</span>.
            </p>
        </div>

        {/* Action Button */}
        <button 
            onClick={scrollToShooter}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-all active:scale-95 animate-bounce-subtle"
        >
            <span className="tracking-widest">GET DOWN TO SHOOT</span>
            <ChevronDown size={20} />
        </button>
      </div>

      {/* --- SHOOTER VIEW SECTION --- */}
      <div 
        ref={shooterSectionRef}
        className="min-h-screen flex flex-col items-center justify-between p-6 bg-neutral-900 relative snap-start border-t border-neutral-800"
      >
        {/* Navigation Header */}
        <div className="w-full flex justify-between items-center mb-4">
             <button 
                onClick={scrollToPlan}
                className="text-neutral-500 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors"
            >
                <ChevronUp size={16} /> PLAN VIEW
            </button>
            <div className="flex items-center gap-3">
                 <button 
                    onClick={() => setSnapMode(!snapMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${snapMode ? 'bg-emerald-900/40 border-emerald-600 text-emerald-500' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}
                    title={snapMode ? "Snap On Drag (Easy)" : "Smooth Drag (Default)"}
                >
                    <Magnet size={14} className={snapMode ? "" : "opacity-50"}/>
                </button>
                 <button 
                    onClick={() => setIsTestMode(!isTestMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${isTestMode ? 'bg-amber-900/40 border-amber-600 text-amber-500' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}
                >
                    {isTestMode ? <Eye size={14}/> : <EyeOff size={14}/>}
                </button>
                {isTestMode || isEvaluated || gameMode === '8' ? (
                    <div className="px-3 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50 text-xs font-bold font-mono">
                    EI: {selectedEi.toFixed(1)}
                </div>
                ) : (
                    <div className="px-3 py-1 rounded bg-neutral-800 text-neutral-500 border border-neutral-700 text-xs font-bold font-mono">
                    AIMING
                </div>
                )}
            </div>
        </div>

        {/* Shooter Canvas */}
        <div className="flex-1 w-full flex flex-col justify-center items-center relative">
            <div className="relative w-full max-w-[600px] group">
                <canvas 
                    ref={shooterCanvasRef} 
                    width={600} 
                    height={500} 
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="w-full aspect-[6/5] cursor-ew-resize touch-none rounded-xl shadow-2xl border-4 border-[#3e2723] bg-[#2c5d3f]"
                />
                
                {!isEvaluated && (
                    <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="inline-block text-[10px] uppercase tracking-widest text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                            {snapMode ? "Drag to Aim" : "Release to Snap"}
                        </span>
                    </div>
                )}
            </div>

            {/* Feedback / Instructions */}
            <div className="mt-8 min-h-[80px] w-full flex flex-col items-center justify-center">
                {feedback ? (
                    <div className={`text-center font-bold text-lg ${feedback.color} px-4 py-2 rounded-lg bg-neutral-800/80 border border-neutral-700`}>
                        {feedback.msg}
                    </div>
                ) : (
                    <div className="text-neutral-500 text-sm">
                        Align for the <span style={{ color: ballColor }} className="font-bold brightness-125">{currentBall}-Ball</span>. Ready?
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="w-full flex gap-3 pb-8">
             {!isEvaluated ? (
                <button 
                  onClick={evaluateShot} 
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Target size={20} /> SHOOT
                </button>
              ) : (
                <div className="flex-1 flex gap-3">
                    <button 
                    onClick={() => startNewRound(false)} 
                    className="flex-1 bg-white hover:bg-neutral-200 text-neutral-900 font-bold py-4 rounded-xl shadow-lg shadow-white/5 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                    <ChevronRight size={20} /> 
                    {currentBall === maxBalls && isEvaluated && feedback?.msg.includes("Correct") ? 'START NEXT RACK' : 'NEXT BALL'}
                    </button>
                     <button 
                        onClick={handleResetRack} 
                        className="w-16 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-xl flex items-center justify-center border border-neutral-700 transition-colors"
                        title="Reset Rack"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>
              )}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<EclipseSight />);
}