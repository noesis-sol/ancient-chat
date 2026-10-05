import { findAncient } from '@/data/ancients';
import { PromptService } from '@/data/prompt.service';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

// GET /api/prompt?ancient=<slug>. Disabled ancients are allowed, so an admin can
// write a prompt before enabling one.
export const GET = withAdmin(async (request: NextRequest) => {
  const ancient = findAncient(request.nextUrl.searchParams.get('ancient') ?? '');
  if (!ancient) {
    return NextResponse.json({ error: 'Unknown ancient' }, { status: 400 });
  }

  const prompt = await promptService.getPrompt(ancient);
  return NextResponse.json(prompt);
});
