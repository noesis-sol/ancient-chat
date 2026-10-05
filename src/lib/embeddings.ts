import { embed, embedMany } from 'ai';
import { env } from '@/lib/env';
import { getOpenAI } from '@/lib/openai';
import { EMBEDDING_DIMENSIONS } from '@/utils/embedding-model';

// The one place text is embedded, at upload and at query time, so both use
// the same model (EMBEDDING_MODEL).

function embeddingModel() {
  return getOpenAI().embedding(env().EMBEDDING_MODEL);
}

/** Embeds a chat question, to query the indexes with. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel(), value: text });
  return embedding;
}

/**
 * Embeds document chunks for upload. Newlines become spaces, as LangChain's
 * OpenAIEmbeddings did when it embedded the existing indexes, so a re-upload
 * gives the same vectors.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts.map((text) => text.replace(/\n/g, ' ')),
  });
  return embeddings;
}

/** The vector size of EMBEDDING_MODEL, for creating an index. Unknown models are asked once. */
export async function embeddingDimension(): Promise<number> {
  return EMBEDDING_DIMENSIONS[env().EMBEDDING_MODEL] ?? (await embedQuery('dimension')).length;
}
