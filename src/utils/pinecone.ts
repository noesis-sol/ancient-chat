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

  const totalChunks = 10;

  let totalWeight = activeIndexes.reduce((acc, index) => acc + index.weight, 0);

  if(totalWeight === 0) {
    return totalWeight = 1;
  }

  for (const index of activeIndexes) {
    const pineconeIndex = pinecone.Index(index.name);
    const embedding = await getEmbedding(question);

    const weight = index.weight / totalWeight;
    const topK = Math.round(totalChunks * weight);

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
