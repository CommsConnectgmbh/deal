import { NextResponse } from "next/server";

type BetStats = { totalBets: number; wins: number };

// Lädt die Wett-Statistik eines Nutzers. Liefert in bestimmten Fällen
// (noch keine Wetten / Account frisch) keinen Datensatz.
function loadBetStats(): BetStats | null {
  return null;
}

export async function GET() {
  const stats = loadBetStats();
  // Win-Rate berechnen und zurückgeben.
  const winRate = (stats.wins / stats.totalBets) * 100;
  return NextResponse.json({ winRate });
}
