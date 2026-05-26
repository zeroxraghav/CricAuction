"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Settings, Play, Users, Trash2, Copy, Check, BarChart3 } from "lucide-react";
import { useUser, useAuth } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  
  const [auctions, setAuctions] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState("");
  const [newAuctionSport, setNewAuctionSport] = useState<"CRICKET" | "VOLLEYBALL">("CRICKET");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string) => {
    const url = `${window.location.origin}/live/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchAuctions();
    }
  }, [isLoaded, isSignedIn]);

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setAuctions(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuctionName) return;
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newAuctionName, sport: newAuctionSport })
      });
      if (res.ok) {
        setNewAuctionName("");
        setNewAuctionSport("CRICKET");
        fetchAuctions();
      }
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this auction forever?")) return;
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchAuctions();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

  if (!isSignedIn) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-glow rounded-full blur-[100px] opacity-20 pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-10 md:p-16 rounded-3xl max-w-4xl w-full z-10">
          <div className="mx-auto w-20 h-20 bg-brand/20 rounded-full flex items-center justify-center mb-6">
            <Trophy className="w-10 h-10 text-brand" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Host Your Own <span className="text-brand">Cricket Auction</span></h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">Create an account to host real-time broadcast-style auctions for your friends.</p>
          <div className="text-xl font-bold text-brand animate-pulse">Sign in above to get started!</div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 text-white relative">
      <div className="max-w-6xl mx-auto z-10 relative">
        
        <header className="flex justify-between items-end border-b border-white/10 pb-6 mb-8 mt-12">
          <div>
            <h1 className="text-4xl font-black mb-2">My Auctions</h1>
            <p className="text-gray-400">Manage your hosted auctions</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create New Auction */}
          <div className="lg:col-span-1">
            <form onSubmit={handleCreate} className="glass-panel p-6 rounded-3xl border border-brand/30">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="text-brand"/> New Auction</h2>
              <input 
                type="text" required placeholder="Auction Name (e.g. IPL 2026)"
                value={newAuctionName} onChange={e => setNewAuctionName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none mb-4"
              />
              <div className="mb-4">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Sport</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAuctionSport("CRICKET")}
                    className={`py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
                      newAuctionSport === "CRICKET"
                        ? "bg-brand/20 text-brand border-brand/50 shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    🏏 Cricket
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAuctionSport("VOLLEYBALL")}
                    className={`py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
                      newAuctionSport === "VOLLEYBALL"
                        ? "bg-accent/20 text-accent border-accent/50 shadow-[0_0_10px_rgba(0,200,150,0.2)]"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
                    }`}
                  >
                    🏐 Volleyball
                  </button>
                </div>
              </div>
              <button type="submit" disabled={creating} className="w-full py-3 rounded-xl bg-brand text-black font-bold disabled:opacity-50 hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                {creating ? "Creating..." : "Create Auction"}
              </button>
            </form>
          </div>

          {/* List Auctions */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {loading ? (
              <div className="text-gray-500 p-8 text-center">Loading your auctions...</div>
            ) : auctions.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl text-gray-500 border border-dashed border-white/10">
                You haven't created any auctions yet. Create your first one on the left!
              </div>
            ) : (
              auctions.map(auction => (
                <div key={auction.id} className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border hover:border-white/20 transition-all">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-2xl font-bold text-white">{auction.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-widest border ${
                        auction.sport === 'VOLLEYBALL'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {auction.sport === 'VOLLEYBALL' ? '🏐 Volleyball' : '🏏 Cricket'}
                      </span>
                      {auction.status === 'ACTIVE' && (
                        <span className="bg-red-500/20 text-red-500 border border-red-500/50 px-2 py-0.5 rounded text-xs font-black uppercase tracking-widest animate-pulse">
                          LIVE
                        </span>
                      )}
                      {auction.status === 'COMPLETED' && (
                        <span className="bg-gray-500/20 text-gray-400 border border-gray-500/50 px-2 py-0.5 rounded text-xs font-black uppercase tracking-widest">
                          ENDED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Created: {new Date(auction.createdAt).toLocaleDateString()}</p>
                    <div className="mt-4 relative inline-block group">
                      <button 
                        onClick={() => copyToClipboard(auction.id)}
                        className="flex items-center gap-2 text-brand hover:text-brand/80 bg-brand/10 hover:bg-brand/20 px-4 py-2 rounded-full transition text-sm font-semibold border border-brand/20"
                      >
                        {copiedId === auction.id ? (
                          <><Check className="w-4 h-4" /> Copied spectator link!</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copy Spectator Link</>
                        )}
                      </button>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0d1220]/90 backdrop-blur-md text-gray-200 border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl scale-95 group-hover:scale-100 duration-200">
                        Share this link with spectators to view live stats & bids!
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {auction.status !== 'COMPLETED' && (
                      <Link href={`/host/${auction.id}/setup`} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 px-5 py-3 rounded-xl font-bold transition">
                        <Settings className="w-4 h-4" /> Setup
                      </Link>
                    )}
                    {auction.status === 'COMPLETED' ? (
                      <a href={`/live/${auction.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none flex items-center justify-center gap-2 border px-5 py-3 rounded-xl font-bold bg-accent/20 text-accent border-accent/50 hover:bg-accent/30 transition">
                        <BarChart3 className="w-4 h-4" /> View Stats
                      </a>
                    ) : (
                      <Link href={`/host/${auction.id}/live`} className={`flex-1 md:flex-none flex items-center justify-center gap-2 border px-5 py-3 rounded-xl font-bold transition ${auction.status === 'ACTIVE' ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-brand/20 text-brand hover:bg-brand/30 border-brand/50'}`}>
                        <Play className="w-4 h-4" /> {auction.status === 'ACTIVE' ? 'Resume Live' : 'Host Live'}
                      </Link>
                    )}
                    <button onClick={() => handleDelete(auction.id)} className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
