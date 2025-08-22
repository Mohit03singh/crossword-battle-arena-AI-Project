"use client";

import React, { useState, useEffect } from "react";
import CrosswordGrid from "@/components/CrosswordGrid";
import ClueList from "@/components/ClueList";
import { puzzle } from "../../data/puzzle";
import { db } from "@/lib/firebase";
import { ref, onValue, set, remove, get } from "firebase/database";
import { aiClueAnswers } from "../../data/aiAnswers";
import { startAISolverTurnBased } from "@/lib/ai";
import { addScore } from "@/lib/score";
import { getOrCreateGameId, clearGameId } from "@/lib/gameID"
import ChatPanel from "@/components/ChatPanel";
import { postChatMessage } from "@/lib/chat";
import { aiLineOnAISolve, aiLineOnPlayerSolve, aiLineOnGameStart, aiLineOnGameOver } from "@/lib/aiLines";

const gameId = getOrCreateGameId();


const TURN_SECONDS = 20; // per-turn timer

export default function GamePage() {
  const [activeWord, setActiveWord] = useState(null);
  const [gridState, setGridState] = useState({});
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [turn, setTurn] = useState("idle"); // "player" | "ai" | "idle"
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);

  // ---- Firebase listeners (grid, scores, turn) ----
  useEffect(() => {
    const gridRef = ref(db, "game/gridState");
    const scoresRef = ref(db, "game/scores");
    const turnRef = ref(db, "game/turn");

    onValue(gridRef, (snap) => setGridState(snap.val() || {}));
    onValue(scoresRef, (snap) => setScores(snap.val() || { player: 0, ai: 0 }));
    onValue(turnRef, (snap) => setTurn(snap.exists() ? snap.val() : "idle"));
  }, []);

  // ---- Re-check word solved whenever the grid changes ----
  useEffect(() => {
    if (Object.keys(gridState).length > 0) {
      checkWordSolved();
      checkGameOverByScored();
    }
  }, [gridState]);

  // ---- Turn Timer ----
  useEffect(() => {
    if (!hasStarted || gameOver) return;

    // reset timer on turn change
    setTimeLeft(TURN_SECONDS);

    if (turn === "idle") return;

    const tick = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(tick);
          // time up: switch the turn
          if (turn === "player") {
            set(ref(db, "game/turn"), "ai");
          } else if (turn === "ai") {
            set(ref(db, "game/turn"), "player");
          }
          return TURN_SECONDS;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, hasStarted, gameOver]);

  // ---- When it's AI's turn, let AI play exactly one word, then give turn back ----
  useEffect(() => {
    const runAI = async () => {
      if (!hasStarted || gameOver) return;
      if (turn !== "ai") return;

      const solvedKeys = Object.keys(gridState).filter(
        (key) => gridState[key]?.scored === true || gridState[key]?.filledBy === "ai"
      );

      const moved = await startAISolverTurnBased(aiClueAnswers, solvedKeys);
      // 'moved' true == AI filled one word. Either way, give turn to player next.
      await set(ref(db, "game/turn"), "player");
    };

    runAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // ---- Player typing (only on player's turn) ----
  const handleCellChange = (row, col, value) => {
    if (!hasStarted || turn !== "player" || gameOver) return;
    const key = `${row}-${col}`;
    const updatedCell = { value: (value || "").toUpperCase(), filledBy: "player" };
    setGridState((prev) => ({ ...prev, [key]: updatedCell }));
    set(ref(db, `game/gridState/${key}`), updatedCell);
  };

  const handleClueClick = (clue, direction) => {
    setActiveWord({ ...clue, direction });
  };

  // ---- Check any word solved; award Player once per word ----
  const checkWordSolved = () => {
    const allClues = [...puzzle.clues.across, ...puzzle.clues.down];

    allClues.forEach((clue) => {
      const { row, col, direction, answer } = clue;
      if (!answer) return;

      const clueKey = `${direction}-${row}-${col}`;
      let matched = true;

      for (let i = 0; i < answer.length; i++) {
        const r = direction === "across" ? row : row + i;
        const c = direction === "across" ? col + i : col;
        const cellKey = `${r}-${c}`;
        const filledChar = (gridState[cellKey]?.value || "").toUpperCase();
        if (filledChar !== answer[i].toUpperCase()) {
          matched = false;
          break;
        }
      }

      if (matched && !gridState[clueKey]?.scored) {
        // mark as scored + award to whoever completed during their turn
        set(ref(db, `game/gridState/${clueKey}`), { scored: true });

        const points = answer.length * 10;
        if (turn === "player") addScore("player", points);
        else if (turn === "ai") addScore("ai", points);
      }
    });
  };

  // ---- Robust Game Over: all clues scored ----
  const checkGameOverByScored = () => {
    const totalClues = puzzle.clues.across.length + puzzle.clues.down.length;
    const scoredCount = Object.keys(gridState).reduce((count, key) => {
      const val = gridState[key];
      if (val && typeof val === "object" && val.scored === true) return count + 1;
      return count;
    }, 0);

    if (scoredCount >= totalClues) {
      setGameOver(true);
      if ((scores.player || 0) > (scores.ai || 0)) setWinner("Player");
      else if ((scores.ai || 0) > (scores.player || 0)) setWinner("AI");
      else setWinner("Draw");
      set(ref(db, "game/turn"), "idle");
    }
  };

  // ---- Controls ----
  const resetAll = async () => {
    await remove(ref(db, "game/gridState"));
    await remove(ref(db, "game/scores"));
    await set(ref(db, "game/aiStarted"), false);
    await set(ref(db, "game/turn"), "idle");
    setGridState({});
    setScores({ player: 0, ai: 0 });
    setActiveWord(null);
    setHasStarted(false);
    setGameOver(false);
    setWinner(null);
    setTimeLeft(TURN_SECONDS);
  };

  const startGame = async () => {
    await resetAll(); // fresh
    await set(ref(db, "game/turn"), "player"); // player starts
    setHasStarted(true);
  };

  const replayAfterWin = async () => {
    await startGame();
  };

  return (
    <div style={{ display: "flex", padding: "20px", position: "relative" }}>
      {/* Top-right Reset button */}
      <button
        onClick={resetAll}
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
        }}
        title="Reset board + scores"
      >
        🔄 Reset
      </button>

      <div>
        {/* Scoreboard + Turn/Timer */}
        <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 16 }}>
          <div style={{ backgroundColor: "#f5f5f5", padding: "10px 20px", borderRadius: 8 }}>
            <h3 style={{ margin: 0 }}>👤 Player</h3>
            <h1 style={{ margin: 0 }}>{scores.player || 0}</h1>
          </div>
          <div style={{ backgroundColor: "#e0f7fa", padding: "10px 20px", borderRadius: 8 }}>
            <h3 style={{ margin: 0 }}>🤖 AI</h3>
            <h1 style={{ margin: 0 }}>{scores.ai || 0}</h1>
          </div>
          <div style={{ background: "#111", color: "#fff", padding: "10px 20px", borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Turn</div>
            <div style={{ fontSize: 18 }}>
              {turn === "player" ? "🟢 Player" : turn === "ai" ? "🔵 AI" : "⏸️ Idle"}
            </div>
            <div style={{ marginTop: 4, fontSize: 14 }}>⏱️ {timeLeft}s</div>
          </div>
        </div>

        <h1>🧠 Crossword Battle Arena</h1>

        {/* START OVERLAY */}
        {!hasStarted && !gameOver && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <h2 style={{ marginBottom: 16 }}>Start a new turn-based game</h2>
            <button
              onClick={startGame}
              style={{
                padding: "10px 20px",
                fontSize: "18px",
                borderRadius: "8px",
                backgroundColor: "#fff",
                color: "#000",
                border: "none",
                cursor: "pointer",
              }}
            >
              ▶️ Start Game (Player First)
            </button>
          </div>
        )}

        <CrosswordGrid
          grid={puzzle.grid}
          activeWord={activeWord}
          gridState={gridState}
          onCellChange={handleCellChange}
        />
      </div>

      <ClueList clues={puzzle.clues} onClueClick={handleClueClick} />

      {/* GAME OVER MODAL */}
      {gameOver && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            zIndex: 9999,
          }}
        >
          <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>🏁 Game Over</h1>
          <h2 style={{ fontSize: "32px" }}>
            Winner:{" "}
            {winner === "Draw"
              ? "🤝 It's a Draw!"
              : winner === "Player"
              ? "🧑 Player"
              : "🤖 AI"}
          </h2>

          <button
            onClick={replayAfterWin}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              fontSize: "18px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#000",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔁 Play Again
          </button>
        </div>
      )}
    </div>
  );
}
