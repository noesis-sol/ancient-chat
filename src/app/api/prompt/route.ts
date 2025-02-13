import { PromptService } from '@/data/prompt.service';
import { secureEndpoint } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export async function GET(request: NextRequest) {
  if (!secureEndpoint(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prompt = await promptService.getPrompt();
  return NextResponse.json(prompt);
}

