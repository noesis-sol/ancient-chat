import Footer from '@/app/(main)/footer';
import Navbar from '@/app/(main)/navbar';
import { lemonMilkFont } from '@/utils/fonts';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import '.././globals.css';

export const metadata: Metadata = {
  title: 'Talk with the Ancients',
  description: 'A place to talk with the ancients'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang='en' className={lemonMilkFont.className}>
        <body>
          <div className='flex flex-col h-full w-full'>
            <Navbar />
            <main className='flex-1 overflow-auto min-h-[calc(100dvh-120px)] justify-items-center'>{children}</main>
            <Footer />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
