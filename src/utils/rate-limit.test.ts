import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimits, rateLimitedResponse, type RateLimiter } from './rate-limit';

const now = () => 1_000_000;

const limiter = (success: boolean, reset = now()): RateLimiter & { limit: ReturnType<typeof vi.fn> } => ({
  limit: vi.fn(async () => ({ success, reset })),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkRateLimits', () => {
  it('lets every request through when rate limiting is off', async () => {
    expect(await checkRateLimits(null, 'user_1', now)).toEqual({ limited: false });
  });

  it('counts the request against every limiter by the identifier', async () => {
    const [minute, day] = [limiter(true), limiter(true)];

    expect(await checkRateLimits([minute, day], 'user_1', now)).toEqual({ limited: false });
    expect(minute.limit).toHaveBeenCalledWith('user_1');
    expect(day.limit).toHaveBeenCalledWith('user_1');
  });

  it('stops at the first limit reached, with the seconds until its window ends', async () => {
    const [minute, day] = [limiter(false, now() + 12_300), limiter(true)];

    expect(await checkRateLimits([minute, day], 'user_1', now)).toEqual({ limited: true, retryAfter: 13 });
    expect(day.limit).not.toHaveBeenCalled();
  });

  it('reports the daily limit after the per-minute one passed', async () => {
    const day = limiter(false, now() + 5 * 3600 * 1000);

    expect(await checkRateLimits([limiter(true), day], 'user_1', now)).toEqual({ limited: true, retryAfter: 18_000 });
  });

  it('asks to wait at least a second', async () => {
    expect(await checkRateLimits([limiter(false, now() - 50)], 'user_1', now)).toEqual({
      limited: true,
      retryAfter: 1,
    });
  });

  it('lets the request through when the store fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing: RateLimiter = { limit: vi.fn().mockRejectedValue(new Error('Upstash is down')) };

    expect(await checkRateLimits([failing], 'user_1', now)).toEqual({ limited: false });
    expect(error).toHaveBeenCalled();
  });
});

describe('rateLimitedResponse', () => {
  it('is a 429 with Retry-After in the header and the body', async () => {
    const response = rateLimitedResponse(42);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(await response.json()).toEqual({ error: 'Too many requests', retryAfter: 42 });
  });
});
