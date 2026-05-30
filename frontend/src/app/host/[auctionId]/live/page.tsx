"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents, Player } from "shared";
import { Shield, Trophy, IndianRupee, TrendingUp, X, SkipForward, Users, Copy, Check, RotateCcw, BarChart3, Clock } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import confetti from "canvas-confetti";

const fmt = (n: number) => `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L`;

interface BidEntry { teamId: string; teamName: string; amount: number }

export default function HostLiveView() {
  const params = useParams();
  const auctionId = params.auctionId as string;
  const socket = useSocket();

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestTeamName, setHighestTeamName] = useState("");
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [timer, setTimer] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [status, setStatus] = useState<"IDLE" | "ACTIVE" | "PAUSED" | "EDITING">("IDLE");
  const [isDeleted, setIsDeleted] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const [showUnsoldPopup, setShowUnsoldPopup] = useState(false);
  const [unsoldPlayers, setUnsoldPlayers] = useState<any[]>([]);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

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


  const [bidAmount, setBidAmount] = useState<number | "">("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const copyLink = () => {
    const url = `${window.location.origin}/live/${auctionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sold popup
  const [soldPopup, setSoldPopup] = useState<{ playerName: string; playerPhoto?: string; teamName: string; amount: number } | null>(null);

  // View team popup
  const [viewingTeam, setViewingTeam] = useState<any | null>(null);
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedTeamPurse = selectedTeam ? selectedTeam.remainingPurse : 0;
  const isTeamFull = selectedTeam ? ((selectedTeam.players?.length || 0) >= (selectedTeam.maxPlayers || 15)) : false;
  
  const ABSOLUTE_MAX_BID = 10000000000; // 1000 Cr
  const parsedBidAmount = (Number(bidAmount) || 0) * 100000;
  const isBidExceeding = (selectedTeamId && bidAmount !== "" && parsedBidAmount > selectedTeamPurse) || (bidAmount !== "" && parsedBidAmount > ABSOLUTE_MAX_BID);

  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || bidAmount === "" || !currentPlayer || isBidExceeding || isTeamFull) return;

    socket?.emit(SocketEvents.PLACE_BID, {
      auctionId,
      playerId: currentPlayer.id,
      teamId: selectedTeam!.id,
      teamName: selectedTeam!.name,
      amount: parsedBidAmount,
    });
  };

  const handleQuickIncrement = (inc: number) => {
    const baseValue = Number(bidAmount) || 0;
    setBidAmount(baseValue + inc);
  };

  useEffect(() => {
    if (status === 'ACTIVE' && currentPlayer) {
      if (currentBid === 0) {
        setBidAmount(currentPlayer.basePrice / 100000);
      } else {
        setBidAmount(currentBid / 100000);
      }
    }
  }, [status, currentBid, currentPlayer]);

  useEffect(() => {
    // Auth check
    if (isLoaded && !userId) {
      router.push("/");
    }
  }, [isLoaded, userId, router]);

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
  }, []);

  useEffect(() => {
    if (showUnsoldPopup) {
      fetchUnsoldPlayers();
    }
  }, [showUnsoldPopup]);

  useEffect(() => {
    if (status === 'EDITING' && bidHistory.length > 0) {
      const latestBid = bidHistory[0];
      setSelectedTeamId(latestBid.teamId);
      setBidAmount(latestBid.amount / 100000);
    }
  }, [status, bidHistory]);

  useEffect(() => {
    // Automatically pre-select the 2nd last bidder to make bidding faster
    if (status !== 'EDITING') {
      if (bidHistory.length >= 2) {
        setSelectedTeamId(bidHistory[1].teamId);
      } else {
        setSelectedTeamId("");
      }
    }
  }, [bidHistory, status]);

  useEffect(() => {
    if (!socket) return;

    socket.emit(SocketEvents.JOIN_AUCTION, { auctionId, isHost: true });

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

    socket.on(SocketEvents.ERROR, (err: any) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(""), 3000);
    });

    socket.on(SocketEvents.NO_PLAYERS_LEFT, () => {
      setShowEndPrompt(true);
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
      socket.off(SocketEvents.ERROR);
      socket.off(SocketEvents.NO_PLAYERS_LEFT);
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
              <p className="text-gray-300 text-xl mb-12">All players have been auctioned. Thank you for hosting!</p>
              <button onClick={() => router.push('/')} className="bg-brand text-black px-10 py-4 rounded-2xl font-black text-xl transition hover:bg-yellow-400 shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                Return to Dashboard
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
                  <div className="text-center md:text-left">
                    <h2 className="text-5xl md:text-6xl font-black text-brand mb-4" style={{ textShadow: '0 0 30px rgba(212,175,55,0.5)' }}>SOLD!</h2>
                    <p className="text-3xl md:text-4xl font-bold text-white mb-3">{soldPopup.playerName}</p>
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
                  <div className="text-center md:text-left break-words min-w-0">
                    <h2 className="text-4xl md:text-6xl font-black text-red-500 mb-4 md:mb-6">UNSOLD</h2>
                    <p className="text-2xl md:text-4xl font-bold text-white break-words">{soldPopup.playerName}</p>
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
                          <div className="text-sm text-gray-400">{p.role}{p.age && p.age !== 'N/A' && p.age !== '0' ? ' • ' + p.age + ' YRS' : ''}</div>
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
          <button onClick={() => router.push(`/host/${auctionId}/setup`)} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400"><X /></button>
          <Trophy className="w-10 h-10 text-brand" />
          <h1 className="text-3xl font-black tracking-widest uppercase text-glow">HOST CONTROL</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* HOST CONTROLS */}
          <div className="flex gap-2">
             <button 
               onClick={() => {
                 if (confirm("Are you sure you want to end this auction?")) {
                   socket?.emit(SocketEvents.END_AUCTION, { auctionId });
                 }
               }}
               className="relative group bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
             >
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">End Auction</span>
               END AUCTION
             </button>
             <button disabled={!!currentPlayer} onClick={() => socket?.emit(SocketEvents.NEXT_PLAYER, { auctionId })} className="relative group bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Next Player</span>
               <SkipForward className="w-5 h-5"/> Next
             </button>
             {status !== 'IDLE' && (
               status === 'ACTIVE' ? (
                 <button onClick={() => socket?.emit(SocketEvents.PAUSE_AUCTION, { auctionId })} className="relative group bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                   <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Pause Auction</span>
                   PAUSE
                 </button>
               ) : (
                 <button onClick={() => socket?.emit(SocketEvents.RESUME_AUCTION, { auctionId })} className="relative group bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                   <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Resume Auction</span>
                   RESUME
                 </button>
               )
             )}
             <button onClick={() => socket?.emit(SocketEvents.PLAYER_SOLD, { auctionId })} className="relative group bg-brand text-black hover:bg-yellow-400 px-6 py-2 rounded-lg font-black tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.4)]">
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Sell Player</span>
               SELL
             </button>
          </div>
          <div className="flex gap-2 ml-4 border-l border-white/20 pl-4 hidden md:flex">
             <button 
               onClick={() => socket?.emit(SocketEvents.REVERT_LAST_PLAYER, { auctionId })}
               disabled={status !== 'IDLE'} 
               className="relative group bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
             >
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Undo Last Player (Sold/Unsold)</span>
               Revert Player
             </button>
          </div>

          {status === "ACTIVE" && (
            <span className="text-lg text-gray-400 font-mono ml-4">{Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</span>
          )}
           <div className={`px-6 py-2 rounded-full border-2 font-bold uppercase flex items-center gap-2 ml-4 ${status === 'ACTIVE' ? 'border-red-500 bg-red-500/20 text-red-500 animate-pulse' : 'border-gray-600 bg-white/5 text-gray-500'}`}>
             <span className={`w-3 h-3 rounded-full ${status === 'ACTIVE' ? 'bg-red-500' : 'bg-gray-600'}`} /> 
             {status === 'ACTIVE' ? 'LIVE' : status}
           </div>
           
           <button 
             onClick={copyLink}
             className="relative group flex items-center gap-2 text-brand hover:text-brand/80 bg-brand/10 hover:bg-brand/20 px-4 py-2 rounded-full transition border border-brand/20 ml-2"
           >
             <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Copy Invitation Link</span>
             {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
             <span className="font-bold hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
           </button>

             <div className="relative group flex items-center gap-2 text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/10 ml-2">
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Live Spectators</span>
               <Users className="w-4 h-4" />
               <span className="font-bold">{viewersCount}</span>
             </div>

             <div className="relative group flex items-center gap-2 text-brand bg-brand/10 px-4 py-2 rounded-full border border-brand/20 ml-2">
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">Players Left to Auction</span>
               <Trophy className="w-4 h-4" />
               <span className="font-bold">{playersLeft} <span className="font-normal opacity-70 hidden sm:inline">left</span></span>
             </div>

             <button 
               onClick={() => setShowUnsoldPopup(true)}
               className="relative group flex items-center gap-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition cursor-pointer px-4 py-2 rounded-full border border-red-500/20 ml-2"
             >
               <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 backdrop-blur-md text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl z-50">View Unsold Players</span>
               <span className="font-bold hidden sm:inline">Unsold</span>
             </button>
          </div>
        </header>      <main className={`flex-1 flex flex-col xl:flex-row p-4 md:p-6 gap-6 z-10 relative ${status === 'PAUSED' ? 'h-[calc(100vh-100px)] overflow-hidden' : 'min-h-[calc(100vh-100px)] xl:h-[calc(100vh-100px)] overflow-y-auto xl:overflow-hidden'}`}>
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
                <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
                <h2 className="text-3xl font-black uppercase tracking-widest text-yellow-500">Auction Paused</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-y-auto custom-scrollbar pb-4 pr-2">
                {[...teams].sort((a, b) => b.budget - b.remainingPurse - (a.budget - a.remainingPurse)).map((team, i) => {
                  const spent = team.budget - team.remainingPurse;
                  return (
                    <div 
                      key={team.id} 
                      onClick={() => setViewingTeam(team)}
                      className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col gap-3 relative overflow-hidden min-h-[280px] lg:h-full cursor-pointer hover:border-brand/50 transition-colors group"
                    >
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
                        <span className="text-xs text-brand uppercase font-bold tracking-widest group-hover:underline flex items-center gap-1 transition-all">
                          View Squad <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-white">{fmt(spent)}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-2">Spent</span>
                        </div>
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
                      <div className="text-lg md:text-2xl font-bold text-accent tracking-widest uppercase mb-2">{currentPlayer.role}{currentPlayer.age && currentPlayer.age !== 'N/A' && currentPlayer.age !== '0' ? ' • ' + currentPlayer.age + ' YRS' : ''}</div>
                      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-none break-words" style={{ textShadow: '0 0 40px rgba(255,255,255,0.2)', wordSpacing: '0.25em' }}>
                        {currentPlayer.name}
                      </h2>
                    </div>
                  </div>

                  {/* BOTTOM ROW: Bids */}
                  <div className="flex flex-col md:flex-row gap-6 lg:gap-8 w-full relative">
                    <div className="w-full md:w-[240px] lg:w-[280px] shrink-0">
                      <div className={`w-full h-full p-4 lg:p-6 rounded-3xl border-2 flex flex-col items-center justify-center transition-colors duration-500 text-center ${currentBid > 0 ? 'bg-brand/20 border-brand/50 shadow-[0_0_50px_rgba(212,175,55,0.3)]' : 'bg-white/5 border-white/10'}`}>
                         <div className="text-sm lg:text-base text-gray-400 uppercase tracking-widest font-bold mb-1">Current Bid</div>
                         <div className={`text-4xl lg:text-5xl font-black ${currentBid > 0 ? 'text-brand' : 'text-gray-500'}`}>
                           {currentBid === 0 ? "WAITING" : fmt(currentBid)}
                         </div>
                         {highestTeamName && (
                           <div className="mt-3 flex flex-col items-center">
                             <div className="text-sm lg:text-base font-bold text-white bg-black/50 px-4 py-1.5 rounded-full border border-white/20">
                               {highestTeamName} LEADS
                             </div>
                             <div className="flex gap-2 mt-2">
                               {status === 'ACTIVE' && (
                                 <>
                                   <button onClick={() => socket?.emit(SocketEvents.EDIT_BID_START, { auctionId })} className="text-[10px] uppercase font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition">
                                     ✎ Edit
                                   </button>
                                   <button onClick={() => socket?.emit(SocketEvents.UNDO_BID, { auctionId })} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/20 transition">
                                     ↩ Undo
                                   </button>
                                 </>
                               )}
                             </div>
                             {teams.find(t => t.name === highestTeamName) && (
                               <div className="text-xs text-gray-400 mt-2 font-mono">
                                 Purse: {fmt(teams.find(t => t.name === highestTeamName).remainingPurse)}
                               </div>
                             )}
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

                {/* MANUAL BIDDING FORM */}
                {(status === "ACTIVE" || status === "EDITING") && (
                  <form onSubmit={handlePlaceBid} className="w-full max-w-4xl mt-6 p-6 glass-panel rounded-3xl border border-brand/30 flex flex-col gap-4 relative z-20">
                    <div className="flex flex-col md:flex-row w-full items-start gap-6">
                      <div className="flex-1 flex flex-col w-full">
                        <label className="block text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest">Select Team</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {teams.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTeamId(t.id)}
                              className={`py-3 px-2 rounded-xl font-bold border transition-all text-sm truncate ${selectedTeamId === t.id ? 'bg-brand border-brand text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'bg-[#111827] border-white/10 text-gray-300 hover:border-white/30'}`}
                            >
                              {t.shortName}
                            </button>
                          ))}
                        </div>
                        {selectedTeamId && selectedTeam && (
                          <div className="mt-4 flex flex-col gap-1 p-3 bg-black/40 rounded-xl border border-white/10 shadow-inner">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Selected Team</span>
                              <span className="text-sm font-bold text-brand">{selectedTeam.name}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-white/5">
                              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Total Purse</span>
                              <span className="text-sm font-mono font-bold text-gray-300">{fmt(selectedTeamPurse)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Slots Left</span>
                              <span className="text-sm font-mono font-bold text-gray-300">{Math.max(0, (selectedTeam.maxPlayers || 15) - (selectedTeam.players?.length || 0))}</span>
                            </div>
                            {bidAmount !== "" && !isTeamFull && (
                              <div className="flex justify-between items-center pt-2 mt-1 border-t border-white/10">
                                <span className={`text-[10px] uppercase tracking-widest font-bold ${isBidExceeding ? 'text-red-500' : 'text-accent'}`}>
                                  {isBidExceeding ? 'Status' : 'Purse after this bid'}
                                </span>
                                <span className={`text-sm font-bold ${isBidExceeding ? 'text-red-500' : 'text-accent font-mono'}`}>
                                  {isBidExceeding ? (parsedBidAmount > ABSOLUTE_MAX_BID ? 'Exceeds limit' : 'Exceeds budget') : fmt(selectedTeamPurse - parsedBidAmount)}
                                </span>
                              </div>
                            )}
                            {isTeamFull && (
                              <div className="flex justify-between items-center pt-2 mt-1 border-t border-white/10">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-red-500">
                                  Status
                                </span>
                                <span className="text-sm font-bold text-red-500">
                                  Squad is full
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-full md:w-[250px] flex flex-col shrink-0">
                        <label className="block text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest">Bid (in Lakhs)</label>
                        <input 
                          type="number" 
                          step="0.5"
                          required 
                          value={bidAmount} 
                          onChange={e => setBidAmount(e.target.value ? Number(e.target.value) : "")} 
                          className={`w-full bg-white/5 border rounded-xl py-3 px-4 text-white outline-none transition-colors text-xl font-bold font-mono ${isBidExceeding ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-brand/50'}`} 
                        />
                        
                        {/* QUICK INCREMENT BUTTONS */}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {[
                            { value: 0.5, label: "+0.5L" },
                            { value: 1.0, label: "+1L" },
                          ].map(inc => (
                            <button 
                              key={inc.value}
                              type="button"
                              onClick={() => handleQuickIncrement(inc.value)}
                              className="bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand font-black py-2 rounded-lg transition-all"
                            >
                              {inc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {status === 'ACTIVE' && (
                        <button type="submit" disabled={!selectedTeamId || bidAmount === "" || !!isBidExceeding || isTeamFull} className="w-full md:w-auto bg-brand text-black font-black py-5 px-8 rounded-xl hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(212,175,55,0.4)] disabled:opacity-50 disabled:cursor-not-allowed self-start md:mt-8">
                          PLACE BID
                        </button>
                      )}
                    </div>
                    
                    {status === 'EDITING' && (
                      <div className="flex items-center gap-4 mt-2 border-t border-white/10 pt-4 w-full justify-between">
                        <div className="text-yellow-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Editing Last Bid
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => socket?.emit(SocketEvents.EDIT_BID_CANCEL, { auctionId })} className="bg-white/10 text-white font-bold py-2 px-6 rounded-xl hover:bg-white/20 transition">
                            Cancel
                          </button>
                          <button type="button" onClick={() => socket?.emit(SocketEvents.REMOVE_BID, { auctionId })} className="bg-red-500/20 text-red-500 border border-red-500/50 font-bold py-2 px-6 rounded-xl hover:bg-red-500/30 transition">
                            Remove Bid
                          </button>
                          <button type="submit" disabled={!selectedTeamId || !bidAmount || !!isBidExceeding || isTeamFull} className="bg-yellow-500 text-black font-black py-2 px-8 rounded-xl hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(234,179,8,0.4)] disabled:opacity-50 disabled:cursor-not-allowed">
                            UPDATE BID
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {/* ERROR MESSAGE TOAST */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-10 bg-red-500 text-white font-bold py-3 px-6 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] z-50">
                      {errorMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-gray-500 text-center w-full"
              >
                <Trophy className={`w-32 h-32 mb-8 ${showEndPrompt ? 'text-brand opacity-100' : 'opacity-20'}`} />
                {showEndPrompt ? (
                  <>
                    <h2 className="text-4xl font-black uppercase tracking-widest text-white mb-6">All Players Auctioned!</h2>
                    <button onClick={() => socket?.emit(SocketEvents.END_AUCTION, { auctionId })} className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-black text-2xl tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.5)] transition">
                      END AUCTION
                    </button>
                  </>
                ) : (
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-widest text-center w-full">Waiting for next player</h2>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Sidebar */}
        <div className="w-full xl:w-[380px] flex flex-col gap-5 h-full">

          {/* Bid History */}
          <div className="glass-panel rounded-[2rem] p-4 flex-none h-[180px] flex flex-col overflow-hidden border border-white/10 shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-3 text-brand">
                <TrendingUp className="w-5 h-5" /> Bid History
              </h3>
              {bidHistory.length > 0 && status === 'ACTIVE' && (
                <button 
                  onClick={() => {
                    if (confirm("Are you sure you want to clear all bids for this player?")) {
                      socket?.emit(SocketEvents.RESET_CURRENT_BIDS, { auctionId });
                    }
                  }}
                  title="Clear all bids for the current player"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-500/20 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Bids
                </button>
              )}
            </div>
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
