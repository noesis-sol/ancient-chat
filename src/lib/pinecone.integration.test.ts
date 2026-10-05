import { NextRequest } from 'next/server';
import { afterAll, describe, expect, it, vi } from 'vitest';

// Runs the app's own Pinecone code (upload route, IndexesService,
// queryPineconeContext, getIndex) against Pinecone Local, so SDK changes that
// break it at runtime fail here; the unit tests mock the SDK. The database,
// Clerk and OpenAI are stand-ins: an in-memory Index table, a signed-in admin
// and fixed fake embeddings. See README.md, "Integration tests".

// Unset, the suite skips (vitest.integration.config.ts says why).
const controllerHost = process.env.PINECONE_CONTROLLER_HOST;

const fakes = vi.hoisted(() => {
  // Near-identical unit vectors, so every record matches every question and
  // a query returns exactly topK records.
  const embedding = (text: string) => {
    const values = new Array<number>(1536).fill(1);
    for (let i = 0; i < text.length; i++) {
      values[i % values.length] += text.charCodeAt(i) / 1e4;
    }
    return values;
  };

  type Row = { id: string; name: string; is_active: boolean; weight: number; ancient: string | null; embedding_model: string };
  type Where = Partial<Record<keyof Row, unknown>>;
  type OrderBy = Partial<Record<keyof Row, 'asc' | 'desc'>>;

  // The Index table, with the Prisma calls IndexesService makes.
  let rows: Row[] = [];
  const matches = (row: Row, where: Where = {}) =>
    Object.entries(where).every(([key, value]) => {
      const field = row[key as keyof Row];
      return value !== null && typeof value === 'object' && 'in' in value
        ? (value.in as unknown[]).includes(field)
        : field === value;
    });
  // Sorts like Postgres would for an orderBy such as { name: 'asc' }; without one, insertion order.
  const sorted = (list: Row[], orderBy: OrderBy = {}) =>
    Object.entries(orderBy).reduceRight(
      (acc, [key, direction]) =>
        [...acc].sort((a, b) => {
          // Same-typed columns, so < compares names as strings and weights as numbers.
          const [x, y] = [a[key as keyof Row], b[key as keyof Row]] as [string, string];
          const order = x === y ? 0 : x < y ? -1 : 1;
          return direction === 'desc' ? -order : order;
        }),
      list
    );
  const find = (where: Where) => {
    const row = rows.find((candidate) => matches(candidate, where));
    if (!row) {
      throw new Error(`No Index row matches ${JSON.stringify(where)}`);
    }
    return row;
  };

  // The bulk writes apply when called, so the sync's $transaction runs them in order.
  const db = {
    index: {
      findMany: async (args?: { where?: Where; orderBy?: OrderBy }) =>
        sorted(rows.filter((row) => matches(row, args?.where)), args?.orderBy).map((row) => ({ ...row })),
      findUnique: async ({ where }: { where: Where }) => {
        const row = rows.find((candidate) => matches(candidate, where));
        return row ? { ...row } : null;
      },
      update: async ({ where, data }: { where: Where; data: Partial<Row> }) => ({ ...Object.assign(find(where), data) }),
      delete: async ({ where }: { where: Where }) => {
        const row = find(where);
        rows = rows.filter((candidate) => candidate !== row);
        return row;
      },
      deleteMany: ({ where }: { where: Where }) => {
        const count = rows.length;
        rows = rows.filter((row) => !matches(row, where));
        return Promise.resolve({ count: count - rows.length });
      },
      updateMany: ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hits = rows.filter((row) => matches(row, where));
        hits.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: hits.length });
      },
      createMany: ({ data }: { data: Omit<Row, 'ancient'>[]; skipDuplicates?: boolean }) => {
        const fresh = data.filter((row) => !rows.some(({ id, name }) => id === row.id || name === row.name));
        rows.push(...fresh.map((row) => ({ ancient: null, ...row })));
        return Promise.resolve({ count: fresh.length });
      }
    },
    $transaction: (writes: Promise<unknown>[]) => Promise.all(writes)
  };

  return { embedding, db };
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

vi.mock('@/lib/prisma', () => ({ prisma: fakes.db }));

// A signed-in admin: admins have the Clerk public metadata role 'admin' (see isAdmin).
vi.mock('@clerk/nextjs/server', () => ({
  getAuth: () => ({ userId: 'user_admin', sessionClaims: { metadata: { role: 'admin' } } }),
  currentUser: async () => ({ publicMetadata: { role: 'admin' } })
}));

// src/lib/embeddings.ts embeds the upload route's chunks with embedMany and
// queryPineconeContext's question with embed.
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  embedMany: async ({ values }: { values: string[] }) => ({ embeddings: values.map(fakes.embedding) }),
  embed: async ({ value }: { value: string }) => ({ embedding: fakes.embedding(value) })
}));

const { POST: upload } = await import('@/app/api/indexes/upload/route');
const { IndexesService } = await import('@/data/indexes.service');
const { getIndex, getPinecone } = await import('@/lib/pinecone');
const { queryPineconeContext } = await import('@/utils/pinecone');
const { integrationRunId } = await import('@/utils/integration-run');

