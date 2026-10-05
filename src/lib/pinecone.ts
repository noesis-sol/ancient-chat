import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';

// One client per process, created on first use: reading env() at module scope
// throws during `next build` when PINECONE_API_KEY is unset.
let pinecone: Pinecone | undefined;

export function getPinecone(): Pinecone {
  return (pinecone ??= new Pinecone({ apiKey: env().PINECONE_API_KEY }));
}

export function getIndex(name: string) {
  return getPinecone().index({ name });
}
