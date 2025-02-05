import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });
  return response.data[0].embedding;
}

export async function queryPineconeContext(question: string) {
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  const embedding = await getEmbedding(question);

  const results = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true
  });

  return results.matches?.map((match) => match.metadata?.text) || [];
}
