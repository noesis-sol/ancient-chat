-- The embedding model of each index's vectors, synced from the index's
-- Pinecone tag. Every existing index was embedded with text-embedding-ada-002.

-- AlterTable
ALTER TABLE "Index" ADD COLUMN "embedding_model" TEXT NOT NULL DEFAULT 'text-embedding-ada-002';
