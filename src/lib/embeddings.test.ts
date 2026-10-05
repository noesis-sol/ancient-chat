import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ CHAT_MODEL: 'gpt-4o-mini', EMBEDDING_MODEL: 'text-embedding-ada-002', OPENAI_API_KEY: 'sk-test' }));
const sdk = vi.hoisted(() => ({ embed: vi.fn(), embedMany: vi.fn() }));

vi.mock('@/lib/env', () => ({ env: () => env }));
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), ...sdk }));

const { chatModel } = await import('./openai');
const { embedDocuments, embeddingDimension, embedQuery } = await import('./embeddings');

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { CHAT_MODEL: 'gpt-4o-mini', EMBEDDING_MODEL: 'text-embedding-ada-002' });
  sdk.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
  sdk.embedMany.mockImplementation(async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => [0.5])
  }));
});

describe('chatModel', () => {
  it('is CHAT_MODEL from OpenAI', () => {
    env.CHAT_MODEL = 'gpt-5-mini';
    expect(chatModel()).toMatchObject({ modelId: 'gpt-5-mini', provider: expect.stringMatching(/^openai\./) });
  });
});

describe('embeddings', () => {
  it('embeds questions and documents with EMBEDDING_MODEL', async () => {
    await expect(embedQuery('What is virtue?')).resolves.toEqual([0.1, 0.2, 0.3]);
    await expect(embedDocuments(['a', 'b'])).resolves.toEqual([[0.5], [0.5]]);

    for (const call of [sdk.embed.mock.calls[0][0], sdk.embedMany.mock.calls[0][0]]) {
      expect(call.model).toMatchObject({ modelId: 'text-embedding-ada-002', provider: expect.stringMatching(/^openai\./) });
    }
    expect(sdk.embed.mock.calls[0][0].value).toBe('What is virtue?');

    env.EMBEDDING_MODEL = 'text-embedding-3-small';
    await embedQuery('What is virtue?');
    expect(sdk.embed.mock.calls[1][0].model).toMatchObject({ modelId: 'text-embedding-3-small' });
  });

  it('turns newlines in documents into spaces, as the indexes were embedded, but keeps the question as is', async () => {
    await embedDocuments(['line one\nline two\n\nnext']);
    await embedQuery('first\nsecond');

    expect(sdk.embedMany.mock.calls[0][0].values).toEqual(['line one line two  next']);
    expect(sdk.embed.mock.calls[0][0].value).toBe('first\nsecond');
  });

  it("knows OpenAI models' dimensions and asks the API for others", async () => {
    await expect(embeddingDimension()).resolves.toBe(1536);
    env.EMBEDDING_MODEL = 'text-embedding-3-large';
    await expect(embeddingDimension()).resolves.toBe(3072);
    expect(sdk.embed).not.toHaveBeenCalled();

    env.EMBEDDING_MODEL = 'some-other-embedding';
    await expect(embeddingDimension()).resolves.toBe(3);
    expect(sdk.embed.mock.calls[0][0].model).toMatchObject({ modelId: 'some-other-embedding' });
  });
});
