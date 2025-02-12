import { IndexesService } from '@/data/indexes.service';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const indexesService = new IndexesService();

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });
  return response.data[0].embedding;
}

export async function queryPineconeContext(question: string) {
  const activeIndexes = await indexesService.getActiveIndexes();
  const context: any[] = [];
  if (activeIndexes.length === 0) {
    return context;
  }

  const topK = activeIndexes.length > 1 ? 3 : 5;

  for (const index of activeIndexes) {
    const pineconeIndex = pinecone.Index(index.name);
    const embedding = await getEmbedding(question);

    const results = await pineconeIndex.query({
      vector: embedding,
      topK,
      includeMetadata: true
    });

    if (results.matches?.length) {
      context.push(...(results.matches.map((match) => match.metadata?.text) || []));
    }
  }
  return context;
}

export async function deleteIndex(indexName: string) {
  await pinecone.deleteIndex(indexName);
}
