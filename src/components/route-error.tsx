'use client';

import ErrorState from '@/components/error-state';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // reset() alone only re-renders the client tree; refresh first so server
  // components (e.g. the admin page's index fetch) are fetched again.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <ErrorState
      code='Oops'
      title='Something went wrong'
      message='The oracle is silent for a moment. Please try again.'
      digest={error.digest}
      action={
        <button className='btn btn-primary' onClick={retry} disabled={isRetrying}>
          {isRetrying ? 'Retrying...' : 'Try again'}
        </button>
      }
    />
  );
}
