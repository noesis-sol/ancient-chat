import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv, parseRateLimitEnv, upstashRedis } from './env';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/ancient_chat',
  PINECONE_API_KEY: 'pc-key',
  OPENAI_API_KEY: 'sk-openai',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
  CLERK_SECRET_KEY: 'sk_test_abc',
};

const upstash = { UPSTASH_REDIS_REST_URL: 'https://eu1-x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'upstash-token' };
const kv = { KV_REST_API_URL: 'https://kv-x.upstash.io', KV_REST_API_TOKEN: 'kv-token' };

function problemsFor(source: Record<string, string | undefined>) {
  try {
    parseRateLimitEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return (error as EnvError).problems;
  }
  throw new Error('expected parseRateLimitEnv to throw');
}

describe('rate limit environment', () => {
  it('defaults to 20 a minute and 200 a day, without a store', () => {
    const env = parseRateLimitEnv({});
    expect(env.CHAT_RATE_LIMIT_PER_MINUTE).toBe(20);
    expect(env.CHAT_RATE_LIMIT_PER_DAY).toBe(200);
    expect(upstashRedis(env)).toBeUndefined();
  });

  it('reads configured limits', () => {
    const env = parseRateLimitEnv({ CHAT_RATE_LIMIT_PER_MINUTE: '5', CHAT_RATE_LIMIT_PER_DAY: ' 50 ' });
    expect(env.CHAT_RATE_LIMIT_PER_MINUTE).toBe(5);
    expect(env.CHAT_RATE_LIMIT_PER_DAY).toBe(50);
  });

  it('rejects limits that are not whole numbers above 0', () => {
    expect(problemsFor({ CHAT_RATE_LIMIT_PER_MINUTE: '0', CHAT_RATE_LIMIT_PER_DAY: '1.5' })).toEqual([
      'CHAT_RATE_LIMIT_PER_MINUTE: must be a whole number above 0',
      'CHAT_RATE_LIMIT_PER_DAY: must be a whole number above 0',
    ]);
    expect(problemsFor({ CHAT_RATE_LIMIT_PER_MINUTE: 'lots' })).toEqual([
      'CHAT_RATE_LIMIT_PER_MINUTE: must be a whole number above 0',
    ]);
  });

  it('uses the UPSTASH_ pair, falling back to the KV_ pair', () => {
    expect(upstashRedis(parseRateLimitEnv(upstash))).toEqual({
      url: 'https://eu1-x.upstash.io',
      token: 'upstash-token',
    });
    expect(upstashRedis(parseRateLimitEnv(kv))).toEqual({ url: 'https://kv-x.upstash.io', token: 'kv-token' });
    expect(upstashRedis(parseRateLimitEnv({ ...kv, ...upstash }))).toEqual({
      url: 'https://eu1-x.upstash.io',
      token: 'upstash-token',
    });
  });

  it('treats empty values as unset', () => {
    expect(upstashRedis(parseRateLimitEnv({ UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: ' ' }))).toBeUndefined();
  });

  it('rejects half a pair and a malformed URL', () => {
    expect(problemsFor({ UPSTASH_REDIS_REST_URL: upstash.UPSTASH_REDIS_REST_URL })).toEqual([
      'UPSTASH_REDIS_REST_TOKEN: not set, but UPSTASH_REDIS_REST_URL is',
    ]);
    expect(problemsFor({ KV_REST_API_TOKEN: kv.KV_REST_API_TOKEN })).toEqual([
      'KV_REST_API_URL: not set, but KV_REST_API_TOKEN is',
    ]);
    expect(problemsFor({ ...upstash, UPSTASH_REDIS_REST_URL: 'eu1-x.upstash.io' })).toEqual([
      'UPSTASH_REDIS_REST_URL: must be an http:// or https:// URL',
    ]);
  });

  it('requires a store in production on Vercel only', () => {
    expect(problemsFor({ VERCEL_ENV: 'production' })).toEqual([
      'UPSTASH_REDIS_REST_URL: not set: production on Vercel needs Upstash Redis for rate limiting ' +
        '(UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)',
    ]);
    expect(upstashRedis(parseRateLimitEnv({ VERCEL_ENV: 'production', ...kv }))).toBeDefined();
    expect(() => parseRateLimitEnv({ VERCEL_ENV: 'preview' })).not.toThrow();
  });

  it('is checked with the rest of the environment at startup', () => {
    expect(() => parseEnv({ ...valid, VERCEL_ENV: 'production' })).toThrow(/UPSTASH_REDIS_REST_URL: not set/);
    expect(parseEnv({ ...valid, ...upstash, CHAT_RATE_LIMIT_PER_DAY: '1000' })).toMatchObject({
      ...upstash,
      CHAT_RATE_LIMIT_PER_DAY: 1000,
    });
  });
});
