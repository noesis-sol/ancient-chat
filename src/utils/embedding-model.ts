// Which embedding model an index's vectors come from. Queries have to be
// embedded with the same model, or they stop matching the documents.

/** The default EMBEDDING_MODEL, and the model of every index created before indexes were tagged with theirs. */
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002';

/** The Pinecone index tag the upload route records the embedding model in. */
export const EMBEDDING_MODEL_TAG = 'embedding_model';

/** The embedding model of a Pinecone index, from its tag. */
export function embeddingModelOf(index: { tags?: Record<string, string> }): string {
  return index.tags?.[EMBEDDING_MODEL_TAG] || DEFAULT_EMBEDDING_MODEL;
}

/** Vector sizes of OpenAI's embedding models, so a new index gets the right dimension without an API call. */
export const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-ada-002': 1536,
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
};
