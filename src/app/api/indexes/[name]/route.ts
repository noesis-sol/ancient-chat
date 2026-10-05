import { IndexesService } from '@/data/indexes.service';
import { indexUpdateSchema, parseJsonBody, withJsonErrors } from '@/utils/admin-api';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export const DELETE = withAdmin(withJsonErrors(async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
  const { name } = await params;
  await indexesService.deleteIndex(name);
  return NextResponse.json({ success: true });
}));

// PUT /api/indexes/:name
export const PUT = withAdmin(withJsonErrors(async (request: NextRequest, { params }: { params: Promise<{ name: string }>}) => {
  const { name } = await params;
  const body = await parseJsonBody(request, indexUpdateSchema);
  if (!body.ok) return body.response;

  await indexesService.updateIndex(name, body.data);
  return NextResponse.json({ success: true });
}));
