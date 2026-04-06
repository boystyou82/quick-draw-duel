import { NextRequest, NextResponse } from "next/server";
import {
  getPlayer,
  getRoom,
  computePhase,
  setRoom,
  getRanking,
  setRanking,
} from "@/lib/duel-state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  }

  const player = await getPlayer(playerId);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Not in a room yet - still waiting
  if (!player.roomId) {
    return NextResponse.json({ phase: "waiting", nickname: player.nickname });
  }

  const room = await getRoom(player.roomId);
  if (!room) {
    return NextResponse.json({ phase: "waiting", nickname: player.nickname });
  }

  const phase = computePhase(room);

  // Auto-timeout: if draw phase expired and nobody shot
  if (phase === "timeout" && room.state !== "finished") {
    room.state = "finished";
    room.winner = null;
    await setRoom(room);

    return NextResponse.json({
      phase: "result",
      nickname: player.nickname,
      result: buildResult(room, player.id),
    });
  }

  // Get opponent info
  const opponentId = room.players.find((id) => id !== playerId);
  const opponent = opponentId ? await getPlayer(opponentId) : null;

  const response: Record<string, unknown> = {
    phase,
    nickname: player.nickname,
    opponent: opponent?.nickname ?? "Unknown",
    triggerType: room.triggerType,
  };

  if (phase === "draw") {
    response.drawTime = room.drawAt;
  }

  if (phase === "result" || room.state === "finished") {
    response.phase = "result";
    response.result = buildResult(room, playerId);
  }

  return NextResponse.json(response);
}

function buildResult(room: { shots: Record<string, number>; tooEarly: string[]; winner: string | null; drawAt: number; players: string[] }, playerId: string) {
  return {
    winner: room.winner,
    shots: room.shots,
    tooEarly: room.tooEarly,
    drawAt: room.drawAt,
    myId: playerId,
    players: room.players,
  };
}
