import type { ContextSource } from '@/utils/context-sources';
import { type ChatStatus, DefaultChatTransport, type HttpChatTransportInitOptions, type UIMessage } from 'ai';

// Chat messages as /api/chat streams them: a reply carries the chunks it was
// based on in a 'data-sources' part.
export type ChatUIMessage = UIMessage<unknown, { sources: ContextSource[] }>;

// The text a message shows in its chat bubble.
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

// The retrieved chunks a reply was based on, shown behind 'view source'.
export function messageSources(message: ChatUIMessage): ContextSource[] {
  return message.parts.flatMap((part) => (part.type === 'data-sources' ? part.data : []));
}

// The messages as sent back to /api/chat: only their text reaches the model,
// so the sources (about 10 KB per reply) are left out to keep the request
// under its size limit.
export function requestMessages(messages: ChatUIMessage[]): ChatUIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type === 'text'),
  }));
}

// useChat's transport to /api/chat, sending the messages without their sources.
export function createChatTransport(options: HttpChatTransportInitOptions<ChatUIMessage> = {}) {
  return new DefaultChatTransport<ChatUIMessage>({
    api: '/api/chat',
    ...options,
    prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
      body: { ...body, id, messages: requestMessages(messages), trigger, messageId },
    }),
  });
}

export function isBusy(status: ChatStatus): boolean {
  return status === 'submitted' || status === 'streaming';
}

// Show the dots until the reply's first text streams in. While streaming,
// the assistant message exists before any of its text has arrived.
export function isThinking(status: ChatStatus, messages: UIMessage[]): boolean {
  if (status === 'submitted') return true;
  if (status !== 'streaming') return false;
  const last = messages[messages.length - 1];
  return last?.role !== 'assistant' || messageText(last) === '';
}
