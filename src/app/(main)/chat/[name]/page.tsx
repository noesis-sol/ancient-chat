'use client';

import Message from '@/app/(main)/chat/[name]/message';
import { ancients } from '@/app/(main)/chat/ancients';
import { PaperAirplaneIcon } from '@heroicons/react/16/solid';
import { Message as AiMessage, useChat } from 'ai/react';
import { redirect } from 'next/navigation';
import React, { useEffect, useRef } from 'react';
import { chatFont } from '@/utils/fonts';

export default function ChatWith({ params }: { params: Promise<{ name: string }> }) {
  const { name } = React.use(params);

  const inputRef = useRef(null);
  const ancient = ancients.find((ancient) => ancient.name.toLowerCase() === name.toLowerCase()) ?? {
    name: 'Unknown',
    image: '/ancients/unknown.jpeg',
    year: 'Unknown',
    isEnabled: false
  };

  if (!ancient.isEnabled) {
    redirect('/chat');
  }

  useEffect(() => {
    if (inputRef.current != null && (inputRef.current as HTMLInputElement).scrollIntoView != null) {
      (inputRef.current as HTMLInputElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload } = useChat();

  const canSend = input.trim() !== '' && !isLoading;
  // Show the dots until the reply starts streaming in.
  const isThinking = isLoading && messages[messages.length - 1]?.role === 'user';

  const handleChatSubmit = (e: React.FormEvent) => {
    if (!canSend) {
      e.preventDefault();
      return;
    }
    handleSubmit(e);
  };

  return (
    <div className='flex flex-row h-full overflow-x-hidden w-full'>
      <div className='invisible w-0 md:w-64 md:m-6 md:visible card card-compact max-h-96 bg-base-100 shadow-xl flex-none'>
        <figure>
          <img src={ancient.image} alt={ancient.name} />
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
                {messages.map((message: AiMessage) => (
                  <Message
                    key={message.id}
                    message={message.content}
                    source={message.role === 'user' ? undefined : message.reasoning}
                    id={message.id}
                    direction={message.role === 'user' ? 'outgoing' : 'incoming'}
                    isLoading={false}
                  />
                ))}
                {isThinking ? <Message key='loading' message='...' direction='incoming' isLoading={true} /> : null}
                {error && !isLoading ? (
                  <div className='col-start-1 col-end-13'>
                    <div className='chat chat-start'>
                      <div role='alert' className='chat-bubble chat-bubble-error'>
                        Something went wrong while getting a reply.{' '}
                        <button type='button' className='btn btn-sm ml-2' onClick={() => reload()}>
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
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
                onChange={handleInputChange}
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
