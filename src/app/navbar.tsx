import { SignedIn, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="navbar flex-none bg-black text-white h-16 w-full">
      <div className="flex flex-1 justify-between">
        <Link href="/chat" className="btn btn-ghost text-xl">
          <Image
            className="border-solid border border-white rounded-full border-2"
            alt="AGRs logo"
            height={45}
            width={45}
            src="https://yt3.googleusercontent.com/4eUXHkAB-XSqTDzKwvWHmQgZ2njUkqbqoXRIi9kHayq_ssr_8zqw5HMfDMQjSw-Fx8wXPLWAfbM=s176-c-k-c0x00ffffff-no-rj"
          />
        </Link>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
