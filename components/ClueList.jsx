// components/ClueList.jsx
import React from "react";
import styles from "./ClueList.module.css";

const ClueList = ({ clues, onClueClick }) => {
  return (
    <div className={styles.clueList}>
      <h3>Across</h3>
      <ul>
        {clues.across.map((item) => (
          <li key={`across-${item.number}`} onClick={() => onClueClick(item, "across")}>
            <strong>{item.number}.</strong> {item.clue}
          </li>
        ))}
      </ul>

      <h3>Down</h3>
      <ul>
        {clues.down.map((item) => (
          <li key={`down-${item.number}`} onClick={() => onClueClick(item, "down")}>
            <strong>{item.number}.</strong> {item.clue}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClueList;
