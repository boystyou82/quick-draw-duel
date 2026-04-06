"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import WesternScene from "./WesternScene";

type Phase =
  | "nickname"
  | "joining"
  | "waiting"
  | "matched"
  | "countdown"
  | "trigger_hint"
  | "draw"
  | "too_early"
  | "result";

type ScenePhase =
  | "idle"
  | "staredown"
  | "tension"
  | "trigger"
  | "draw"
  | "shot"
  | "too_early";

interface DuelResult {
  winner: string | null;
  shots: Record<string, number>;
  tooEarly: string[];
  drawAt: number;
  myId: string;
  players: string[];
}

interface RankEntry {
  nickname: string;
  wins: number;
  losses: number;
  bestTime: number | null;
}

function phaseToScene(phase: Phase, hasShot: boolean): ScenePhase {
  switch (phase) {
    case "matched": return "idle";
    case "countdown": return "staredown";
    case "trigger_hint": return "tension";
    case "draw": return hasShot ? "shot" : "draw";
    case "too_early": return "too_early";
    default: return "idle";
  }
}

export default function DuelGame() {
  const [phase, setPhase] = useState<Phase>("nickname");
  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState("");
  const [triggerType, setTriggerType] = useState("bell");
  const [result, setResult] = useState<DuelResult | null>(null);
  const [myReactionTime, setMyReactionTime] = useState<number | null>(null);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [hasShot, setHasShot] = useState(false);
  const [drawTime, setDrawTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);

  // Keep ref in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Fetch rankings
  useEffect(() => {
    fetch("/api/duel/rankings")
      .then((r) => r.json())
      .then(setRankings)
      .catch(() => {});
  }, []);

  const fetchRankings = () => {
    fetch("/api/duel/rankings")
      .then((r) => r.json())
      .then(setRankings)
      .catch(() => {});
  };

  // Start polling (uses ref to avoid stale closure)
  function startPolling(pid: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/duel/status?playerId=${pid}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.opponent) setOpponent(data.opponent);
        if (data.triggerType) setTriggerType(data.triggerType);

        if (data.phase === "result" && data.result) {
          setResult(data.result);
          setPhase("result");
          fetchRankings();
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }

        const cur = phaseRef.current;
        const sp = data.phase as string;

        // Only advance phase forward, never backward
        if (sp === "matched" && (cur === "waiting" || cur === "joining")) {
          setPhase("matched");
        } else if (sp === "countdown" && cur === "matched") {
          setPhase("countdown");
        } else if (sp === "trigger_hint" && cur === "countdown") {
          setPhase("trigger_hint");
        } else if (sp === "draw" && cur !== "draw" && cur !== "too_early" && cur !== "result") {
          if (data.drawTime) setDrawTime(data.drawTime);
          setPhase("draw");
        }
      } catch {}
    }, 400);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Join duel
  async function joinDuel() {
    const name = nickname.trim();
    if (!name) return;

    setError(null);
    setPhase("joining");

    try {
      const res = await fetch("/api/duel/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name }),
      });

      if (!res.ok) {
        const errData = await res.text();
        setError(`Server error: ${res.status} - ${errData}`);
        setPhase("nickname");
        return;
      }

      const data = await res.json();
      setPlayerId(data.playerId);
      setHasShot(false);
      setMyReactionTime(null);
      setResult(null);

      if (data.status === "matched") {
        setOpponent(data.opponent);
        setPhase("matched");
      } else {
        setPhase("waiting");
      }

      startPolling(data.playerId);
    } catch (err) {
      setError(`Connection failed: ${err}`);
      setPhase("nickname");
    }
  }

  // Shoot
  const shoot = useCallback(async () => {
    if (!playerId || hasShot) return;
    const cur = phaseRef.current;
    if (cur !== "countdown" && cur !== "trigger_hint" && cur !== "draw") return;

    setHasShot(true);
    const now = Date.now();

    if (cur === "countdown" || cur === "trigger_hint") {
      setPhase("too_early");
    }

    if (cur === "draw" && drawTime) {
      setMyReactionTime(now - drawTime);
    }

    try {
      await fetch("/api/duel/shoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, shootTime: now }),
      });
    } catch {}
  }, [playerId, hasShot, drawTime]);

  // Keyboard: Space to shoot
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shoot]);

  function playAgain() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPhase("nickname");
    setPlayerId(null);
    setHasShot(false);
    setResult(null);
    setMyReactionTime(null);
    setError(null);
  }

  const iWon = result?.winner ? result.myId === result.winner : false;
  const isDraw = !result?.winner && phase === "result";

  // Nickname map for result display
  const getNickname = (pid: string) => {
    if (pid === playerId) return nickname;
    return opponent || pid;
  };

  const showScene =
    phase === "matched" ||
    phase === "countdown" ||
    phase === "trigger_hint" ||
    phase === "draw" ||
    phase === "too_early";

  return (
    <div className="w-full max-w-2xl mx-auto select-none">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-1">
          <span className="text-amber-500">🤠</span> Quick Draw Duel
        </h1>
        <p className="text-zinc-500 text-sm">The fastest gun in the West wins</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* === NICKNAME === */}
      {phase === "nickname" && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-12 text-center space-y-6">
          <div className="text-6xl">🌵</div>
          <p className="text-xl text-amber-400 font-semibold">Enter the Saloon</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinDuel()}
            placeholder="Your cowboy name..."
            maxLength={16}
            autoFocus
            className="w-64 px-4 py-3 bg-zinc-900 border border-zinc-600 rounded-xl text-center
              text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 text-lg"
          />
          <div>
            <button
              onClick={() => joinDuel()}
              disabled={!nickname.trim()}
              className="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700
                disabled:text-zinc-500 text-white font-bold rounded-xl transition-colors text-lg"
            >
              Find Opponent 🔫
            </button>
          </div>
        </div>
      )}

      {/* === JOINING === */}
      {phase === "joining" && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-12 text-center space-y-4">
          <div className="text-4xl animate-spin">⏳</div>
          <p className="text-amber-400">Entering the saloon...</p>
        </div>
      )}

      {/* === WAITING === */}
      {phase === "waiting" && (
        <div className="bg-zinc-800 border border-amber-900/50 rounded-2xl p-12 text-center space-y-4">
          <div className="text-6xl animate-bounce">🚪</div>
          <p className="text-xl text-amber-400 font-semibold">Waiting at the Saloon...</p>
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <p className="text-zinc-600 text-xs mt-4">
            Share this link — or open another tab to test
          </p>
        </div>
      )}

      {/* === GAME SCENE === */}
      {showScene && (
        <div
          onClick={
            phase === "countdown" || phase === "trigger_hint" || phase === "draw"
              ? () => shoot()
              : undefined
          }
          className={
            phase === "countdown" || phase === "trigger_hint" || phase === "draw"
              ? "cursor-crosshair"
              : ""
          }
        >
          <WesternScene
            phase={phaseToScene(phase, hasShot)}
            playerName={nickname}
            opponentName={opponent}
            triggerType={triggerType}
          />

          {(phase === "countdown" || phase === "trigger_hint") && (
            <div className="mt-3 text-center">
              <p className="text-amber-400/60 text-sm animate-pulse">
                ⚠️ Click or press Space when you see the signal — not before!
              </p>
            </div>
          )}
          {phase === "draw" && !hasShot && (
            <div className="mt-3 text-center">
              <p className="text-red-400 text-lg font-bold animate-pulse">
                🔫 SHOOT NOW! Click or press Space!
              </p>
            </div>
          )}
          {phase === "draw" && hasShot && (
            <div className="mt-3 text-center">
              <p className="text-zinc-400 text-sm">
                Shot fired!{" "}
                {myReactionTime && (
                  <span className="text-green-400 font-mono">{myReactionTime}ms</span>
                )}{" "}
                — waiting for opponent...
              </p>
            </div>
          )}
          {phase === "too_early" && (
            <div className="mt-4 text-center">
              <p className="text-red-400 mb-3">You drew before the signal!</p>
              <button
                onClick={playAgain}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
              >
                Try Again 🔫
              </button>
            </div>
          )}
        </div>
      )}

      {/* === RESULT === */}
      {phase === "result" && result && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center space-y-6">
          <div className="text-6xl">{iWon ? "🏆" : isDraw ? "🤝" : "💀"}</div>

          {isDraw ? (
            <p className="text-3xl text-zinc-400 font-bold">Draw! Nobody shot.</p>
          ) : iWon ? (
            <div>
              <p className="text-3xl text-amber-400 font-bold">You win, Sheriff!</p>
              {myReactionTime && (
                <p className="text-green-400 font-mono text-2xl mt-2">{myReactionTime}ms</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-3xl text-red-400 font-bold">You lost, partner.</p>
              {result.tooEarly.includes(result.myId) && (
                <p className="text-red-300 text-sm mt-1">Drew too early!</p>
              )}
            </div>
          )}

          {Object.keys(result.shots).length > 0 && (
            <div className="flex gap-4 justify-center">
              {Object.entries(result.shots).map(([pid, ts]) => {
                const ms = Math.round(ts - result.drawAt);
                return (
                  <div
                    key={pid}
                    className={`px-5 py-3 rounded-xl ${
                      pid === result.winner
                        ? "bg-amber-900/50 border border-amber-700"
                        : "bg-zinc-700/50 border border-zinc-600"
                    }`}
                  >
                    <p className="text-xs text-zinc-400">{getNickname(pid)}</p>
                    <p className={`font-mono font-bold text-lg ${
                      pid === result.winner ? "text-amber-400" : "text-zinc-300"
                    }`}>
                      {ms}ms
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={playAgain}
            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors text-lg"
          >
            Duel Again 🔫
          </button>
        </div>
      )}

      {/* Rankings */}
      {rankings.length > 0 && (
        <div className="mt-6 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
          <h2 className="text-center text-amber-500 font-bold mb-3">🏆 Fastest Guns in Town</h2>
          <div className="space-y-1">
            {rankings.map((r, i) => (
              <div
                key={r.nickname}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  r.nickname === nickname ? "bg-amber-900/30 border border-amber-800/50" : "hover:bg-zinc-700/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm w-6">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className={`font-medium ${r.nickname === nickname ? "text-amber-400" : "text-zinc-300"}`}>
                    {r.nickname}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-400">{r.wins}W</span>
                  <span className="text-red-400">{r.losses}L</span>
                  {r.bestTime && <span className="text-zinc-500 font-mono">{r.bestTime}ms</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-zinc-600 space-y-1">
        <p>
          Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Space</kbd> or{" "}
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Click</kbd> to shoot
        </p>
      </div>
    </div>
  );
}
