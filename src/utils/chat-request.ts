import { CoreMessage, LanguageModel, streamText } from 'ai';
import { z } from 'zod';

// Limits on what a client may send to /api/chat. They bound the prompt we pay
// OpenAI for on every request.
export const MAX_BODY_BYTES = 200_000;
export const MAX_MESSAGES = 200;
export const MAX_MESSAGE_CHARS = 8_000;
// Only the most recent turns are sent to the model.
export const HISTORY_LENGTH = 20;
export const MAX_OUTPUT_TOKENS = 1_024;
export const MAX_NAME_CHARS = 40;

export const STREAM_ERROR_MESSAGE = 'The reply could not be generated. Please try again.';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatRequestResult =
  | { ok: true; messages: ChatMessage[]; lastUserMessage: string }
  | { ok: false; status: 400 | 413; error: string };

// Only user and assistant turns with plain string content are accepted, so a
// client cannot inject system or tool messages. Unknown keys (useChat sends
// id, parts, createdAt) are stripped.
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
});

// Reads the body as text, giving up as soon as it grows past maxBytes.
// Returns null when the body is too large.
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return null;
  }
  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function parseChatRequest(body: string): ChatRequestResult {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, error: 'Request body is not valid JSON' };
  }

  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    const tooBig = parsed.error.issues.some((issue) => issue.code === 'too_big');
    return tooBig
      ? { ok: false, status: 413, error: 'Too many or too long messages' }
      : { ok: false, status: 400, error: 'Invalid messages' };
  }

  const messages = parsed.data.messages.slice(-HISTORY_LENGTH);
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user' || lastMessage.content.trim() === '') {
    return { ok: false, status: 400, error: 'The last message must be a non-empty user message' };
  }

  return { ok: true, messages, lastUserMessage: lastMessage.content };
}

// The name comes from the user's editable Clerk profile and goes into the
// system prompt, so keep only characters a name needs and cap its length.
export function sanitizeUserName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}' .-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([' .-])\1+/g, '$1')
    .trim()
    .slice(0, MAX_NAME_CHARS)
    .trim();
}

export function chatStreamResponse({
  model,
  system,
  messages,
  abortSignal,
}: {
  model: LanguageModel;
  system: string;
  messages: CoreMessage[];
  abortSignal?: AbortSignal;
}): Response {
  const result = streamText({
    model,
    system,
    messages,
    maxTokens: MAX_OUTPUT_TOKENS,
    abortSignal,
    onError: ({ error }) => console.error(error),
  });

  // Errors from the model arrive after the response has started, so they are
  // sent to the client as an error part instead of ending the stream silently.
  return result.toDataStreamResponse({ getErrorMessage: () => STREAM_ERROR_MESSAGE });
}
