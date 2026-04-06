import { NextResponse } from "next/server";
import { state } from "@/lib/duel-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const rankings = Array.from(state.rankings.values())
    .filter((r) => r.wins + r.losses > 0)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .slice(0, 20);

  return NextResponse.json(rankings);
}
