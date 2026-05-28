import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { PlayerRole } from '@prisma/client';
import { getAuth } from '@clerk/express';
import { parse } from 'csv-parse';

const router = express.Router();
const csvUpload = multer({ dest: 'uploads/' });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/photos';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const photoUpload = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

function convertGoogleDriveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('drive.google.com')) {
    let fileId = '';
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch && openMatch[1]) {
      fileId = openMatch[1];
    } else {
      const fileDMatch = url.match(/\/file\/d\/([^\/]+)/);
      if (fileDMatch && fileDMatch[1]) {
        fileId = fileDMatch[1];
      }
    }
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  return url;
}

// Require authentication for all host routes
router.use((req: any, res: any, next: any) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      console.error('Unauthorized request to auctions route', req.path);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.auth = auth;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal Auth Error' });
  }
});

// GET my auctions
router.get('/', async (req: any, res: any) => {
  const hostId = req.auth.userId;
  try {
    const auctions = await prisma.auction.findMany({
      where: { hostId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

// POST create auction
router.post('/', async (req: any, res: any) => {
  const hostId = req.auth.userId;
  const { name, sport } = req.body;
  console.log('Create auction attempt for hostId:', hostId, 'name:', name, 'sport:', sport);
  if (!name) return res.status(400).json({ error: 'Auction name required' });
  const auctionSport = sport === 'VOLLEYBALL' ? 'VOLLEYBALL' : 'CRICKET';
  try {
    const auction = await prisma.auction.create({
      data: { name, sport: auctionSport, hostId, status: 'UPCOMING' }
    });
    res.json(auction);
  } catch (err) {
    console.error('Create auction error:', err);
    res.status(500).json({ error: 'Failed to create auction' });
  }
});

// GET specific auction details (Host side)
router.get('/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;
  try {
    const auction = await prisma.auction.findFirst({
      where: { id, hostId },
      include: { teams: true, players: true }
    });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
});

// Upload a photo and return the URL
router.post('/upload-photo', photoUpload.single('photo'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  const photoUrl = `http://localhost:4000/uploads/photos/${req.file.filename}`;
  res.json({ photoUrl });
});

// Upload CSV for specific auction
router.post('/:id/players/csv', csvUpload.single('file'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const { id } = req.params;
  const hostId = req.auth.userId;
  console.log(`[DEBUG] POST /:id/players/csv hit. id=${id}, hostId=${hostId}`);

  // Verify ownership
  const auction = await prisma.auction.findFirst({ where: { id, hostId } });
  if (!auction) {
    console.log(`[DEBUG] Auction not found in /players/csv for id=${id} and hostId=${hostId}`);
    return res.status(404).json({ error: 'Auction not found' });
  }

  const defaultBasePriceValue = parseFloat(req.body.defaultBasePrice) || 100000;

  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        const defaultRole = auction.sport === 'VOLLEYBALL' ? 'SETTER' : 'BATSMAN';
        if (results.length > 0) {
          console.log('Player CSV - first row raw keys:', Object.keys(results[0]));
        }
        const validPlayers = results.map(row => {
          const normalized: any = {};
          for (const key of Object.keys(row)) {
            const cleanKey = key.replace(/^\ufeff/, '').toLowerCase().trim().replace(/[\s_-]+/g, '');
            const val = row[key];
            normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
          }

          const name = normalized.name || normalized.playername || normalized.player || '';
          let roleInput = normalized.role?.toUpperCase()?.replace(/\s+/g, '')?.replace(/[-_]/g, '') || defaultRole;
          
          if (roleInput === 'WICKETKEEPER' || roleInput === 'WK' || roleInput === 'WICKET-KEEPER') roleInput = 'WICKETKEEPER';
          if (roleInput === 'ALLROUNDER' || roleInput === 'AR' || roleInput === 'ALL-ROUNDER') roleInput = 'ALLROUNDER';
          
          const validRoles = ['BATSMAN', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER', 'SETTER', 'SPIKER', 'LIBERO', 'BLOCKER', 'OPPOSITE', 'DEFENDER'];
          if (!validRoles.includes(roleInput)) {
            roleInput = defaultRole;
          }
          const photoUrl = convertGoogleDriveUrl(normalized.photourl || normalized.photo || normalized.imageurl || normalized.image);
          const age = String(normalized.age || normalized.playerage || 'N/A');
          let basePrice = parseInt(normalized.baseprice) || defaultBasePriceValue;
          if (basePrice < 10000) {
            basePrice = basePrice * 100000;
          }

          return {
            name,
            photoUrl,
            age,
            role: roleInput as PlayerRole,
            basePrice,
            auctionId: id
          };
        });

        await prisma.player.createMany({ data: validPlayers, skipDuplicates: true });
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Players imported successfully', count: validPlayers.length });
      } catch (err: any) {
        console.error('Error in players CSV import:', err);
        res.status(500).json({ error: `Failed to process CSV: ${err.message}` });
      }
    });
});

// Bulk Upload Teams (CSV)
router.post('/:id/teams/csv', csvUpload.single('file'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const { id } = req.params;
  const hostId = req.auth.userId;

  // Verify ownership
  const auction = await prisma.auction.findFirst({ where: { id, hostId } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const defaultBudgetValue = parseFloat(req.body.defaultBudget) || 10000000;
  const defaultMaxPlayersValue = parseInt(req.body.defaultMaxPlayers) || 15;

  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        if (results.length > 0) {
          console.log('Team CSV - first row raw keys:', Object.keys(results[0]));
        }
        const validTeams = results.map(row => {
          const normalized: any = {};
          for (const key of Object.keys(row)) {
            const cleanKey = key.replace(/^\ufeff/, '').toLowerCase().trim().replace(/[\s_-]+/g, '');
            const val = row[key];
            normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
          }

          const name = normalized.name || normalized.teamname || normalized.team || '';
          const shortName = normalized.shortname || normalized.teamshortname || normalized.short || normalized.code || '';
          let budget = parseInt(normalized.budget) || defaultBudgetValue;
          if (budget < 10000) {
            budget = budget * 100000;
          }
          const maxPlayers = parseInt(normalized.maxplayers) || defaultMaxPlayersValue;
          const logoUrl = convertGoogleDriveUrl(normalized.logourl || normalized.logo || normalized.imageurl || normalized.image);

          return {
            name,
            shortName,
            logoUrl,
            budget: budget,
            remainingPurse: budget,
            maxPlayers,
            auctionId: id
          };
        });

        await prisma.team.createMany({ data: validTeams, skipDuplicates: true });
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Teams imported successfully', count: validTeams.length });
      } catch (err: any) {
        console.error('Error in teams CSV import:', err);
        res.status(500).json({ error: `Failed to process teams CSV: ${err.message}` });
      }
    });
});

// Create Team for specific auction
router.post('/:id/teams', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;
  const { name, shortName, budget, logoUrl, maxPlayers } = req.body;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const team = await prisma.team.create({
      data: {
        name, shortName, logoUrl: convertGoogleDriveUrl(logoUrl),
        budget: parseFloat(budget),
        remainingPurse: parseFloat(budget),
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : 15,
        auctionId: id
      }
    });
    res.json({ message: 'Team created successfully', team });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Team name/short name already exists in this auction' });
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update Team for specific auction
router.put('/:id/teams/:teamId', async (req: any, res: any) => {
  const { id, teamId } = req.params;
  const hostId = req.auth.userId;
  console.log(`[DEBUG] PUT /:id/teams/:teamId hit. id=${id}, teamId=${teamId}, hostId=${hostId}`);
  const { name, shortName, budget, logoUrl, maxPlayers } = req.body;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) {
      console.log(`[DEBUG] Auction not found for id=${id} and hostId=${hostId}`);
      return res.status(404).json({ error: 'Auction not found' });
    }

    const team = await prisma.team.findFirst({ where: { id: teamId, auctionId: id } });
    if (!team) {
      console.log(`[DEBUG] Team not found for teamId=${teamId} and auctionId=${id}`);
      return res.status(404).json({ error: 'Team not found' });
    }

    const newBudget = parseFloat(budget);
    const spent = team.budget - team.remainingPurse;
    if (newBudget < spent) {
      return res.status(400).json({ error: `Budget cannot be less than the amount already spent (${spent})` });
    }
    const newRemainingPurse = team.remainingPurse + (newBudget - team.budget);

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        name,
        shortName,
        logoUrl: convertGoogleDriveUrl(logoUrl),
        budget: newBudget,
        remainingPurse: newRemainingPurse,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : team.maxPlayers
      }
    });
    res.json({ message: 'Team updated successfully', team: updatedTeam });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Team name/short name already exists in this auction' });
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Create Player for specific auction
router.post('/:id/players', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;
  const { name, age, role, basePrice, photoUrl } = req.body;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.create({
      data: {
        name, photoUrl: convertGoogleDriveUrl(photoUrl), age: String(age || ''), role,
        basePrice: parseFloat(basePrice),
        status: 'PENDING',
        auctionId: id
      }
    });
    res.json({ message: 'Player added successfully', player });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Update Player for specific auction
router.put('/:id/players/:playerId', async (req: any, res: any) => {
  const { id, playerId } = req.params;
  const hostId = req.auth.userId;
  const { name, age, role, basePrice, photoUrl } = req.body;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.findFirst({ where: { id: playerId, auctionId: id } });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    if (player.status === 'SOLD') {
      return res.status(400).json({ error: 'Cannot edit a player who has already been sold' });
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: {
        name,
        age: String(age || ''),
        role,
        basePrice: parseFloat(basePrice),
        photoUrl: convertGoogleDriveUrl(photoUrl)
      }
    });
    res.json({ message: 'Player updated successfully', player: updatedPlayer });
  } catch (err) {
    console.error("Update player error:", err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete a single player
router.delete('/:id/players/:playerId', async (req: any, res: any) => {
  const { id, playerId } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.findFirst({ where: { id: playerId, auctionId: id } });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    await prisma.$transaction(async (tx) => {
      // If SOLD, refund the team
      if (player.status === 'SOLD' && player.teamId && player.soldPrice) {
        await tx.team.update({
          where: { id: player.teamId },
          data: { remainingPurse: { increment: player.soldPrice } }
        });
      }
      // Delete all bids for this player
      await tx.bid.deleteMany({ where: { playerId: player.id } });
      // Delete the player
      await tx.player.delete({ where: { id: player.id } });
    });

    res.json({ message: `Player ${player.name} deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Delete a single team
router.delete('/:id/teams/:teamId', async (req: any, res: any) => {
  const { id, teamId } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const team = await prisma.team.findFirst({ where: { id: teamId, auctionId: id } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if any players are sold to this team
    const soldToTeam = await prisma.player.count({ where: { teamId: teamId, status: 'SOLD' } });
    if (soldToTeam > 0) {
      return res.status(400).json({ error: 'Cannot delete team: Players are sold to this team. Reset them first.' });
    }

    await prisma.team.delete({ where: { id: teamId } });
    res.json({ message: `Team ${team.name} deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Clear all players for specific auction
router.delete('/:id/players', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const soldCount = await prisma.player.count({ where: { auctionId: id, status: 'SOLD' } });
    if (soldCount > 0) {
      return res.status(400).json({ error: 'Cannot clear players: Some players are already sold.' });
    }

    await prisma.player.deleteMany({ where: { auctionId: id } });
    res.json({ message: 'All players cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear players' });
  }
});

// Reset auction
router.post('/:id/reset', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    await prisma.$transaction(async (tx) => {
      // 1. Reset all players
      await tx.player.updateMany({
        where: { auctionId: id },
        data: {
          status: 'PENDING',
          soldPrice: null,
          teamId: null,
          isRecalled: false
        }
      });

      // 2. Clear all bids (assuming bids are linked to players in this auction, but actually we can just clear all bids for players in this auction)
      const players = await tx.player.findMany({ where: { auctionId: id }, select: { id: true } });
      const playerIds = players.map(p => p.id);
      if (playerIds.length > 0) {
        await tx.bid.deleteMany({ where: { playerId: { in: playerIds } } });
      }

      // 3. Reset teams remainingPurse to budget
      const teams = await tx.team.findMany({ where: { auctionId: id } });
      for (const team of teams) {
        await tx.team.update({
          where: { id: team.id },
          data: { remainingPurse: team.budget }
        });
      }

      // 4. Set auction status to IDLE
      await tx.auction.update({
        where: { id: id },
        data: { status: 'IDLE' }
      });
    });

    res.json({ message: 'Auction reset successfully' });
  } catch (err) {
    console.error('Reset auction error:', err);
    res.status(500).json({ error: 'Failed to reset auction' });
  }
});

// Clear all teams for specific auction
router.delete('/:id/teams', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const soldCount = await prisma.player.count({ where: { auctionId: id, status: 'SOLD' } });
    if (soldCount > 0) {
      return res.status(400).json({ error: 'Cannot clear teams: Some players are already sold.' });
    }

    await prisma.team.deleteMany({ where: { auctionId: id } });
    res.json({ message: 'All teams cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear teams' });
  }
});

// Delete Auction
router.delete('/:id', async (req: any, res: any) => {
  const io = (req as any).io;
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    // Since onDelete: Cascade is configured, this deletes Teams, Players, Bids as well
    await prisma.auction.delete({ where: { id } });

    io.to(id).emit('AUCTION_DELETED');
    
    // Cleanup Redis keys if using them, skipping for simplicity in logic
    res.json({ message: 'Auction fully deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete auction' });
  }
});

// Reset a Player's status and refund team purse
router.post('/:id/players/:playerId/reset', async (req: any, res: any) => {
  const { id, playerId } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findFirst({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.findFirst({ where: { id: playerId, auctionId: id } });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    if (player.status === 'PENDING') {
      return res.status(400).json({ error: 'Player is already pending' });
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // 1. If SOLD, refund the team
      if (player.status === 'SOLD' && player.teamId && player.soldPrice) {
        await tx.team.update({
          where: { id: player.teamId },
          data: { remainingPurse: { increment: player.soldPrice } }
        });
      }

      // 2. Delete all bids for this player
      await tx.bid.deleteMany({
        where: { playerId: player.id }
      });

      // 3. Reset the player
      await tx.player.update({
        where: { id: player.id },
        data: {
          status: 'PENDING',
          soldPrice: null,
          teamId: null
        }
      });
    });

    res.json({ message: 'Player reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset player' });
  }
});

export default router;
