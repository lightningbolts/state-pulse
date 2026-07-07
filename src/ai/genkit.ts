import {genkit} from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

/** Stable Gemini 3.1 Flash Lite — do not use gemini-2.0-* models. */
export const GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const geminiModel = googleAI.model(GEMINI_MODEL);

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
    }),
  ],
  model: geminiModel,
});
