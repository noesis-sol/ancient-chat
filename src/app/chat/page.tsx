'use client';

import Link from "next/link";
import {ancients} from "@/app/chat/ancients";


export default function Chat() {
    return (
        <section className="max-w-4xl mx-auto h-[calc(100vh-120px)]">
            <h1 className="text-5xl font-bold text-center m-12">Choose your philosopher!</h1>
            <div className="grid grid-cols-3 gap-5 py-5 justify-center pb-16 justify-items-center">
                {ancients.map(({name, image, year, isEnabled}) => {
                    return (<div key={name} className="card card-compact w-64 bg-base-100 shadow-xl">
                        <figure><img src={image} alt={name}
                                     className='object-fill'/>
                        </figure>
                        <div className="card-body">
                            <h2 className="card-title">{name}</h2>
                            <p>{year}</p>
                            <div className="card-actions justify-end">
                                {isEnabled ? <Link href={`/chat/${name}`} className="btn btn-primary">Chat now</Link> :
                                    <p className='text-red-500'>Coming soon!</p>}
                            </div>
                        </div>
                    </div>)
                })}
            </div>
        </section>
    );
}
