import { IndexesService } from '@/data/indexes.service';
import { indexToggleSchema, parseJsonBody, withJsonErrors } from '@/utils/admin-api';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const indexesService = new IndexesService();

export const PATCH = withAdmin(withJsonErrors(async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
    const { name } = await params;
    const body = await parseJsonBody(request, indexToggleSchema);
    if (!body.ok) return body.response;

    await indexesService.toggleIndex(name, body.data.isActive);
    return NextResponse.json({ success: true });
  }));
