import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="grid grid-cols-1 justify-items-center h-[calc(100vh-120px)] content-center">
      <SignUp path="/sign-up" />
    </div>
  );
}
