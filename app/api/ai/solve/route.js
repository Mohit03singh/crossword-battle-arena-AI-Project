// app/api/ai/solve/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { llmSolveOne } from "@/lib/llm";

export async function POST(req) {
  try {
    const { clues, gridState, solvedKeys } = await req.json();
    if (!clues?.across || !clues?.down) {
      return NextResponse.json({ error: "Missing clues" }, { status: 400 });
    }
    const move = await llmSolveOne({ clues, gridState, solvedKeys });
    if (
      !move ||
      (move.direction !== "across" && move.direction !== "down") ||
      !Number.isFinite(move.row) ||
      !Number.isFinite(move.col) ||
      !move.answer
    ) {
      return NextResponse.json({ error: "No valid move" }, { status: 200 });
    }
    return NextResponse.json(move, { status: 200 });
  } catch {
    return NextResponse.json({ error: "AI solve failed" }, { status: 200 });
  }
}
