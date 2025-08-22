// components/CrosswordGrid.jsx
import React from "react";
import styles from "./CrosswordGrid.module.css";

const CrosswordGrid = ({ grid, activeWord, gridState, onCellChange }) => {
  const isCellHighlighted = (row, col) => {
    if (!activeWord) return false;
    const { row: r, col: c, length, direction } = activeWord;

    if (direction === "across" && row === r && col >= c && col < c + length) return true;
    if (direction === "down" && col === c && row >= r && row < r + length) return true;

    return false;
  };

  return (
    <div className={styles.grid}>
      {grid.map((row, rowIndex) =>
        row.map((_, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const value = gridState[key]?.value || "";
          return (
            <input
              key={key}
              maxLength="1"
              className={`${styles.cell} 
  ${isCellHighlighted(rowIndex, colIndex) ? styles.highlighted : ""} 
  ${gridState[key]?.filledBy === "ai" ? styles.aiCell : ""}`}
              value={value}
              onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
              readOnly={false}
            />
          );
        })
      )}
    </div>
  );
};

export default CrosswordGrid;
