import { PromptService } from '@/data/prompt.service';
import { queryPineconeContext } from '@/utils/pinecone';
import { openai } from '@ai-sdk/openai';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { CoreMessage, streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

const  getPrompt = async (userName: string, context: string) => {
  const service = new PromptService();
  const customPrompt = await service.getPrompt();

  return `${customPrompt.text}\n
    Answer in the first person to a person called ${userName}.
    
    Limit your answers to the context below.
    ----
    ${context}
    ----`;
};

export async function POST(request: NextRequest) {
  const { messages } = (await request.json()) as { messages: CoreMessage[] };
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await currentUser();

  try {
    const lastMessage = messages.findLast((m) => m.role === 'user');
    const context = await queryPineconeContext(lastMessage?.content.toString() ?? '');
    const content = await getPrompt(user?.firstName ?? '', context.join('\n'));

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content: content
        },
        ...messages,
      ]
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
