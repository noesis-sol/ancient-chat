import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { env } from '@/lib/env';

// Created on first use: reading env() at module scope throws during
// `next build` when OPENAI_API_KEY is unset.
let openai: OpenAIProvider | undefined;

export function getOpenAI(): OpenAIProvider {
  return (openai ??= createOpenAI({ apiKey: env().OPENAI_API_KEY }));
}

/** The model that answers in the chat (CHAT_MODEL). */
export function chatModel() {
  return getOpenAI()(env().CHAT_MODEL);
}
