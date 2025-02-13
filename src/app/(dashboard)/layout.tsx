import { lemonMilkFont } from '@/utils/fonts';
import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import React from 'react';
import '.././globals.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang='en' className={lemonMilkFont.className}>
        <body>
          <div className='drawer lg:drawer-open'>
            <input id='menu-drawer' type='checkbox' className='drawer-toggle' />
            <div className='drawer-content flex flex-col max-h-screen overflow-y-auto flex-grow'>
              <label
                htmlFor='menu-drawer'
                aria-label='open sidebar'
                className='btn btn-square btn-ghost lg:hidden self-start'
              >
                <span className='material-icons'>menu</span>
              </label>
              <div className='sm:p-10 m bg-base-200 overflow-y-auto min-h-screen'>
                <div className='flex flex-col h-full w-full'>
                  <main className='flex-1 overflow-auto min-h-[calc(100dvh-120px)] justify-items-center'>
                    {children}
                  </main>
                </div>
              </div>
            </div>
            <div className='drawer-side min-h-full bg-base-300'>
              <label htmlFor='menu-drawer' aria-label='close sidebar' className='drawer-overlay'></label>
              <div className='p-5 text-5xl font-bold'>Admin</div>
              <div className='flex flex-col flex-grow justify-between'>
                <div>
                  <ul className='menu w-80 p-4 text-base-content space-y-1'>
                    <li>
                      <Link href='/admin'>Indexes</Link>
                    </li>
                    <li>
                      <Link href='/admin/prompt'>Prompt</Link>
                    </li>
                    <li>
                      <Link href='/chat'>Chat</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
