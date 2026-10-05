import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvError, parseEnv } from './env';

const sdk = vi.hoisted(() => ({
  constructed: vi.fn(),
  index: vi.fn(),
  describeIndex: vi.fn(),
  deleteIndex: vi.fn(),
  env: { PINECONE_API_KEY: 'test-key', PINECONE_CONTROLLER_HOST: undefined as string | undefined }
}));

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./env')>()),
  env: () => sdk.env
}));

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    constructor(config: unknown) {
      sdk.constructed(config);
    }
    index = sdk.index;
    describeIndex = sdk.describeIndex;
    deleteIndex = sdk.deleteIndex;
  }
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.env.PINECONE_CONTROLLER_HOST = 'http://localhost:5080';
  sdk.index.mockImplementation((options: unknown) => ({ options }));
  sdk.describeIndex.mockResolvedValue({ host: 'localhost:5081' });
});

describe('PINECONE_CONTROLLER_HOST', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/ancient_chat',
    PINECONE_API_KEY: 'pc-key',
    OPENAI_API_KEY: 'sk-openai',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
    CLERK_SECRET_KEY: 'sk_test_abc'
  };

  it('is optional, and empty counts as unset', () => {
    expect(parseEnv(valid).PINECONE_CONTROLLER_HOST).toBeUndefined();
    expect(parseEnv({ ...valid, PINECONE_CONTROLLER_HOST: ' ' }).PINECONE_CONTROLLER_HOST).toBeUndefined();
  });

  it('accepts an http or https URL', () => {
    expect(
      parseEnv({ ...valid, PINECONE_CONTROLLER_HOST: 'http://localhost:5080' }).PINECONE_CONTROLLER_HOST
    ).toBe('http://localhost:5080');
    expect(
      parseEnv({ ...valid, PINECONE_CONTROLLER_HOST: 'https://pinecone.internal' }).PINECONE_CONTROLLER_HOST
    ).toBe('https://pinecone.internal');
  });

  it.each(['localhost:5080', 'ftp://localhost:5080', 'http://'])('rejects %s', (value) => {
    expect(() => parseEnv({ ...valid, PINECONE_CONTROLLER_HOST: value })).toThrow(EnvError);
    expect(() => parseEnv({ ...valid, PINECONE_CONTROLLER_HOST: value })).toThrow(
      'PINECONE_CONTROLLER_HOST: must be an http:// or https:// URL'
    );
  });
});

describe('getPinecone with Pinecone Local', () => {
  it('points the control plane at the controller host', async () => {
    const { getPinecone } = await import('./pinecone');

    getPinecone();

    expect(sdk.constructed).toHaveBeenCalledWith({
      apiKey: 'test-key',
      controllerHostUrl: 'http://localhost:5080'
    });
  });
});

describe('getIndex with Pinecone Local', () => {
  it('targets the described host over the controller scheme', async () => {
    const { getIndex } = await import('./pinecone');

    expect(await getIndex('plato')).toEqual({
      options: { name: 'plato', host: 'http://localhost:5081' }
    });
    expect(sdk.describeIndex).toHaveBeenCalledWith('plato');
  });

  it('keeps a host that already has a scheme', async () => {
    sdk.describeIndex.mockResolvedValue({ host: 'https://plato.example' });
    const { getIndex } = await import('./pinecone');

    expect(await getIndex('plato')).toEqual({ options: { name: 'plato', host: 'https://plato.example' } });
  });

  it('describes each index once', async () => {
    sdk.describeIndex.mockImplementation(async (name: string) => ({
      host: name === 'plato' ? 'localhost:5081' : 'localhost:5082'
    }));
    const { getIndex } = await import('./pinecone');

    await getIndex('plato');
    await getIndex('plato');
    expect(await getIndex('aristotle')).toEqual({
      options: { name: 'aristotle', host: 'http://localhost:5082' }
    });

    expect(sdk.describeIndex).toHaveBeenCalledTimes(2);
  });

  it('describes the index again after deleting it', async () => {
    const { deleteIndex, getIndex } = await import('./pinecone');

    await getIndex('plato');
    await deleteIndex('plato');
    sdk.describeIndex.mockResolvedValue({ host: 'localhost:5083' });

    expect(sdk.deleteIndex).toHaveBeenCalledWith('plato');
    expect(await getIndex('plato')).toEqual({ options: { name: 'plato', host: 'http://localhost:5083' } });
  });

  it('does not describe the index when the controller host is unset', async () => {
    sdk.env.PINECONE_CONTROLLER_HOST = undefined;
    const { getIndex, getPinecone } = await import('./pinecone');

    expect(await getIndex('plato')).toEqual({ options: { name: 'plato' } });
    getPinecone();
    expect(sdk.constructed).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(sdk.describeIndex).not.toHaveBeenCalled();
  });
});
