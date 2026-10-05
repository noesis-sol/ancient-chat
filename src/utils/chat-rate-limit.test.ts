import { ancients } from '@/data/ancients';
import type { RateLimiter } from '@/utils/rate-limit';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({ getAuth: vi.fn(), currentUser: vi.fn() }));
const pinecone = vi.hoisted(() => ({ queryPineconeContext: vi.fn() }));
const stream = vi.hoisted(() => ({ chatStreamResponse: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ chatRateLimiters: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => clerk);
vi.mock('@/utils/pinecone', () => pinecone);
vi.mock('@/lib/rate-limit', () => rateLimit);
vi.mock('@/data/prompt.service', () => ({
  PromptService: class {
    getPrompt = async () => ({ text: 'You are Socrates.' });
  },
}));
vi.mock('@/utils/chat-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/chat-request')>()),
  chatStreamResponse: stream.chatStreamResponse,
}));

const { POST } = await import('@/app/api/chat/route');

const enabled = ancients.find((ancient) => ancient.isEnabled)!;

const chatRequest = () =>
  new NextRequest(`http://localhost/api/chat?ancient=${enabled.slug}`, {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'What is virtue?' }] }] }),
  });

const limiter = (success: boolean, reset = Date.now()): RateLimiter => ({
  limit: vi.fn(async () => ({ success, reset })),
});

beforeEach(() => {
  vi.clearAllMocks();
  clerk.getAuth.mockReturnValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ firstName: 'Ann' });
  pinecone.queryPineconeContext.mockResolvedValue([]);
  stream.chatStreamResponse.mockResolvedValue(new Response('stream'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/chat rate limit', () => {
  it('answers when rate limiting is off', async () => {
    rateLimit.chatRateLimiters.mockReturnValue(null);

    const response = await POST(chatRequest());

    expect(response.status).toBe(200);
    expect(stream.chatStreamResponse).toHaveBeenCalled();
  });

  it('counts requests per signed-in user and answers within the limits', async () => {
    const minute = limiter(true);
    rateLimit.chatRateLimiters.mockReturnValue([minute]);

    const response = await POST(chatRequest());

    expect(response.status).toBe(200);
    expect(minute.limit).toHaveBeenCalledWith('user_1');
  });

  it('turns the request away with 429 and Retry-After before doing any work', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    rateLimit.chatRateLimiters.mockReturnValue([limiter(false, 1_000_000 + 30_000)]);

    const response = await POST(chatRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({ error: 'Too many requests', retryAfter: 30 });
    expect(pinecone.queryPineconeContext).not.toHaveBeenCalled();
    expect(stream.chatStreamResponse).not.toHaveBeenCalled();
  });

  it('does not count signed-out requests', async () => {
    clerk.getAuth.mockReturnValue({ userId: null });
    const minute = limiter(true);
    rateLimit.chatRateLimiters.mockReturnValue([minute]);

    expect((await POST(chatRequest())).status).toBe(401);
    expect(minute.limit).not.toHaveBeenCalled();
  });
});
