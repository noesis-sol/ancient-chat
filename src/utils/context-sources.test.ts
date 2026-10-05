import { readUIMessageStream, simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { chatStreamResponse, MAX_BODY_BYTES, parseChatRequest, readBodyWithLimit } from './chat-request';
import { type ContextSource, sourceLabel, toContextSource } from './context-sources';
import { type ChatUIMessage, createChatTransport, messageSources, messageText, requestMessages } from './ui-message';

const chunk = (id: string, overrides: Partial<ContextSource> = {}): ContextSource => ({
  id,
  index: 'aristotle',
  text: `Chunk ${id}.`,
  source: '/aristotle/nicomachean-ethics.txt',
  filename: 'nicomachean-ethics.txt',
  ...overrides,
});

describe('toContextSource', () => {
  it('keeps the text and where it came from', () => {
    const match = {
      id: '/aristotle/ethics.txt-3',
      metadata: { text: 'Virtue is a mean.', source: '/aristotle/ethics.txt', filename: 'ethics.txt', type: 'txt' },
    };
    expect(toContextSource('aristotle', match)).toEqual({
      id: '/aristotle/ethics.txt-3',
      index: 'aristotle',
      text: 'Virtue is a mean.',
      source: '/aristotle/ethics.txt',
      filename: 'ethics.txt',
    });
  });

  it('leaves out names the metadata lacks', () => {
    expect(toContextSource('plato', { id: '1', metadata: { text: 'The cave.', filename: 3 } })).toEqual({
      id: '1',
      index: 'plato',
      text: 'The cave.',
      source: undefined,
      filename: undefined,
    });
  });

  it('drops matches without text', () => {
    expect(toContextSource('plato', { id: '1' })).toBeNull();
    expect(toContextSource('plato', { id: '1', metadata: { text: '' } })).toBeNull();
  });
});

describe('sourceLabel', () => {
  it('prefers the file name, then the path, then the index', () => {
    expect(sourceLabel(chunk('1'))).toBe('nicomachean-ethics.txt');
    expect(sourceLabel(chunk('1', { filename: undefined }))).toBe('nicomachean-ethics.txt');
    expect(sourceLabel(chunk('1', { filename: undefined, source: undefined }))).toBe('aristotle');
  });
});

const reply = (parts: ChatUIMessage['parts']): ChatUIMessage => ({ id: '2', role: 'assistant', parts });

describe('messageSources', () => {
  it('collects the sources parts', () => {
    const message = reply([
      { type: 'data-sources', data: [chunk('1')] },
      { type: 'text', text: 'Answer' },
      { type: 'data-sources', data: [chunk('2')] },
    ]);
    expect(messageSources(message).map((source) => source.id)).toEqual(['1', '2']);
  });

  it('is empty for a reply without sources', () => {
    expect(messageSources(reply([{ type: 'text', text: 'Answer' }]))).toEqual([]);
  });
});

describe('requestMessages', () => {
  it('keeps only the text parts', () => {
    const message = reply([
      { type: 'step-start' },
      { type: 'data-sources', data: [chunk('1')] },
      { type: 'text', text: 'Answer' },
    ]);
    expect(requestMessages([message])).toEqual([{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Answer' }] }]);
  });
});

const replyModel = (reply: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: reply },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: { unified: 'stop' as const, raw: undefined },
            usage: {
              inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 2, text: 2, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });

describe('sources end to end', () => {
  // The chat page's transport against the same steps as /api/chat.
  const setup = (sources: ContextSource[]) => {
    const model = replyModel('Virtue is a mean.');
    const bodies: string[] = [];
    const transport = createChatTransport({
      api: 'http://localhost/api/chat',
      fetch: async (input, init) => {
        const body = (await readBodyWithLimit(new Request(input, init), MAX_BODY_BYTES)) ?? '';
        bodies.push(body);
        const chatRequest = parseChatRequest(body);
        if (!chatRequest.ok) {
          return Response.json({ error: chatRequest.error }, { status: chatRequest.status });
        }
        return chatStreamResponse({ model, instructions: 'You are Aristotle.', messages: chatRequest.messages, sources });
      },
    });
    const send = async (messages: ChatUIMessage[]) => {
      const stream = await transport.sendMessages({
        chatId: 'chat',
        messageId: undefined,
        messages,
        trigger: 'submit-message',
        abortSignal: undefined,
      });
      let last: ChatUIMessage | undefined;
      for await (const message of readUIMessageStream<ChatUIMessage>({ stream, terminateOnError: true })) {
        last = message;
      }
      if (!last) throw new Error('no reply');
      return last;
    };
    return { model, bodies, send };
  };

  const question = (id: string, text: string): ChatUIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

  it('sends the retrieved chunks with the reply', async () => {
    const sources = [chunk('1'), chunk('2', { index: 'plato', filename: 'republic.txt' })];
    const { send } = setup(sources);

    const answer = await send([question('1', 'What is virtue?')]);

    expect(messageText(answer)).toBe('Virtue is a mean.');
    expect(messageSources(answer)).toEqual(sources);
  });

  it('sends no sources part when nothing was retrieved', async () => {
    const { send } = setup([]);
    const answer = await send([question('1', 'What is virtue?')]);
    expect(answer.parts.some((part) => part.type === 'data-sources')).toBe(false);
  });

  it('leaves the sources out of the history sent back', async () => {
    const sources = Array.from({ length: 10 }, (_, i) => chunk(String(i), { text: 'x'.repeat(1_000) }));
    const { model, bodies, send } = setup(sources);

    const first = question('1', 'What is virtue?');
    const answer = await send([first]);
    await send([first, answer, question('3', 'And happiness?')]);

    expect(bodies[1]).not.toContain('data-sources');
    expect(bodies[1].length).toBeLessThan(1_000);
    expect(model.doStreamCalls[1].prompt).toEqual([
      { role: 'system', content: 'You are Aristotle.' },
      { role: 'user', content: [{ type: 'text', text: 'What is virtue?' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Virtue is a mean.' }] },
      { role: 'user', content: [{ type: 'text', text: 'And happiness?' }] },
    ]);
  });
});
