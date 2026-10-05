import { IndexesService } from '@/data/indexes.service';
import { embedQuery } from '@/lib/embeddings';
import { env } from '@/lib/env';
import { getIndex } from '@/lib/pinecone';
import { allocateChunks } from '@/utils/chunk-allocation';
import { ContextSource, toContextSource } from '@/utils/context-sources';

const indexesService = new IndexesService();

// Retrieves context for the question from the ancient's active indexes.
// Indexes embedded with another model than EMBEDDING_MODEL are skipped: the
// question's vector would not match their documents.
export async function queryPineconeContext(question: string, ancient: string): Promise<ContextSource[]> {
  const embeddingModel = env().EMBEDDING_MODEL;
  const activeIndexes = (await indexesService.getActiveIndexes(ancient)).filter((index) => {
    if (index.embedding_model === embeddingModel) return true;
    console.warn(
      `Skipping index "${index.name}": embedded with ${index.embedding_model}, but EMBEDDING_MODEL is ${embeddingModel}`
    );
    return false;
  });
  const totalChunks = 10;

  const allocation = allocateChunks(activeIndexes.map((index) => index.weight), totalChunks);
  const queries = activeIndexes
    .map((index, i) => ({ name: index.name, topK: allocation[i] }))
    .filter(({ topK }) => topK > 0);

  if (queries.length === 0) {
    return [];
  }

  const embedding = await embedQuery(question);

  const results = await Promise.all(
    queries.map(async ({ name, topK }) =>
      (await getIndex(name)).query({
        vector: embedding,
        topK,
        includeMetadata: true
      })
    )
  );

  return results.flatMap((result, i) =>
    (result.matches ?? []).flatMap((match) => toContextSource(queries[i].name, match) ?? [])
  );
}
