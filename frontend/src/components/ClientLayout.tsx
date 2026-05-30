'use client';

import { usePathname } from 'next/navigation';
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { LayoutDashboard } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide header and padding on spectator live screens
  if (pathname.startsWith('/live/')) {
    return (
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10 px-3 py-3 md:px-6 md:py-4 flex items-center justify-between">
        {/* Left: Logo/Title */}
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center group-hover:bg-brand/30 transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </div>
            <span className="font-black tracking-widest uppercase text-white group-hover:text-brand transition">BidArena</span>
          </a>
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <div className="flex gap-4 items-center">
              <SignInButton />
              <SignUpButton />
            </div>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-3 md:gap-6">
              <a href="/dashboard" className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-white transition flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </a>
              <UserButton />
            </div>
          </Show>
        </div>
      </header>
      
      <div className="pt-[73px] flex-1 flex flex-col">
        {children}
      </div>
    </>
  );
}
