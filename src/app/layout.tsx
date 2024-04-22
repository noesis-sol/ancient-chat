import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import Navbar from "@/app/navbar";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
    title: "Talk with the Ancients",
    description: "A place to talk with the ancients",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={inter.className}>
        <Navbar/>
        {children}
        </body>
        </html>
    );
}
