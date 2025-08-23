// app/game/page.js
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import CrosswordGrid from "@/components/CrosswordGrid";
import ClueList from "@/components/ClueList";
import ScoreBar from "@/components/ScoreBar";
import ChatPanel from "@/components/ChatPanel";

import { puzzle } from "../../data/puzzle";
import { aiClueAnswers } from "../../data/aiAnswers";

import { db } from "@/lib/firebase";
import { ref, onValue, set, remove, get, push } from "firebase/database";

import { startAISolverSimul } from "@/lib/ai";
import { getOrCreateGameId } from "@/lib/gameId";
import { postChatMessage } from "@/lib/chat";
import { aiLineOnPlayerSolve, aiLineOnGameStart, aiLineOnGameOver } from "@/lib/aiLines";
import { getNormalizedPuzzle, normalizeClues } from "@/lib/puzzleUtils";

const BASE_POINTS_PER_WORD = 1;
function computeTimeBonus(now, lastTick) {
  const delta = Math.max(0, Math.floor((now - (lastTick || now)) / 1000));
  if (delta <= 5) return 2;
  if (delta <= 10) return 1;
  return 0;
}

const normalizedPuzzle = getNormalizedPuzzle(puzzle);
const ALL_CLUES = [...normalizedPuzzle.clues.across, ...normalizedPuzzle.clues.down];
const normalizedAISeed = normalizeClues(aiClueAnswers);

