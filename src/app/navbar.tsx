import Link from "next/link";
import {SignedIn, UserButton} from "@clerk/nextjs";

export default function Navbar() {
    return (
        <header className="navbar sticky top-0 z-50 bg-black text-white">
            <div className='flex flex-1 justify-between'>
                <Link href='/' className="btn btn-ghost text-xl">AGR</Link>
                <SignedIn>
                    <UserButton/>
                </SignedIn>
            </div>
        </header>
    );
}
