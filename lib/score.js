// lib/score.js
import { db } from "./firebase";
import { ref, set, get } from "firebase/database";

export async function addScore(type, points) {
  const scoreRef = ref(db, `game/scores/${type}`);
  const snapshot = await get(scoreRef);
  const current = snapshot.exists() ? snapshot.val() : 0;

  console.log("🟢 Adding score for:", type);
  console.log("Previous:", current, "→ New:", current + points);

  await set(scoreRef, current + points);
}
