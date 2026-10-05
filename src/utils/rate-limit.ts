import { NextResponse } from 'next/server';

// One rate limit, such as @upstash/ratelimit's Ratelimit. `reset` is when the
// current window ends, in milliseconds since the epoch.
export interface RateLimiter {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
}

export type RateLimitResult = { limited: false } | { limited: true; retryAfter: number };

// Counts a request against each limiter in turn, stopping at the first that
// turns it away, so a request refused by the per-minute limit doesn't use up
// the daily one. `retryAfter` is in whole seconds. Without limiters (rate
// limiting is off) or when the store fails, the request goes through: an
// outage of the store shouldn't take the chat down with it.
export async function checkRateLimits(
  limiters: RateLimiter[] | null,
  identifier: string,
  now: () => number = Date.now
): Promise<RateLimitResult> {
  try {
    for (const limiter of limiters ?? []) {
      const { success, reset } = await limiter.limit(identifier);
      if (!success) {
        return { limited: true, retryAfter: Math.max(1, Math.ceil((reset - now()) / 1000)) };
      }
    }
  } catch (error) {
    console.error('Rate limit check failed, letting the request through:', error);
  }
  return { limited: false };
}

// 429 with Retry-After. The body repeats it because the chat UI only sees the
// body of a failed response.
export function rateLimitedResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
