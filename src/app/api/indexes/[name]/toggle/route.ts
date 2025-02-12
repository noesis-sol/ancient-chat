import { IndexesService } from '@/data/indexes.service';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  
    const { name } = await params;
    const { isActive } = await request.json();
    await indexesService.toggleIndex(name, isActive);
    return NextResponse.json({ success: true });
  }
  