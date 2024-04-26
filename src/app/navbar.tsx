import Link from "next/link";
import Image from "next/image";
import {SignedIn, UserButton} from "@clerk/nextjs";

export default function Navbar() {
    return (
        <header className="navbar fixed top-0 z-50 bg-black text-white">
            <div className='flex flex-1 justify-between'>
                <Link href='/chat' className="btn btn-ghost text-xl">
                    <Image className="border-solid border border-white" alt="AGRs logo" height={40} width={40}
                           src="https://yt3.googleusercontent.com/4eUXHkAB-XSqTDzKwvWHmQgZ2njUkqbqoXRIi9kHayq_ssr_8zqw5HMfDMQjSw-Fx8wXPLWAfbM=s176-c-k-c0x00ffffff-no-rj"
                    />
                </Link>
                <SignedIn>
                    <UserButton/>
                </SignedIn>
            </div>
        </header>
    );
}