// Unique per suite: Pinecone Local may hold other suites' and runs' indexes.
const run = integrationRunId();
const republic = { index: `${run}-republic`, path: `${run}-republic/book-1.txt`, chunks: 12 };
const meno = { index: `${run}-meno`, path: `${run}-meno/dialogue.txt`, chunks: 4 };

// Paragraphs of ~900 characters: the route's splitter (chunks of 1000) makes
// each one a chunk of its own.
const document = (chunks: number) =>
  Array.from({ length: chunks }, (_, i) => `Paragraph ${i}. ${'The unexamined life is not worth living. '.repeat(22)}`).join(
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

const recordCount = async (name: string) => (await (await getIndex(name)).describeIndexStats()).totalRecordCount;

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

const pineconeIndexNames = async () => ((await getPinecone().listIndexes()).indexes ?? []).map(({ name }) => name);

describe.skipIf(!controllerHost)('Pinecone Local integration', () => {
  const indexes = new IndexesService();

  afterAll(async () => {
    // Pinecone Local serves at most ten indexes (ports 5081-5090), so leave none behind.
    for (const name of await pineconeIndexNames()) {
      if (name.startsWith(`${run}-`)) await getPinecone().deleteIndex(name);
    }
  });

  it('upload creates the index, waits until it is ready and upserts every chunk', async () => {
    for (const { index, path, chunks } of [republic, meno]) {
      const response = await uploadFile(path, document(chunks));

      expect(await response.json()).toEqual({
        success: true,
        indexName: index,
        message: 'File successfully processed and indexed'
      });
      expect((await getPinecone().describeIndex(index)).status.ready).toBe(true);
      await eventually(async () => expect(await recordCount(index)).toBe(chunks));
    }
  });

  it('upload into an existing index overwrites the records by id', async () => {
    const response = await uploadFile(meno.path, document(meno.chunks));

    expect(response.status).toBe(200);
    await eventually(async () => expect(await recordCount(meno.index)).toBe(meno.chunks));
  });

  it('IndexesService syncs new Pinecone indexes into the table, inactive', async () => {
    const rows = await indexes.getIndexes();

    for (const { index } of [republic, meno]) {
      const { host } = await getPinecone().describeIndex(index);
      expect(rows.find((row) => row.name === index)).toEqual({
        id: host,
        name: index,
        is_active: false,
        weight: 1,
        ancient: null,
        // The upload tags the index with EMBEDDING_MODEL (the default here).
        // Pinecone Local drops tags, and an untagged index reads as the default.
        embedding_model: 'text-embedding-ada-002'
      });
    }
  });

  it("queryPineconeContext splits topK between the ancient's indexes by weight", async () => {
    for (const { index } of [republic, meno]) {
      await indexes.setIndexAncient(index, 'plato');
      await indexes.toggleIndex(index, true);
    }
    // 4:1 splits the 10 chunks exactly. Weights that leave a remainder (3:1 is
    // 7.5:2.5) hand it to the earlier row, whose order follows Pinecone's
    // listIndexes and so differs between Pinecone Local images.
    await indexes.updateIndex(republic.index, { weight: 4 });

    const sources = await queryPineconeContext('What is justice?', 'plato');

    // Weights 4:1 split the 10 chunks 8:2.
    expect(sources.filter(({ index }) => index === republic.index)).toHaveLength(8);
    expect(sources.filter(({ index }) => index === meno.index)).toHaveLength(2);
    for (const source of sources) {
      const { path } = source.index === republic.index ? republic : meno;
      expect(source).toEqual({
        id: expect.stringMatching(new RegExp(`^${path.replace(/[.]/g, '\\.')}-\\d+$`)),
        index: source.index,
        text: expect.stringMatching(/^Paragraph \d+\. The unexamined life/),
        source: path,
        filename: path.split('/').pop()
      });
    }
  });

  it('deleteMany by ids removes those chunks from retrieval', async () => {
    const stale = Array.from({ length: republic.chunks - 4 }, (_, i) => `${republic.path}-${i}`);

    await (await getIndex(republic.index)).deleteMany({ ids: stale });

    await eventually(async () => expect(await recordCount(republic.index)).toBe(4));
    const sources = await queryPineconeContext('What is justice?', 'plato');
    // The republic index has 4 chunks left for its topK of 8.
    expect(sources.filter(({ index }) => index === republic.index).map(({ id }) => id).sort()).toEqual(
      Array.from({ length: 4 }, (_, i) => `${republic.path}-${republic.chunks - 4 + i}`).sort()
    );
  });

  it('IndexesService deletes the index from Pinecone and the table', async () => {
    for (const { index } of [republic, meno]) {
      await indexes.deleteIndex(index);
    }

    await eventually(async () => {
      const names = await pineconeIndexNames();
      expect(names).not.toContain(republic.index);
      expect(names).not.toContain(meno.index);
    });
    const rows = await indexes.getIndexes();
    expect(rows.map(({ name }) => name)).not.toContain(republic.index);
    expect(rows.map(({ name }) => name)).not.toContain(meno.index);
  });
});
