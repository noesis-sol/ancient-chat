import { withAdmin } from '@/utils/adminAuth';
import { Pinecone } from '@pinecone-database/pinecone';
import { NextResponse } from 'next/server';

export const GET = withAdmin(async () => {
  // Constructed per request: at module scope it throws during `next build` when PINECONE_API_KEY is unset.
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  const indexList = await pinecone.listIndexes();

  return NextResponse.json({
    indexes: indexList.indexes
  });
});
