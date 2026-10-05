import type { ContextSource } from '@/utils/context-sources';
import type { ChatUIMessage } from '@/utils/ui-message';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  LanguageModel,
  streamText,
  toUIMessageStream,
} from 'ai';
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

// A validated UI message reduced to its text, ready for convertToModelMessages.
export type ChatMessage = { role: 'user' | 'assistant'; parts: [{ type: 'text'; text: string }] };

export type ChatRequestResult =
  | { ok: true; messages: ChatMessage[]; lastUserMessage: string }
  | { ok: false; status: 400 | 413; error: string };

// useChat sends UI messages: { id, role, parts, metadata }. Only user and
// assistant turns are accepted, so a client cannot inject system messages, and
// only their text parts reach the model. Other parts (step-start, reasoning,
// files, tools) and unknown keys are dropped.
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        parts: z.array(
          z
            .object({ type: z.string(), text: z.unknown() })
            .refine((part) => part.type !== 'text' || typeof part.text === 'string', {
              message: 'Text parts must have string text',
            })
        ),
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

  const messages = parsed.data.messages.map((message) => ({
    role: message.role,
    text: message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text as string)
      .join('\n'),
  }));
  if (messages.some((message) => message.text.length > MAX_MESSAGE_CHARS)) {
    return { ok: false, status: 413, error: 'Too many or too long messages' };
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user' || lastMessage.text.trim() === '') {
    return { ok: false, status: 400, error: 'The last message must be a non-empty user message' };
  }

  // Assistant turns that failed before any text streamed in carry no text.
  const history = messages
    .filter((message) => message.text.trim() !== '')
    .slice(-HISTORY_LENGTH)
    .map(({ role, text }): ChatMessage => ({ role, parts: [{ type: 'text', text }] }));

  return { ok: true, messages: history, lastUserMessage: lastMessage.text };
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

export async function chatStreamResponse({
  model,
  instructions,
  messages,
  sources = [],
  abortSignal,
}: {
  model: LanguageModel;
  instructions: string;
  messages: ChatMessage[];
  // The retrieved chunks the instructions were built from, sent with the reply.
  sources?: ContextSource[];
  abortSignal?: AbortSignal;
}): Promise<Response> {
  const result = streamText({
    model,
    instructions,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal,
    onError: ({ error }) => console.error(error),
  });

  // Errors from the model arrive after the response has started, so they are
  // sent to the client as an error part instead of ending the stream silently.
  return createUIMessageStreamResponse({
    stream: createUIMessageStream<ChatUIMessage>({
      execute: ({ writer }) => {
        if (sources.length > 0) {
          writer.write({ type: 'data-sources', data: sources });
        }
        writer.merge(toUIMessageStream({ stream: result.stream, onError: () => STREAM_ERROR_MESSAGE }));
      },
      onError: () => STREAM_ERROR_MESSAGE,
    }),
  });
}
