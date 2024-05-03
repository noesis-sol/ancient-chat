'use client';

import { ancients } from '@/app/chat/ancients';
import Link from 'next/link';

export default function Chat() {
  return (
    <section className="mx-auto lg:max-w-6xl max-md:mb-16 ">
      <h1 className=" text-3xl md:text-5xl font-bold text-center m-12">Choose your philosopher!</h1>
      <div className="grid grid-cols-1 px-5 sm:grid-cols-2 md:grid-cols-3 gap-5 lg:grid-cols-4 justify-center justify-items-center">
        {ancients.map(({ name, image, year, isEnabled }) => {
          return (
            <div
              key={name}
              className="card max-sm:text-sm max-sm:card-side w-full max-sm:h-28 md:w-64 bg-base-100 shadow-xl"
            >
              <figure>
                <Link href={`/chat/${name}`}>
                  <img src={image} alt={name} className="object-fill max-sm:h-28 max-h-52 sm:max-h-full" />
                </Link>
              </figure>
              <div className="flex-1 max-sm:h-20 min-h-32">
                <div className="flex flex-col p-3 w-200px">
                  <h2 className=" card-title">{name}</h2>
                  <p>{year}</p>
                  <div className="card-actions">{isEnabled ? '' : <p className="text-red-500">Coming soon!</p>}</div>
                  {isEnabled ? (
                    <div className="text-right">
                      <Link href={`/chat/${name}`} className="btn btn-primary max-sm:h-8 max-sm:btn-ghost">
                        Chat now
                      </Link>
                    </div>
                  ) : (
                    ''
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
