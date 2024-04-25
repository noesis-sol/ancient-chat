'use client';

import Link from "next/link";
import {ancients} from "@/app/chat/ancients";


export default function Chat() {
    return (
        <section className="max-w-4xl mx-auto h-[calc(100vh-120px)]">
            <div className="grid grid-cols-3 gap-5 py-5 justify-center pb-16 justify-items-center">
                {ancients.map(({name, image, year}) => {
                    return (<div key={name} className="card card-compact w-64 bg-base-100 shadow-xl">
                        <figure><img src={image} alt={name}
                                     className='object-fill'/>
                        </figure>
                        <div className="card-body">
                            <h2 className="card-title">{name}</h2>
                            <p>{year}</p>
                            <div className="card-actions justify-end">
                                <Link href={`/chat/${name}`} className="btn btn-primary">Chat</Link>
                            </div>
                        </div>
                    </div>)
                })}
            </div>
        </section>
    );
}
