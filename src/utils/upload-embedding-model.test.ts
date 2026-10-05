import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ EMBEDDING_MODEL: 'text-embedding-ada-002', PINECONE_CLOUD: 'aws', PINECONE_REGION: 'us-east-1' }));
const pinecone = vi.hoisted(() => ({
  listIndexes: vi.fn(),
  createIndex: vi.fn(),
  describeIndex: vi.fn(),
  replaceFileChunks: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => ({
  getAuth: () => ({ userId: 'user_admin', sessionClaims: { metadata: { role: 'admin' } } }),
  currentUser: async () => ({ publicMetadata: { role: 'admin' } })
}));
vi.mock('@/lib/env', () => ({ env: () => env }));
vi.mock('@/lib/embeddings', () => ({ embedDocuments: vi.fn(), embeddingDimension: async () => 3072 }));
vi.mock('@/lib/pinecone', () => ({
  getPinecone: () => pinecone,
  getIndex: async () => ({})
}));
vi.mock('@/utils/upload-chunks', () => ({ replaceFileChunks: pinecone.replaceFileChunks }));

const { POST } = await import('@/app/api/indexes/upload/route');

const upload = () => {
  const form = new FormData();
  form.append('file', new File(['Virtue is knowledge.'], 'meno.txt', { type: 'text/plain' }));
  form.append('path', 'plato/meno.txt');
  form.append('filename', 'meno.txt');
  form.append('type', 'text/plain');
  return POST(new NextRequest('http://localhost/api/indexes/upload', { method: 'POST', body: form }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  env.EMBEDDING_MODEL = 'text-embedding-ada-002';
  pinecone.describeIndex.mockResolvedValue({ status: { ready: true } });
});

describe('POST /api/indexes/upload embedding model', () => {
  it("creates a new index with the model's dimension and tags it with the model", async () => {
    env.EMBEDDING_MODEL = 'text-embedding-3-large';
    pinecone.listIndexes.mockResolvedValue({ indexes: [] });

    const response = await upload();

    expect(response.status).toBe(200);
    expect(pinecone.createIndex).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'plato', dimension: 3072, tags: { embedding_model: 'text-embedding-3-large' } })
    );
    expect(pinecone.replaceFileChunks).toHaveBeenCalledOnce();
  });

  it('uploads into an untagged index while EMBEDDING_MODEL is text-embedding-ada-002', async () => {
    pinecone.listIndexes.mockResolvedValue({ indexes: [{ name: 'plato' }] });

    const response = await upload();

    expect(response.status).toBe(200);
    expect(pinecone.createIndex).not.toHaveBeenCalled();
    expect(pinecone.replaceFileChunks).toHaveBeenCalledOnce();
  });

  it('refuses to add vectors of another model to an existing index', async () => {
    env.EMBEDDING_MODEL = 'text-embedding-3-small';
    pinecone.listIndexes.mockResolvedValue({ indexes: [{ name: 'plato' }] });

    const response = await upload();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'EMBEDDING_MODEL_MISMATCH',
      error: expect.stringContaining('embedded with text-embedding-ada-002, but EMBEDDING_MODEL is text-embedding-3-small')
    });
    expect(pinecone.replaceFileChunks).not.toHaveBeenCalled();
  });

  it('uploads into an index tagged with the same model', async () => {
    env.EMBEDDING_MODEL = 'text-embedding-3-small';
    pinecone.listIndexes.mockResolvedValue({ indexes: [{ name: 'plato', tags: { embedding_model: 'text-embedding-3-small' } }] });

    expect((await upload()).status).toBe(200);
    expect(pinecone.replaceFileChunks).toHaveBeenCalledOnce();
  });
});
