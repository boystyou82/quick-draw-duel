import { NextRequest, NextResponse } from "next/server";
import {
  getPlayer,
  getRoom,
  setRoom,
  computePhase,
  getRanking,
  setRanking,
} from "@/lib/duel-state";

export async function POST(req: NextRequest) {
  const { playerId, shootTime } = await req.json();

  const player = await getPlayer(playerId);
  if (!player || !player.roomId) {
    return NextResponse.json({ error: "Not in a duel" }, { status: 400 });
  }

  const room = await getRoom(player.roomId);
  if (!room || room.state === "finished") {
    return NextResponse.json({ error: "Duel already finished" }, { status: 400 });
  }

  // Already shot
  if (room.shots[playerId]) {
    return NextResponse.json({ error: "Already shot" }, { status: 400 });
  }

  const now = shootTime || Date.now();
  const phase = computePhase(room);

  // Too early (before DRAW)
  if (phase === "countdown" || phase === "trigger_hint") {
    room.tooEarly.push(playerId);
    room.state = "finished";
    const opponentId = room.players.find((id) => id !== playerId)!;
    room.winner = opponentId;
    await setRoom(room);
    await updateRankings(room);
    return NextResponse.json({ result: "too_early" });
  }

  // Valid shot during DRAW
  if (phase === "draw") {
    room.shots[playerId] = now;
    const opponentId = room.players.find((id) => id !== playerId)!;
    const opponentShot = room.shots[opponentId];

    if (opponentShot) {
      // Both shot - faster wins
      room.winner = now <= opponentShot ? playerId : opponentId;
      room.state = "finished";
      await setRoom(room);
      await updateRankings(room);
    } else {
      // First shot - save and wait for opponent (or timeout)
      await setRoom(room);

      // Check if opponent shot too early
      if (room.tooEarly.includes(opponentId)) {
        room.winner = playerId;
        room.state = "finished";
        await setRoom(room);
        await updateRankings(room);
      }
    }

    return NextResponse.json({
      result: "shot",
      reactionTime: now - room.drawAt,
    });
  }

  return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
}

async function updateRankings(room: {
  winner: string | null;
  players: string[];
  shots: Record<string, number>;
  drawAt: number;
}) {
  if (!room.winner) return;

  for (const pid of room.players) {
    // We need to get player to find nickname
    const player = await (await import("@/lib/duel-state")).getPlayer(pid);
    if (!player) continue;

    const rank = (await getRanking(player.nickname)) || {
      nickname: player.nickname,
      wins: 0,
      losses: 0,
      bestTime: null,
    };

    if (pid === room.winner) {
      rank.wins++;
      const shotTime = room.shots[pid];
      if (shotTime) {
        const reactionMs = shotTime - room.drawAt;
        if (rank.bestTime === null || reactionMs < rank.bestTime) {
          rank.bestTime = reactionMs;
        }
      }
    } else {
      rank.losses++;
    }

    await setRanking(rank);
  }
}
