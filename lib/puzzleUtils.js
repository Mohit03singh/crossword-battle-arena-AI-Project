// lib/puzzleUtils.js
function toLower(x) { return String(x || "").toLowerCase(); }
function coerceNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function pickAnswer(c) { return String(c?.answer ?? c?.word ?? c?.solution ?? "").toUpperCase(); }
function pickText(c) { return String(c?.clue ?? c?.text ?? c?.question ?? "").trim(); }
function looksOneBased(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const anyZero =
    arr.some((c) => Number(c?.row) === 0 || Number(c?.col) === 0) ||
    arr.some((c) => Number(c?.r) === 0 || Number(c?.c) === 0);
  return !anyZero;
}

export function normalizeClues(rawClues) {
  if (!Array.isArray(rawClues)) return [];
  const oneBased = looksOneBased(rawClues);
  return rawClues.map((c, idx) => {
    const direction = toLower(c?.direction ?? c?.dir ?? "across");
    const rowRaw = c?.row ?? c?.r ?? c?.startRow ?? c?.i;
    const colRaw = c?.col ?? c?.c ?? c?.startCol ?? c?.j;
    const row = coerceNum(rowRaw) - (oneBased ? 1 : 0);
    const col = coerceNum(colRaw) - (oneBased ? 1 : 0);
    const answer = pickAnswer(c);
    const text = pickText(c);
    const number = c?.number ?? c?.no ?? idx + 1;
    return { row, col, direction, answer, clue: text, length: answer.length, number };
  });
}

export function getNormalizedPuzzle(puzzle) {
  const across = normalizeClues(puzzle?.clues?.across || []);
  const down   = normalizeClues(puzzle?.clues?.down || []);
  return { ...puzzle, clues: { across, down } };
}
