import { describe, expect, it, vi } from 'vitest';
import { BATCH_SIZE, chunkIds, CHUNK_COUNT_KEY, previousChunkCount, replaceFileChunks, type ChunkIndex } from './upload-chunks';

const path = 'plato/republic.txt';

type StoredRecord = { id: string; values: number[]; metadata: Record<string, string | number | boolean | string[]> };

// An index that keeps its records in a map, recording every call.
const fakeIndex = (records: StoredRecord[] = []) => {
  const stored = new Map(records.map((record) => [record.id, record]));
  const index = {
    stored,
    fetch: vi.fn(async ({ ids }: { ids: string[] }) => ({
      records: Object.fromEntries(ids.flatMap((id) => (stored.has(id) ? [[id, stored.get(id)!]] : [])))
    })),
    upsert: vi.fn(async ({ records }: { records: StoredRecord[] }) => {
      records.forEach((record) => stored.set(record.id, record));
    }),
    deleteMany: vi.fn(async ({ ids }: { ids: string[] }) => {
      ids.forEach((id) => stored.delete(id));
    })
  };
  return index satisfies ChunkIndex;
};

const chunks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ pageContent: `chunk ${i}`, metadata: { source: path } }));

const embed = vi.fn(async (texts: string[]) => texts.map((text) => [text.length]));

// Records of an upload made before chunk counts were stored.
const legacyRecords = (count: number): StoredRecord[] =>
  chunkIds(path, 0, count).map((id) => ({ id, values: [0], metadata: { source: path } }));

describe('chunkIds', () => {
  it('numbers the ids from `from` up to but not including `to`', () => {
    expect(chunkIds(path, 2, 4)).toEqual([`${path}-2`, `${path}-3`]);
  });

  it('is empty when `to` is not past `from`', () => {
    expect(chunkIds(path, 4, 4)).toEqual([]);
    expect(chunkIds(path, 5, 3)).toEqual([]);
  });
});

describe('replaceFileChunks', () => {
  it('embeds each batch in one request and upserts it', async () => {
    embed.mockClear();
    const index = fakeIndex();

    await replaceFileChunks(index, path, chunks(2 * BATCH_SIZE + 5), embed);

    expect(embed).toHaveBeenCalledTimes(3);
    expect(embed.mock.calls.map(([texts]) => texts.length)).toEqual([BATCH_SIZE, BATCH_SIZE, 5]);
    expect(index.upsert).toHaveBeenCalledTimes(3);
    expect(index.stored.size).toBe(2 * BATCH_SIZE + 5);
    expect(index.stored.get(`${path}-7`)).toEqual({
      id: `${path}-7`,
      values: ['chunk 7'.length],
      metadata: { source: path, text: 'chunk 7', [CHUNK_COUNT_KEY]: 2 * BATCH_SIZE + 5 }
    });
    expect(index.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the chunks a longer earlier upload left behind, by id', async () => {
    const index = fakeIndex();
    await replaceFileChunks(index, path, chunks(12), embed);

    await replaceFileChunks(index, path, chunks(4), embed);

    expect(index.deleteMany).toHaveBeenCalledOnce();
    expect(index.deleteMany).toHaveBeenCalledWith({ ids: chunkIds(path, 4, 12) });
    expect([...index.stored.keys()].sort()).toEqual(chunkIds(path, 0, 4).sort());
    expect(index.stored.get(`${path}-0`)?.metadata[CHUNK_COUNT_KEY]).toBe(4);
  });

  it('deletes nothing when the new upload has as many chunks or more', async () => {
    const index = fakeIndex();
    await replaceFileChunks(index, path, chunks(4), embed);

    await replaceFileChunks(index, path, chunks(6), embed);

    expect(index.deleteMany).not.toHaveBeenCalled();
    expect(index.stored.size).toBe(6);
  });

  it('deletes at most 1000 ids per request', async () => {
    const index = fakeIndex(
      chunkIds(path, 0, 2500).map((id) => ({ id, values: [0], metadata: { [CHUNK_COUNT_KEY]: 2500 } }))
    );

    await replaceFileChunks(index, path, chunks(1), embed);

    expect(index.deleteMany.mock.calls.map(([{ ids }]) => ids.length)).toEqual([1000, 1000, 499]);
    expect([...index.stored.keys()]).toEqual([`${path}-0`]);
  });

  it('deletes the stale chunks of an upload made before chunk counts were stored', async () => {
    const index = fakeIndex(legacyRecords(BATCH_SIZE + 30));

    await replaceFileChunks(index, path, chunks(3), embed);

    expect([...index.stored.keys()].sort()).toEqual(chunkIds(path, 0, 3).sort());
  });

  it('leaves other files alone', async () => {
    const other = { id: 'plato/laws.txt-5', values: [0], metadata: { [CHUNK_COUNT_KEY]: 6 } };
    const index = fakeIndex([other]);
    await replaceFileChunks(index, path, chunks(8), embed);

    await replaceFileChunks(index, path, chunks(2), embed);

    expect(index.stored.get(other.id)).toEqual(other);
  });
});

describe('previousChunkCount', () => {
  it('is 0 for a file not uploaded before', async () => {
    expect(await previousChunkCount(fakeIndex(), path)).toBe(0);
  });

  it('reads the count stored on the first chunk', async () => {
    const index = fakeIndex([{ id: `${path}-0`, values: [0], metadata: { [CHUNK_COUNT_KEY]: 40 } }]);

    expect(await previousChunkCount(index, path)).toBe(40);
    expect(index.fetch).toHaveBeenCalledOnce();
  });

  it.each([1, BATCH_SIZE, BATCH_SIZE + 1, 3 * BATCH_SIZE + 7])(
    'counts %i chunks of an upload made before counts were stored',
    async (count) => {
      expect(await previousChunkCount(fakeIndex(legacyRecords(count)), path)).toBe(count);
    }
  );
});
