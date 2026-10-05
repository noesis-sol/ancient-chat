'use client';

import { hasAdminRole } from '@/utils/admin-role';
import { Show, UserButton, useAuth, useUser } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';

export default function Navbar() {
  const { sessionClaims } = useAuth();
  const { user } = useUser();
  // Only decides whether to show the link; the admin pages and APIs check the role on the server.
  const isAdmin = hasAdminRole(sessionClaims?.metadata ?? user?.publicMetadata);

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
        <Show when='signed-in'>
          <UserButton>
            <UserButton.MenuItems>
              {isAdmin && (
                <UserButton.Link href='/admin' label='Admin' labelIcon={<SlidersHorizontal size={16} />} />
              )}
            </UserButton.MenuItems>
          </UserButton>
        </Show>
      </div>
    </header>
  );
}
