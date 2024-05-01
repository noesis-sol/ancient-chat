'use client';

import Message, {MessageProps} from "@/app/chat/[name]/message";
import {useRef, useState} from "react";
import {PaperAirplaneIcon} from "@heroicons/react/16/solid";
import {ancients} from "@/app/chat/ancients";
import {redirect} from "next/navigation";
import './style.css';

export default function ChatWith({params: {name}}: { params: { name: string } }) {
    const [messages, setMessages] = useState<MessageProps[]>([]);
    const inputRef = useRef(null);
    const ancient = ancients.find(ancient => ancient.name.toLowerCase() === name.toLowerCase()) ?? {
        name: 'Unknown',
        image: '/ancients/unknown.jpeg',
        year: 'Unknown',
        isEnabled: false
    };

    if (!ancient.isEnabled) {
        redirect('/chat');
    }

    const askAncient = async (question: MessageProps) => {
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                question: question.message,
                // messages.filter(message => message.direction === 'outgoing')
                // .map(message => message.message)
            })
        });

        const {response: data} = await response.json();

        const source = data.sourceDocuments?.map((doc: { pageContent: string }) => doc.pageContent);

        setMessages([...messages, question, {
            id: Date.now().toString(),
            direction: 'incoming',
            message: data.text,
            source,
            user: 'me'
        }]);
    }

    return (
        <div className="flex h-[calc(100vh-120px)] antialiased text-gray-800">
            <div className="flex flex-row h-full w-full overflow-x-hidden">
                <div
                    className="invisible w-0 md:w-64 md:m-6 md:visible card card-compact max-h-96 bg-base-100 shadow-xl flex-none">
                    <figure><img src={ancient.image}
                                 alt={ancient.name}/></figure>
                    <div className="card-body">
                        <h2 className="card-title">{ancient.name}</h2>
                        <p>{ancient.year}</p>
                    </div>
                </div>
                <div className="flex flex-col flex-auto h-full sm:p-6 md:pl-0 chat-box text-lg">
                    <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-gray-100 h-full p-4">
                        <div className="flex flex-col h-full overflow-x-auto mb-4">
                            <div className="flex flex-col-reverse h-full overflow-x-auto">
                                <div className="grid grid-cols-12 gap-y-2">
                                    {messages.map(message => (
                                        <Message key={message.id} message={message.message} source={message.source}
                                                 id={message.id}
                                                 direction={message.direction}/>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (inputRef.current != null && inputRef.current['value'] != null) {
                                const q = inputRef.current['value'];

                                const userMessage: MessageProps = {
                                    id: Date.now().toString(),
                                    direction: 'outgoing',
                                    message: inputRef.current['value'],
                                    user: 'me'
                                };

                                setMessages([...messages, userMessage]);

                                inputRef.current['value'] = '' as never;

                                await askAncient(userMessage);
                            }


                        }} className="flex flex-row items-center h-16 rounded-xl bg-white w-full p-4">

                            <div className="flex-grow">
                                <div className="relative w-full">
                                    <input
                                        ref={inputRef}
                                        type="text" placeholder="Type here"
                                        className="input input-bordered w-full"/>
                                </div>
                            </div>
                            <div className="ml-4">
                                <button
                                    className="btn btn-primary"
                                >
                                    <span>Send</span>
                                    <PaperAirplaneIcon className="h-5"></PaperAirplaneIcon>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
