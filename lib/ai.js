// lib/ai.js
import { ref, set, get } from "firebase/database";
import { db } from "./firebase";
import { postChatMessage } from "./chat";
import { aiLineOnAISolve } from "./aiLines";

export async function startAISolverSimul(normalizedClues, solvedKeys, gameId, gridStateForLLM) {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // Only UNSOLVED candidates
  const remaining = normalizedClues.filter(
    (c) => !solvedKeys.includes(`${c.direction}-${c.row}-${c.col}`)
  );
  if (remaining.length === 0) return false;

  // Try LLM
  let move = null;
  try {
    const res = await fetch("/api/ai/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clues: {
          across: remaining.filter((c) => c.direction === "across"),
          down:   remaining.filter((c) => c.direction === "down"),
        },
        gridState: gridStateForLLM || {},
        solvedKeys: solvedKeys || [],
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.answer) move = json;
    }
  } catch { /* silent */ }

  // Fallback to first remaining with known answer
  const isSolvedKey = (m) => m && solvedKeys.includes(`${m.direction}-${m.row}-${m.col}`);
  if (!move || isSolvedKey(move)) {
    const next = remaining.find((c) => c.answer);
    if (!next) return false;
    move = { direction: next.direction, row: next.row, col: next.col, answer: next.answer };
  }

  const { row, col, direction, answer } = move;
  const len = answer.length;

  // Realistic delay
  await delay(3000 + Math.floor(Math.random() * 5000));

  // Type letters
  for (let i = 0; i < len; i++) {
    const r = direction === "across" ? row : row + i;
    const c = direction === "across" ? col + i : col;
    await set(ref(db, `games/${gameId}/gridState/${r}-${c}`), {
      value: answer[i].toUpperCase(),
      filledBy: "ai",
    });
    await delay(70);
  }

  // Flavor line (predicted)
  try {
    const aiRef = ref(db, `games/${gameId}/ai_score`);
    const playerRef = ref(db, `games/${gameId}/player_score`);
    const [aiSnap, playerSnap] = await Promise.all([get(aiRef), get(playerRef)]);
    const currentAI = aiSnap.exists() ? aiSnap.val() : 0;
    const currentPlayer = playerSnap.exists() ? playerSnap.val() : 0;
    postChatMessage(gameId, "ai", aiLineOnAISolve({ playerScore: currentPlayer, aiScore: currentAI + 1 }));
  } catch {}
  return true;
}
