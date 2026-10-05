import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { isBusy, isThinking, messageReasoning, messageText } from './ui-message';

const user: UIMessage = { id: '1', role: 'user', parts: [{ type: 'text', text: 'What is virtue?' }] };
const reply = (parts: UIMessage['parts']): UIMessage => ({ id: '2', role: 'assistant', parts });

describe('messageText', () => {
  it('joins the text parts and ignores the others', () => {
    const message = reply([
      { type: 'step-start' },
      { type: 'reasoning', text: 'Think.' },
      { type: 'text', text: 'Know ' },
      { type: 'text', text: 'thyself.' },
    ]);
    expect(messageText(message)).toBe('Know thyself.');
  });

  it('is empty for a message without text', () => {
    expect(messageText(reply([{ type: 'step-start' }]))).toBe('');
  });
});

describe('messageReasoning', () => {
  it('joins the reasoning parts', () => {
    const message = reply([
      { type: 'reasoning', text: 'First.' },
      { type: 'text', text: 'Answer' },
      { type: 'reasoning', text: 'Second.' },
    ]);
    expect(messageReasoning(message)).toBe('First.\nSecond.');
  });

  it('is empty when there is no reasoning', () => {
    expect(messageReasoning(user)).toBe('');
  });
});

describe('isBusy', () => {
  it('is true while a request is in flight', () => {
    expect(isBusy('submitted')).toBe(true);
    expect(isBusy('streaming')).toBe(true);
    expect(isBusy('ready')).toBe(false);
    expect(isBusy('error')).toBe(false);
  });
});

describe('isThinking', () => {
  it('is true once submitted', () => {
    expect(isThinking('submitted', [user])).toBe(true);
  });

  it('stays true while streaming until the reply has text', () => {
    expect(isThinking('streaming', [user])).toBe(true);
    expect(isThinking('streaming', [user, reply([{ type: 'step-start' }])])).toBe(true);
    expect(isThinking('streaming', [user, reply([{ type: 'text', text: 'Know' }])])).toBe(false);
  });

  it('is false when ready or after an error', () => {
    expect(isThinking('ready', [user])).toBe(false);
    expect(isThinking('error', [user])).toBe(false);
  });
});
