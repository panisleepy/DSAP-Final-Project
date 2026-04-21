import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { NotificationCenter } from "@/components/common/NotificationCenter";
import { UserIdModal } from "@/components/common/UserIdModal";
import { ComposeProvider } from '@/components/post/ComposeProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "murmur — gentle social whispers",
  description:
    "murmur is a soft, real-time space for sharing whispers with friends. Post, like, and reply without disrupting your calm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-brandPink/10">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>
          <ComposeProvider>
            <NotificationCenter />
            <UserIdModal />
        {children}
          </ComposeProvider>
        </Providers>
      </body>
    </html>
  );
}
