"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents, Player } from "shared";
import { Shield, Trophy, IndianRupee, TrendingUp, X, SkipForward, Users, Clock, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import confetti from "canvas-confetti";

const fmt = (n: number) => `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L`;

interface BidEntry { teamId: string; teamName: string; amount: number }

export default function SpectatorView() {
  const params = useParams();
  const auctionId = params.id as string;
  const socket = useSocket();

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestTeamName, setHighestTeamName] = useState("");
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [timer, setTimer] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [status, setStatus] = useState<"IDLE" | "ACTIVE" | "PAUSED" | "EDITING">("IDLE");
  const [isDeleted, setIsDeleted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [auctionInfo, setAuctionInfo] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const [showUnsoldPopup, setShowUnsoldPopup] = useState(false);
  const [unsoldPlayers, setUnsoldPlayers] = useState<any[]>([]);


  // Sold popup
  const [soldPopup, setSoldPopup] = useState<{ playerName: string; playerPhoto?: string; teamName: string; amount: number } | null>(null);

  // View team popup
  const [viewingTeam, setViewingTeam] = useState<any | null>(null);
  const router = useRouter();

  const [playersLeft, setPlayersLeft] = useState(0);

  const fetchPlayersLeft = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/players/count`)
      .then(res => res.json())
      .then(data => {
        if (typeof data.count === 'number') {
           setPlayersLeft(data.count);
        }
      })
      .catch(() => {});
  };

  const fetchTeams = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/teams`)
      .then(res => res.json())
      .then(data => setTeams(data));
  };

  const fetchUnsoldPlayers = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/players`)
      .then(res => res.json())
      .then(data => {
        setUnsoldPlayers(data.filter((p: any) => p.status === 'UNSOLD'));
      });
  };

  useEffect(() => {
    fetchTeams();
    fetchPlayersLeft();
    // Fetch auction info to detect COMPLETED status
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}`)
      .then(res => res.json())
      .then(data => {
        setAuctionInfo(data);
        if (data.status === 'COMPLETED') {
          setIsEnded(true);
          // Fetch all players for results view
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/players`)
            .then(r => r.json())
            .then(players => setAllPlayers(players));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showUnsoldPopup) {
      fetchUnsoldPlayers();
    }
  }, [showUnsoldPopup]);

  useEffect(() => {
    if (!socket) return;

    socket.emit(SocketEvents.JOIN_AUCTION, auctionId);

    socket.on(SocketEvents.AUCTION_STATE_UPDATE, (state: any) => {
      setCurrentPlayer(state.currentPlayer);
      setCurrentBid(state.currentBid);
      setHighestTeamName(state.highestBiddingTeamName || "");
      setStatus(state.status);
      setBidHistory(state.bidHistory || []);
      fetchPlayersLeft();
    });

    socket.on(SocketEvents.BID_UPDATED, (bid: BidEntry) => {
      setCurrentBid(bid.amount);
      setHighestTeamName(bid.teamName);
      setBidHistory(prev => [bid, ...prev]);
    });

    socket.on(SocketEvents.TIMER_UPDATE, (time: number) => {
      setTimer(time);
    });

    socket.on(SocketEvents.PLAYER_SOLD, (info: any) => {
      setSoldPopup({
        playerName: info.playerName,
        playerPhoto: info.playerPhoto,
        teamName: info.teamName,
        amount: info.amount,
      });
      fetchTeams();
      fetchPlayersLeft();
      setTimeout(() => setSoldPopup(null), 5000);
      if (info.amount > 0) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    socket.on(SocketEvents.PLAYER_UNSOLD, (info: any) => {
      setSoldPopup({
        playerName: info.playerName,
        playerPhoto: info.playerPhoto,
        teamName: "UNSOLD",
        amount: 0,
      });
      fetchPlayersLeft();
      setTimeout(() => setSoldPopup(null), 5000);
    });

    socket.on(SocketEvents.AUCTION_DELETED, () => {
      setIsDeleted(true);
    });

    socket.on('VIEWERS_COUNT_UPDATE', (count: number) => {
      setViewersCount(count);
    });

    socket.on(SocketEvents.AUCTION_ENDED, () => {
      setIsEnded(true);
    });



    return () => {
      socket.off(SocketEvents.BID_UPDATED);
      socket.off(SocketEvents.TIMER_UPDATE);
      socket.off(SocketEvents.AUCTION_STATE_UPDATE);
      socket.off(SocketEvents.PLAYER_SOLD);
      socket.off(SocketEvents.PLAYER_UNSOLD);
      socket.off(SocketEvents.AUCTION_DELETED);
      socket.off('VIEWERS_COUNT_UPDATE');
      socket.off(SocketEvents.AUCTION_ENDED);

    };
  }, [socket, auctionId]);

  if (isDeleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="text-center">
          <h1 className="text-5xl font-black text-red-500 mb-4">Auction Deleted</h1>
          <p className="text-gray-400 text-lg mb-8">This live auction has been removed by the administrator.</p>
          <button onClick={() => router.push('/')} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-bold transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW (when auction is COMPLETED) ──
  if (auctionInfo?.status === 'COMPLETED') {
    const soldPlayers = allPlayers.filter(p => p.status === 'SOLD' || p.status === 'RETAINED').sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
    const unsold = allPlayers.filter(p => p.status === 'UNSOLD');
    const topBuys = soldPlayers.slice(0, 5);
    const teamsRanked = [...teams].sort((a, b) => (a.budget - a.remainingPurse) - (b.budget - b.remainingPurse)).reverse();

    return (
      <div className="min-h-screen bg-black text-white font-sans relative">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-brand-glow rounded-full blur-[150px] opacity-15 pointer-events-none" />

        {/* Header */}
        <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto flex justify-between items-center p-6">
            <div className="flex items-center gap-4">
              <Trophy className="w-10 h-10 text-brand" />
              <div>
                <h1 className="text-3xl font-black tracking-widest uppercase text-glow">{auctionInfo.name}</h1>
                <p className="text-sm text-gray-500">Concluded on {new Date(auctionInfo.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-gray-500/20 text-gray-400 border border-gray-500/50 px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-500" /> ENDED
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 space-y-8 relative z-10">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-black text-brand">{allPlayers.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Total Players</div>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-black text-green-400">{soldPlayers.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Sold</div>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-black text-red-400">{unsold.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Unsold</div>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-black text-white">{fmt(soldPlayers.reduce((s, p) => s + (p.soldPrice || 0), 0))}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Total Spent</div>
            </div>
          </div>

          {/* Top Buys */}
          {topBuys.length > 0 && (
            <section>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-brand" /> Top Buys</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {topBuys.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`glass-panel rounded-2xl p-5 border text-center relative overflow-hidden ${
                      i === 0 ? 'border-brand/50 shadow-[0_0_30px_rgba(212,175,55,0.2)]' : 'border-white/10'
                    }`}
                  >
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-yellow-300" />}
                    <div className="text-xs text-gray-500 font-bold mb-2">#{i + 1}</div>
                    {p.photoUrl ? (
                      <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-white/20" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white/30">{p.name.charAt(0)}</div>
                    )}
                    <div className="font-black text-lg">{p.name}</div>
                    <div className="text-xs text-gray-400 mb-2">{p.role}</div>
                    <div className={`font-mono font-black text-lg ${i === 0 ? 'text-brand' : 'text-white'}`}>
                      {p.status === 'RETAINED' ? <span className="bg-brand/20 text-brand px-2 py-1 rounded text-xs uppercase font-bold tracking-wider">Retained</span> : fmt(p.soldPrice)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{teams.find(t => t.id === p.teamId)?.name || 'N/A'}</div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Team Leaderboard */}
          <section>
            <h2 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-3"><Shield className="w-6 h-6 text-accent" /> Team Leaderboard</h2>
            <div className="space-y-3">
              {teamsRanked.map((team, i) => {
                const spent = team.budget - team.remainingPurse;
                const teamPlayers = soldPlayers.filter(p => p.teamId === team.id);
                const isExpanded = expandedTeamId === team.id;
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <button
                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                        className={`w-full glass-panel rounded-2xl p-4 md:p-5 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all cursor-pointer hover:bg-white/5 ${
                          i === 0 ? 'border-brand/30 bg-brand/5' : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xl md:text-2xl font-black text-gray-500 w-8">#{i + 1}</span>
                          <div className="text-left">
                            <div className="font-black text-base md:text-lg">{team.name}</div>
                            <div className="text-xs md:text-sm text-gray-400">{teamPlayers.length} players acquired</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end">
                          <div className="text-right">
                            <div className="font-mono font-black text-base md:text-lg text-white">{fmt(spent)}</div>
                            <div className="text-[10px] md:text-xs text-gray-500">spent of {fmt(team.budget)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-green-400">{fmt(team.remainingPurse)}</div>
                            <div className="text-[10px] md:text-xs text-gray-500">remaining</div>
                          </div>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </div>
                      </button>
                    <AnimatePresence>
                      {isExpanded && teamPlayers.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 ml-8 border-l-2 border-white/10">
                            {teamPlayers.map(p => (
                              <div key={p.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center gap-3">
                                {p.photoUrl ? (
                                  <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-white/20" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/40">{p.name.charAt(0)}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate">{p.name}</div>
                                  <div className="text-xs text-gray-500">{p.role}</div>
                                </div>
                                <div className="font-mono font-bold text-sm text-brand">
                                  {p.status === 'RETAINED' ? <span className="bg-brand/20 text-brand px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Retained</span> : fmt(p.soldPrice)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Unsold Players */}
          {unsold.length > 0 && (
            <section>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-3"><X className="w-6 h-6 text-red-500" /> Unsold Players</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unsold.map(p => (
                  <div key={p.id} className="bg-white/5 border border-red-500/20 p-4 rounded-xl flex items-center gap-4">
                    {p.photoUrl ? (
                      <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-white/20 opacity-60" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/30">{p.name.charAt(0)}</div>
                    )}
                    <div className="flex-1">
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm text-gray-500">{p.role} &bull; {p.age ? p.age + ' YRS' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 uppercase font-bold">Base</div>
                      <div className="font-mono font-bold text-sm text-red-400">{fmt(p.basePrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All Sold Players Table */}
          {soldPlayers.length > 0 && (
            <section>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-3"><BarChart3 className="w-6 h-6 text-brand" /> All Sold Players</h2>
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">#</th>
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">Player</th>
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">Role</th>
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">Team</th>
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">Base Price</th>
                        <th className="p-4 text-xs text-gray-500 uppercase tracking-widest font-bold">Sold Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {soldPlayers.map((p, i) => (
                        <tr key={p.id} className={`border-b border-white/5 hover:bg-white/5 transition ${i === 0 ? 'bg-brand/5' : ''}`}>
                          <td className="p-4 text-gray-500 font-bold">{i + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {p.photoUrl ? (
                                <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white/40">{p.name.charAt(0)}</div>
                              )}
                              <span className="font-bold">{p.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-gray-400 text-sm">{p.role}</td>
                          <td className="p-4 font-bold text-sm">{teams.find(t => t.id === p.teamId)?.name || 'N/A'}</td>
                          <td className="p-4 font-mono text-sm text-gray-400">{fmt(p.basePrice)}</td>
                          <td className={`p-4 font-mono font-bold ${i === 0 ? 'text-brand' : 'text-white'}`}>
                            {p.status === 'RETAINED' ? <span className="bg-brand/20 text-brand px-2 py-1 rounded text-xs uppercase font-bold tracking-wider">Retained</span> : fmt(p.soldPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black text-white font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-glow rounded-full blur-[150px] opacity-20 pointer-events-none" />

      {/* AUCTION ENDED POPUP */}
      <AnimatePresence>
        {isEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="text-center glass-panel p-16 rounded-3xl border-2 border-brand/50 shadow-[0_0_100px_rgba(212,175,55,0.3)] max-w-2xl w-full"
            >
              <Trophy className="w-32 h-32 mx-auto mb-8 text-brand animate-pulse" />
              <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-brand mb-4">Auction Ended</h1>
              <p className="text-gray-300 text-xl mb-12">All players have been auctioned. The event has concluded.</p>
              <button onClick={() => router.push('/')} className="bg-brand text-black px-10 py-4 rounded-2xl font-black text-xl transition hover:bg-yellow-400 shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOLD POPUP */}
      <AnimatePresence>
        {soldPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSoldPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="glass-panel rounded-3xl md:rounded-[3rem] p-6 md:p-16 max-w-2xl w-full text-center relative border-2 border-brand/50 shadow-[0_0_120px_rgba(212,175,55,0.4)]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSoldPopup(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white"><X className="w-7 h-7" /></button>
              
              {soldPopup.amount > 0 ? (
                <div className="flex flex-col md:flex-row items-center justify-center gap-10">
                  {soldPopup.playerPhoto ? (
                    <img referrerPolicy="no-referrer" src={soldPopup.playerPhoto} alt="" className="w-48 h-48 rounded-3xl object-cover border-4 border-brand/50 shadow-[0_0_40px_rgba(212,175,55,0.3)] shrink-0" />
                  ) : (
                    <div className="w-48 h-48 rounded-3xl bg-white/10 border-4 border-white/10 flex items-center justify-center text-7xl font-black text-white/20 shrink-0">{soldPopup.playerName.charAt(0)}</div>
                  )}
                  <div className="text-center md:text-left break-words min-w-0 flex-1">
                    <h2 className="text-5xl md:text-6xl font-black text-brand mb-4" style={{ textShadow: '0 0 30px rgba(212,175,55,0.5)' }}>SOLD!</h2>
                    <p className="text-3xl md:text-4xl font-bold text-white mb-3 break-words whitespace-normal">{soldPopup.playerName}</p>
                    <p className="text-xl md:text-2xl text-gray-300 mb-6">to <span className="text-accent font-black text-2xl md:text-3xl">{soldPopup.teamName}</span></p>
                    <div className="bg-brand/10 border border-brand/30 rounded-2xl py-4 px-8 inline-block">
                      <p className="text-4xl md:text-5xl font-black text-brand">{fmt(soldPopup.amount)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
                  {soldPopup.playerPhoto ? (
                    <img referrerPolicy="no-referrer" src={soldPopup.playerPhoto} alt="" className="w-32 h-32 md:w-48 md:h-48 rounded-3xl object-cover border-4 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.3)] shrink-0" />
                  ) : (
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-3xl bg-white/10 border-4 border-red-500/50 flex items-center justify-center text-5xl md:text-7xl font-black text-red-500/50 shrink-0">{soldPopup.playerName.charAt(0)}</div>
                  )}
                  <div className="text-center md:text-left break-words min-w-0 flex-1">
                    <h2 className="text-4xl md:text-6xl font-black text-red-500 mb-4 md:mb-6">UNSOLD</h2>
                    <p className="text-2xl md:text-4xl font-bold text-white break-words whitespace-normal">{soldPopup.playerName}</p>
                    <p className="text-gray-400 mt-4 text-xl">No bids were placed</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TEAM PLAYERS POPUP */}
      <AnimatePresence>
        {viewingTeam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setViewingTeam(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="glass-panel rounded-[2rem] p-10 max-w-3xl w-full relative border-2 border-accent/50 shadow-[0_0_80px_rgba(255,255,255,0.1)] flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setViewingTeam(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white"><X className="w-7 h-7" /></button>
              
              <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                <Shield className="w-12 h-12 text-accent" />
                <div>
                  <h2 className="text-4xl font-black text-white">{viewingTeam.name}</h2>
                  <p className="text-xl text-gray-400">Squad: {viewingTeam.players?.length || 0}/{viewingTeam.maxPlayers || 15} &bull; Purse: {fmt(viewingTeam.remainingPurse)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                {viewingTeam.players?.length > 0 ? (
                  viewingTeam.players.map((p: any) => (
                    <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4">
                      {p.photoUrl ? (
                        <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-14 h-14 rounded-full object-cover border border-white/20" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold text-white/50">{p.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="font-bold text-lg">{p.name}</div>
                        <div className="text-sm text-gray-400">{p.role} &bull; {p.status === 'RETAINED' ? <span className="bg-brand/20 text-brand px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Retained</span> : fmt(p.soldPrice || p.basePrice)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-10 text-gray-500 text-xl">No players in squad yet.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNSOLD PLAYERS POPUP */}
      <AnimatePresence>
        {showUnsoldPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowUnsoldPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="glass-panel rounded-[2rem] p-10 max-w-3xl w-full relative border-2 border-red-500/50 shadow-[0_0_80px_rgba(239,68,68,0.1)] flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowUnsoldPopup(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white"><X className="w-7 h-7" /></button>
              
              <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white">Unsold Players</h2>
                  <p className="text-gray-400">{unsoldPlayers.length} players currently unsold</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {unsoldPlayers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {unsoldPlayers.map((p: any) => (
                      <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4">
                        {p.photoUrl ? (
                          <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-white/20" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/50">{p.name.charAt(0)}</div>
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-lg">{p.name}</div>
                          <div className="text-sm text-gray-400">{p.role} &bull; {p.age ? p.age + ' YRS' : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Base Price</div>
                          <div className="font-mono font-bold text-white">{fmt(p.basePrice)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500 text-xl">No unsold players yet.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex justify-between items-center p-6 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <Trophy className="w-10 h-10 text-brand" />
          <h1 className="text-3xl font-black tracking-widest uppercase text-glow">LIVE AUCTION</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Users className="w-4 h-4" />
            <span className="font-bold">{viewersCount} <span className="font-normal opacity-70 hidden sm:inline">watching</span></span>
          </div>
          <div className="flex items-center gap-2 text-brand bg-brand/10 px-4 py-2 rounded-full border border-brand/20">
            <Trophy className="w-4 h-4" />
            <span className="font-bold">{playersLeft} <span className="font-normal opacity-70 hidden sm:inline">left</span></span>
          </div>
          <button 
            onClick={() => setShowUnsoldPopup(true)}
            className="flex items-center gap-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition cursor-pointer px-4 py-2 rounded-full border border-red-500/20"
          >
            <span className="font-bold hidden sm:inline">Unsold</span>
          </button>
          {status === "ACTIVE" && (
            <span className="text-lg text-gray-400 font-mono ml-4">{Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</span>
          )}
           <div className={`px-6 py-2 rounded-full border-2 font-bold uppercase flex items-center gap-2 ml-4 ${status === 'ACTIVE' ? 'border-red-500 bg-red-500/20 text-red-500 animate-pulse' : 'border-gray-600 bg-white/5 text-gray-500'}`}>
             <span className={`w-3 h-3 rounded-full ${status === 'ACTIVE' ? 'bg-red-500' : 'bg-gray-600'}`} /> 
             {isEnded ? 'ENDED' : (status === 'ACTIVE' ? 'LIVE' : status)}
           </div>
        </div>
      </header>

      {/* (NOT LIVE OVERLAY REMOVED AS REQUESTED) */}

      <main className="flex-1 flex flex-col xl:flex-row p-4 md:p-6 gap-6 z-10 min-h-[calc(100vh-100px)] xl:h-[calc(100vh-100px)] overflow-y-auto xl:overflow-hidden relative">
      {/* STATS MODAL (PAUSED) */}
      <AnimatePresence>
        {status === 'PAUSED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/95 backdrop-blur-md flex flex-col items-center justify-start p-4 lg:p-6"
          >
            <div className="w-full max-w-[95vw] h-full max-h-full flex flex-col pb-4">
              <div className="flex items-center gap-4 mb-6 shrink-0">
                {status === 'PAUSED' ? (
                  <>
                    <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
                    <h2 className="text-3xl font-black uppercase tracking-widest text-yellow-500">Auction Paused</h2>
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-8 h-8 text-brand" />
                    <h2 className="text-3xl font-black uppercase tracking-widest text-white">Live Leaderboard & Squads</h2>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
                {[...teams].sort((a, b) => b.budget - b.remainingPurse - (a.budget - a.remainingPurse)).map((team, i) => {
                  const spent = team.budget - team.remainingPurse;
                  return (
                    <div key={team.id} className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col gap-3 relative overflow-hidden h-full">
                      {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-brand shadow-[0_0_10px_rgba(212,175,55,1)]" />}
                      <div className="flex justify-between items-start shrink-0">
                        <div>
                          <div className="font-black text-xl leading-none text-white">{team.name}</div>
                          <div className="text-xs text-gray-400 mt-1">{team.players?.length || 0}/{team.maxPlayers || 15} Players</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Purse</div>
                          <div className="font-mono font-bold text-base text-green-400">{fmt(team.remainingPurse)}</div>
                        </div>
                      </div>
                      
                      {/* Players List */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-2 border-t border-white/10 pt-2">
                        {team.players && team.players.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {team.players.map((p: any) => (
                              <div key={p.id} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0">
                                <span className="truncate pr-2 text-gray-300">{p.name}</span>
                                <span className="font-mono text-brand whitespace-nowrap">
                                  {p.status === 'RETAINED' ? <span className="bg-brand/20 text-brand px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Retained</span> : fmt(p.soldPrice || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 text-center py-4 italic">No players yet</div>
                        )}
                      </div>
                      
                      <div className="shrink-0 border-t border-white/10 pt-3 flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Spent</span>
                        <span className="font-mono font-bold text-sm text-white">{fmt(spent)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Left: Player Presentation */}
        <div className="flex-1 flex flex-col justify-center items-center relative glass-panel rounded-[3rem] p-12 border border-white/10 overflow-hidden">
          
          <AnimatePresence mode="wait">
            {currentPlayer ? (
              <motion.div 
                key={currentPlayer.id}
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                transition={{ type: "spring", duration: 0.8 }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 lg:gap-8 mt-auto mb-auto">
                  {/* TOP ROW: Photo & Name */}
                  <div className="flex flex-col md:flex-row gap-6 lg:gap-8 w-full items-center md:items-stretch">
                    <div className="w-full md:w-[240px] lg:w-[280px] shrink-0 flex justify-center">
                      {currentPlayer.photoUrl ? (
                        <img referrerPolicy="no-referrer" src={currentPlayer.photoUrl} alt={currentPlayer.name} className="w-48 h-48 md:w-full md:h-[240px] lg:h-[280px] rounded-3xl object-cover border-4 border-brand/50 shadow-[0_0_30px_rgba(212,175,55,0.3)] bg-black/50" />
                      ) : (
                        <div className="w-48 h-48 md:w-full md:h-[240px] lg:h-[280px] rounded-3xl bg-white/10 border-4 border-white/10 flex items-center justify-center text-6xl md:text-7xl font-black text-white/20">{currentPlayer.name.charAt(0)}</div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left min-w-0">
                      <div className="text-lg md:text-2xl font-bold text-accent tracking-widest uppercase mb-2">{currentPlayer.role} &bull; {currentPlayer.age ? currentPlayer.age + ' YRS' : ''}</div>
                      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-none break-words" style={{ textShadow: '0 0 40px rgba(255,255,255,0.2)', wordSpacing: '0.25em' }}>
                        {currentPlayer.name}
                      </h2>
                    </div>
                  </div>

                  {/* BOTTOM ROW: Bids */}
                  <div className="flex flex-col md:flex-row gap-6 lg:gap-8 w-full relative">
                    {/* EDITING OVERLAY */}
                    {status === 'EDITING' && (
                      <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                        <div className="w-12 h-12 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin mb-4"></div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest text-center">
                          <span className="text-yellow-500">{highestTeamName}</span> is editing their bid...
                        </h3>
                        <p className="text-gray-400 mt-2">Please wait for the host to confirm.</p>
                      </div>
                    )}

                    <div className="w-full md:w-[240px] lg:w-[280px] shrink-0">
                      <div className={`w-full h-full p-4 lg:p-6 rounded-3xl border-2 flex flex-col items-center justify-center transition-colors duration-500 text-center ${currentBid > 0 ? 'bg-brand/20 border-brand/50 shadow-[0_0_50px_rgba(212,175,55,0.3)]' : 'bg-white/5 border-white/10'}`}>
                         <div className="text-sm lg:text-base text-gray-400 uppercase tracking-widest font-bold mb-1">Current Bid</div>
                         <div className={`text-4xl lg:text-5xl font-black ${currentBid > 0 ? 'text-brand' : 'text-gray-500'}`}>
                           {currentBid === 0 ? "WAITING" : fmt(currentBid)}
                         </div>
                         {highestTeamName && (
                           <div className="mt-3 text-sm lg:text-base font-bold text-white bg-black/50 px-4 py-1.5 rounded-full border border-white/20">
                             {highestTeamName} LEADS
                           </div>
                         )}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 lg:gap-6 min-w-0">
                       <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-3xl flex justify-between items-center">
                         <span className="text-sm lg:text-base text-gray-400 uppercase tracking-widest font-bold">Base Price</span>
                         <span className="text-xl lg:text-2xl font-bold text-white">{fmt(currentPlayer.basePrice)}</span>
                       </div>
                       <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-4 lg:p-5 flex flex-col items-center justify-center">
                         <div className="text-sm lg:text-base text-gray-400 uppercase tracking-widest font-bold mb-1">Total Bids</div>
                         <div className="text-5xl lg:text-6xl font-black text-white">{bidHistory.length}</div>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center h-full w-full mx-auto"
              >
                <div className="w-32 h-32 md:w-48 md:h-48 bg-white/5 rounded-[3rem] flex items-center justify-center mb-8 border border-white/10">
                  <Trophy className="w-16 h-16 md:w-20 md:h-20 text-gray-500" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-gray-400 uppercase tracking-widest mb-4 w-full">Waiting for next player...</h2>
                <p className="text-gray-500 text-lg md:text-xl max-w-md w-full">The host will begin bidding shortly</p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Sidebar */}
        <div className="w-full xl:w-[380px] flex flex-col gap-5 shrink-0 h-full pb-10 xl:pb-0">

          {/* Bid History */}
          <div className="glass-panel rounded-[2rem] p-4 flex-none h-[180px] flex flex-col overflow-hidden border border-white/10 shrink-0">
            <h3 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-3 text-brand">
              <TrendingUp className="w-5 h-5" /> Bid History
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {bidHistory.slice(0, 2).map((bid, i) => (
                <motion.div
                  key={i}
                  initial={i === 0 ? { opacity: 0, x: 30 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-xl flex justify-between items-center border ${i === 0 ? 'bg-brand/15 border-brand/40' : 'bg-white/5 border-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-5">#{bidHistory.length - i}</span>
                    <span className={`font-bold ${i === 0 ? 'text-brand' : 'text-gray-300'}`}>{bid.teamName}</span>
                  </div>
                  <span className={`font-mono font-bold ${i === 0 ? 'text-brand' : 'text-white/60'}`}>{fmt(bid.amount)}</span>
                </motion.div>
              ))}
              {bidHistory.length === 0 && (
                <div className="text-center text-gray-600 py-10 flex flex-col items-center gap-2">
                  <IndianRupee className="w-8 h-8 opacity-20" />
                  <span>Waiting for bids...</span>
                </div>
              )}
            </div>
          </div>

          {/* Franchise Purses */}
          <div className="glass-panel rounded-[2rem] p-4 flex-1 flex flex-col overflow-hidden border border-white/10">
            <h3 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-3 text-accent shrink-0">
              <Shield className="w-5 h-5" /> Franchise Purses
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar pb-2">
              {teams.map(team => (
                <button 
                  key={team.id} 
                  onClick={() => setViewingTeam(team)}
                  className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all cursor-pointer hover:bg-white/10 ${
                    highestTeamName === team.name 
                      ? 'bg-brand/10 border-brand/30' 
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div>
                    <span className="font-black text-base tracking-wide">{team.name}</span>
                    <span className="text-xs text-gray-500 ml-2 bg-black/50 px-2 py-0.5 rounded">{team.players?.length || 0} players</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-white">{fmt(team.remainingPurse)}</span>
                </button>
              ))}
              {teams.length === 0 && <div className="text-gray-500 text-center py-6">No teams found</div>}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
