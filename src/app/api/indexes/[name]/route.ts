import { IndexesService } from '@/data/indexes.service';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;
  await indexesService.deleteIndex(name);
  return NextResponse.json({ success: true });
}

// PUT /api/indexes/:name
export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }>}) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;
  const updatedIndex = await request.json();

  await indexesService.updateIndex(name, updatedIndex);
  return NextResponse.json({ success: true });
}

