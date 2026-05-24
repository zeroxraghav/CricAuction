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
  const { name } = req.body;
  console.log('Create auction attempt for hostId:', hostId, 'name:', name);
  if (!name) return res.status(400).json({ error: 'Auction name required' });
  try {
    const auction = await prisma.auction.create({
      data: { name, hostId, status: 'UPCOMING' }
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
    const auction = await prisma.auction.findUnique({
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

  // Verify ownership
  const auction = await prisma.auction.findUnique({ where: { id, hostId } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        const validPlayers = results.map(row => ({
          name: row.name,
          country: row.country || 'Unknown',
          role: (row.role?.toUpperCase() || 'BATSMAN') as PlayerRole,
          basePrice: parseInt(row.basePrice) || 2000000,
          category: row.category || 'General',
          auctionId: id
        }));

        await prisma.player.createMany({ data: validPlayers, skipDuplicates: true });
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Players imported successfully', count: validPlayers.length });
      } catch (err) {
        res.status(500).json({ error: 'Failed to process CSV' });
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
  const auction = await prisma.auction.findUnique({ where: { id, hostId } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        const validTeams = results.map(row => {
          const budget = parseInt(row.budget) || 850000000;
          return {
            name: row.name,
            shortName: row.shortName,
            logoUrl: row.logoUrl || null,
            budget: budget,
            remainingPurse: budget,
            auctionId: id
          };
        });

        await prisma.team.createMany({ data: validTeams, skipDuplicates: true });
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Teams imported successfully', count: validTeams.length });
      } catch (err) {
        res.status(500).json({ error: 'Failed to process teams CSV' });
      }
    });
});

// Create Team for specific auction
router.post('/:id/teams', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;
  const { name, shortName, budget, logoUrl } = req.body;

  try {
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const team = await prisma.team.create({
      data: {
        name, shortName, logoUrl,
        budget: parseFloat(budget),
        remainingPurse: parseFloat(budget),
        auctionId: id
      }
    });
    res.json({ message: 'Team created successfully', team });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Team name/short name already exists in this auction' });
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Create Player for specific auction
router.post('/:id/players', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;
  const { name, country, role, basePrice, category, photoUrl } = req.body;

  try {
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.create({
      data: {
        name, photoUrl, country, role,
        basePrice: parseFloat(basePrice),
        category, status: 'PENDING',
        auctionId: id
      }
    });
    res.json({ message: 'Player added successfully', player });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Clear all players for specific auction
router.delete('/:id/players', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
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

// Clear all teams for specific auction
router.delete('/:id/teams', async (req: any, res: any) => {
  const { id } = req.params;
  const hostId = req.auth.userId;

  try {
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
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
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
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
    const auction = await prisma.auction.findUnique({ where: { id, hostId } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const player = await prisma.player.findUnique({ where: { id: playerId, auctionId: id } });
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
