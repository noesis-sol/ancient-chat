import { withAdmin } from '@/utils/adminAuth';
import { NextResponse } from 'next/server';
import { getPinecone } from '@/lib/pinecone';

export const GET = withAdmin(async () => {
  const indexList = await getPinecone().listIndexes();

  return NextResponse.json({
    indexes: indexList.indexes
  });
});
