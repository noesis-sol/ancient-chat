'use client';

import Link from "next/link";
import {ancients} from "@/app/chat/ancients";


export default function Chat() {
    return (
        <section className="mx-auto pb-5 md:pb-20 lg:max-w-6xl ">
            <h1 className="text-3xl md:text-5xl font-bold text-center m-12">Choose your philosopher!</h1>
            <div
                className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 lg:grid-cols-4 justify-center justify-items-center">
                {ancients.map(({name, image, year, isEnabled}) => {
                    return (
                        <div key={name}
                             className="card max-sm:card-side w-full md:w-64 bg-base-100 shadow-xl">
                            <figure>
                                <Link href={`/chat/${name}`}>
                                    <img src={image} alt={name}
                                         className='object-fill max-h-52 sm:max-h-full'/>
                                </Link>
                            </figure>
                            <div className="card-body">
                                <h2 className="card-title">{name}</h2>
                                <p>{year}</p>
                                <div className="card-actions justify-start sm:justify-end">
                                    {isEnabled ?
                                        <Link href={`/chat/${name}`} className="btn btn-primary">Chat now</Link> :
                                        <p className='text-red-500'>Coming soon!</p>}
                                </div>
                            </div>
                        </div>)
                })}
            </div>
        </section>
    );
}
