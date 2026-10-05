import { PromptService } from '@/data/prompt.service';
import { withAdmin } from '@/utils/adminAuth';
import { NextResponse } from 'next/server';

const promptService = new PromptService();

export const GET = withAdmin(async () => {
  const prompt = await promptService.getPrompt();
  return NextResponse.json(prompt);
});
