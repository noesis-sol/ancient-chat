import { cleanMetadata } from './index-upload';

/** Records per embeddings request and per upsert. */
export const BATCH_SIZE = 100;

/** Pinecone's limit on ids per deleteMany. */
const DELETE_BATCH_SIZE = 1000;

/**
 * Every record of a file stores how many chunks the file had, so the next
 * upload of that file knows which higher-numbered chunks are left over.
 */
export const CHUNK_COUNT_KEY = 'chunkCount';

/** A file's chunks are records `${path}-0` to `${path}-${count - 1}`. */
export const chunkId = (path: string, n: number): string => `${path}-${n}`;

/** The ids of chunks `from` to `to - 1` of a file; none when `to <= from`. */
export const chunkIds = (path: string, from: number, to: number): string[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => chunkId(path, from + i));

type Metadata = Record<string, string | number | boolean | string[]>;

/** The parts of a Pinecone index the upload uses. */
export interface ChunkIndex {
  fetch(options: { ids: string[] }): Promise<{ records: Record<string, { metadata?: Metadata } | undefined> }>;
  upsert(options: { records: { id: string; values: number[]; metadata: Metadata }[] }): Promise<void>;
  deleteMany(options: { ids: string[] }): Promise<void>;
}

export interface Chunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * How many chunks the file's last upload made: the count its first record
 * stores, or 0 when the file has none. Files uploaded before the count was
 * stored are counted by fetching their ids a batch at a time.
 */
export async function previousChunkCount(index: ChunkIndex, path: string): Promise<number> {
  const first = (await index.fetch({ ids: [chunkId(path, 0)] })).records[chunkId(path, 0)];
  if (!first) return 0;
  const stored = first.metadata?.[CHUNK_COUNT_KEY];
  if (typeof stored === 'number') return stored;

  let count = 1;
  for (;;) {
    const ids = chunkIds(path, count, count + BATCH_SIZE);
    const { records } = await index.fetch({ ids });
    const found = ids.filter((id) => records[id]).length;
    count += found;
    if (found < ids.length) return count;
  }
}

/**
 * Writes a file's chunks as records `${path}-n`, embedding each batch in one
 * request, then deletes the chunks an earlier, longer upload of the file left
 * behind, by their ids.
 */
export async function replaceFileChunks(
  index: ChunkIndex,
  path: string,
  chunks: Chunk[],
  embed: (texts: string[]) => Promise<number[][]>
): Promise<void> {
  const oldCount = await previousChunkCount(index, path);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embed(batch.map((chunk) => chunk.pageContent));
    await index.upsert({
      records: batch.map((chunk, j) => ({
        id: chunkId(path, i + j),
        values: embeddings[j],
        metadata: cleanMetadata({
          ...chunk.metadata,
          text: chunk.pageContent,
          [CHUNK_COUNT_KEY]: chunks.length
        })
      }))
    });
  }

  const stale = chunkIds(path, chunks.length, oldCount);
  for (let i = 0; i < stale.length; i += DELETE_BATCH_SIZE) {
    await index.deleteMany({ ids: stale.slice(i, i + DELETE_BATCH_SIZE) });
  }
}
