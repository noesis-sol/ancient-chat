'use client';

import { adminEmails } from '@/utils/emails';
import { SignedIn, UserButton, useUser } from '@clerk/nextjs';
import { faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  const { user } = useUser();

  return (
    <header className='navbar bg-black text-white h-16 w-full'>
      <div className='flex flex-1 justify-between'>
        <Link href='/chat' className='btn btn-ghost text-xl'>
          <Image
            className='border-solid border-white rounded-full border-2'
            alt='AGRs logo'
            height={45}
            width={45}
            src='/logo.jpg'
          />
        </Link>
        <SignedIn>
          <UserButton>
            <UserButton.MenuItems>
              {user?.emailAddresses?.some((email) => adminEmails.includes(email.emailAddress)) && (
                <UserButton.Link href='/admin' label='Admin' labelIcon={<FontAwesomeIcon icon={faSliders} />} />
              )}
            </UserButton.MenuItems>
          </UserButton>
        </SignedIn>
      </div>
    </header>
  );
}
