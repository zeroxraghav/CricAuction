import express from 'express';
import { prisma } from '../prisma';

const router = express.Router();

router.get('/auctions/:id/teams', async (req, res) => {
  const { id } = req.params;
  try {
    const teams = await prisma.team.findMany({
      where: { auctionId: id },
      include: {
        players: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/auctions/:id/players', async (req, res) => {
  const { id } = req.params;
  try {
    const players = await prisma.player.findMany({
      where: { auctionId: id },
      orderBy: { name: 'asc' }
    });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.get('/auctions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const auction = await prisma.auction.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, createdAt: true }
    });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
});

export default router;
