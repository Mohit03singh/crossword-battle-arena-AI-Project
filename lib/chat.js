// lib/chat.js
import { db } from "./firebase";
import { ref, push, serverTimestamp } from "firebase/database";

export function postChatMessage(gameId, sender, message) {
  const chatRef = ref(db, `games/${gameId}/chat`);
  return push(chatRef, {
    sender, // "player" | "ai"
    message,
    timestamp: Date.now(), // or serverTimestamp() if using RTDB server time
  });
}
