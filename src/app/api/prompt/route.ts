import { PromptService } from '@/data/prompt.service';
import { requireAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const prompt = await promptService.getPrompt();
  return NextResponse.json(prompt);
}

