"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, ArrowRight, Shield, Zap, Users } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0f1a] text-white font-sans px-4">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-glow rounded-full blur-[150px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-glow rounded-full blur-[120px] opacity-10 pointer-events-none" />
      
      <div className="z-10 text-center max-w-5xl mx-auto flex flex-col items-center">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.8, type: "spring" }}
          className="w-24 h-24 bg-brand/20 rounded-full flex items-center justify-center mb-8 border border-brand/40 shadow-[0_0_30px_rgba(212,175,55,0.3)]"
        >
          <Trophy className="w-12 h-12 text-brand" />
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-6xl md:text-8xl font-black uppercase tracking-tight mb-6 text-glow leading-tight"
        >
          The Ultimate <br/><span className="text-brand">Cricket Auction</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-12"
        >
          Host professional, broadcast-quality IPL-style auctions with real-time syncing, dynamic team wallets, and a stunning spectator view.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-6"
        >
          {isSignedIn ? (
            <Link 
              href="/dashboard" 
              className="bg-brand text-black font-black uppercase tracking-widest px-10 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-yellow-400 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:scale-105"
            >
              Create an Auction <ArrowRight className="w-6 h-6" />
            </Link>
          ) : (
            <div className="bg-white/5 border border-white/10 px-10 py-4 rounded-2xl flex items-center justify-center text-lg text-gray-300 backdrop-blur-sm">
              Sign in above to get started
            </div>
          )}
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 1, duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full max-w-5xl"
        >
          <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center">
            <Zap className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Real-Time Sockets</h3>
            <p className="text-gray-500 text-sm">Lightning-fast bid updates synchronized across all host and spectator screens instantly.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center">
            <Shield className="w-8 h-8 text-accent mb-4" />
            <h3 className="text-xl font-bold mb-2">Smart Purses</h3>
            <p className="text-gray-500 text-sm">Automated budget calculations and constraints prevent invalid bids and enforce rules.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center">
            <Users className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Spectator Mode</h3>
            <p className="text-gray-500 text-sm">Share a public link so anyone can watch the auction unfold live with a premium dashboard.</p>
          </div>
        </motion.div>

      </div>
    </main>
  );
}
