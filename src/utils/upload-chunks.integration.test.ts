import { NextRequest } from 'next/server';
import { afterAll, describe, expect, it, vi } from 'vitest';

// Runs the upload route against Pinecone Local (see README.md, "Integration
// tests"): concurrent uploads that create the same index, one embeddings
// request per batch, and re-uploads that delete the chunks a longer earlier
// upload left behind. Clerk and OpenAI are stand-ins: a signed-in admin and
// fixed fake embeddings.

// Unset, the suite skips (vitest.integration.config.ts says why).
const controllerHost = process.env.PINECONE_CONTROLLER_HOST;

const fakes = vi.hoisted(() => {
  const embedding = (text: string) => {
    const values = new Array<number>(1536).fill(1);
    for (let i = 0; i < text.length; i++) {
      values[i % values.length] += text.charCodeAt(i) / 1e4;
    }
    return values;
  };
  // The texts of each embeddings request.
  const requests: string[][] = [];
  return { embedding, requests };
});

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  const env = actual.parseEnv({
    DATABASE_URL: 'postgresql://unused@localhost:5432/unused',
    PINECONE_API_KEY: 'pinecone-local-ignores-keys',
    OPENAI_API_KEY: 'unused',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_unused',
    CLERK_SECRET_KEY: 'sk_test_unused',
    PINECONE_CONTROLLER_HOST: process.env.PINECONE_CONTROLLER_HOST
  });
  return { ...actual, env: () => env };
});

vi.mock('@clerk/nextjs/server', () => ({
  getAuth: () => ({ userId: 'user_admin', sessionClaims: { metadata: { role: 'admin' } } }),
  currentUser: async () => ({ publicMetadata: { role: 'admin' } })
}));

// src/lib/embeddings.ts embeds each batch with one embedMany call.
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  embedMany: async ({ values }: { values: string[] }) => {
    fakes.requests.push(values);
    return { embeddings: values.map(fakes.embedding) };
  }
}));

const { POST: upload } = await import('@/app/api/indexes/upload/route');
const { getIndex, getPinecone } = await import('@/lib/pinecone');
const { BATCH_SIZE, chunkIds, CHUNK_COUNT_KEY } = await import('@/utils/upload-chunks');
const { integrationRunId } = await import('@/utils/integration-run');

// Unique per suite: Pinecone Local may hold other suites' and runs' indexes.
const run = integrationRunId();
const academy = `${run}-academy`;
const long = { path: `${academy}/republic.txt`, chunks: BATCH_SIZE + 50 };
const short = { path: `${academy}/meno.txt`, chunks: 3 };

// Paragraphs of ~900 characters: the route's splitter (chunks of 1000) makes
// each one a chunk of its own.
const document = (chunks: number, label = 'Paragraph') =>
  Array.from({ length: chunks }, (_, i) => `${label} ${i}. ${'The unexamined life is not worth living. '.repeat(22)}`).join(
    '\n\n'
  );

const uploadFile = (path: string, content: string) => {
  const form = new FormData();
  const filename = path.split('/').pop()!;
  form.append('file', new File([content], filename, { type: 'text/plain' }));
  form.append('path', path);
  form.append('filename', filename);
  form.append('type', 'text/plain');
  return upload(new NextRequest('http://localhost/api/indexes/upload', { method: 'POST', body: form }));
};

const index = () => getIndex(academy);

const recordCount = async () => (await (await index()).describeIndexStats()).totalRecordCount;

// The ids among `ids` that the index holds.
const storedIds = async (ids: string[]) => {
  const { records } = await (await index()).fetch({ ids });
  return ids.filter((id) => records[id]);
};

// Polls until check passes: writes may take a moment to show in reads.
async function eventually(check: () => Promise<void>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

describe.skipIf(!controllerHost)('Upload chunks on Pinecone Local', () => {
  afterAll(async () => {
    // Pinecone Local serves at most ten indexes (ports 5081-5090), so leave none behind.
    for (const { name } of (await getPinecone().listIndexes()).indexes ?? []) {
      if (name.startsWith(`${run}-`)) await getPinecone().deleteIndex(name);
    }
  });

  it('concurrent uploads into the same new folder both succeed, embedding one request per batch', async () => {
    const responses = await Promise.all([
      uploadFile(long.path, document(long.chunks)),
      uploadFile(short.path, document(short.chunks))
    ]);

    for (const response of responses) {
      expect(await response.json()).toEqual({
        success: true,
        indexName: academy,
        message: 'File successfully processed and indexed'
      });
    }
    expect(fakes.requests.map((texts) => texts.length).sort((a, b) => a - b)).toEqual([short.chunks, 50, BATCH_SIZE]);
    await eventually(async () => expect(await recordCount()).toBe(long.chunks + short.chunks));
  });

  it('re-uploading a shorter file deletes its orphan chunks by id', async () => {
    const response = await uploadFile(long.path, document(4, 'Revised'));

    expect(response.status).toBe(200);
    await eventually(async () => expect(await recordCount()).toBe(4 + short.chunks));
    expect(await storedIds(chunkIds(long.path, 0, long.chunks))).toEqual(chunkIds(long.path, 0, 4));
    expect(await storedIds(chunkIds(short.path, 0, short.chunks))).toEqual(chunkIds(short.path, 0, short.chunks));
    const { records } = await (await index()).fetch({ ids: [`${long.path}-0`] });
    expect(records[`${long.path}-0`].metadata).toMatchObject({ text: expect.stringMatching(/^Revised 0\./), [CHUNK_COUNT_KEY]: 4 });
  });

  it('re-uploading a file uploaded before chunk counts were stored deletes its orphan chunks too', async () => {
    const legacy = `${academy}/laws.txt`;
    await (await index()).upsert({
      records: chunkIds(legacy, 0, 6).map((id) => ({ id, values: fakes.embedding(id), metadata: { source: legacy } }))
    });
    await eventually(async () => expect(await storedIds(chunkIds(legacy, 0, 6))).toHaveLength(6));

    const response = await uploadFile(legacy, document(2));

    expect(response.status).toBe(200);
    await eventually(async () => expect(await storedIds(chunkIds(legacy, 0, 6))).toEqual(chunkIds(legacy, 0, 2)));
  });
});
