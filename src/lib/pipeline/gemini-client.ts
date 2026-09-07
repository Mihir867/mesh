import { GoogleGenAI } from "@google/genai";

let genAIInstance: GoogleGenAI | null = null;

/**
 * Get the Google GenAI client instance.
 * Throws a clear descriptive error if GEMINI_API_KEY is not configured.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please add GEMINI_API_KEY to your environment (.env.local)."
    );
  }

  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey });
  }

  return genAIInstance;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
