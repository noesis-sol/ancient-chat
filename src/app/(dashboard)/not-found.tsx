import ErrorState from '@/components/error-state';
import Link from 'next/link';

export default function NotFound() {
  return (
    <ErrorState
      code='404'
      title='Page not found'
      message='This page is lost to history. Perhaps one of the ancients can help you find your way.'
      action={
        <Link href='/chat' className='btn btn-primary'>
          Talk with the ancients
        </Link>
      }
    />
  );
}
