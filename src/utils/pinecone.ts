import { IndexesService } from '@/data/indexes.service';
import { allocateChunks } from '@/utils/chunk-allocation';
import { Pinecone, RecordMetadataValue } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

// Clients are created on first use: constructing them at module scope throws
// during `next build` when the API keys are unset.
let pinecone: Pinecone | undefined;
let openai: OpenAI | undefined;

function getPinecone() {
  return (pinecone ??= new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  }));
}

function getOpenAI() {
  return (openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
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

export async function queryPineconeContext(question: string): Promise<RecordMetadataValue[]> {
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
      getPinecone().Index(name).query({
        vector: embedding,
        topK,
        includeMetadata: true
      })
    )
  );

  return results.flatMap((result) => result.matches?.map((match) => match.metadata?.text ?? "") ?? []);
}

export async function deleteIndex(indexName: string) {
  await getPinecone().deleteIndex(indexName);
}
