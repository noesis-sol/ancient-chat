import { IndexesService } from '@/data/indexes.service';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export const PATCH = withAdmin(async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
    const { name } = await params;
    const { isActive } = await request.json();
    await indexesService.toggleIndex(name, isActive);
    return NextResponse.json({ success: true });
  });
