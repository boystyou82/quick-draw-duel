import { NextResponse } from "next/server";
import { getTopRankings } from "@/lib/duel-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rankings = await getTopRankings(20);
    return NextResponse.json(rankings);
  } catch {
    return NextResponse.json([]);
  }
}
