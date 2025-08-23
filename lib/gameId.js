// lib/gameId.js
const STORAGE_KEY = "cba:gameId";

function createId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateGameId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = createId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearGameId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
