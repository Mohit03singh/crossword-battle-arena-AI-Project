// components/ScoreBar.jsx
"use client";
import React from "react";
import styles from "./ScoreBar.module.css";

export default function ScoreBar({ player = 0, ai = 0 }) {
  return (
    <div className={styles.bar}>
      <div className={styles.side}>
        <div className={styles.label}>PLAYER</div>
        <div className={styles.value}>{player}</div>
      </div>
      <div className={`${styles.side} ${styles.ai}`}>
        <div className={styles.label}>AI OPPONENT</div>
        <div className={styles.value}>{ai}</div>
      </div>
    </div>
  );
}
