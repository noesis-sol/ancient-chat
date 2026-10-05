import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ EMBEDDING_MODEL: 'text-embedding-ada-002' }));
const mocks = vi.hoisted(() => ({ getActiveIndexes: vi.fn(), query: vi.fn(), embedQuery: vi.fn() }));

vi.mock('@/lib/env', () => ({ env: () => env }));
vi.mock('@/lib/embeddings', () => ({ embedQuery: mocks.embedQuery }));
vi.mock('@/lib/pinecone', () => ({ getIndex: async (name: string) => ({ query: (args: object) => mocks.query(name, args) }) }));
vi.mock('@/data/indexes.service', () => ({
  IndexesService: class {
    getActiveIndexes = mocks.getActiveIndexes;
  }
}));

const { queryPineconeContext } = await import('./pinecone');

const row = (name: string, embedding_model: string) => ({ id: `${name}-host`, name, is_active: true, weight: 1, ancient: 'plato', embedding_model });

beforeEach(() => {
  vi.clearAllMocks();
  env.EMBEDDING_MODEL = 'text-embedding-ada-002';
  mocks.embedQuery.mockResolvedValue([0.1]);
  mocks.query.mockResolvedValue({ matches: [] });
});

describe('queryPineconeContext embedding model', () => {
  it('queries only the indexes embedded with EMBEDDING_MODEL, giving them all the chunks', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.getActiveIndexes.mockResolvedValue([row('republic', 'text-embedding-ada-002'), row('meno', 'text-embedding-3-small')]);

    await queryPineconeContext('What is justice?', 'plato');

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith('republic', { vector: [0.1], topK: 10, includeMetadata: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"meno": embedded with text-embedding-3-small'));
    warn.mockRestore();
  });

  it('follows a changed EMBEDDING_MODEL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    env.EMBEDDING_MODEL = 'text-embedding-3-small';
    mocks.getActiveIndexes.mockResolvedValue([row('republic', 'text-embedding-ada-002'), row('meno', 'text-embedding-3-small')]);

    await queryPineconeContext('What is justice?', 'plato');

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith('meno', expect.objectContaining({ topK: 10 }));
    warn.mockRestore();
  });

  it('embeds nothing when no index matches the model', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.getActiveIndexes.mockResolvedValue([row('meno', 'text-embedding-3-small')]);

    await expect(queryPineconeContext('What is justice?', 'plato')).resolves.toEqual([]);
    expect(mocks.embedQuery).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
