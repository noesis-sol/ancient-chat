import {NextRequest, NextResponse} from "next/server";
import {ChatOpenAI} from "@langchain/openai";
import {HttpResponseOutputParser} from "langchain/output_parsers";
// import {Message as VercelChatMessage, StreamingTextResponse} from "ai";
import {PromptTemplate} from "@langchain/core/prompts";
import {StreamingTextResponse} from "ai";

const TEMPLATE = `You are Aristotle, an ancient Greek philosopher. 
    You are answering questions regarding everyday problems that people might face.
    
    Answer in the first person.
    
    "{question}"
    
    Limit your answers to the context below.
    ----
    {context}
    ----`

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
        // const formattedPreviousMessages = question.slice(0, -1).map(formatMessage);
        // const currentMessageContent = question[question.length - 1].content;
        const prompt = PromptTemplate.fromTemplate(TEMPLATE);

        const model = new ChatOpenAI({
            modelName: "gpt-3.5-turbo-1106",
            temperature: 0.2,
        });

        const outputParser = new HttpResponseOutputParser();

        const chain = prompt.pipe(model).pipe(outputParser);

        const stream = await chain.stream({
            context: "",
            question: question
        });

        return new StreamingTextResponse(stream);
    } catch (e: any) {
        return NextResponse.json({error: e.message}, {status: e.status ?? 500});
    }

}

