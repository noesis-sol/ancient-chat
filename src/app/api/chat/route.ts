import {NextRequest, NextResponse} from "next/server";
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {Pinecone} from "@pinecone-database/pinecone";
import {PineconeStore} from "@langchain/pinecone";
import {ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate} from "@langchain/core/prompts";
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
    ----`

const USER_TEMPLATE = "Question: {question}"

const messages = [
    SystemMessagePromptTemplate.fromTemplate(TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate(USER_TEMPLATE)
];

interface PostParams {
    question: string
}

export async function POST(request: NextRequest) {
    const {question} = (await request.json()) as PostParams;
    try {
        const vectorStore: PineconeStore = await PineconeStore.fromExistingIndex(
            new OpenAIEmbeddings(),
            {pineconeIndex}
        );
        const prompt = ChatPromptTemplate.fromMessages(messages);

        const model = new ChatOpenAI({
            modelName: "gpt-3.5-turbo-1106",
            temperature: 0.2,
        });

        const bufferMemory = new BufferMemory({
            memoryKey: "chat_history", // Must be set to "chat_history"
            inputKey: 'question',
            outputKey: 'text',
            returnMessages: true,
        })

        const chain = ConversationalRetrievalQAChain.fromLLM(
            model,
            vectorStore.asRetriever(),
            {
                memory: bufferMemory,
                returnSourceDocuments: true,
                qaChainOptions: {
                    prompt,
                    type: "stuff",
                }
            },
        )
        const response = await chain.invoke({question});

        return NextResponse.json({response: response});
    } catch (e: any) {
        return NextResponse.json({error: e.message}, {status: e.status ?? 500});
    }

}

