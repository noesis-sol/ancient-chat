import { getAuth } from '@clerk/nextjs/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Constructed per request: at module scope it throws during `next build` when PINECONE_API_KEY is unset.
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  const indexList = await pinecone.listIndexes();

  return NextResponse.json({
    indexes: indexList.indexes
  });
}