import { PromptService } from '@/data/prompt.service';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export const PUT = withAdmin(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const {  text } = await request.json();
  const prompt = await promptService.updatePrompt(id, { text });
  return NextResponse.json(prompt);
});
