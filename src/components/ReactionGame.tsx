"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DistributionChart from "./DistributionChart";

type GameState = "idle" | "waiting" | "ready" | "result" | "too-early";

interface Attempt {
  time: number;
  timestamp: number;
}

function getRating(ms: number): { label: string; color: string; emoji: string } {
  if (ms < 150) return { label: "Incredible!", color: "text-purple-400", emoji: "🤯" };
  if (ms < 200) return { label: "Amazing!", color: "text-cyan-400", emoji: "⚡" };
  if (ms < 250) return { label: "Fast!", color: "text-green-400", emoji: "🔥" };
  if (ms < 300) return { label: "Average", color: "text-yellow-400", emoji: "👍" };
  if (ms < 400) return { label: "Slow", color: "text-orange-400", emoji: "🐢" };
  return { label: "Try again!", color: "text-red-400", emoji: "😴" };
}

export default function ReactionGame() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [reactionTime, setReactionTime] = useState<number>(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem("reaction-best");
    if (saved) setBestTime(Number(saved));
  }, []);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    cleanup();
    setGameState("waiting");

    const delay = Math.random() * 4000 + 1000; // 1-5 seconds
    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = performance.now();
      setGameState("ready");
    }, delay);
  }, [cleanup]);

  const handleClick = useCallback(() => {
    if (gameState === "idle" || gameState === "result" || gameState === "too-early") {
      startGame();
      return;
    }

    if (gameState === "waiting") {
      cleanup();
      setGameState("too-early");
      return;
    }

    if (gameState === "ready") {
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setReactionTime(elapsed);
      setGameState("result");

      const newAttempt = { time: elapsed, timestamp: Date.now() };
      const newAttempts = [...attempts, newAttempt].slice(-5);
      setAttempts(newAttempts);

      if (!bestTime || elapsed < bestTime) {
        setBestTime(elapsed);
        localStorage.setItem("reaction-best", String(elapsed));
      }
    }
  }, [gameState, attempts, bestTime, startGame, cleanup]);

  const average =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.time, 0) / attempts.length)
      : null;

  const shareText =
    gameState === "result"
      ? `My reaction time: ${reactionTime}ms! ${getRating(reactionTime).emoji} Can you beat me? `
      : "";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Reaction Time Test", text: shareText });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Copied to clipboard!");
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto select-none">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-yellow-400">⚡</span> Reaction Time Test
        </h1>
        <p className="text-zinc-400 text-sm">
          Average human reaction time is <span className="text-yellow-400 font-semibold">250ms</span>
        </p>
      </div>

      {/* Game Area */}
      <div
        onClick={handleClick}
        className={`
          relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center cursor-pointer
          transition-colors duration-100 text-center px-8
          ${gameState === "idle" ? "bg-blue-600 hover:bg-blue-500" : ""}
          ${gameState === "waiting" ? "bg-red-600" : ""}
          ${gameState === "ready" ? "bg-green-500" : ""}
          ${gameState === "result" ? "bg-zinc-800 border border-zinc-700" : ""}
          ${gameState === "too-early" ? "bg-orange-600" : ""}
        `}
      >
        {gameState === "idle" && (
          <>
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-2xl font-bold text-white">Click to Start</p>
            <p className="text-blue-200 mt-2 text-sm">Test how fast you can react</p>
          </>
        )}

        {gameState === "waiting" && (
          <>
            <div className="text-6xl mb-4">🔴</div>
            <p className="text-2xl font-bold text-white">Wait for green...</p>
            <p className="text-red-200 mt-2 text-sm">Don&apos;t click yet!</p>
          </>
        )}

        {gameState === "ready" && (
          <>
            <div className="text-6xl mb-4">🟢</div>
            <p className="text-3xl font-bold text-white">CLICK NOW!</p>
          </>
        )}

        {gameState === "too-early" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <p className="text-2xl font-bold text-white">Too early!</p>
            <p className="text-orange-200 mt-2 text-sm">Click to try again</p>
          </>
        )}

        {gameState === "result" && (
          <>
            <div className="text-5xl mb-2">{getRating(reactionTime).emoji}</div>
            <p className={`text-6xl font-bold font-mono ${getRating(reactionTime).color}`}>
              {reactionTime}<span className="text-2xl">ms</span>
            </p>
            <p className={`text-xl font-semibold mt-2 ${getRating(reactionTime).color}`}>
              {getRating(reactionTime).label}
            </p>
            <p className="text-zinc-400 mt-4 text-sm">Click to try again</p>
          </>
        )}
      </div>

      {/* Stats & Share */}
      {(attempts.length > 0 || bestTime) && (
        <div className="mt-6 space-y-4">
          {/* Stats Row */}
          <div className="flex gap-3">
            {bestTime && (
              <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Best</p>
                <p className="text-2xl font-bold font-mono text-green-400">{bestTime}ms</p>
              </div>
            )}
            {average && (
              <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Average</p>
                <p className="text-2xl font-bold font-mono text-yellow-400">{average}ms</p>
              </div>
            )}
            <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Tries</p>
              <p className="text-2xl font-bold font-mono text-blue-400">{attempts.length}</p>
            </div>
          </div>

          {/* Recent Attempts */}
          {attempts.length > 1 && (
            <div className="flex gap-2 justify-center">
              {attempts.map((a, i) => (
                <div
                  key={a.timestamp}
                  className={`px-3 py-1 rounded-full text-xs font-mono ${
                    i === attempts.length - 1
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-800/50 text-zinc-500"
                  }`}
                >
                  {a.time}ms
                </div>
              ))}
            </div>
          )}

          {/* Distribution Chart */}
          {gameState === "result" && (
            <DistributionChart reactionTime={reactionTime} />
          )}

          {/* Share Button */}
          {gameState === "result" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
            >
              Share Result 🔗
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-600">
          Tip: Use a mouse for best accuracy. Mobile touch adds ~50ms delay.
        </p>
      </div>
    </div>
  );
}
