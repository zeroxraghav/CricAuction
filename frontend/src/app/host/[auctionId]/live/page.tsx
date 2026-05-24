"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents, Player } from "shared";
import { Shield, Trophy, IndianRupee, TrendingUp, X, SkipForward, Users, Copy, Check, RotateCcw } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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
  const [status, setStatus] = useState<"IDLE" | "ACTIVE" | "PAUSED">("IDLE");
  const [isDeleted, setIsDeleted] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const [showUnsoldPopup, setShowUnsoldPopup] = useState(false);
  const [unsoldPlayers, setUnsoldPlayers] = useState<any[]>([]);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

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
  
  const ABSOLUTE_MAX_BID = 10000000000; // 1000 Cr
  const isBidExceeding = (selectedTeamId && bidAmount && Number(bidAmount) > selectedTeamPurse) || (bidAmount && Number(bidAmount) > ABSOLUTE_MAX_BID);

  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !bidAmount || !currentPlayer || isBidExceeding) return;

    socket?.emit(SocketEvents.PLACE_BID, {
      auctionId,
      playerId: currentPlayer.id,
      teamId: selectedTeam.id,
      teamName: selectedTeam.shortName,
      amount: Number(bidAmount),
    });
  };

  const handleQuickIncrement = (inc: number) => {
    const baseValue = Number(bidAmount) || 0;
    setBidAmount(baseValue + inc);
  };

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

  useEffect(() => { fetchTeams(); }, []);

  useEffect(() => {
    if (showUnsoldPopup) {
      fetchUnsoldPlayers();
    }
  }, [showUnsoldPopup]);

  useEffect(() => {
    if (status === 'EDITING' && bidHistory.length > 0) {
      const latestBid = bidHistory[0];
      setSelectedTeamId(latestBid.teamId);
      setBidAmount(latestBid.amount);
    }
  }, [status]);

  useEffect(() => {
    if (!socket) return;

    socket.emit(SocketEvents.JOIN_AUCTION, { auctionId, isHost: true });

    socket.on(SocketEvents.AUCTION_STATE_UPDATE, (state: any) => {
      setCurrentPlayer(state.currentPlayer);
      setCurrentBid(state.currentBid);
      setHighestTeamName(state.highestBiddingTeamName || "");
      setStatus(state.status);
      setBidHistory(state.bidHistory || []);
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
    });

    socket.on(SocketEvents.PLAYER_UNSOLD, (info: any) => {
      setSoldPopup({
        playerName: info.playerName,
        teamName: "UNSOLD",
        amount: 0,
      });
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
              className="glass-panel rounded-[3rem] p-16 max-w-2xl w-full text-center relative border-2 border-brand/50 shadow-[0_0_120px_rgba(212,175,55,0.4)]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSoldPopup(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white"><X className="w-7 h-7" /></button>
              
              {soldPopup.amount > 0 ? (
                <>
                  <Trophy className="w-20 h-20 text-brand mx-auto mb-6" />
                  {soldPopup.playerPhoto && (
                    <img src={soldPopup.playerPhoto} alt="" className="w-32 h-32 rounded-full object-cover border-4 border-brand/50 mx-auto mb-6 shadow-[0_0_40px_rgba(212,175,55,0.3)]" />
                  )}
                  <h2 className="text-6xl font-black text-brand mb-4" style={{ textShadow: '0 0 30px rgba(212,175,55,0.5)' }}>SOLD!</h2>
                  <p className="text-4xl font-bold text-white mb-3">{soldPopup.playerName}</p>
                  <p className="text-2xl text-gray-300 mb-6">to <span className="text-accent font-black text-3xl">{soldPopup.teamName}</span></p>
                  <div className="bg-brand/10 border border-brand/30 rounded-2xl py-4 px-8 inline-block">
                    <p className="text-5xl font-black text-brand">{fmt(soldPopup.amount)}</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-6xl font-black text-red-500 mb-6">UNSOLD</h2>
                  <p className="text-4xl font-bold text-white">{soldPopup.playerName}</p>
                  <p className="text-gray-400 mt-4 text-xl">No bids were placed</p>
                </>
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
                  <h2 className="text-4xl font-black text-white">{viewingTeam.name} ({viewingTeam.shortName})</h2>
                  <p className="text-xl text-gray-400">Squad: {viewingTeam.players?.length || 0}/25 &bull; Purse: {fmt(viewingTeam.remainingPurse)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                {viewingTeam.players?.length > 0 ? (
                  viewingTeam.players.map((p: any) => (
                    <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-14 h-14 rounded-full object-cover border border-white/20" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold text-white/50">{p.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="font-bold text-lg">{p.name}</div>
                        <div className="text-sm text-gray-400">{p.role} &bull; {fmt(p.soldPrice || p.basePrice)}</div>
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
                          <img src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-white/20" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/50">{p.name.charAt(0)}</div>
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-lg">{p.name}</div>
                          <div className="text-sm text-gray-400">{p.role} &bull; {p.country}</div>
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
             <button disabled={!!currentPlayer} onClick={() => socket?.emit(SocketEvents.NEXT_PLAYER, { auctionId })} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
               <SkipForward className="w-5 h-5"/> Next
             </button>
             {status === 'ACTIVE' ? (
               <button onClick={() => socket?.emit(SocketEvents.PAUSE_AUCTION, { auctionId })} className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                 PAUSE
               </button>
             ) : (
               <button onClick={() => socket?.emit(SocketEvents.RESUME_AUCTION, { auctionId })} className="bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                 RESUME
               </button>
             )}
             <button onClick={() => socket?.emit(SocketEvents.PLAYER_SOLD, { auctionId })} className="bg-brand text-black hover:bg-yellow-400 px-6 py-2 rounded-lg font-black tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.4)]">
               SELL
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
             className="flex items-center gap-2 text-brand hover:text-brand/80 bg-brand/10 hover:bg-brand/20 px-4 py-2 rounded-full transition border border-brand/20 ml-2"
           >
             {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
             <span className="font-bold hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
           </button>

             <div className="flex items-center gap-2 text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/10 ml-2">
               <Users className="w-4 h-4" />
               <span className="font-bold">{viewersCount}</span>
             </div>

             <button 
               onClick={() => setShowUnsoldPopup(true)}
               className="flex items-center gap-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition cursor-pointer px-4 py-2 rounded-full border border-red-500/20 ml-2"
             >
               <span className="font-bold hidden sm:inline">Unsold</span>
             </button>
          </div>
        </header>

      <main className="flex-1 flex p-6 gap-6 z-10 h-[calc(100vh-100px)]">
        
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
                {currentPlayer.photoUrl ? (
                  <img src={currentPlayer.photoUrl} alt={currentPlayer.name} className="w-48 h-48 rounded-full object-cover border-4 border-brand/50 shadow-[0_0_30px_rgba(212,175,55,0.3)] mb-6 bg-black/50" />
                ) : (
                  <div className="w-48 h-48 rounded-full bg-white/10 border-4 border-white/10 flex items-center justify-center text-7xl font-black text-white/20 mb-6">{currentPlayer.name.charAt(0)}</div>
                )}

                <div className="text-xl font-bold text-accent tracking-widest uppercase mb-2">{currentPlayer.role} &bull; {currentPlayer.country}</div>
                <h2 className="text-7xl font-black uppercase tracking-tight text-center mb-8 leading-none" style={{ textShadow: '0 0 40px rgba(255,255,255,0.2)' }}>
                  {currentPlayer.name}
                </h2>

                <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
                  {/* Current Bid */}
                  <div className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center transition-colors duration-500 ${currentBid > 0 ? 'bg-brand/20 border-brand/50 shadow-[0_0_50px_rgba(212,175,55,0.3)]' : 'bg-white/5 border-white/10'}`}>
                     <div className="text-gray-400 uppercase tracking-widest font-bold mb-2">Current Bid</div>
                     <div className={`text-5xl font-black ${currentBid > 0 ? 'text-brand' : 'text-gray-500'}`}>
                       {currentBid === 0 ? "WAITING" : fmt(currentBid)}
                     </div>
                     {highestTeamName && (
                       <div className="mt-4 flex flex-col items-center">
                         <div className="text-xl font-bold text-white bg-black/50 px-6 py-2 rounded-full border border-white/20">
                           {highestTeamName} LEADS
                         </div>
                         {status === 'ACTIVE' && (
                           <button onClick={() => socket?.emit(SocketEvents.EDIT_BID_START, { auctionId })} className="mt-3 text-[10px] uppercase font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition">
                             ✎ Edit Bid
                           </button>
                         )}
                         {teams.find(t => t.shortName === highestTeamName) && (
                           <div className="text-sm text-gray-400 mt-2 font-mono">
                             Purse: {fmt(teams.find(t => t.shortName === highestTeamName).remainingPurse)}
                           </div>
                         )}
                       </div>
                     )}
                  </div>

                  {/* Base Price + Bid Count */}
                  <div className="flex flex-col gap-6">
                     <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex justify-between items-center">
                       <span className="text-gray-400 uppercase tracking-widest font-bold">Base Price</span>
                       <span className="text-2xl font-bold text-white">{fmt(currentPlayer.basePrice)}</span>
                     </div>
                     <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center">
                       <div className="text-gray-400 uppercase tracking-widest font-bold mb-2">Total Bids</div>
                       <div className="text-6xl font-black text-white">{bidHistory.length}</div>
                     </div>
                  </div>
                </div>

                {/* MANUAL BIDDING FORM */}
                {(status === "ACTIVE" || status === "EDITING") && (
                  <form onSubmit={handlePlaceBid} className="w-full max-w-4xl mt-6 p-6 glass-panel rounded-3xl border border-brand/30 flex flex-col gap-4 relative z-20">
                    <div className="flex w-full items-start gap-4">
                      <div className="flex-1 flex flex-col">
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Select Team</label>
                        <select required value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none">
                          <option value="">-- Choose Team --</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.shortName}</option>)}
                        </select>
                        {selectedTeamId && (
                          <div className="mt-3 flex flex-col gap-1 p-3 bg-black/40 rounded-xl border border-white/10 shadow-inner">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Total Purse</span>
                              <span className="text-sm font-mono font-bold text-gray-300">{fmt(selectedTeamPurse)}</span>
                            </div>
                            {bidAmount !== "" && (
                              <div className="flex justify-between items-center pt-2 mt-1 border-t border-white/10">
                                <span className={`text-[10px] uppercase tracking-widest font-bold ${isBidExceeding ? 'text-red-500' : 'text-accent'}`}>
                                  {isBidExceeding ? 'Status' : 'Purse after this bid'}
                                </span>
                                <span className={`text-sm font-bold ${isBidExceeding ? 'text-red-500' : 'text-accent font-mono'}`}>
                                  {isBidExceeding ? (Number(bidAmount) > ABSOLUTE_MAX_BID ? 'Exceeds system limit' : 'Bid exceeds budget') : fmt(selectedTeamPurse - Number(bidAmount))}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Bid Amount (₹)</label>
                        <input 
                          type="number" 
                          required 
                          min={status === 'EDITING' && bidHistory.length > 1 ? bidHistory[1].amount + 1 : (currentBid === 0 ? currentPlayer.basePrice : currentBid + 1)}
                          max={selectedTeamId ? selectedTeamPurse : ABSOLUTE_MAX_BID}
                          placeholder={`Min: ${status === 'EDITING' && bidHistory.length > 1 ? bidHistory[1].amount + 1 : (currentBid === 0 ? currentPlayer.basePrice : currentBid + 1)}`} 
                          value={bidAmount} 
                          onChange={e => setBidAmount(e.target.value ? Number(e.target.value) : "")} 
                          className={`w-full bg-white/5 border rounded-xl py-3 px-4 text-white outline-none transition-colors ${isBidExceeding ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-brand/50'}`} 
                        />
                        
                        {/* QUICK INCREMENT BUTTONS */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { value: 500, label: "+500" },
                            { value: 1000, label: "+1k" },
                            { value: 5000, label: "+5k" },
                            { value: 10000, label: "+10k" },
                            { value: 20000, label: "+20k" },
                            { value: 50000, label: "+50k" },
                            { value: 100000, label: "+1L" },
                            { value: 500000, label: "+5L" },
                            { value: 1000000, label: "+10L" },
                            { value: 2000000, label: "+20L" },
                          ].map(inc => (
                            <button 
                              key={inc.value}
                              type="button"
                              onClick={() => handleQuickIncrement(inc.value)}
                              className="bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand text-xs font-black px-3 py-1.5 rounded-lg transition-all"
                            >
                              {inc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {status === 'ACTIVE' && (
                        <button type="submit" disabled={!selectedTeamId || !bidAmount || !!isBidExceeding} className="bg-brand text-black font-black py-3 px-8 rounded-xl hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(212,175,55,0.4)] disabled:opacity-50 disabled:cursor-not-allowed self-start mt-7">
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
                          <button type="submit" disabled={!selectedTeamId || !bidAmount || !!isBidExceeding} className="bg-yellow-500 text-black font-black py-2 px-8 rounded-xl hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(234,179,8,0.4)] disabled:opacity-50 disabled:cursor-not-allowed">
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
                className="flex flex-col items-center justify-center text-gray-500"
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
                  <h2 className="text-4xl font-black uppercase tracking-widest">Waiting for next player</h2>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Sidebar */}
        <div className="w-[380px] flex flex-col gap-5">

          {/* Bid History */}
          <div className="glass-panel rounded-[2rem] p-5 flex-1 flex flex-col overflow-hidden border border-white/10">
            <div className="flex justify-between items-center mb-4">
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
              {bidHistory.map((bid, i) => (
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
          <div className="glass-panel rounded-[2rem] p-5 flex flex-col overflow-hidden border border-white/10" style={{ maxHeight: '40%' }}>
            <h3 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-3 text-accent">
              <Shield className="w-5 h-5" /> Franchise Purses
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {teams.map(team => (
                <button 
                  key={team.id} 
                  onClick={() => setViewingTeam(team)}
                  className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all cursor-pointer hover:bg-white/10 ${
                    highestTeamName === team.shortName 
                      ? 'bg-brand/10 border-brand/30' 
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div>
                    <span className="font-black text-base tracking-wide">{team.shortName}</span>
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
