'use client';

import Message, {MessageProps, uuidv4} from '@/app/chat/[name]/message';
import {ancients} from '@/app/chat/ancients';
import {PaperAirplaneIcon} from '@heroicons/react/16/solid';
import {redirect} from 'next/navigation';
import React, {useEffect, useRef, useState} from 'react';
import './style.css';

export default function ChatWith({params}: { params: Promise<{ name: string }> }) {
    const {name} = React.use(params);

    const [messages, setMessages] = useState<MessageProps[]>([]);
    const inputRef = useRef(null);
    const ancient = ancients.find((ancient) => ancient.name.toLowerCase() === name.toLowerCase()) ?? {
        name: 'Unknown',
        image: '/ancients/unknown.jpeg',
        year: 'Unknown',
        isEnabled: false,
    };

    if (!ancient.isEnabled) {
        redirect('/chat');
    }

    useEffect(() => {
        if (inputRef.current != null && (inputRef.current as HTMLInputElement).scrollIntoView != null) {
            (inputRef.current as HTMLInputElement).scrollIntoView({behavior: 'smooth'});
        }
    }, []);

    const askAncient = async (question: MessageProps) => {
        if (!question.message) {
            return;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                question: question.message,
                sessionId: uuidv4(),
            }),
        });

        const {response: data} = await response.json();

        const source = data.sourceDocuments?.map((doc: { pageContent: string }) => doc.pageContent);

        setMessages([
            ...messages,
            question,
            {
                id: uuidv4(),
                direction: 'incoming',
                message: data.text,
                source,
                user: 'me',
            }
        ]);
    };

    return (
        <div className="flex flex-row h-full overflow-x-hidden">
            <div
                className="invisible w-0 md:w-64 md:m-6 md:visible card card-compact max-h-96 bg-base-100 shadow-xl flex-none">
                <figure>
                    <img src={ancient.image} alt={ancient.name}/>
                </figure>
                <div className="card-body">
                    <h2 className="card-title">{ancient.name}</h2>
                    <p>{ancient.year}</p>
                </div>
            </div>
            <div className="grow flex-col h-full sm:p-6 md:pl-0 chat-box text-lg">
                <div className="flex flex-col flex-auto shrink-0 sm:rounded-2xl h-full p-4 bg-base-200">
                    <div className="flex flex-col h-full overflow-x-auto mb-4">
                        <div className="flex flex-col-reverse h-full overflow-x-auto">
                            <div className="grid grid-cols-12 gap-y-2">
                                {messages.map((message) => (
                                    <Message
                                        key={message.id}
                                        message={message.message}
                                        source={message.source}
                                        id={message.id}
                                        direction={message.direction}
                                        isLoading={message.isLoading}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();

                            const q = inputRef.current?.['value'];
                            if (q) {
                                const userMessage: MessageProps = {
                                    id: uuidv4(),
                                    direction: 'outgoing',
                                    message: q,
                                    user: 'me',
                                };

                                setMessages([
                                    ...messages,
                                    userMessage,
                                    {
                                        id: uuidv4(),
                                        direction: 'incoming',
                                        isLoading: true
                                    } as MessageProps,
                                ]);

                                inputRef.current && (inputRef.current['value'] = null as never);

                                await askAncient(userMessage);
                            }
                        }}
                        className="flex flex-row items-center h-16 rounded-xl w-full"
                    >
                        <div className="items-center grow">
                            <input ref={inputRef} type="text" placeholder="Type here"
                                   className="input input-bordered w-full"/>
                        </div>
                        <div className="ml-2">
                            <button className="btn btn-primary">
                                <span>Send</span>
                                <PaperAirplaneIcon className="h-5"></PaperAirplaneIcon>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
