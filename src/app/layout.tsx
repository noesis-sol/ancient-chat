import Footer from '@/app/footer';
import Navbar from '@/app/navbar';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Talk with the Ancients',
  description: 'A place to talk with the ancients',
};

const lemonMilkFont = localFont({
  src: [
    { path: '../fonts/lemon-milk/LEMONMILK-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/lemon-milk/LEMONMILK-RegularItalic.otf', weight: '400', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Bold.otf', weight: '600', style: 'bold' },
    { path: '../fonts/lemon-milk/LEMONMILK-BoldItalic.otf', weight: '600', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Light.otf', weight: '300', style: 'light' },
    { path: '../fonts/lemon-milk/LEMONMILK-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Medium.otf', weight: '500', style: 'medium' },
    { path: '../fonts/lemon-milk/LEMONMILK-MediumItalic.otf', weight: '500', style: 'italic' },
  ],
  variable: '--font-lemon-milk',
});
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={lemonMilkFont.className}>
        <body>
          <div className="flex flex-col h-full w-full">
            <Navbar />
            <main className="flex-1 overflow-auto min-h-[calc(100dvh-120px)]">{children}</main>
            <Footer />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
