import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className='sm:h-full grid grid-cols-1 justify-items-center content-center'>
      <SignIn path='/sign-in' />
    </div>
  );
}
