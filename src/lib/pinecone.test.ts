import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  constructed: vi.fn(),
  index: vi.fn()
}));

vi.mock('@/lib/env', () => ({ env: () => ({ PINECONE_API_KEY: 'test-key' }) }));

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    constructor(config: unknown) {
      sdk.constructed(config);
    }
    index = sdk.index;
  }
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.index.mockImplementation((options: unknown) => ({ options }));
});

describe('getPinecone', () => {
  it('creates no client on import', async () => {
    await import('./pinecone');

    expect(sdk.constructed).not.toHaveBeenCalled();
  });

  it('creates one client with the API key from env and reuses it', async () => {
    const { getPinecone } = await import('./pinecone');

    const first = getPinecone();

    expect(getPinecone()).toBe(first);
    expect(sdk.constructed).toHaveBeenCalledOnce();
    expect(sdk.constructed).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });
});

describe('getIndex', () => {
  it('targets the index by name with the options object, on the shared client', async () => {
    const { getIndex, getPinecone } = await import('./pinecone');

    expect(getIndex('plato')).toEqual({ options: { name: 'plato' } });
    expect(sdk.index).toHaveBeenCalledWith({ name: 'plato' });
    getPinecone();
    expect(sdk.constructed).toHaveBeenCalledOnce();
  });
});
