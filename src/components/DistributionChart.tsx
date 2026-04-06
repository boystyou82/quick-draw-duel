"use client";

import { useMemo } from "react";

// Normal distribution CDF approximation (Abramowitz and Stegun)
function normalCDF(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327;
  const p =
    d *
    Math.exp((-z * z) / 2) *
    (t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744)))));
  return z > 0 ? 1 - p : p;
}

// Normal distribution PDF
function normalPDF(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp((-z * z) / 2) / (std * Math.sqrt(2 * Math.PI));
}

// Seeded random for consistent fake players
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const FAKE_NAMES = [
  "SpeedDemon", "FlashGordon", "QuickDraw", "NinjaReflex", "BoltMaster",
  "SwiftFox", "RapidFire", "ThunderClick", "LightningLee", "TurboMax",
  "PixelHunter", "ClickKing", "ReflexGod", "ZapMaster", "RocketJay",
  "SonicBoom", "BlitzKrieg", "HyperNova", "StormRider", "AceClicker",
  "CyberWolf", "NeonBlade", "GhostTap", "IronPulse", "VortexX",
  "ShadowSnap", "CometDash", "FrostByte", "BlazeTap", "WarpSpeed",
];

interface Props {
  reactionTime: number;
}

export default function DistributionChart({ reactionTime }: Props) {
  const MEAN = 255;
  const STD = 45;

  const percentile = useMemo(
    () => Math.round((1 - normalCDF(reactionTime, MEAN, STD)) * 100),
    [reactionTime]
  );

  // Generate bell curve points
  const curvePoints = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    for (let ms = 100; ms <= 450; ms += 2) {
      points.push({ x: ms, y: normalPDF(ms, MEAN, STD) });
    }
    return points;
  }, []);

  // Generate fake players scattered on the distribution
  const fakePlayers = useMemo(() => {
    const rand = seededRandom(42);
    const players: { name: string; time: number; y: number }[] = [];

    for (let i = 0; i < 20; i++) {
      // Box-Muller transform for normal distribution
      const u1 = rand();
      const u2 = rand();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const time = Math.round(MEAN + z * STD);
      if (time < 100 || time > 450) continue;

      players.push({
        name: FAKE_NAMES[i % FAKE_NAMES.length],
        time,
        y: 0.3 + rand() * 0.5, // scatter vertically within the chart area
      });
    }
    return players;
  }, []);

  // SVG dimensions
  const W = 400;
  const H = 180;
  const PAD = { top: 30, bottom: 35, left: 10, right: 10 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xScale = (ms: number) =>
    PAD.left + ((ms - 100) / (450 - 100)) * chartW;
  const maxY = normalPDF(MEAN, MEAN, STD);
  const yScale = (y: number) => PAD.top + chartH - (y / maxY) * chartH;

  // Build SVG path for the bell curve
  const pathD = curvePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.y)}`)
    .join(" ");

  // Fill area path
  const fillD = `${pathD} L ${xScale(450)} ${yScale(0)} L ${xScale(100)} ${yScale(0)} Z`;

  const userX = xScale(Math.max(100, Math.min(450, reactionTime)));
  const userCurveY = yScale(normalPDF(Math.max(100, Math.min(450, reactionTime)), MEAN, STD));

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
      {/* Percentile header */}
      <div className="text-center mb-3">
        <p className="text-sm text-zinc-400">
          Faster than{" "}
          <span className="text-2xl font-bold text-green-400">{percentile}%</span>
          {" "}of players
        </p>
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Reaction time distribution chart">
        {/* Grid lines */}
        {[150, 200, 250, 300, 350, 400].map((ms) => (
          <g key={ms}>
            <line
              x1={xScale(ms)}
              y1={PAD.top}
              x2={xScale(ms)}
              y2={PAD.top + chartH}
              stroke="#333"
              strokeWidth="0.5"
            />
            <text
              x={xScale(ms)}
              y={H - 5}
              textAnchor="middle"
              fill="#666"
              fontSize="10"
            >
              {ms}ms
            </text>
          </g>
        ))}

        {/* Bell curve fill */}
        <path d={fillD} fill="url(#curveGradient)" opacity="0.3" />

        {/* Bell curve line */}
        <path d={pathD} fill="none" stroke="#4ade80" strokeWidth="2" />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="30%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#4ade80" />
            <stop offset="70%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Fake players as dots */}
        {fakePlayers.map((player, i) => {
          const px = xScale(player.time);
          const py = PAD.top + player.y * chartH;
          return (
            <g key={i}>
              <circle cx={px} cy={py} r="3" fill="#555" opacity="0.6" />
              <text
                x={px}
                y={py - 6}
                textAnchor="middle"
                fill="#666"
                fontSize="6"
              >
                {player.name}
              </text>
            </g>
          );
        })}

        {/* User marker line */}
        <line
          x1={userX}
          y1={PAD.top}
          x2={userX}
          y2={PAD.top + chartH}
          stroke="#facc15"
          strokeWidth="2"
          strokeDasharray="4 2"
        />

        {/* User dot on curve */}
        <circle
          cx={userX}
          cy={userCurveY}
          r="5"
          fill="#facc15"
          stroke="#000"
          strokeWidth="1.5"
        />

        {/* YOU label */}
        <rect
          x={userX - 18}
          y={PAD.top - 2}
          width="36"
          height="16"
          rx="4"
          fill="#facc15"
        />
        <text
          x={userX}
          y={PAD.top + 10}
          textAnchor="middle"
          fill="#000"
          fontSize="10"
          fontWeight="bold"
        >
          YOU
        </text>
      </svg>

      {/* Legend */}
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1 px-2">
        <span>🤯 Incredible</span>
        <span>⚡ Amazing</span>
        <span>🔥 Fast</span>
        <span>👍 Average</span>
        <span>🐢 Slow</span>
      </div>
    </div>
  );
}
