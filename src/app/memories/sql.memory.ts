import {BaseChatMessageHistory} from "@langchain/core/chat_history";
import {BaseMessage, StoredMessage} from "langchain/schema";
import {BufferMemory} from "langchain/memory";
import {mapStoredMessagesToChatMessages} from "@langchain/core/messages";
import {PrismaClient} from '@prisma/client'

export interface CustomChatMessageHistoryInput {
    sessionId: string;
}


export class SqlMessageHistory extends BaseChatMessageHistory {
    private readonly sessionId: string;
    private prisma = new PrismaClient()

    lc_namespace = ["langchain", "stores", "message"];

    private constructor(fields: CustomChatMessageHistoryInput) {
        super(fields);
        this.sessionId = fields.sessionId;
    }

    async getMessages(): Promise<BaseMessage[]> {
        const messages = await this.prisma.message.findMany({
            where: {
                sessionId: this.sessionId
            }
        });

        const storedMessages = messages.map(message => ({
            type: "message",
            data: {
                content: message.content,
                name: message.name,
                tool_call_id: message.tool_call_id,
                role: message.role,
            }
        } as StoredMessage));

        return mapStoredMessagesToChatMessages(storedMessages);

    }

    async addMessage(message: BaseMessage): Promise<void> {
        const storedMessage = message.toDict();

        await this.prisma.message.create({
            data: {
                sessionId: this.sessionId,
                content: storedMessage.data.content,
                name: storedMessage.data.name,
                role: storedMessage.data.role,
                tool_call_id: storedMessage.data.tool_call_id,
            }
        });
    }

    async addUserMessage(message: string): Promise<void> {
        await this.prisma.message.create({
            data: {
                sessionId: this.sessionId,
                content: message,
                name: "user",
                role: "user",
            }
        });
    }

    async addAIChatMessage(message: string): Promise<void> {
        await this.prisma.message.create({
            data: {
                sessionId: this.sessionId,
                content: message,
                name: "ai",
                role: "ai",
            }
        });
    }

    clear(): Promise<void> {
        return Promise.resolve();
    }

    static async GetSqlMemory(fields: CustomChatMessageHistoryInput): Promise<BufferMemory> {
        return new BufferMemory({
            chatHistory: new SqlMessageHistory(fields),
            returnMessages: true,
            inputKey: "question",
            outputKey: "text",
            memoryKey: "chat_history",
        });
    }
}
