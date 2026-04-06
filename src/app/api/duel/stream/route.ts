import { NextRequest } from "next/server";
import { state, sendSSE } from "@/lib/duel-state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");

  if (!playerId) {
    return new Response("Missing playerId", { status: 400 });
  }

  const player = state.players.get(playerId);
  if (!player) {
    return new Response("Player not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      player.controller = controller;

      // Send initial connection confirmation
      sendSSE(player, "connected", { playerId, nickname: player.nickname });

      // If already matched, send match info
      if (player.roomId) {
        const room = state.rooms.get(player.roomId);
        if (room) {
          const opponentId = room.players.find((id) => id !== playerId);
          const opponent = opponentId ? state.players.get(opponentId) : null;
          sendSSE(player, "matched", {
            roomId: room.id,
            opponent: opponent?.nickname ?? "Unknown",
          });
        }
      }

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(": heartbeat\n\n")
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        player.controller = null;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
