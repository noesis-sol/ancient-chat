import { IndexesService } from '@/data/indexes.service';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export const DELETE = withAdmin(async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
  const { name } = await params;
  await indexesService.deleteIndex(name);
  return NextResponse.json({ success: true });
});

// PUT /api/indexes/:name
export const PUT = withAdmin(async (request: NextRequest, { params }: { params: Promise<{ name: string }>}) => {
  const { name } = await params;
  const updatedIndex = await request.json();

  await indexesService.updateIndex(name, updatedIndex);
  return NextResponse.json({ success: true });
});
