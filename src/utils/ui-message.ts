import type { ChatStatus, UIMessage } from 'ai';

// The text a message shows in its chat bubble.
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

// The reasoning parts of a reply, shown behind 'view source'.
export function messageReasoning(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n');
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
