'use client';

import ChatError from '@/app/(main)/chat/[name]/chat-error';
import Message from '@/app/(main)/chat/[name]/message';
import { findAncient } from '@/data/ancients';
import { PaperAirplaneIcon } from '@heroicons/react/16/solid';
import { createChatTransport, isBusy, isThinking, messageSources, messageText, type ChatUIMessage } from '@/utils/ui-message';
import { useChat } from '@ai-sdk/react';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatFont } from '@/utils/fonts';

export default function ChatWith({ params }: { params: Promise<{ name: string }> }) {
  const { name } = React.use(params);

  const inputRef = useRef(null);
  // The layout has already turned away unknown and disabled ancients.
  const ancient = findAncient(name)!;

  useEffect(() => {
    if (inputRef.current != null && (inputRef.current as HTMLInputElement).scrollIntoView != null) {
      (inputRef.current as HTMLInputElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const [input, setInput] = useState('');
  const transport = useMemo(
    () => createChatTransport({ api: `/api/chat?ancient=${encodeURIComponent(ancient.slug)}` }),
    [ancient.slug]
  );
  const { messages, sendMessage, status, error, regenerate } = useChat<ChatUIMessage>({ transport });

  const canSend = input.trim() !== '' && !isBusy(status);
  const showThinking = isThinking(status, messages);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) {
      return;
    }
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className='flex flex-row h-full overflow-x-hidden w-full'>
      <div className='invisible w-0 md:w-64 md:m-6 md:visible card card-compact max-h-96 bg-base-100 shadow-xl flex-none'>
        <figure>
          <Image src={ancient.image} alt={ancient.name} width={1024} height={1024} sizes='256px' />
        </figure>
        <div className='card-body'>
          <h2 className='card-title'>{ancient.name}</h2>
          <p>{ancient.year}</p>
        </div>
      </div>
      <div className={`grow flex-col h-full sm:p-6 md:pl-0 text-lg ${chatFont.className}`}>
        <div className='flex flex-col flex-auto shrink-0 sm:rounded-2xl h-full p-4 bg-base-200'>
          <div className='flex flex-col h-full overflow-x-auto mb-4'>
            <div className='flex flex-col-reverse h-full overflow-x-auto'>
              <div className='grid grid-cols-12 gap-y-2'>
                {messages
                  .filter((message) => messageText(message) !== '')
                  .map((message) => (
                    <Message
                      key={message.id}
                      message={messageText(message)}
                      sources={message.role === 'user' ? undefined : messageSources(message)}
                      direction={message.role === 'user' ? 'outgoing' : 'incoming'}
                      isLoading={false}
                    />
                  ))}
                {showThinking ? <Message key='loading' message='...' direction='incoming' isLoading={true} /> : null}
                {error ? <ChatError error={error} onRetry={() => regenerate()} /> : null}
              </div>
            </div>
          </div>
          <form onSubmit={handleChatSubmit} className='flex flex-row items-center h-16 rounded-xl w-full'>
            <div className='items-center grow'>
              <input
                ref={inputRef}
                type='text'
                placeholder='Type here'
                className='input input-bordered w-full text-lg'
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <div className='ml-2'>
              <button type='submit' className='btn btn-primary text-lg' disabled={!canSend}>
                <span>Send</span>
                <PaperAirplaneIcon className='h-5'></PaperAirplaneIcon>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
