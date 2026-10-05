import Link from 'next/link';
import React from 'react';

export default function ErrorState({
  code,
  title,
  message,
  digest,
  action
}: {
  code: string;
  title: string;
  message: string;
  digest?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className='hero h-full min-h-[60dvh]'>
      <div className='hero-content text-center'>
        <div className='max-w-md flex flex-col items-center gap-4'>
          <p className='text-7xl font-bold opacity-30'>{code}</p>
          <h1 className='text-3xl md:text-4xl font-bold'>{title}</h1>
          <p>{message}</p>
          {digest && <p className='text-xs opacity-50'>Reference: {digest}</p>}
          <div className='flex flex-wrap justify-center gap-3'>
            {action}
            <Link href='/' className='btn btn-ghost'>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
