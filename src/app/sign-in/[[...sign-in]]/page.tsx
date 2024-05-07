import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex-1 grid grid-cols-1 justify-items-center content-center">
      <SignIn path="/sign-in" />
    </div>
  );
}
