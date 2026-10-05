'use client';

import ErrorState from '@/components/error-state';
import { lemonMilkFont } from '@/utils/fonts';
import { useEffect } from 'react';
import './globals.css';

// Replaces the root layout when a layout itself throws, so it renders its own <html> and <body>.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang='en' className={lemonMilkFont.className}>
      <body>
        <ErrorState
          code='Oops'
          title='Something went wrong'
          message='The oracle is silent for a moment. Please try again.'
          digest={error.digest}
          action={
            <button className='btn btn-primary' onClick={() => window.location.reload()}>
              Try again
            </button>
          }
        />
      </body>
    </html>
  );
}
