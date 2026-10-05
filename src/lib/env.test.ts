import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/ancient_chat',
  PINECONE_API_KEY: 'pc-key',
  OPENAI_API_KEY: 'sk-openai',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
  CLERK_SECRET_KEY: 'sk_test_abc',
};

function problemsFor(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return (error as EnvError).problems;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('accepts a complete environment and defaults the Pinecone location and chat rate limits', () => {
    expect(parseEnv(valid)).toEqual({
      ...valid,
      PINECONE_CLOUD: 'aws',
      PINECONE_REGION: 'us-east-1',
      CHAT_RATE_LIMIT_PER_MINUTE: 20,
      CHAT_RATE_LIMIT_PER_DAY: 200,
    });
  });

  it('reads a configured Pinecone cloud and region', () => {
    const env = parseEnv({ ...valid, PINECONE_CLOUD: 'gcp', PINECONE_REGION: 'europe-west4' });
    expect(env.PINECONE_CLOUD).toBe('gcp');
    expect(env.PINECONE_REGION).toBe('europe-west4');
  });

  it('names every missing variable', () => {
    expect(problemsFor({})).toEqual([
      'DATABASE_URL: not set',
      'PINECONE_API_KEY: not set',
      'OPENAI_API_KEY: not set',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: not set',
      'CLERK_SECRET_KEY: not set',
    ]);
  });

  it('treats empty and blank values as unset', () => {
    expect(problemsFor({ ...valid, OPENAI_API_KEY: '', PINECONE_API_KEY: '  ' })).toEqual([
      'PINECONE_API_KEY: not set',
      'OPENAI_API_KEY: not set',
    ]);
    expect(parseEnv({ ...valid, PINECONE_REGION: '' }).PINECONE_REGION).toBe('us-east-1');
  });

  it('rejects malformed values', () => {
    expect(
      problemsFor({
        ...valid,
        DATABASE_URL: 'mysql://localhost/db',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_abc',
        CLERK_SECRET_KEY: 'pk_test_abc',
        PINECONE_CLOUD: 'digitalocean',
      })
    ).toEqual([
      'DATABASE_URL: must be a postgresql:// connection string',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: must be a Clerk publishable key (pk_...)',
      'CLERK_SECRET_KEY: must be a Clerk secret key (sk_...)',
      'PINECONE_CLOUD: must be aws, gcp or azure',
    ]);
  });

  it('puts the variable names in the error message', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL: not set/);
  });
});
