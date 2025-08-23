// lib/chat.js
import { db } from "./firebase";
import { ref, push } from "firebase/database";

// Chat path (doc-style): chat_messages/{gameId}/*
export function postChatMessage(gameId, sender, message) {
  const chatRef = ref(db, `chat_messages/${gameId}`);
  return push(chatRef, {
    sender,           // "player" | "ai" | "system"
    message,
    timestamp: Date.now(),
  });
}
