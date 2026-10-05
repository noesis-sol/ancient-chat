import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upstash = vi.hoisted(() => {
  const Ratelimit = vi.fn(function (this: { options: unknown }, options: unknown) {
    this.options = options;
  }) as unknown as ReturnType<typeof vi.fn> & { slidingWindow: ReturnType<typeof vi.fn> };
  Ratelimit.slidingWindow = vi.fn((tokens: number, window: string) => ({ tokens, window }));
  const Redis = vi.fn(function (this: { config: unknown }, config: unknown) {
    this.config = config;
  });
  return { Ratelimit, Redis };
});

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: upstash.Ratelimit }));
vi.mock('@upstash/redis', () => ({ Redis: upstash.Redis }));

const load = async () => (await import('./rate-limit')).chatRateLimiters;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
    vi.stubEnv(name, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('chatRateLimiters', () => {
  it('is off without Upstash Redis', async () => {
    const chatRateLimiters = await load();

    expect(chatRateLimiters()).toBeNull();
    expect(upstash.Redis).not.toHaveBeenCalled();
  });

  it('limits per minute, then per day, with the configured limits', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv-x.upstash.io');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    vi.stubEnv('CHAT_RATE_LIMIT_PER_MINUTE', '5');
    vi.stubEnv('CHAT_RATE_LIMIT_PER_DAY', '');
    const chatRateLimiters = await load();

    const limiters = chatRateLimiters() as unknown as { options: { prefix: string; limiter: unknown } }[];

    expect(upstash.Redis).toHaveBeenCalledWith({ url: 'https://kv-x.upstash.io', token: 'kv-token' });
    expect(limiters.map(({ options }) => [options.prefix, options.limiter])).toEqual([
      ['ratelimit:chat:minute', { tokens: 5, window: '1 m' }],
      ['ratelimit:chat:day', { tokens: 200, window: '1 d' }],
    ]);
    expect(chatRateLimiters()).toBe(limiters);
  });
});
