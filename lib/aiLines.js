// lib/aiLines.js
export function aiLineOnPlayerSolve({ playerScore, aiScore }) {
  const diff = playerScore - aiScore;
  if (diff >= 20) return "Not bad, human. Enjoy it while it lasts.";
  if (diff <= -20) return "I’m cruising. Try to keep up!";
  return "Nice move. Your turn won’t be this easy next time.";
}

export function aiLineOnAISolve({ playerScore, aiScore }) {
  const diff = aiScore - playerScore;
  if (diff >= 20) return "Dominance established. Proceeding efficiently.";
  if (diff <= -20) return "Closing the gap. This isn’t over.";
  return "My algorithms like this trajectory.";
}

export function aiLineOnGameStart() {
  return "AlphaCross online. Let’s make this interesting.";
}

export function aiLineOnGameOver({ winner }) {
  if (winner === "AI") return "Victory: expected. Good game.";
  if (winner === "Player") return "Impressive. I will recalibrate.";
  return "A draw? Statistical anomaly.";
}
