import { PromptService } from '@/data/prompt.service';
import {
  chatStreamResponse,
  MAX_BODY_BYTES,
  parseChatRequest,
  readBodyWithLimit,
  sanitizeUserName,
} from '@/utils/chat-request';
import { queryPineconeContext } from '@/utils/pinecone';
import { openai } from '@ai-sdk/openai';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const promptService = new PromptService();

const  getPrompt = async (userName: string, context: string) => {
  const customPrompt = await promptService.getPrompt();
  const audience = userName ? `to a person called ${userName}` : 'to the person you are talking to';

  return `${customPrompt.text}\n
    Answer in the first person ${audience}.
    
    Limit your answers to the context below.
    ----
    ${context}
    ----`;
};

export async function POST(request: NextRequest) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (body === null) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }
  const chatRequest = parseChatRequest(body);
  if (!chatRequest.ok) {
    return NextResponse.json({ error: chatRequest.error }, { status: chatRequest.status });
  }

  try {
    const user = await currentUser();
    const context = await queryPineconeContext(chatRequest.lastUserMessage);
    const instructions = await getPrompt(sanitizeUserName(user?.firstName), context.join('\n'));

    return await chatStreamResponse({
      model: openai('gpt-4o-mini'),
      instructions,
      messages: chatRequest.messages,
      abortSignal: request.signal,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