export default function GamePage() {
  const gameId = getOrCreateGameId();

  const [activeWord, setActiveWord] = useState(null);
  const [gridState, setGridState] = useState({});
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [gameStatus, setGameStatus] = useState("idle"); // "idle" | "active" | "completed"
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [lastSolveTs, setLastSolveTs] = useState(0);
  const aiBusyRef = useRef(false);

  // Listeners
  useEffect(() => {
    if (!gameId) return;
    const gridRef = ref(db, `games/${gameId}/gridState`);
    const pScore  = ref(db, `games/${gameId}/player_score`);
    const aScore  = ref(db, `games/${gameId}/ai_score`);
    const status  = ref(db, `games/${gameId}/game_status`);
    const lastRef = ref(db, `games/${gameId}/last_event_at`);

    const ug = onValue(gridRef, (s) => setGridState(s.val() || {}));
    const up = onValue(pScore,  (s) => setScores((pr) => ({ ...pr, player: s.val() || 0 })));
    const ua = onValue(aScore,  (s) => setScores((pr) => ({ ...pr, ai:     s.val() || 0 })));
    const us = onValue(status,  (s) => setGameStatus(s.val() || "idle"));
    const ul = onValue(lastRef, (s) => setLastSolveTs(s.val() || 0));
    return () => { ug(); up(); ua(); us(); ul(); };
  }, [gameId]);

  const solvedKeys = useMemo(
    () => Object.keys(gridState).filter((k) => gridState[k]?.scored === true),
    [gridState]
  );

  // AI loop
  useEffect(() => {
    const runAI = async () => {
      if (gameStatus !== "active" || aiBusyRef.current || gameOver) return;
      const remaining = ALL_CLUES.filter((c) => !solvedKeys.includes(`${c.direction}-${c.row}-${c.col}`));
      if (remaining.length === 0) return;

      aiBusyRef.current = true;
      postChatMessage(gameId, "system", "🔵 AI thinking…");
      try {
        await startAISolverSimul(remaining, solvedKeys, gameId, gridState);
      } finally {
        aiBusyRef.current = false;
      }
    };
    runAI();
  }, [gameStatus, solvedKeys, gridState, gameOver, gameId]);

  // Score write helper
  const writeScore = async (who, add) => {
    const key = who === "player" ? "player_score" : "ai_score";
    const sref = ref(db, `games/${gameId}/${key}`);
    const snap = await get(sref);
    const cur = snap.exists() ? snap.val() : 0;
    const next = cur + add;
    await set(sref, next);
    return next;
  };

  const markSolvedAndScore = async ({ clue, solvedBy }) => {
    const { row, col, direction, answer, number } = clue;
    const clueKey = `${direction}-${row}-${col}`;
    if (gridState[clueKey]?.scored) return;

    await set(ref(db, `games/${gameId}/gridState/${clueKey}`), { scored: true });

    const now = Date.now();
    const bonus = computeTimeBonus(now, lastSolveTs);
    const points = BASE_POINTS_PER_WORD + bonus;

    if (solvedBy === "player") {
      const newP = await writeScore("player", points);
      postChatMessage(gameId, "system", `🟢 You solved ${number ?? ""} ${direction.toUpperCase()} “${answer}” (+${points}). P:${newP} | AI:${scores.ai || 0}`);
      postChatMessage(gameId, "ai", aiLineOnPlayerSolve({ playerScore: newP, aiScore: scores.ai || 0 }));
    } else {
      const newA = await writeScore("ai", points);
      postChatMessage(gameId, "system", `🔵 AI solved ${number ?? ""} ${direction.toUpperCase()} “${answer}” (+${points}). P:${scores.player || 0} | AI:${newA}`);
    }

    await set(ref(db, `games/${gameId}/last_event_at`), now);
    await push(ref(db, `games/${gameId}/solved_words`), {
      word_id: clueKey, word: answer, solved_by: solvedBy, timestamp: now,
    });
  };

  const cellOwnerTally = (clue, pendingCellKey, pendingValue) => {
    const { row, col, direction, answer } = clue;
    let ai = 0, player = 0, last = "player";
    for (let i = 0; i < answer.length; i++) {
      const r = direction === "across" ? row : row + i;
      const c = direction === "across" ? col + i : col;
      const key = `${r}-${c}`;
      const cell = key === pendingCellKey ? { value: pendingValue, filledBy: "player" } : gridState[key];
      if (cell?.filledBy === "ai") ai++;
      if (cell?.filledBy === "player") player++;
      if (cell?.filledBy) last = cell.filledBy;
    }
    return ai === player ? last : ai > player ? "ai" : "player";
  };

  // Optimistic scoring around edited cell
  const tryScoreAroundCell = async (row, col, newVal) => {
    const affected = ALL_CLUES.filter((c) => {
      const { row: r, col: c0, direction, answer } = c;
      if (direction === "across") return row === r && col >= c0 && col < c0 + answer.length;
      return col === c0 && row >= r && row < r + answer.length;
    });

    for (const clue of affected) {
      const { row: r0, col: c0, direction, answer } = clue;
      const clueKey = `${direction}-${r0}-${c0}`;
      if (gridState[clueKey]?.scored) continue;

      let ok = true;
      for (let i = 0; i < answer.length; i++) {
        const r = direction === "across" ? r0 : r0 + i;
        const c = direction === "across" ? c0 + i : c0;
        const key = `${r}-${c}`;
        const ch = key === `${row}-${col}` ? String(newVal || "").toUpperCase() : String(gridState[key]?.value || "").toUpperCase();
        if (ch !== String(answer[i]).toUpperCase()) { ok = false; break; }
      }
      if (!ok) continue;

      const solvedBy = cellOwnerTally(clue, `${row}-${col}`, String(newVal || "").toUpperCase());
      await markSolvedAndScore({ clue, solvedBy });
    }
  };

  // Typing
  const handleCellChange = (row, col, value) => {
    if (!hasStarted || gameOver || gameStatus !== "active") return;
    const key = `${row}-${col}`;
    const up = String(value || "").toUpperCase();
    set(ref(db, `games/${gameId}/gridState/${key}`), { value: up, filledBy: "player" });
    tryScoreAroundCell(row, col, up);
  };

  const handleClueClick = (clue, direction) => setActiveWord({ ...clue, direction });

  // Safety net verify on any grid change
  useEffect(() => {
    const verifyAll = async () => {
      for (const clue of ALL_CLUES) {
        const { row, col, direction, answer } = clue;
        const clueKey = `${direction}-${row}-${col}`;
        if (gridState[clueKey]?.scored) continue;

        let ok = true;
        for (let i = 0; i < answer.length; i++) {
          const r = direction === "across" ? row : row + i;
          const c = direction === "across" ? col + i : col;
          const ch = String(gridState[`${r}-${c}`]?.value || "").toUpperCase();
          if (ch !== String(answer[i]).toUpperCase()) { ok = false; break; }
        }
        if (!ok) continue;

        let ai = 0, player = 0, last = "player";
        for (let i = 0; i < answer.length; i++) {
          const r = direction === "across" ? row : row + i;
          const c = direction === "across" ? col + i : col;
          const cell = gridState[`${r}-${c}`];
          if (cell?.filledBy === "ai") ai++;
          if (cell?.filledBy === "player") player++;
          if (cell?.filledBy) last = cell.filledBy;
        }
        const solvedBy = ai === player ? last : ai > player ? "ai" : "player";
        await markSolvedAndScore({ clue, solvedBy });
      }
    };
    if (gameStatus === "active" && Object.keys(gridState).length) verifyAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridState, gameStatus]);

  // Game Over ➜ also clear CHAT immediately
  useEffect(() => {
    const total = ALL_CLUES.length;
    const scoredCount = Object.keys(gridState).reduce((acc, k) => acc + (gridState[k]?.scored ? 1 : 0), 0);
    if (scoredCount >= total && gameStatus === "active") {
      (async () => {
        await set(ref(db, `games/${gameId}/game_status`), "completed");
        setGameStatus("completed"); setGameOver(true);

        const p = scores.player || 0, a = scores.ai || 0;
        const w = p === a ? "Draw" : p > a ? "Player" : "AI";
        setWinner(w);

        // 🧹 Clear chat after game over
        await remove(ref(db, `chat_messages/${gameId}`));

        // Optionally keep a single winner line OUTSIDE chat (UI banner already shows winner)
        // If you still want AI line, you could post it on next start instead.
      })();
    }
  }, [gridState, gameStatus, gameId, scores.player, scores.ai]);

  // Controls
  const resetAll = async () => {
    await remove(ref(db, `games/${gameId}/gridState`));
    await remove(ref(db, `games/${gameId}/solved_words`));
    await remove(ref(db, `chat_messages/${gameId}`)); // 🧹 chat clear on reset
    await set(ref(db, `games/${gameId}/player_score`), 0);
    await set(ref(db, `games/${gameId}/ai_score`), 0);
    await set(ref(db, `games/${gameId}/game_status`), "idle");
    await set(ref(db, `games/${gameId}/winner`), null);
    await set(ref(db, `games/${gameId}/last_event_at`), 0);

    setGridState({}); setScores({ player: 0, ai: 0 });
    setActiveWord(null); setHasStarted(false); setGameOver(false); setWinner(null);
  };

  const startGame = async () => {
    // Fresh state + 🧹 clear previous chat
    await remove(ref(db, `games/${gameId}/gridState`));
    await remove(ref(db, `games/${gameId}/solved_words`));
    await remove(ref(db, `chat_messages/${gameId}`)); // 🧹 chat clear on start
    await set(ref(db, `games/${gameId}/player_score`), 0);
    await set(ref(db, `games/${gameId}/ai_score`), 0);
    await set(ref(db, `games/${gameId}/game_status`), "active");
    const now = Date.now();
    await set(ref(db, `games/${gameId}/last_event_at`), now);

    setHasStarted(true); setGameOver(false);

    postChatMessage(gameId, "system", "🟢 Game started. Type to solve!");
    postChatMessage(gameId, "ai", aiLineOnGameStart());
  };

  const replayAfterWin = async () => startGame();

  // Board helpers
  const { playableSet, clueNumbers } = useMemo(() => {
    const white = new Set(); const nums = new Map();
    let a = 1, d = 1;
    const mark = (row, col, len, dir, n) => {
      for (let i = 0; i < len; i++) {
        const r = dir === "across" ? row : row + i;
        const c = dir === "across" ? col + i : col;
        white.add(`${r}-${c}`);
      }
      nums.set(`${row}-${col}`, n);
    };
    for (const c of normalizedPuzzle.clues.across) mark(c.row, c.col, c.answer.length, "across", c.number ?? a++);
    for (const c of normalizedPuzzle.clues.down)   mark(c.row, c.col, c.answer.length, "down",   c.number ?? d++);
    return { playableSet: white, clueNumbers: nums };
  }, []);

  return (
    <div style={{ display: "flex", padding: 20, gap: 16 }}>
      <div style={{ position: "fixed", left: 20, right: 360, top: 14, zIndex: 5 }}>
        <ScoreBar player={scores.player || 0} ai={scores.ai || 0} />
      </div>

      <button
        onClick={resetAll}
        style={{ position: "fixed", top: 16, right: 16, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}
        title="Reset this game's data"
      >
        🔄 Reset
      </button>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 72 }}>
        {gameStatus !== "active" && !gameOver && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, background: "#111", color: "#fff" }}>
            <h2 style={{ marginBottom: 12 }}>Start a new game</h2>
            <button
              onClick={startGame}
              style={{ padding: "10px 20px", fontSize: 16, borderRadius: 8, backgroundColor: "#fff", border: "none", cursor: "pointer" }}
            >
              ▶️ Start Game
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 16 }}>
          <CrosswordGrid
            gridSize={10}
            activeWord={activeWord}
            gridState={gridState}
            onCellChange={handleCellChange}
            canType={hasStarted && !gameOver && gameStatus === "active"}
            playableSet={playableSet}
            clueNumbers={clueNumbers}
          />
          <div style={{ width: 320 }}>
            <ClueList clues={normalizedPuzzle.clues} onClueClick={handleClueClick} />
          </div>
        </div>

        {gameOver && (
          <div style={{ marginTop: 20, padding: 20, borderRadius: 12, background: "#111", color: "#fff" }}>
            <h2 style={{ marginTop: 0 }}>
              Winner: {winner === "Draw" ? "🤝 Draw" : winner === "Player" ? "🧑 Player" : "🤖 AI"}
            </h2>
            <button
              onClick={replayAfterWin}
              style={{ marginTop: 8, padding: "10px 20px", fontSize: 16, borderRadius: 8, backgroundColor: "#fff", border: "none", cursor: "pointer" }}
            >
              🔁 Play Again
            </button>
          </div>
        )}
      </div>

      <ChatPanel
        gameId={gameId}
        onSend={(msg) => { if (!msg?.trim()) return; postChatMessage(gameId, "player", msg.trim()); }}
      />
    </div>
  );
}
