'use client';

import Message, {MessageProps} from "@/app/chat/[name]/message";
import {useRef, useState} from "react";

export default function ChatWith({params: {name}}: { params: { name: string } }) {
    const [messages, setMessages] = useState<MessageProps[]>([]);
    const inputRef = useRef(null);
    return (
        <div className="flex h-[calc(100vh-60px)] antialiased text-gray-800">
            <div className="flex flex-row h-full w-full overflow-x-hidden">
                <div className="flex flex-col py-6 pl-6 pr-2 w-64 bg-white flex-shrink-0">
                    <div className="flex flex-row items-center justify-center w-full">
                        <div className="flex flex-col items-center w-full rounded-lg">
                            <img className="rounded object-contain" src={`/ancients/${name}.jpeg`} alt={name}/>
                            <h2 className="text-xl font-semibold mt-4">{name}</h2>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col flex-auto h-full p-6">
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

                            <div className="flex-grow ml-4">
                                <div className="relative w-full">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="flex w-full border rounded-xl focus:outline-none focus:border-indigo-300 pl-4 h-10"
                                    />
                                </div>
                            </div>
                            <div className="ml-4">
                                <button
                                    className="flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white px-4 py-1 flex-shrink-0"
                                >
                                    <span>Send</span>
                                    <span className="ml-2">
                  <svg
                      className="w-4 h-4 transform rotate-45 -mt-px"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    ></path>
                  </svg>
                </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
