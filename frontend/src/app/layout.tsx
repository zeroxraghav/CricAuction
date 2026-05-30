import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "BidArena",
  description: "Premium Sports Auction Platform",
};

import { LayoutDashboard } from "lucide-react";
import { ClientLayout } from "@/components/ClientLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster 
          position="top-right" 
          toastOptions={{
            className: '!bg-white/10 !backdrop-blur-md !text-white !border !border-white/20',
            success: { iconTheme: { primary: '#d4af37', secondary: 'black' } }
          }}
        />
        <ClerkProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ClerkProvider>
      </body>
    </html>
  );
}
