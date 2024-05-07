import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex-1 grid grid-cols-1 justify-items-center content-center">
      <SignUp path="/sign-up" />
    </div>
  );
}
