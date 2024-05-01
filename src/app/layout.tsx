import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import Navbar from "@/app/navbar";
import Footer from "@/app/footer";
import {ClerkProvider} from "@clerk/nextjs";
import localFont from 'next/font/local'

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
    title: "Talk with the Ancients",
    description: "A place to talk with the ancients",
};

const lemonMilkFont = localFont({

    src: [
        {path: '../fonts/lemon-milk/LEMONMILK-Regular.otf', weight: '400', style: 'normal'},
        {path: '../fonts/lemon-milk/LEMONMILK-RegularItalic.otf', weight: '400', style: 'italic'},
        {path: '../fonts/lemon-milk/LEMONMILK-Bold.otf', weight: '600', style: 'bold'},
        {path: '../fonts/lemon-milk/LEMONMILK-BoldItalic.otf', weight: '600', style: 'italic'},
        {path: '../fonts/lemon-milk/LEMONMILK-Light.otf', weight: '300', style: 'light'},
        {path: '../fonts/lemon-milk/LEMONMILK-LightItalic.otf', weight: '300', style: 'italic'},
        {path: '../fonts/lemon-milk/LEMONMILK-Medium.otf', weight: '500', style: 'medium'},
        {path: '../fonts/lemon-milk/LEMONMILK-MediumItalic.otf', weight: '500', style: 'italic'}],
    variable: '--font-lemon-milk',
})
export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en" className={lemonMilkFont.className}>
            <body>
            <Navbar/>
            <main className='pt-16 max-md:pb-16'>
                {children}
            </main>
            <Footer/>
            </body>
            </html>
        </ClerkProvider>
    );
}
