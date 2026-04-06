import { NextRequest, NextResponse } from "next/server";
import { state, sendSSE } from "@/lib/duel-state";
import { finishDuel } from "../join/route";

export async function POST(req: NextRequest) {
  const { playerId } = await req.json();

  const player = state.players.get(playerId);
  if (!player || !player.roomId) {
    return NextResponse.json({ error: "Not in a duel" }, { status: 400 });
  }

  const room = state.rooms.get(player.roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const now = Date.now();

  // Too early! (shot before DRAW)
  if (room.state === "countdown") {
    room.tooEarly.add(playerId);
    room.state = "finished";

    // The other player wins
    const opponentId = room.players.find((id) => id !== playerId)!;
    finishDuel(room.id, opponentId, "too_early");

    return NextResponse.json({ result: "too_early" });
  }

  // Already finished
  if (room.state === "finished") {
    return NextResponse.json({ error: "Duel already finished" }, { status: 400 });
  }

  // Valid shot during DRAW phase
  if (room.state === "draw") {
    room.shots.set(playerId, now);

    // Check if both players have shot
    const otherPlayerId = room.players.find((id) => id !== playerId)!;
    const otherShot = room.shots.get(otherPlayerId);

    if (otherShot) {
      // Both shot - faster wins
      const winner = now <= otherShot ? playerId : otherPlayerId;
      finishDuel(room.id, winner, "both_shot");
    } else {
      // First shot - notify opponent and wait briefly
      const opponent = state.players.get(otherPlayerId);
      if (opponent) {
        sendSSE(opponent, "opponent_shot", {
          nickname: player.nickname,
        });
      }

      // Give opponent 1s grace period, then auto-win
      setTimeout(() => {
        const room = state.rooms.get(player.roomId!);
        if (room && room.state === "draw" && !room.shots.has(otherPlayerId)) {
          finishDuel(room.id, playerId, "faster");
        }
      }, 1000);
    }

    return NextResponse.json({
      result: "shot",
      reactionTime: room.drawTime ? now - room.drawTime : 0,
    });
  }

  return NextResponse.json({ error: "Invalid state" }, { status: 400 });
}
