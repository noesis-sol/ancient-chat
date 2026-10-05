import { parseRateLimitEnv, upstashRedis } from '@/lib/env';
import type { RateLimiter } from '@/utils/rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let chatLimiters: RateLimiter[] | null | undefined;

// The per-user limits on /api/chat, per minute then per day, or null when
// Upstash Redis isn't configured and rate limiting is off. Created on first
// use, like the other clients, so `next build` needs no secrets.
export function chatRateLimiters(): RateLimiter[] | null {
  if (chatLimiters !== undefined) {
    return chatLimiters;
  }
  const env = parseRateLimitEnv(process.env);
  const credentials = upstashRedis(env);
  if (!credentials) {
    return (chatLimiters = null);
  }
  const redis = new Redis(credentials);
  return (chatLimiters = [
    new Ratelimit({
      redis,
      prefix: 'ratelimit:chat:minute',
      limiter: Ratelimit.slidingWindow(env.CHAT_RATE_LIMIT_PER_MINUTE, '1 m'),
    }),
    new Ratelimit({
      redis,
      prefix: 'ratelimit:chat:day',
      limiter: Ratelimit.slidingWindow(env.CHAT_RATE_LIMIT_PER_DAY, '1 d'),
    }),
  ]);
}
