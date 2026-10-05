import { PromptService } from '@/data/prompt.service';
import { parseJsonBody, promptUpdateSchema, withJsonErrors } from '@/utils/admin-api';
import { withAdmin } from '@/utils/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

const promptService = new PromptService();

export const PUT = withAdmin(withJsonErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await parseJsonBody(request, promptUpdateSchema);
  if (!body.ok) return body.response;

  const prompt = await promptService.updatePrompt(id, { text: body.data.text });
  return NextResponse.json(prompt);
}));
