import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Target, RotateCcw, Trophy, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, BookOpen, Settings2, X, CheckCircle2, CircleDashed, ArrowUpRight } from 'lucide-react';

// --- Constants & Math ---
const BALL_DIAMETER = 30; // Plan view size
const SHOOTER_DIAMETER = 260; 

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
const getAllowedEIs = (level: number) => {
    // Level is 1-based (1 to 10)
    let eis = [0, 1, 2, 3, 4];
    
    if (level >= 2) eis.push(5);
    if (level >= 3) eis.push(6);
    if (level >= 4) eis.push(7, 8);
    
    // Halves introduction
    if (level >= 5) eis.push(0.5, 1.5);
    if (level >= 6) eis.push(2.5, 3.5);
    if (level >= 7) eis.push(4.5);
    if (level >= 8) eis.push(5.5);
    if (level >= 9) eis.push(6.5);
    if (level >= 10) eis.push(7.5);
    
    return eis.sort((a,b) => a-b);
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
                                    <tr><td className="px-4 py-2 font-mono text-rose-400">8</td><td className="px-4 py-2">90.0°</td><td className="px-4 py-2">Edge / Clip</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2 italic">
                            *Note: This trainer uses pure geometric aiming (`sin(angle) = EI/8`). Real-world physics factors like throw and friction are intentionally excluded to focus on visual overlap recognition.
                        </p>
                    </section>

                     <section>
                        <h3 className="text-white font-bold text-lg mb-2">Progression</h3>
                        <ul className="text-sm space-y-1 list-disc pl-4 marker:text-emerald-500">
                            <li><strong>Level 1:</strong> Standard Hits (EI 0 - 4)</li>
                            <li><strong>Level 2-4:</strong> Extended Range (EI 5 - 8)</li>
                            <li><strong>Level 5-10:</strong> Precision Mode (Half-EI increments)</li>
                        </ul>
                        <p className="text-sm mt-2">
                            Clear a rack (15 balls) to advance to the next difficulty level.
                        </p>
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

const EclipseIndexTrainer = () => {
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
  
  // Settings
  const [isTestMode, setIsTestMode] = useState(false);
  const [showCbVisuals, setShowCbVisuals] = useState(true); // Combines Ghost Ball & Aim Line
  const [showObLine, setShowObLine] = useState(true); // New toggle for OB->Pocket line
  const [showGuide, setShowGuide] = useState(false);

  // Refs
  const planCanvasRef = useRef<HTMLCanvasElement>(null);
  const shooterCanvasRef = useRef<HTMLCanvasElement>(null);
  const planSectionRef = useRef<HTMLDivElement>(null);
  const shooterSectionRef = useRef<HTMLDivElement>(null);

  // Helper to calculate max visible pocket distance
  const calculateMaxPocketDistance = (angleDeg: number, direction: 'left' | 'right') => {
    // Canvas Geometry
    const w = 400;
    const h = 500;
    const originX = w / 2; // 200
    const originY = h * 0.35; // 175 (Ghost Ball Center)
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
  const startNewRound = useCallback(() => {
    // Apply Pending Updates
    if (pendingBall !== null) {
        setCurrentBall(pendingBall);
        setPendingBall(null);
    }
    if (pendingDifficulty !== null) {
        setDifficultyLevel(pendingDifficulty);
        setPendingDifficulty(null);
    }

    // Use current or newly updated difficulty
    const effectiveDifficulty = pendingDifficulty !== null ? pendingDifficulty : difficultyLevel;
    const allowed = getAllowedEIs(effectiveDifficulty);
    const randomIdx = Math.floor(Math.random() * allowed.length);
    const ei = allowed[randomIdx];
    const angle = eiToAngle(ei);
    const dir = Math.random() > 0.5 ? 'right' : 'left';
    
    // Calculate Pocket Distance
    const maxDist = calculateMaxPocketDistance(angle, dir);
    // Object ball is at roughly BALL_DIAMETER (30) from origin.
    // We want the pocket in the outer half of the remaining space.
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
    setTargetDirection(dir);
    
    setSelectedEi(0);
    setSelectedDirection('right');
    
    setIsEvaluated(false);
    setFeedback(null);

    // Auto-scroll to plan view
    planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [difficultyLevel, pendingBall, pendingDifficulty]);

  // Initial load
  useEffect(() => {
    startNewRound();
  }, []); 

  const scrollToShooter = () => {
    shooterSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPlan = () => {
    planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetGame = () => {
      setScore(0);
      setCurrentBall(1);
      setDifficultyLevel(1);
      setPendingBall(null);
      setPendingDifficulty(null);
      setPendingBall(1);
      setPendingDifficulty(1);
      setTimeout(() => {
        // Force reset
        window.location.reload(); 
      }, 50);
  };
  
  // Custom reset without reload
  const handleReset = () => {
      setScore(0);
      setCurrentBall(1);
      setDifficultyLevel(1);
      setPendingBall(null);
      setPendingDifficulty(null);
      
      // Manually set new round params
      const allowed = getAllowedEIs(1);
      const ei = allowed[Math.floor(Math.random() * allowed.length)];
      setTargetAngle(eiToAngle(ei));
      setTargetDirection(Math.random() > 0.5 ? 'right' : 'left');
      setPocketDistance(180);
      setSelectedEi(0);
      setIsEvaluated(false);
      setFeedback(null);
      planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Rendering Plan View ---
  useEffect(() => {
    const canvas = planCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Geometry
    const centerX = width / 2;
    const cbY = height * 0.85;
    const gbY = height * 0.35; 
    
    // 1. Aim Line (CB -> GB) [TOGGLEABLE]
    if (showCbVisuals) {
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
    if (showCbVisuals) {
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

  }, [targetAngle, targetDirection, currentBall, showCbVisuals, showObLine, pocketDistance]);

  // --- Rendering Shooter View ---
  useEffect(() => {
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

  }, [selectedEi, selectedDirection, isTestMode, currentBall]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (isEvaluated) return;
    const canvas = shooterCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = (clientX - rect.left) * scaleX;
    const width = canvas.width;
    
    const dx = x - width / 2;
    
    // Scale user input to EI (max roughly 8)
    const rawEi = (Math.abs(dx) / SHOOTER_DIAMETER) * 8;
    const dir = dx >= 0 ? 'right' : 'left';

    // Snapping Logic
    // If level < 5, snap to integers (0, 1, 2...)
    // If level >= 5, snap to halves (0, 0.5, 1, 1.5...)
    const snapInterval = difficultyLevel >= 5 ? 0.5 : 1.0;
    
    // Get valid EIs for this level
    const allowed = getAllowedEIs(difficultyLevel);
    
    // First snap to grid
    let snappedVal = Math.round(rawEi / snapInterval) * snapInterval;
    
    // Then find closest allowed value (though snapping should mostly handle it, this ensures bounds)
    let closestEi = allowed[0];
    let minDiff = Math.abs(snappedVal - allowed[0]);
    
    for (const val of allowed) {
        if (Math.abs(snappedVal - val) < minDiff) {
            minDiff = Math.abs(snappedVal - val);
            closestEi = val;
        }
    }
    
    setSelectedEi(closestEi);
    setSelectedDirection(dir);
  };

  const evaluateShot = () => {
    // Check match
    const targetEi = Math.round(angleToEi(targetAngle) * 2) / 2; // precision to 0.5
    const isCorrectEi = selectedEi === targetEi;
    const isCorrectDir = selectedDirection === targetDirection || targetEi === 0;

    if (isCorrectEi && isCorrectDir) {
      // SUCCESS
      setFeedback({ msg: `Correct! EI ${selectedEi} ${selectedEi > 0 ? selectedDirection : ''}.`, color: 'text-emerald-400' });
      setScore(s => s + 10);
      
      // Progression Logic (Queued)
      if (currentBall === 15) {
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
        hint = selectedEi > targetEi ? "Too thin." : "Too full.";
      }
      setFeedback({ msg: `Miss! Target was EI ${targetEi} ${targetDirection}. ${hint}`, color: 'text-rose-400' });
      
      // Regression Logic (Queued)
      if (currentBall > 1) {
          setPendingBall(currentBall - 1);
      } else {
          setPendingBall(1);
      }
    }
    setIsEvaluated(true);
  };

  // UI Helpers
  const { color: ballColor, isStriped: ballStriped } = getBallVisuals(currentBall);

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
                    Eclipse Trainer
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
            
            <button 
                onClick={() => setShowGuide(true)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
                title="User Guide"
            >
                <BookOpen size={24}/>
            </button>
        </div>

        {/* Plan Canvas Container */}
        <div className="flex-1 flex flex-col justify-center items-center w-full my-4 relative">
            <div className="bg-neutral-800/50 p-1 rounded-2xl border border-neutral-700 shadow-xl w-full max-w-[360px] relative">
                
                {/* Visual Settings Toolbar */}
                <div className="absolute -right-3 top-12 flex flex-col gap-2">
                     <button 
                        onClick={() => setShowCbVisuals(!showCbVisuals)}
                        className={`p-2 rounded-full shadow-lg border backdrop-blur-md transition-all ${showCbVisuals ? 'bg-emerald-900/80 border-emerald-500 text-emerald-400' : 'bg-neutral-900/80 border-neutral-700 text-neutral-500'}`}
                        title="Toggle Ghost Ball & Aim Line"
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
                    width={400} 
                    height={500} 
                    className="w-full aspect-[4/5] rounded-lg shadow-inner bg-[#2c5d3f]" 
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
                    onClick={() => setIsTestMode(!isTestMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${isTestMode ? 'bg-amber-900/40 border-amber-600 text-amber-500' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}
                >
                    {isTestMode ? <Eye size={14}/> : <EyeOff size={14}/>}
                </button>
                {isTestMode || isEvaluated ? (
                    <div className="px-3 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50 text-xs font-bold font-mono">
                    EI: {selectedEi}
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
                    onMouseDown={handleInteraction}
                    onTouchStart={handleInteraction}
                    onMouseMove={(e) => e.buttons === 1 && handleInteraction(e)}
                    onTouchMove={handleInteraction}
                    className="w-full aspect-[6/5] cursor-ew-resize touch-none rounded-xl shadow-2xl border-4 border-[#3e2723] bg-[#2c5d3f]"
                />
                
                {!isEvaluated && (
                    <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="inline-block text-[10px] uppercase tracking-widest text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                            Drag to Aim
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
                    onClick={startNewRound} 
                    className="flex-1 bg-white hover:bg-neutral-200 text-neutral-900 font-bold py-4 rounded-xl shadow-lg shadow-white/5 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                    <ChevronRight size={20} /> 
                    {currentBall === 15 && isEvaluated && feedback?.msg.includes("Correct") ? 'START NEXT RACK' : 'NEXT BALL'}
                    </button>
                     <button 
                        onClick={handleReset} 
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
  root.render(<EclipseIndexTrainer />);
}