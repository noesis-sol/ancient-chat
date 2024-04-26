import {NextRequest, NextResponse} from "next/server";
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
// import {Message as VercelChatMessage, StreamingTextResponse} from "ai";
import {Pinecone} from "@pinecone-database/pinecone";
import {PineconeStore} from "@langchain/pinecone";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {ConversationalRetrievalQAChain} from "langchain/chains";
import {BufferMemory} from "langchain/memory";

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

const TEMPLATE = `You are Aristotle, an ancient Greek philosopher. 
    You are answering questions regarding everyday problems that people might face.
    Answer in the first person.
    
    Limit your answers to the context below.
    ----
    {context}
    ----
    
    Question: {question}`

interface PostParams {
    question: string
    chatHistory: string[]
}

// const formatMessage = (message: VercelChatMessage) => {
//     return `${message.role}: ${message.content}`;
// };

export async function POST(request: NextRequest) {
    const {question, chatHistory} = (await request.json()) as PostParams;
    try {
        const vectorStore: PineconeStore = await PineconeStore.fromExistingIndex(
            new OpenAIEmbeddings(),
            {pineconeIndex}
        );
        const prompt = ChatPromptTemplate.fromTemplate(TEMPLATE);

        const model = new ChatOpenAI({
            modelName: "gpt-3.5-turbo-1106",
            temperature: 0.2,
        });

        const chain = ConversationalRetrievalQAChain.fromLLM(
            model,
            vectorStore.asRetriever(),
            {
                memory: new BufferMemory({
                    memoryKey: "chat_history", // Must be set to "chat_history"
                }),
                qaChainOptions: {
                    prompt,
                    type: "stuff",
                }
            },
        )
        const response = await chain.invoke({question});
        return NextResponse.json({response: response.text});
    } catch (e: any) {
        return NextResponse.json({error: e.message}, {status: e.status ?? 500});
    }

}

