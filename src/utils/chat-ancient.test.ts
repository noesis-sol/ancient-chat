import { ancients } from '@/data/ancients';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const prompts = vi.hoisted(() => ({ getPrompt: vi.fn() }));
const pinecone = vi.hoisted(() => ({ queryPineconeContext: vi.fn() }));
const stream = vi.hoisted(() => ({ chatStreamResponse: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => clerk);
vi.mock('@/utils/pinecone', () => pinecone);
vi.mock('@/data/prompt.service', () => ({
  PromptService: class {
    getPrompt = prompts.getPrompt;
  }
}));
vi.mock('@/utils/chat-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/chat-request')>()),
  chatStreamResponse: stream.chatStreamResponse
}));

const { POST } = await import('@/app/api/chat/route');

const chatRequest = (query: string) =>
  new NextRequest(`http://localhost/api/chat${query}`, {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'What is virtue?' }] }] })
  });

const plato = ancients.find((ancient) => ancient.slug === 'plato')!;

beforeEach(() => {
  vi.clearAllMocks();
  clerk.getAuth.mockReturnValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ firstName: 'Ann' });
  prompts.getPrompt.mockImplementation(async ({ name }: { name: string }) => ({ text: `You are ${name}.` }));
  pinecone.queryPineconeContext.mockImplementation(async (_question: string, ancient: string) => [
    { id: 'chunk-1', index: `${ancient}-index`, text: `passage from ${ancient}'s indexes` }
  ]);
  stream.chatStreamResponse.mockResolvedValue(new Response('stream'));
});

afterEach(() => {
  plato.isEnabled = false;
});

describe('POST /api/chat ancient', () => {
  it.each([
    ['no ancient', ''],
    ['an unknown ancient', '?ancient=zeno'],
    ['a disabled ancient', '?ancient=plato']
  ])('rejects %s with 404 before doing any work', async (_case, query) => {
    const response = await POST(chatRequest(query));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Unknown ancient' });
    expect(pinecone.queryPineconeContext).not.toHaveBeenCalled();
    expect(prompts.getPrompt).not.toHaveBeenCalled();
    expect(stream.chatStreamResponse).not.toHaveBeenCalled();
  });

  it("answers with the ancient's own prompt and indexes", async () => {
    const response = await POST(chatRequest('?ancient=aristotle'));

    expect(response.status).toBe(200);
    expect(pinecone.queryPineconeContext).toHaveBeenCalledWith('What is virtue?', 'aristotle');
    expect(prompts.getPrompt).toHaveBeenCalledWith(expect.objectContaining({ slug: 'aristotle' }));
    const { instructions } = stream.chatStreamResponse.mock.calls[0][0];
    expect(instructions).toContain('You are Aristotle.');
    expect(instructions).toContain("passage from aristotle's indexes");
  });

  it('uses another ancient once it is enabled', async () => {
    plato.isEnabled = true;

    const response = await POST(chatRequest('?ancient=plato'));

    expect(response.status).toBe(200);
    expect(pinecone.queryPineconeContext).toHaveBeenCalledWith('What is virtue?', 'plato');
    const { instructions } = stream.chatStreamResponse.mock.calls[0][0];
    expect(instructions).toContain('You are Plato.');
    expect(instructions).toContain("passage from plato's indexes");
    expect(instructions).not.toContain('Aristotle');
  });

  it('still requires sign-in first', async () => {
    clerk.getAuth.mockReturnValue({ userId: null });

    const response = await POST(chatRequest('?ancient=aristotle'));

    expect(response.status).toBe(401);
  });
});
