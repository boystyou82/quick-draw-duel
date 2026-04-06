"use client";

import { useEffect, useState } from "react";

type ScenePhase =
  | "idle"
  | "staredown"
  | "tension"
  | "trigger"
  | "draw"
  | "shot"
  | "too_early";

interface Props {
  phase: ScenePhase;
  playerName: string;
  opponentName: string;
  triggerType: string;
}

export default function WesternScene({
  phase,
  playerName,
  opponentName,
  triggerType,
}: Props) {
  const [showTrigger, setShowTrigger] = useState(false);

  useEffect(() => {
    if (phase === "trigger") {
      const t = setTimeout(() => setShowTrigger(true), 300);
      return () => clearTimeout(t);
    }
    setShowTrigger(false);
  }, [phase]);

  const isActive = phase !== "idle";
  const isDraw = phase === "draw";
  const isShot = phase === "shot";
  const isTooEarly = phase === "too_early";

  return (
    <div
      className={`
        relative w-full aspect-[16/9] rounded-2xl overflow-hidden
        transition-all duration-500
        ${isDraw ? "ring-4 ring-red-500 ring-opacity-75" : ""}
      `}
      style={{
        background: isDraw
          ? "linear-gradient(180deg, #7f1d1d 0%, #dc2626 30%, #f59e0b 100%)"
          : "linear-gradient(180deg, #1e3a5f 0%, #c2956b 60%, #8B7355 75%, #6B5B3F 100%)",
      }}
    >
      {/* Sun */}
      <div
        className={`
          absolute top-4 right-8 w-16 h-16 rounded-full transition-all duration-1000
          ${isDraw ? "bg-red-400 scale-150 animate-pulse" : "bg-yellow-300"}
        `}
        style={{
          boxShadow: isDraw
            ? "0 0 60px rgba(239,68,68,0.8)"
            : "0 0 40px rgba(253,224,71,0.5)",
        }}
      />

      {/* Mountains */}
      <svg
        className="absolute bottom-[35%] w-full opacity-30"
        viewBox="0 0 800 100"
        preserveAspectRatio="none"
      >
        <polygon points="0,100 100,30 200,70 300,20 400,60 500,10 600,50 700,25 800,100" fill="#4a3728" />
      </svg>

      {/* Ground */}
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-[#5C4A32] to-[#7A6548]">
        {/* Ground texture lines */}
        <div className="absolute top-2 left-0 w-full h-[1px] bg-[#6B5B3F] opacity-30" />
        <div className="absolute top-6 left-0 w-full h-[1px] bg-[#6B5B3F] opacity-20" />
      </div>

      {/* Dust particles - always floating */}
      {isActive && (
        <>
          {[...Array(8)].map((_, i) => (
            <div
              key={`dust-${i}`}
              className="absolute rounded-full bg-amber-200 opacity-20 animate-dust"
              style={{
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                left: `${Math.random() * 100}%`,
                bottom: `${25 + Math.random() * 20}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Tumbleweed */}
      {(phase === "staredown" || phase === "tension" || phase === "trigger") && (
        <div className="absolute bottom-[32%] animate-tumbleweed">
          <div className="text-2xl animate-spin-slow">🌾</div>
        </div>
      )}

      {/* Wind lines */}
      {phase === "tension" && (
        <>
          {[...Array(3)].map((_, i) => (
            <div
              key={`wind-${i}`}
              className="absolute h-[1px] bg-gradient-to-r from-transparent via-amber-200/30 to-transparent animate-wind"
              style={{
                width: `${60 + Math.random() * 80}px`,
                top: `${30 + i * 15}%`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Left Cowboy (Player) */}
      <div
        className={`
          absolute bottom-[28%] left-[15%] transition-all duration-300
          ${isDraw ? "scale-110" : ""}
          ${isShot ? "translate-x-2" : ""}
          ${isTooEarly ? "opacity-50 -rotate-12 translate-y-4" : ""}
        `}
      >
        <CowboySilhouette facing="right" hat="round" />
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded">
            {playerName}
          </span>
        </div>
      </div>

      {/* Right Cowboy (Opponent) */}
      <div
        className={`
          absolute bottom-[28%] right-[15%] transition-all duration-300
          ${isDraw ? "scale-110" : ""}
        `}
      >
        <CowboySilhouette facing="left" hat="flat" />
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-bold text-red-300 bg-black/40 px-2 py-0.5 rounded">
            {opponentName}
          </span>
        </div>
      </div>

      {/* Gun flash on DRAW */}
      {isDraw && (
        <>
          <div className="absolute bottom-[38%] left-[28%] text-3xl animate-flash">💥</div>
          <div className="absolute bottom-[38%] right-[28%] text-3xl animate-flash" style={{ animationDelay: "0.1s" }}>💥</div>
        </>
      )}

      {/* Trigger animations */}
      {phase === "trigger" && showTrigger && (
        <TriggerAnimation type={triggerType} />
      )}

      {/* DRAW text overlay */}
      {isDraw && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl font-black text-white animate-draw-text"
            style={{
              textShadow: "0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.5)",
              letterSpacing: "0.2em",
            }}
          >
            DRAW!
          </div>
        </div>
      )}

      {/* Too early overlay */}
      {isTooEarly && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-center">
            <div className="text-4xl mb-2">💀</div>
            <div className="text-2xl font-bold text-red-400">Too early!</div>
          </div>
        </div>
      )}

      {/* Center text for phases */}
      {phase === "staredown" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <span className="text-xs text-amber-200/60 tracking-[0.3em] uppercase animate-pulse">
            Hands on holsters...
          </span>
        </div>
      )}

      {phase === "tension" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <span className="text-xs text-red-200/60 tracking-[0.3em] uppercase animate-pulse">
            Wait for it...
          </span>
        </div>
      )}

      {/* Shot indicator */}
      {isShot && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl">💨</div>
            <div className="text-lg font-bold text-white mt-1">Bang!</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CowboySilhouette({ facing, hat }: { facing: "left" | "right"; hat: "round" | "flat" }) {
  const flip = facing === "left" ? "scale-x-[-1]" : "";
  return (
    <svg
      width="50"
      height="70"
      viewBox="0 0 50 70"
      className={`${flip}`}
      fill="currentColor"
    >
      {/* Hat */}
      {hat === "round" ? (
        <>
          <ellipse cx="25" cy="12" rx="18" ry="4" fill="#1a1a1a" />
          <path d="M15 12 Q25 0 35 12" fill="#2a2a2a" />
        </>
      ) : (
        <>
          <rect x="8" y="10" width="34" height="3" rx="1" fill="#1a1a1a" />
          <rect x="15" y="3" width="20" height="9" rx="2" fill="#2a2a2a" />
        </>
      )}
      {/* Head */}
      <circle cx="25" cy="20" r="7" fill="#1a1a1a" />
      {/* Body */}
      <path d="M18 27 L15 50 L20 50 L25 38 L30 50 L35 50 L32 27 Z" fill="#1a1a1a" />
      {/* Legs */}
      <rect x="16" y="48" width="6" height="18" rx="2" fill="#1a1a1a" />
      <rect x="28" y="48" width="6" height="18" rx="2" fill="#1a1a1a" />
      {/* Gun arm */}
      <path d="M32 30 L42 38 L44 36 L35 28 Z" fill="#1a1a1a" />
      {/* Gun */}
      <rect x="42" y="34" width="8" height="3" rx="1" fill="#333" />
    </svg>
  );
}

function TriggerAnimation({ type }: { type: string }) {
  switch (type) {
    case "horse":
      return (
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 animate-trigger-appear">
          <div className="text-4xl animate-bounce">🐴</div>
          <div className="text-[10px] text-amber-200 text-center mt-1 animate-pulse">
            *NEIGH!*
          </div>
        </div>
      );
    case "bell":
      return (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 animate-trigger-appear">
          <div className="text-4xl animate-bell">🔔</div>
          <div className="text-[10px] text-amber-200 text-center mt-1">
            *DING DONG!*
          </div>
        </div>
      );
    case "cough":
      return (
        <div className="absolute bottom-[45%] left-1/2 -translate-x-1/2 animate-trigger-appear">
          <div className="text-2xl">💨</div>
          <div className="text-[10px] text-amber-200 text-center mt-1 animate-pulse">
            *AHEM!*
          </div>
        </div>
      );
    case "crow":
      return (
        <div className="absolute top-[20%] animate-crow">
          <div className="text-3xl">🦅</div>
          <div className="text-[10px] text-amber-200 text-center">
            *SCREECH!*
          </div>
        </div>
      );
    case "thunder":
      return (
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 animate-trigger-appear">
          <div className="text-4xl animate-flash">⚡</div>
          <div className="text-[10px] text-amber-200 text-center mt-1">
            *CRACK!*
          </div>
        </div>
      );
    default:
      return (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 animate-trigger-appear">
          <div className="text-4xl animate-bell">🔔</div>
        </div>
      );
  }
}
