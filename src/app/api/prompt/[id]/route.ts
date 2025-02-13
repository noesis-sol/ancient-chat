import { PromptService } from '@/data/prompt.service';
import { secureEndpoint } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!secureEndpoint(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const {  text } = await request.json();
  const prompt = await promptService.updatePrompt(id, { text });
  return NextResponse.json(prompt);
}
