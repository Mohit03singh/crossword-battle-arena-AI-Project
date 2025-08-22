// data/puzzle.js
export const puzzle = {
  // 10x10 completely empty board
  grid: Array.from({ length: 10 }, () => Array(10).fill("")),
  clues: {
    across: [
      {
        number: 1,
        clue: "A small domestic animal",
        row: 0,
        col: 0,
        length: 3,
        direction: "across",
        answer: "CAT",
      },
    ],
    down: [
      {
        number: 2,
        clue: "Word for cross",
        row: 0,
        col: 2,
        length: 5,
        direction: "down",
        answer: "CROSS",
      },
    ],
  },
};
