import { SqlMessageHistory } from '@/app/memories/sql.memory';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { NextRequest, NextResponse } from 'next/server';

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

interface PostParams {
  question: string;
  sessionId: string;
}

const getPrompt = (userName: string) => {
  const TEMPLATE = `You are Aristotle, an ancient Greek philosopher. 
    You are answering questions regarding everyday problems that people might face.
    Answer in the first person to a person called ${userName}.
    
    Limit your answers to the context below.
    ----
    {context}
    ----`;

  const USER_TEMPLATE = 'Question: {question}';

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate(USER_TEMPLATE),
  ];

  return ChatPromptTemplate.fromMessages(messages);
};

export async function POST(request: NextRequest) {
  const { question, sessionId } = (await request.json()) as PostParams;
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await currentUser();

  try {
    const vectorStore: PineconeStore = await PineconeStore.fromExistingIndex(new OpenAIEmbeddings(), { pineconeIndex });
    const prompt = getPrompt(user?.firstName ?? 'User');

    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo-1106',
      temperature: 0.2,
    });

    const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
      memory: await SqlMessageHistory.GetSqlMemory({ sessionId }),
      returnSourceDocuments: true,
      qaChainOptions: {
        prompt,
        type: 'stuff',
      },
    });

    const response = await chain.invoke({ question });
    return NextResponse.json({ response: response });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
