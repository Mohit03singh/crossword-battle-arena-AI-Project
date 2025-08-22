// lib/ai.js
import { ref, set } from "firebase/database";
import { db } from "./firebase";
import { addScore } from "./score";

// Returns true if AI solved one word, false if none left
export async function startAISolverTurnBased(aiClues, solvedKeys) {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // Find the first unsolved clue
  const next = aiClues.find((clue) => {
    const key = `${clue.direction}-${clue.row}-${clue.col}`;
    return !solvedKeys.includes(key);
  });

  if (!next) {
    // no AI move available
    return false;
  }

  const { row, col, answer, direction } = next;
  const clueKey = `${direction}-${row}-${col}`;

  // Type the word letter-by-letter
  for (let i = 0; i < answer.length; i++) {
    const r = direction === "across" ? row : row + i;
    const c = direction === "across" ? col + i : col;
    const key = `${r}-${c}`;
    await set(ref(db, `game/gridState/${key}`), {
      value: answer[i].toUpperCase(),
      filledBy: "ai",
    });
    await delay(300);
  }

  // Mark scored + award AI
  await set(ref(db, `game/gridState/${clueKey}`), { scored: true });
  await addScore("ai", answer.length * 10);

  return true;
}
