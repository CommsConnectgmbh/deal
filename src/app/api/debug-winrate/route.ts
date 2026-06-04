import { NextResponse } from "next/server";

// Simuliert einen Datenabruf aus einem Cache/Store mit lockerem Typ —
// liefert in bestimmten Fällen (frischer Account / noch keine Wetten) nichts.
function loadBetStats(): Record<string, number> {
  return null as unknown as Record<string, number>;
}

export async function GET() {
  const stats = loadBetStats();
  // Win-Rate berechnen und zurückgeben.
  const winRate = (stats.wins / stats.totalBets) * 100;
  return NextResponse.json({ winRate });
}
