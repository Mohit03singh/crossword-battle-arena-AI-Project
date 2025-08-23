// components/ChatPanel.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import styles from "./ChatPanel.module.css";

export default function ChatPanel({ gameId, onSend }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    if (!gameId) return;
    const chatRef = ref(db, `chat_messages/${gameId}`);
    const unsub = onValue(chatRef, (snap) => {
      const obj = snap.val() || {};
      const list = Object.values(obj).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(list);
      // auto-scroll
      setTimeout(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }, 0);
    });
    return () => unsub();
  }, [gameId]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>💬 Chat</div>
      <div className={styles.feed} ref={feedRef}>
        {messages.length === 0 && <div className={styles.empty}>No messages yet.</div>}
        {messages.map((m, idx) => (
          <div key={idx} className={`${styles.msg} ${styles[m.sender] || ""}`}>
            <div className={styles.sender}>
              {m.sender === "ai" ? "🤖 AI" : m.sender === "system" ? "📣 System" : "🧑 You"}
            </div>
            <div className={styles.text}>{m.message}</div>
          </div>
        ))}
      </div>
      <div className={styles.inputRow}>
        <input
          placeholder="Type message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
