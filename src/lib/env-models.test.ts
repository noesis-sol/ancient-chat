import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/ancient_chat',
  PINECONE_API_KEY: 'pc-key',
  OPENAI_API_KEY: 'sk-openai',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
  CLERK_SECRET_KEY: 'sk_test_abc',
};

describe('parseEnv models', () => {
  it('defaults to gpt-4o-mini and text-embedding-ada-002, also when set empty', () => {
    for (const source of [valid, { ...valid, CHAT_MODEL: '', EMBEDDING_MODEL: ' ' }]) {
      const env = parseEnv(source);
      expect(env.CHAT_MODEL).toBe('gpt-4o-mini');
      expect(env.EMBEDDING_MODEL).toBe('text-embedding-ada-002');
    }
  });

  it('reads configured models', () => {
    const env = parseEnv({ ...valid, CHAT_MODEL: 'gpt-5-mini', EMBEDDING_MODEL: ' text-embedding-3-small ' });
    expect(env.CHAT_MODEL).toBe('gpt-5-mini');
    expect(env.EMBEDDING_MODEL).toBe('text-embedding-3-small');
  });

  it('rejects an embedding model name that cannot be a Pinecone index tag', () => {
    expect(() => parseEnv({ ...valid, EMBEDDING_MODEL: 'models/embed:v2' })).toThrow(EnvError);
    expect(() => parseEnv({ ...valid, EMBEDDING_MODEL: 'models/embed:v2' })).toThrow(/EMBEDDING_MODEL: must be a model name/);
  });
});
