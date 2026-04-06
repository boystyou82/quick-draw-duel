import { NextRequest, NextResponse } from "next/server";
import {
  generateId,
  getRandomTrigger,
  getPlayer,
  setPlayer,
  getRoom,
  setRoom,
  joinQueue,
  popQueue,
  getRanking,
  setRanking,
} from "@/lib/duel-state";
import type { Player, Room } from "@/lib/duel-state";

export async function POST(req: NextRequest) {
  const { nickname } = await req.json();
  if (!nickname || typeof nickname !== "string") {
    return NextResponse.json({ error: "Nickname required" }, { status: 400 });
  }

  const playerId = generateId();
  const player: Player = {
    id: playerId,
    nickname: nickname.trim().slice(0, 16),
    roomId: null,
  };
  await setPlayer(player);

  // Initialize ranking if new
  const existing = await getRanking(player.nickname);
  if (!existing) {
    await setRanking({
      nickname: player.nickname,
      wins: 0,
      losses: 0,
      bestTime: null,
    });
  }

  // Try to match with waiting player
  let matched = false;
  let attempts = 0;

  while (attempts < 5) {
    const waitingId = await popQueue();
    if (!waitingId) break;

    // Check if waiting player is still valid
    const waitingPlayer = await getPlayer(waitingId);
    if (!waitingPlayer || waitingPlayer.roomId) {
      attempts++;
      continue;
    }

    // Match found! Create room with scheduled timestamps
    const now = Date.now();
    const trigger = getRandomTrigger();
    const countdownDelay = 2000;
    const triggerDelay = countdownDelay + 2000 + Math.random() * 1000;
    const drawDelay = triggerDelay + 1000 + Math.random() * 3000;

    const roomId = generateId();
    const room: Room = {
      id: roomId,
      players: [waitingId, playerId],
      state: "countdown",
      triggerType: trigger.type,
      countdownAt: now + countdownDelay,
      triggerAt: now + triggerDelay,
      drawAt: now + drawDelay,
      timeoutAt: now + drawDelay + 5000,
      shots: {},
      tooEarly: [],
      winner: null,
    };
    await setRoom(room);

    // Update both players
    waitingPlayer.roomId = roomId;
    player.roomId = roomId;
    await setPlayer(waitingPlayer);
    await setPlayer(player);

    matched = true;

    return NextResponse.json({
      playerId,
      status: "matched",
      roomId,
      opponent: waitingPlayer.nickname,
    });
  }

  if (!matched) {
    // No match found, join queue
    await joinQueue(playerId);
    return NextResponse.json({
      playerId,
      status: "waiting",
    });
  }
}
