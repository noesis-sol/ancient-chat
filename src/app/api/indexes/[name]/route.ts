import { getAuth } from '@clerk/nextjs/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;
  await pinecone.deleteIndex(name);
  return NextResponse.json({ success: true });
}
