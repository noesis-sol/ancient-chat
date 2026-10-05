import { Ancient, findEnabledAncient } from '@/data/ancients';
import { PromptService } from '@/data/prompt.service';
import { chatModel } from '@/lib/openai';
import { chatRateLimiters } from '@/lib/rate-limit';
import {
  chatStreamResponse,
  MAX_BODY_BYTES,
  parseChatRequest,
  readBodyWithLimit,
  sanitizeUserName,
} from '@/utils/chat-request';
import { queryPineconeContext } from '@/utils/pinecone';
import { checkRateLimits, rateLimitedResponse } from '@/utils/rate-limit';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const promptService = new PromptService();

const  getPrompt = async (ancient: Ancient, userName: string, context: string) => {
  const customPrompt = await promptService.getPrompt(ancient);
  const audience = userName ? `to a person called ${userName}` : 'to the person you are talking to';

  return `${customPrompt.text}\n
    Answer in the first person ${audience}.
    
    Limit your answers to the context below.
    ----
    ${context}
    ----`;
};

// POST /api/chat?ancient=<slug>
export async function POST(request: NextRequest) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Each request costs an embedding, Pinecone queries and a completion.
  const rateLimit = await checkRateLimits(chatRateLimiters(), userId);
  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfter);
  }

  // The chat page turns away disabled ancients too, but clients can call this route directly.
  const ancient = findEnabledAncient(request.nextUrl.searchParams.get('ancient') ?? '');
  if (!ancient) {
    return NextResponse.json({ error: 'Unknown ancient' }, { status: 404 });
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
    const sources = await queryPineconeContext(chatRequest.lastUserMessage, ancient.slug);
    const context = sources.map((source) => source.text).join('\n');
    const instructions = await getPrompt(ancient, sanitizeUserName(user?.firstName), context);

    return await chatStreamResponse({
      model: chatModel(),
      instructions,
      messages: chatRequest.messages,
      sources,
      abortSignal: request.signal,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
