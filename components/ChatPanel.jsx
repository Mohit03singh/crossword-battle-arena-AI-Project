// components/ChatPanel.jsx
"use client";
import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import styles from "./ChatPanel.module.css"; // optional CSS

export default function ChatPanel({ gameId, onSend }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const chatRef = ref(db, `games/${gameId}/chat`);
    return onValue(chatRef, (snap) => {
      const obj = snap.val() || {};
      const list = Object.values(obj).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(list);
    });
  }, [gameId]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  };

  return (
    <div className={styles.wrap || ""} style={{ width: 320, marginLeft: 20 }}>
      <h3>💬 Chat</h3>
      <div className={styles.feed || ""} style={{ height: 280, overflowY: "auto", border: "1px solid #eee", padding: 8, borderRadius: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6, opacity: m.sender === "system" ? 0.7 : 1 }}>
            <b>{m.sender === "ai" ? "🤖 AI" : m.sender === "player" ? "👤 You" : "ℹ️ System"}:</b> {m.message}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <input
          placeholder="Type message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <button onClick={send} style={{ padding: "8px 12px", borderRadius: 6, border: "none", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
}
