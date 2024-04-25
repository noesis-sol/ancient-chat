'use client';

import Message, {MessageProps} from "@/app/chat/[name]/message";
import {useRef, useState} from "react";
import {PaperAirplaneIcon} from "@heroicons/react/16/solid";
import {ancients} from "@/app/chat/ancients";

export default function ChatWith({params: {name}}: { params: { name: string } }) {
    const [messages, setMessages] = useState<MessageProps[]>([]);
    const inputRef = useRef(null);
    const ancient = ancients.find(ancient => ancient.name.toLowerCase() === name.toLowerCase()) ?? {
        name: 'Unknown',
        image: '/ancients/unknown.jpeg',
        year: 'Unknown'
    };
    return (
        <div className="flex h-[calc(100vh-120px)] antialiased text-gray-800">
            <div className="flex flex-row h-full w-full overflow-x-hidden">

                <div className="card card-compact w-64 max-h-96 m-6 bg-base-100 shadow-xl">
                    <figure><img src={ancient.image}
                                 alt={ancient.name}/></figure>
                    <div className="card-body">
                        <h2 className="card-title">{ancient.name}</h2>
                        <p>{ancient.year}</p>
                    </div>
                </div>
                <div className="flex flex-col flex-auto h-full pl-3 p-6">
                    <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-gray-100 h-full p-4">
                        <div className="flex flex-col h-full overflow-x-auto mb-4">
                            <div className="flex flex-col h-full">
                                <div className="grid grid-cols-12 gap-y-2">
                                    {messages.map(message => (
                                        <Message key={message.id} message={message.message}
                                                 direction={message.direction}/>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (inputRef.current?.value) {
                                setMessages([...messages, {
                                    id: Date.now().toString(),
                                    direction: 'outgoing',
                                    message: inputRef.current.value,
                                    user: 'me'
                                }])
                                inputRef.current.value = '';
                            }
                        }} className="flex flex-row items-center h-16 rounded-xl bg-white w-full px-4">

                            <div className="flex-grow">
                                <div className="relative w-full">
                                    <input
                                        ref={inputRef}

                                        type="text" placeholder="Type here"
                                        className="input input-bordered w-full "/>
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
