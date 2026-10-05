import { IndexesService } from '@/data/indexes.service';
import { requireAdmin } from '@/utils/adminAuth';
import { parseIndexAncientBody } from '@/utils/index-ancient';
import { Prisma } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

// PATCH /api/indexes/:name/ancient with { ancient: <slug> | null }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 });
  }
  const parsed = parseIndexAncientBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name } = await params;
  try {
    await indexesService.setIndexAncient(name, parsed.ancient);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Index not found' }, { status: 404 });
    }
    throw error;
  }
  return NextResponse.json({ success: true });
}
