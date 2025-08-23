// components/CrosswordGrid.jsx
"use client";

import React, { useMemo } from "react";
import styles from "./CrosswordGrid.module.css";

const CrosswordGrid = ({
  gridSize = 10,
  gridState = {},
  onCellChange,
  canType = true,
  activeWord,
  playableSet,
  clueNumbers,
}) => {
  const isCellHighlighted = (row, col) => {
    if (!activeWord) return false;
    const { row: r, col: c, length, direction } = activeWord;
    if (direction === "across" && row === r && col >= c && col < c + length) return true;
    if (direction === "down" && col === c && row >= r && row < r + length) return true;
    return false;
  };

  const rows = useMemo(() => Array.from({ length: gridSize }, (_, i) => i), [gridSize]);

  return (
    <div className={styles.boardWrap}>
      <div className={styles.board}>
        {rows.map((r) =>
          rows.map((c) => {
            const key = `${r}-${c}`;
            const isPlayable = playableSet ? playableSet.has(key) : true;
            if (!isPlayable) return <div key={key} className={styles.block} />;
            const value = gridState[key]?.value || "";
            const aiCell = gridState[key]?.filledBy === "ai";
            const num = clueNumbers?.get(key);

            return (
              <div key={key} className={`${styles.cell} ${isCellHighlighted(r, c) ? styles.hl : ""} ${aiCell ? styles.aiCell : ""}`}>
                {num ? <div className={styles.num}>{num}</div> : null}
                <input
                  maxLength={1}
                  value={value}
                  onChange={(e) => onCellChange?.(r, c, e.target.value)}
                  readOnly={!canType}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CrosswordGrid;
