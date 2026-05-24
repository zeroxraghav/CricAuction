"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Upload, Users, Shield, PlusCircle, UserPlus, PlayCircle, ImageIcon, ArrowLeft, RotateCcw } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function AdminSetup() {
  const router = useRouter();
  const params = useParams();
  const auctionId = params.auctionId as string;
  
  // Data
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  // States
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [teamCsvFile, setTeamCsvFile] = useState<File | null>(null);
  const [uploadingTeamCsv, setUploadingTeamCsv] = useState(false);
  
  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [teamBudget, setTeamBudget] = useState("850000000"); // 85 Cr default
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState<string>("");
  const [teamCreating, setTeamCreating] = useState(false);

  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState("BATSMAN");
  const [pPrice, setPPrice] = useState("20000000");
  const [pPhotoFile, setPPhotoFile] = useState<File | null>(null);
  const [pPhotoPreview, setPPhotoPreview] = useState<string>("");
  const [pAdding, setPAdding] = useState(false);

  const [deletingAuction, setDeletingAuction] = useState(false);
  const [clearingPlayers, setClearingPlayers] = useState(false);
  const [clearingTeams, setClearingTeams] = useState(false);

  const { getToken } = useAuth();

  const [auctionInfo, setAuctionInfo] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [tRes, pRes, aRes] = await Promise.all([
        fetch(`http://localhost:4000/api/public/auctions/${auctionId}/teams`),
        fetch(`http://localhost:4000/api/public/auctions/${auctionId}/players`),
        fetch(`http://localhost:4000/api/public/auctions/${auctionId}`)
      ]);
      setTeams(await tRes.json());
      setPlayers(await pRes.json());
      setAuctionInfo(await aRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/players/csv`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message} (${data.count} players)`);
        setFile(null);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to upload file");
    }
    setUploading(false);
  };

  const handleTeamFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamCsvFile) return;

    setUploadingTeamCsv(true);
    const formData = new FormData();
    formData.append("file", teamCsvFile);

    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/teams/csv`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message} (${data.count} teams)`);
        setTeamCsvFile(null);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to upload file");
    }
    setUploadingTeamCsv(false);
  };

  const handleManualPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPAdding(true);
    try {
      // Step 1: Upload photo if provided
      let photoUrl = "";
      if (pPhotoFile) {
        const photoForm = new FormData();
        photoForm.append("photo", pPhotoFile);
        const token = await getToken();
        const uploadRes = await fetch("http://localhost:4000/api/auctions/upload-photo", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: photoForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) photoUrl = uploadData.photoUrl;
      }

      // Step 2: Create player with photoUrl
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: pName, country: "Unknown", role: pRole, basePrice: pPrice, category: "General", photoUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: Added ${data.player.name}`);
        setPName(""); setPPhotoFile(null); setPPhotoPreview("");
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to add player");
    }
    setPAdding(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamCreating(true);

    try {
      // Step 1: Upload logo if provided
      let logoUrl = "";
      if (teamLogoFile) {
        const photoForm = new FormData();
        photoForm.append("photo", teamLogoFile);
        const token = await getToken();
        const uploadRes = await fetch("http://localhost:4000/api/auctions/upload-photo", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: photoForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) logoUrl = uploadData.photoUrl;
      }

      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: teamName, shortName: teamShortName, budget: teamBudget, logoUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: Team ${data.team.name} created!`);
        setTeamName(""); setTeamShortName(""); setTeamLogoFile(null); setTeamLogoPreview("");
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to create team");
    }
    setTeamCreating(false);
  };

  const handleResetPlayer = async (playerId: string) => {
    if (!confirm("Are you sure you want to reset this player? This will revert their status to PENDING, refund the team's purse, and delete all bids for this player.")) return;

    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/players/${playerId}/reset`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message}`);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to reset player");
    }
  };

  const handleClearPlayers = async () => {
    if (!confirm("Are you sure you want to clear the entire player database? This cannot be undone.")) return;
    
    setClearingPlayers(true);
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/players`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message}`);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to clear players");
    }
    setClearingPlayers(false);
  };

  const handleClearTeams = async () => {
    if (!confirm("Are you sure you want to clear the entire registered franchises database? This cannot be undone.")) return;
    
    setClearingTeams(true);
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}/teams`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message}`);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to clear teams");
    }
    setClearingTeams(false);
  };

  const handleDeleteAuction = async () => {
    if (!confirm("Are you sure? This will delete all bids and kick everyone out. Players and Teams will remain in the database.")) return;
    
    setDeletingAuction(true);
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:4000/api/auctions/${auctionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message}`);
        router.push("/"); // Back to dashboard
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to delete auction");
    }
    setDeletingAuction(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden bg-[#0a0f1a] text-white">
      <header className="flex flex-col md:flex-row justify-between items-center glass p-4 rounded-2xl mb-8 z-10 border border-brand/20 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition"><ArrowLeft className="text-gray-400" /></Link>
          <SettingsIcon />
          <h1 className="text-2xl font-bold tracking-widest uppercase">Auction Setup</h1>
        </div>
        <button 
          onClick={() => router.push(`/host/${auctionId}/live`)}
          className="bg-brand text-black font-black px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
        >
          <PlayCircle className="w-6 h-6" /> {auctionInfo?.status === 'ACTIVE' ? 'RESUME LIVE AUCTION' : 'START LIVE AUCTION'}
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 z-10">
        
        {/* LEFT COLUMN: Data Entry Forms (5 columns wide) */}
        <div className="xl:col-span-5 flex flex-col gap-8 h-full overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Create Team Form */}
          <div className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Shield className="text-accent" /> Register Franchise
            </h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team Name" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
                <input type="text" required value={teamShortName} onChange={e => setTeamShortName(e.target.value)} placeholder="Short Name" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="number" required value={teamBudget} onChange={e => setTeamBudget(e.target.value)} placeholder="Budget" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
                <div className="relative">
                  <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-4 cursor-pointer hover:border-accent/50 transition h-full">
                    {teamLogoPreview ? (
                      <img src={teamLogoPreview} alt="Preview" className="w-6 h-6 rounded-md object-cover border border-white/20" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-gray-300 text-sm truncate">{teamLogoFile ? teamLogoFile.name : "Upload Logo (optional)"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setTeamLogoFile(f);
                      if (f) setTeamLogoPreview(URL.createObjectURL(f));
                      else setTeamLogoPreview("");
                    }} />
                  </label>
                </div>
              </div>
              <button type="submit" disabled={teamCreating} className="w-full py-3 rounded-xl bg-accent/20 border border-accent/50 text-accent font-bold hover:bg-accent/30 transition">
                {teamCreating ? "Creating..." : "Create Team"}
              </button>
            </form>
          </div>

          {/* Bulk Upload Teams CSV */}
          <div className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload className="text-gray-300" /> Bulk Upload Teams (CSV)
            </h2>
            <form onSubmit={handleTeamFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-white/20 p-6 rounded-xl flex flex-col items-center justify-center hover:border-accent/50 transition cursor-pointer relative">
                <span className="text-gray-300 font-semibold text-sm">{teamCsvFile ? teamCsvFile.name : "Drop CSV here"}</span>
                <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setTeamCsvFile(e.target.files?.[0] || null)} />
              </div>
              <button type="submit" disabled={!teamCsvFile || uploadingTeamCsv} className="w-full py-3 rounded-xl bg-accent text-black font-bold disabled:opacity-50">
                {uploadingTeamCsv ? "Uploading..." : "Import Teams CSV"}
              </button>
            </form>
          </div>

          {/* Add Player Manually */}
          <div className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="text-brand" /> Add Player Manually
            </h2>
            <form onSubmit={handleManualPlayer} className="space-y-4">
               <div className="grid grid-cols-1 gap-4">
                 <input type="text" required placeholder="Name" value={pName} onChange={e=>setPName(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <select value={pRole} onChange={e=>setPRole(e.target.value)} className="bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none">
                   <option value="BATSMAN">Batsman</option>
                   <option value="BOWLER">Bowler</option>
                   <option value="ALLROUNDER">All-Rounder</option>
                   <option value="WICKETKEEPER">Wicket Keeper</option>
                 </select>
                 <input type="number" required placeholder="Base Price" value={pPrice} onChange={e=>setPPrice(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none" />
               </div>
               <div className="relative">
                 <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-4 cursor-pointer hover:border-brand/50 transition">
                   {pPhotoPreview ? (
                     <img src={pPhotoPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-white/20" />
                   ) : (
                     <ImageIcon className="w-5 h-5 text-gray-400" />
                   )}
                   <span className="text-gray-300 text-sm truncate">{pPhotoFile ? pPhotoFile.name : "Upload Player Photo (optional)"}</span>
                   <input type="file" accept="image/*" className="hidden" onChange={e => {
                     const f = e.target.files?.[0] || null;
                     setPPhotoFile(f);
                     if (f) setPPhotoPreview(URL.createObjectURL(f));
                     else setPPhotoPreview("");
                   }} />
                 </label>
               </div>
               <button type="submit" disabled={pAdding} className="w-full py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition">
                {pAdding ? "Adding..." : "Add Player to Database"}
              </button>
            </form>
          </div>

          {/* Bulk Upload CSV */}
          <div className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload className="text-gray-300" /> Bulk Upload Players (CSV)
            </h2>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-white/20 p-6 rounded-xl flex flex-col items-center justify-center hover:border-brand/50 transition cursor-pointer relative">
                <span className="text-gray-300 font-semibold text-sm">{file ? file.name : "Drop CSV here"}</span>
                <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <button type="submit" disabled={!file || uploading} className="w-full py-3 rounded-xl bg-brand text-black font-bold disabled:opacity-50">
                {uploading ? "Uploading..." : "Import CSV"}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="glass-panel p-6 rounded-3xl border-red-500/30">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
              Danger Zone
            </h2>
            <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-4">
              <p className="text-sm text-gray-300">
                Deleting the auction will erase all bids and kick all spectators out immediately. Teams and players will remain in the database.
              </p>
            </div>
            <button 
              onClick={handleDeleteAuction}
              disabled={deletingAuction}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50"
            >
              {deletingAuction ? "Deleting..." : "Delete Live Auction"}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Data Viewers (7 columns wide) */}
        <div className="xl:col-span-7 flex flex-col gap-6 h-full">
          
          <div className="glass-panel rounded-3xl p-6 flex flex-col h-1/2 border border-white/10 overflow-hidden">
             <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0a0f1a]/80 backdrop-blur-md z-10 pb-2">
               <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-brand" /> Player Database ({players.length})</h2>
               {players.length > 0 && (
                 <button 
                   onClick={handleClearPlayers}
                   disabled={clearingPlayers}
                   className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50"
                 >
                   {clearingPlayers ? "Clearing..." : "Clear All"}
                 </button>
               )}
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
               {players.map(p => (
                 <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4 hover:border-white/30 transition relative group">
                   {p.photoUrl ? (
                     <img src={p.photoUrl} alt={p.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/10 bg-black/50" />
                   ) : (
                     <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center font-black text-xl text-white/50 border-2 border-white/5">{p.name.charAt(0)}</div>
                   )}
                   <div className="overflow-hidden flex-1">
                     <div className="font-bold truncate text-white">{p.name} <span className="text-xs ml-2 text-gray-500 uppercase">({p.status})</span></div>
                     <div className="text-xs text-brand font-semibold">{p.role}</div>
                     <div className="text-xs text-gray-400">₹{p.basePrice.toLocaleString("en-IN")}</div>
                   </div>
                   {p.status !== 'PENDING' && (
                     <button
                       onClick={() => handleResetPlayer(p.id)}
                       title="Reset Player"
                       className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition absolute right-4 opacity-0 group-hover:opacity-100"
                     >
                       <RotateCcw className="w-5 h-5" />
                     </button>
                   )}
                 </div>
               ))}
               {players.length === 0 && <div className="col-span-full text-center text-gray-500 py-10">No players added yet</div>}
             </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 flex flex-col h-1/2 border border-white/10 overflow-hidden">
             <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0a0f1a]/80 backdrop-blur-md z-10 pb-2">
               <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-accent" /> Registered Franchises ({teams.length})</h2>
               {teams.length > 0 && (
                 <button 
                   onClick={handleClearTeams}
                   disabled={clearingTeams}
                   className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50"
                 >
                   {clearingTeams ? "Clearing..." : "Clear All"}
                 </button>
               )}
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
               {teams.map(t => (
                 <div key={t.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4 hover:border-accent/30 transition">
                   {t.logoUrl ? (
                     <img src={t.logoUrl} alt={t.name} className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1" />
                   ) : (
                     <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-black text-xl text-white/50">{t.shortName}</div>
                   )}
                   <div className="overflow-hidden">
                     <div className="font-bold truncate text-white">{t.shortName}</div>
                     <div className="text-xs text-gray-400">₹{t.budget.toLocaleString("en-IN")}</div>
                   </div>
                 </div>
               ))}
               {teams.length === 0 && <div className="col-span-full text-center text-gray-500 py-10">No teams registered yet</div>}
             </div>
          </div>

        </div>

      </main>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}
