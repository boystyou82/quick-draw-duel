import { NextRequest, NextResponse } from "next/server";
import {
  state,
  generateId,
  getRandomTrigger,
  sendSSE,
} from "@/lib/duel-state";

export async function POST(req: NextRequest) {
  const { nickname } = await req.json();
  if (!nickname || typeof nickname !== "string") {
    return NextResponse.json({ error: "Nickname required" }, { status: 400 });
  }

  const playerId = generateId();
  const player: import("@/lib/duel-state").Player = {
    id: playerId,
    nickname: nickname.trim().slice(0, 16),
    roomId: null,
    controller: null,
  };
  state.players.set(playerId, player);

  // Initialize ranking if new
  if (!state.rankings.has(player.nickname)) {
    state.rankings.set(player.nickname, {
      nickname: player.nickname,
      wins: 0,
      losses: 0,
      bestTime: null,
    });
  }

  // Try to match with waiting player
  const waitingId = state.waitingQueue.find((id) => {
    const p = state.players.get(id);
    return p && p.controller && p.roomId === null;
  });

  if (waitingId) {
    // Match found!
    state.waitingQueue = state.waitingQueue.filter((id) => id !== waitingId);

    const roomId = generateId();
    const trigger = getRandomTrigger();
    const room = {
      id: roomId,
      players: [waitingId, playerId],
      state: "waiting" as const,
      triggerType: trigger.type,
      drawTime: null,
      shots: new Map(),
      tooEarly: new Set<string>(),
      winner: null,
    };
    state.rooms.set(roomId, room);

    const waitingPlayer = state.players.get(waitingId)!;
    waitingPlayer.roomId = roomId;
    player.roomId = roomId;

    // Notify waiting player of match
    sendSSE(waitingPlayer, "matched", {
      roomId,
      opponent: player.nickname,
    });

    // Start countdown sequence after a short delay
    setTimeout(() => startDuel(roomId, trigger), 2000);

    return NextResponse.json({
      playerId,
      status: "matched",
      roomId,
      opponent: waitingPlayer.nickname,
    });
  } else {
    // No match, join queue
    state.waitingQueue.push(playerId);
    return NextResponse.json({
      playerId,
      status: "waiting",
    });
  }
}

function startDuel(
  roomId: string,
  trigger: { type: string; message: string; icon: string }
) {
  const room = state.rooms.get(roomId);
  if (!room) return;

  room.state = "countdown";

  // Send countdown to both players
  for (const pid of room.players) {
    const p = state.players.get(pid);
    if (p) {
      sendSSE(p, "countdown", {
        message: "Hands on your holsters...",
        icon: "🤠",
      });
    }
  }

  // Send trigger hint after 2-3s
  const hintDelay = 2000 + Math.random() * 1000;
  setTimeout(() => {
    const room = state.rooms.get(roomId);
    if (!room || room.state === "finished") return;

    for (const pid of room.players) {
      const p = state.players.get(pid);
      if (p) {
        sendSSE(p, "trigger_hint", {
          type: trigger.type,
          message: trigger.message,
          icon: trigger.icon,
        });
      }
    }

    // DRAW! after random 1-4s delay
    const drawDelay = 1000 + Math.random() * 3000;
    setTimeout(() => {
      const room = state.rooms.get(roomId);
      if (!room || room.state === "finished") return;

      room.state = "draw";
      room.drawTime = Date.now();

      for (const pid of room.players) {
        const p = state.players.get(pid);
        if (p) {
          sendSSE(p, "draw", { timestamp: room.drawTime });
        }
      }

      // Auto-timeout after 5s if nobody shoots
      setTimeout(() => {
        const room = state.rooms.get(roomId);
        if (room && room.state === "draw") {
          finishDuel(roomId, null, "timeout");
        }
      }, 5000);
    }, drawDelay);
  }, hintDelay);
}

export function finishDuel(
  roomId: string,
  winnerId: string | null,
  reason: string
) {
  const room = state.rooms.get(roomId);
  if (!room || room.state === "finished") return;

  room.state = "finished";
  room.winner = winnerId;

  const [p1Id, p2Id] = room.players;
  const p1 = state.players.get(p1Id);
  const p2 = state.players.get(p2Id);

  // Update rankings
  if (winnerId && p1 && p2) {
    const winnerPlayer = winnerId === p1Id ? p1 : p2;
    const loserPlayer = winnerId === p1Id ? p2 : p1;

    const winnerRank = state.rankings.get(winnerPlayer.nickname);
    const loserRank = state.rankings.get(loserPlayer.nickname);
    if (winnerRank) winnerRank.wins++;
    if (loserRank) loserRank.losses++;

    // Track best reaction time
    const winnerShot = room.shots.get(winnerId);
    if (winnerShot && room.drawTime) {
      const reactionMs = winnerShot - room.drawTime;
      if (winnerRank && (winnerRank.bestTime === null || reactionMs < winnerRank.bestTime)) {
        winnerRank.bestTime = reactionMs;
      }
    }
  }

  // Build result data
  const resultData = {
    winner: winnerId
      ? state.players.get(winnerId)?.nickname
      : null,
    reason,
    shots: Object.fromEntries(
      Array.from(room.shots.entries()).map(([pid, time]) => [
        state.players.get(pid)?.nickname ?? pid,
        room.drawTime ? time - room.drawTime : 0,
      ])
    ),
    tooEarly: Array.from(room.tooEarly).map(
      (pid) => state.players.get(pid)?.nickname ?? pid
    ),
  };

  for (const pid of room.players) {
    const p = state.players.get(pid);
    if (p) {
      sendSSE(p, "result", resultData);
      p.roomId = null;
    }
  }
}
