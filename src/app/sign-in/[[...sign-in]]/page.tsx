import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="grid grid-cols-1 justify-items-center h-[calc(100vh-120px)] content-center">
      <SignIn path="/sign-in" />
    </div>
  );
}
