import { PromptService } from '@/data/prompt.service';
import { requireAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const { id } = await params;
  const {  text } = await request.json();
  const prompt = await promptService.updatePrompt(id, { text });
  return NextResponse.json(prompt);
}
