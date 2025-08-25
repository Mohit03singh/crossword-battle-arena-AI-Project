// lib/llm.js
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROVIDER = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

let openai = null;
let genAI = null;

if (PROVIDER === "openai") {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[LLM] Missing OPENAI_API_KEY");
  } else {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} else if (PROVIDER === "gemini") {
  if (!process.env.GEMINI_API_KEY) {
    console.error("[LLM] Missing GEMINI_API_KEY");
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
}

function buildPrompt({ clues, gridState, solvedKeys }) {
  const revealed = Object.entries(gridState || {})
    .filter(([, v]) => v && typeof v === "object" && v.value)
    .map(([k, v]) => `${k}:${String(v.value).toUpperCase()}`)
    .slice(0, 250)
    .join(", ");

  const shape = (arr = []) =>
    arr.map((c) => ({
      row: Number(c.row),
      col: Number(c.col),
      length: Number(c.answer?.length || 0),
      clue: String(c.clue || ""),
      answer: c.answer ? String(c.answer).toUpperCase() : undefined,
      direction: String(c.direction || "across").toLowerCase(),
    }));

  return `You are a crossword assistant. Choose EXACTLY ONE unsolved entry.

Rules:
- Return ONLY JSON: {"direction":"across|down","row":0-based,"col":0-based,"answer":"UPPERCASE"}.
- Use revealedLetters to respect typed letters.
- Not in solvedKeys; not already fully filled.
- If multiple, choose the SHORTEST.
- If ambiguous, output best guess matching letters+length.

revealedLetters="${revealed}"
solvedKeys=${JSON.stringify(solvedKeys || [])}
across=${JSON.stringify(shape(clues.across || []))}
down=${JSON.stringify(shape(clues.down || []))}`;
}

function safeParse(s) {
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
  } catch {}
  return null;
}

export async function llmSolveOne(payload) {
  const prompt = buildPrompt(payload);

  if (PROVIDER === "openai" && openai) {
    const resp = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: prompt,
      temperature: 0.2,
    });
    const text = (resp.output_text || "").trim();
    const m = safeParse(text);
    if (!m) return null;
    return {
      direction: String(m.direction || "").toLowerCase() === "down" ? "down" : "across",
      row: Number(m.row) || 0,
      col: Number(m.col) || 0,
      answer: String(m.answer || "").toUpperCase(),
    };
  }

  if (PROVIDER === "gemini" && genAI) {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    });
    const gen = await model.generateContent(prompt);
    const text = gen.response?.text?.() || "";
    const m = safeParse(text.trim());
    if (!m) return null;
    return {
      direction: String(m.direction || "").toLowerCase() === "down" ? "down" : "across",
      row: Number(m.row) || 0,
      col: Number(m.col) || 0,
      answer: String(m.answer || "").toUpperCase(),
    };
  }

  return null;
}
