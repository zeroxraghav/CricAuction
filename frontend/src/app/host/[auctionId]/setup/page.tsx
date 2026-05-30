"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Upload, Users, Shield, PlusCircle, UserPlus, PlayCircle, ImageIcon, ArrowLeft, RotateCcw, Trash2, Pencil, Download, FileText } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { exportAuctionSummaryPDF } from "@/lib/pdfExport";

const fmt = (n: number) => (n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + 'L';

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
  const [teamBudget, setTeamBudget] = useState("100"); // 100 Lakhs = 1 Cr default
  const [teamMaxPlayers, setTeamMaxPlayers] = useState("15");
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState<string>("");
  const [teamCreating, setTeamCreating] = useState(false);

  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState("BATSMAN");
  const [pPrice, setPPrice] = useState("1"); // 1 Lakh default
  const [pPhotoFile, setPPhotoFile] = useState<File | null>(null);
  const [pPhotoPreview, setPPhotoPreview] = useState<string>("");
  const [pRetainedTeamId, setPRetainedTeamId] = useState("");
  const [pAdding, setPAdding] = useState(false);

  const [deletingAuction, setDeletingAuction] = useState(false);
  const [resettingAuction, setResettingAuction] = useState(false);
  const [clearingPlayers, setClearingPlayers] = useState(false);
  const [clearingTeams, setClearingTeams] = useState(false);

  const { getToken } = useAuth();

  const [auctionInfo, setAuctionInfo] = useState<any>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerFilter, setPlayerFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");

  const fetchData = async () => {
    try {
      const [tRes, pRes, aRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/teams`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}/players`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/auctions/${auctionId}`)
      ]);
      setTeams(await tRes.json());
      setPlayers(await pRes.json());
      const aInfo = await aRes.json();
      setAuctionInfo(aInfo);
      if (aInfo?.sport === 'VOLLEYBALL') setPRole('SETTER');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [defaultTeamBudget, setDefaultTeamBudget] = useState("100");
  const [defaultTeamMaxPlayers, setDefaultTeamMaxPlayers] = useState("15");
  const [defaultPlayerBasePrice, setDefaultPlayerBasePrice] = useState("1");

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("defaultBasePrice", defaultPlayerBasePrice);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players/csv`, {
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
    formData.append("defaultBudget", defaultTeamBudget);
    formData.append("defaultMaxPlayers", defaultTeamMaxPlayers);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/teams/csv`, {
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

  const handleEditTeam = (team: any) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamShortName(team.shortName);
    setTeamBudget((team.budget / 100000).toString());
    setTeamMaxPlayers(team.maxPlayers?.toString() || "15");
    setTeamLogoPreview(team.logoUrl || "");
    setTeamLogoFile(null);

    const formElement = document.getElementById("franchise-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelTeamEdit = () => {
    setEditingTeamId(null);
    setTeamName("");
    setTeamShortName("");
    setTeamBudget("100");
    setTeamMaxPlayers("15");
    setTeamLogoFile(null);
    setTeamLogoPreview("");
  };

  const handleEditPlayer = (player: any) => {
    setEditingPlayerId(player.id);
    setPName(player.name);
    setPRole(player.role);
    setPPrice((player.basePrice / 100000).toString());
    setPPhotoPreview(player.photoUrl || "");
    setPPhotoFile(null);
    setPRetainedTeamId(player.status === 'RETAINED' ? (player.teamId || "") : "");

    const formElement = document.getElementById("player-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelPlayerEdit = () => {
    setEditingPlayerId(null);
    setPName("");
    setPRole(auctionInfo?.sport === 'VOLLEYBALL' ? 'SETTER' : 'BATSMAN');
    setPPrice("1");
    setPPhotoFile(null);
    setPPhotoPreview("");
    setPRetainedTeamId("");
  };

  const handleManualPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPAdding(true);
    try {
      // Step 1: Upload photo if provided
      let photoUrl = pPhotoPreview;
      if (pPhotoFile) {
        const photoForm = new FormData();
        photoForm.append("photo", pPhotoFile);
        const token = await getToken();
        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/upload-photo`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: photoForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) photoUrl = uploadData.photoUrl;
      }

      // Step 2: Create or update player
      const token = await getToken();
      const isEdit = !!editingPlayerId;
      const url = isEdit
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players/${editingPlayerId}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: pName, age: "25", role: pRole, basePrice: Number(pPrice) * 100000, photoUrl, retainedTeamId: pRetainedTeamId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isEdit ? `Success: Updated ${data.player.name}` : `Success: Added ${data.player.name}`);
        setPName(""); setPPhotoFile(null); setPPhotoPreview(""); setPRetainedTeamId("");
        setEditingPlayerId(null);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error(editingPlayerId ? "Failed to update player" : "Failed to add player");
    }
    setPAdding(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamCreating(true);

    try {
      // Step 1: Upload logo if provided
      let logoUrl = teamLogoPreview;
      if (teamLogoFile) {
        const photoForm = new FormData();
        photoForm.append("photo", teamLogoFile);
        const token = await getToken();
        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/upload-photo`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: photoForm,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) logoUrl = uploadData.photoUrl;
      }

      const token = await getToken();
      const isEdit = !!editingTeamId;
      const url = isEdit
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/teams/${editingTeamId}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/teams`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: teamName, shortName: teamShortName, budget: Number(teamBudget) * 100000, maxPlayers: Number(teamMaxPlayers), logoUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isEdit ? `Success: Team ${data.team.name} updated!` : `Success: Team ${data.team.name} created!`);
        setTeamName(""); setTeamShortName(""); setTeamMaxPlayers("15"); setTeamLogoFile(null); setTeamLogoPreview("");
        setEditingTeamId(null);
        fetchData();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error(editingTeamId ? "Failed to update team" : "Failed to create team");
    }
    setTeamCreating(false);
  };

  const handleResetPlayer = async (playerId: string) => {
    if (!confirm("Are you sure you want to reset this player? This will revert their status to PENDING, refund the team's purse, and delete all bids for this player.")) return;

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players/${playerId}/reset`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/teams`, {
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

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm("Are you sure you want to delete this player? If sold, the team's purse will be refunded.")) return;
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/players/${playerId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Failed to delete player");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/teams/${teamId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Failed to delete team");
    }
  };

  const handleDeleteAuction = async () => {
    if (!confirm("Are you sure? This will permanently delete the auction, including ALL its players, teams, and bids. This action cannot be undone.")) return;
    
    setDeletingAuction(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}`, {
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

  const handleResetAuction = async () => {
    if (!confirm("Are you sure you want to reset this auction? This will reset all players to PENDING, refund all team budgets, and clear all bids. The auction will start from scratch.")) return;
    
    setResettingAuction(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auctions/${auctionId}/reset`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Success: ${data.message}`);
        fetchData(); // Refresh all data
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.error("Failed to reset auction");
    }
    setResettingAuction(false);
  };

  const downloadSampleTeamsCSV = () => {
    const csvContent = "name,shortName,budget,maxPlayers,logoUrl\nMumbai Warriors,MW,100,15,https://example.com/logo.png\nChennai Kings,CK,100,15,\nDelhi Strikers,DS,80,15,";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_teams.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSamplePlayersCSV = () => {
    const csvContent = "name,role,basePrice,photoUrl,age,retainedTeam\nVirat Kohli,BATSMAN,20,https://example.com/photo.png,35,\nMS Dhoni,WICKETKEEPER,15,,42,Chennai Kings\nJasprit Bumrah,BOWLER,10,,30,";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_players.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAuctionSummaryPDFHandler = () => {
    exportAuctionSummaryPDF(auctionInfo, teams, players);
  };

  const filteredPlayers = players
    .filter((p: any) => playerFilter === "ALL" || p.status === playerFilter)
    .filter((p: any) => playerFilter !== "SOLD" || teamFilter === "ALL" || p.teamId === teamFilter);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden bg-[#0a0f1a] text-white">
      <header className="flex flex-col md:flex-row justify-between items-center glass p-4 rounded-2xl mb-8 z-10 border border-brand/20 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition"><ArrowLeft className="text-gray-400" /></Link>
          <SettingsIcon />
          <h1 className="text-2xl font-bold tracking-widest uppercase">Auction Setup</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleResetAuction}
            disabled={resettingAuction}
            className="bg-red-500/10 text-red-500 font-bold px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500/20 transition-all border border-red-500/20 disabled:opacity-50"
            title="Reset entire auction"
          >
            <RotateCcw className="w-5 h-5" /> <span className="hidden md:inline">{resettingAuction ? "Resetting..." : "Reset"}</span>
          </button>
          <button 
            onClick={exportAuctionSummaryPDFHandler}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            <FileText className="w-5 h-5" /> <span className="hidden md:inline">Export PDF</span>
          </button>
          <button 
            onClick={() => router.push(`/host/${auctionId}/live`)}
            className="bg-brand text-black font-black px-4 md:px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
          >
            <PlayCircle className="w-6 h-6" /> <span className="hidden sm:inline">{auctionInfo?.status === 'ACTIVE' ? 'RESUME LIVE AUCTION' : 'START LIVE AUCTION'}</span><span className="inline sm:hidden">LIVE</span>
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 z-10">
        
        {/* LEFT COLUMN: Data Entry Forms (5 columns wide) */}
        <div className="xl:col-span-5 flex flex-col gap-8 h-full overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Create Team Form */}
          <div id="franchise-form" className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Shield className="text-accent" /> {editingTeamId ? "Edit Franchise" : "Register Franchise"}
            </h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team Name" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
                <input type="text" required value={teamShortName} onChange={e => setTeamShortName(e.target.value)} placeholder="Short Name" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="number" step="any" required value={teamBudget} onChange={e => setTeamBudget(e.target.value)} placeholder="Budget (in Lakhs)" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
                <input type="number" min="1" required value={teamMaxPlayers} onChange={e => setTeamMaxPlayers(e.target.value)} placeholder="Players to Buy" className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-accent/50 outline-none" />
                <div className="relative">
                  <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-4 cursor-pointer hover:border-accent/50 transition h-full">
                    {teamLogoPreview ? (
                      <img referrerPolicy="no-referrer" src={teamLogoPreview} alt="Preview" className="w-6 h-6 rounded-md object-cover border border-white/20" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-gray-300 text-sm truncate">{teamLogoFile ? teamLogoFile.name : (editingTeamId && teamLogoPreview ? "Change Logo (optional)" : "Upload Logo (optional)")}</span>
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
                {teamCreating ? (editingTeamId ? "Updating..." : "Creating...") : (editingTeamId ? "Update Team" : "Create Team")}
              </button>
              {editingTeamId && (
                <button type="button" onClick={handleCancelTeamEdit} className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-bold hover:bg-red-500/20 transition mt-2">
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* Bulk Upload Teams CSV */}
          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload className="text-gray-300" /> Bulk Upload Teams (CSV)
              </h2>
              <button onClick={downloadSampleTeamsCSV} type="button" className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Sample CSV</span>
              </button>
            </div>
            <form onSubmit={handleTeamFileUpload} className="space-y-4">
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Budget (in Lakhs)</label>
                    <input type="number" min="0" required value={defaultTeamBudget} onChange={(e) => setDefaultTeamBudget(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand" placeholder="e.g. 100 for 1 Cr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Players to Buy</label>
                    <input type="number" min="1" required value={defaultTeamMaxPlayers} onChange={(e) => setDefaultTeamMaxPlayers(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand" placeholder="e.g. 15" />
                  </div>
                </div>
              </div>
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
          <div id="player-form" className="glass-panel p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="text-brand" /> {editingPlayerId ? "Edit Player Details" : "Add Player Manually"}
            </h2>
            <form onSubmit={handleManualPlayer} className="space-y-4">
               <div className="grid grid-cols-1 gap-4">
                 <input type="text" required placeholder="Name" value={pName} onChange={e=>setPName(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none" />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <select value={pRole} onChange={e=>setPRole(e.target.value)} className="bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none">
                   {auctionInfo?.sport === 'VOLLEYBALL' ? (
                     <>
                       <option value="SETTER">Setter</option>
                       <option value="SPIKER">Spiker</option>
                       <option value="LIBERO">Libero</option>
                       <option value="BLOCKER">Blocker</option>
                       <option value="OPPOSITE">Opposite</option>
                       <option value="DEFENDER">Defender</option>
                     </>
                   ) : (
                     <>
                       <option value="BATSMAN">Batsman</option>
                       <option value="BOWLER">Bowler</option>
                       <option value="ALLROUNDER">All-Rounder</option>
                       <option value="WICKETKEEPER">Wicket Keeper</option>
                     </>
                   )}
                 </select>
                 <input type="number" step="any" required placeholder="Base Price (in Lakhs)" value={pPrice} onChange={e=>setPPrice(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none" />
                 <select value={pRetainedTeamId} onChange={e=>setPRetainedTeamId(e.target.value)} className="bg-[#111827] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none">
                   <option value="">Not Retained (Auction Pool)</option>
                   {teams.map((t: any) => (
                     <option key={t.id} value={t.id}>Retained by {t.shortName}</option>
                   ))}
                 </select>
               </div>
               <div className="relative">
                 <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-4 cursor-pointer hover:border-brand/50 transition">
                   {pPhotoPreview ? (
                     <img referrerPolicy="no-referrer" src={pPhotoPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-white/20" />
                   ) : (
                     <ImageIcon className="w-5 h-5 text-gray-400" />
                   )}
                   <span className="text-gray-300 text-sm truncate">{pPhotoFile ? pPhotoFile.name : (editingPlayerId && pPhotoPreview ? "Change Photo (optional)" : "Upload Player Photo (optional)")}</span>
                   <input type="file" accept="image/*" className="hidden" onChange={e => {
                     const f = e.target.files?.[0] || null;
                     setPPhotoFile(f);
                     if (f) setPPhotoPreview(URL.createObjectURL(f));
                     else setPPhotoPreview("");
                   }} />
                 </label>
               </div>
               <button type="submit" disabled={pAdding} className="w-full py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition">
                {pAdding ? (editingPlayerId ? "Updating..." : "Adding...") : (editingPlayerId ? "Update Player" : "Add Player to Database")}
              </button>
              {editingPlayerId && (
                <button type="button" onClick={handleCancelPlayerEdit} className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-bold hover:bg-red-500/20 transition mt-2">
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* Bulk Upload CSV */}
          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload className="text-gray-300" /> Bulk Upload Players (CSV)
              </h2>
              <button onClick={downloadSamplePlayersCSV} type="button" className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Sample CSV</span>
              </button>
            </div>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-semibold">
                  Default Player Base Price (in Lakhs)
                </label>
                <input type="number" step="any" required placeholder="1" value={defaultPlayerBasePrice} onChange={e=>setDefaultPlayerBasePrice(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-brand/50 outline-none" />
              </div>
              <div className="border-2 border-dashed border-white/20 p-6 rounded-xl flex flex-col items-center justify-center hover:border-brand/50 transition cursor-pointer relative">
                <span className="text-gray-300 font-semibold text-sm">{file ? file.name : "Drop CSV here"}</span>
                <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <button type="submit" disabled={!file || uploading} className="w-full py-3 rounded-xl bg-brand text-black font-bold disabled:opacity-50">
                {uploading ? "Uploading..." : "Import CSV"}
              </button>
            </form>
          </div>


        </div>

        {/* RIGHT COLUMN: Data Viewers (7 columns wide) */}
        <div className="xl:col-span-7 flex flex-col gap-6 h-full">
          
          <div className="glass-panel rounded-3xl p-6 flex flex-col h-1/2 border border-white/10 overflow-hidden">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 sticky top-0 bg-[#0a0f1a]/80 backdrop-blur-md z-10 pb-2 border-b border-white/5 gap-2">
               <div className="flex flex-wrap items-center gap-2 md:gap-4">
                 <h2 className="text-xl font-bold flex items-center gap-2 mr-2"><Users className="text-brand" /> Player Database ({filteredPlayers.length})</h2>
                 <select 
                   value={playerFilter} 
                   onChange={(e) => setPlayerFilter(e.target.value)}
                   className="bg-black border border-white/20 text-white rounded-lg px-2 py-1 text-xs md:text-sm focus:outline-none focus:border-brand/50 cursor-pointer"
                 >
                   <option value="ALL">All Status</option>
                   <option value="PENDING">Pending</option>
                   <option value="SOLD">Sold</option>
                   <option value="UNSOLD">Unsold</option>
                 </select>
                 
                 {playerFilter === 'SOLD' && (
                   <select 
                     value={teamFilter} 
                     onChange={(e) => setTeamFilter(e.target.value)}
                     className="bg-black border border-white/20 text-white rounded-lg px-2 py-1 text-xs md:text-sm focus:outline-none focus:border-brand/50 cursor-pointer max-w-[150px] truncate"
                   >
                     <option value="ALL">All Teams</option>
                     {teams.map(t => (
                       <option key={t.id} value={t.id}>{t.shortName}</option>
                     ))}
                   </select>
                 )}
               </div>
               {players.length > 0 && (
                 <button 
                   onClick={handleClearPlayers}
                   disabled={clearingPlayers}
                   className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 shrink-0 self-start md:self-auto"
                 >
                   {clearingPlayers ? "Clearing..." : "Clear All"}
                 </button>
               )}
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max pb-4">
               {filteredPlayers.map(p => (
                 <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col gap-1 hover:border-white/30 transition relative group">
                   <div className="flex items-start gap-4 w-full">
                     {p.photoUrl ? (
                       <img referrerPolicy="no-referrer" src={p.photoUrl} alt={p.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/10 bg-black/50 flex-shrink-0" />
                     ) : (
                       <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center font-black text-xl text-white/50 border-2 border-white/5 flex-shrink-0">{p.name.charAt(0)}</div>
                     )}
                     <div className="overflow-hidden flex-1 min-w-0">
                       <div className="font-bold truncate text-white text-base mb-0.5" title={p.name}>{p.name}</div>
                       <div className="text-[10px] text-brand font-bold uppercase tracking-wider mb-1.5">{p.role}</div>
                       <div className="text-xs font-mono font-bold text-gray-300">₹{(p.basePrice / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L</div>
                     </div>
                   </div>
                   
                   <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3 mt-3 w-full">
                      <div className="relative flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-md flex items-center justify-center text-[10px] uppercase font-black border cursor-default tracking-widest ${
                          p.status === 'SOLD' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                            : p.status === 'UNSOLD'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {p.status !== 'SOLD' && (
                          <button
                            onClick={() => handleEditPlayer(p)}
                            title="Edit Player"
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition border border-blue-500/30 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                       {p.status !== 'PENDING' && (
                         <button
                           onClick={() => handleResetPlayer(p.id)}
                           title="Reset Player"
                           className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition border border-orange-500/30 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                         >
                           <RotateCcw className="w-4 h-4" />
                         </button>
                       )}
                       <button
                         onClick={() => handleDeletePlayer(p.id)}
                         title="Delete Player"
                         className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 transition border border-red-500/30 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                      </div>
                   </div>
                 </div>
               ))}
               {filteredPlayers.length === 0 && <div className="col-span-full text-center text-gray-500 py-10">{players.length === 0 ? "No players added yet" : "No players found"}</div>}
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
                 <div key={t.id} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 hover:border-accent/30 transition group">
                   {t.logoUrl ? (
                     <img referrerPolicy="no-referrer" src={t.logoUrl} alt={t.name} className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0" />
                   ) : (
                     <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg text-white/50 flex-shrink-0">{t.shortName}</div>
                   )}
                   <div className="overflow-hidden flex-1 min-w-0">
                     <div className="font-bold truncate text-white text-sm">{t.shortName}</div>
                     <div className="text-xs text-gray-400">₹{(t.budget / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L</div>
                   </div>
                    <button
                      onClick={() => handleEditTeam(t)}
                      title="Edit Team"
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition border border-[#D4AF37]/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                   <button
                     onClick={() => handleDeleteTeam(t.id)}
                     title="Delete Team"
                     className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 transition border border-red-500/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
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
