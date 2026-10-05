import { IndexesService } from '@/data/indexes.service';
import { env } from '@/lib/env';
import { getIndex, getPinecone } from '@/lib/pinecone';
import { allocateChunks } from '@/utils/chunk-allocation';
import { ContextSource, toContextSource } from '@/utils/context-sources';
import { OpenAI } from 'openai';

// Created on first use: reading env() at module scope throws during
// `next build` when OPENAI_API_KEY is unset.
let openai: OpenAI | undefined;

function getOpenAI() {
  return (openai ??= new OpenAI({
    apiKey: env().OPENAI_API_KEY
  }));
}

const indexesService = new IndexesService();

async function getEmbedding(text: string) {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });
  return response.data[0].embedding;
}

export async function queryPineconeContext(question: string): Promise<ContextSource[]> {
  const activeIndexes = await indexesService.getActiveIndexes();
  const totalChunks = 10;

  const allocation = allocateChunks(activeIndexes.map((index) => index.weight), totalChunks);
  const queries = activeIndexes
    .map((index, i) => ({ name: index.name, topK: allocation[i] }))
    .filter(({ topK }) => topK > 0);

  if (queries.length === 0) {
    return [];
  }

  const embedding = await getEmbedding(question);

  const results = await Promise.all(
    queries.map(({ name, topK }) =>
      getIndex(name).query({
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

export async function deleteIndex(indexName: string) {
  await getPinecone().deleteIndex(indexName);
}
