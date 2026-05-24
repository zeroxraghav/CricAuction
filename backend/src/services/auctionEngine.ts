import { prisma } from '../prisma';

interface ProcessBidData {
  auctionId: string;
  playerId: string;
  teamId: string;
  amount: number;
}

export const processBid = async (data: ProcessBidData) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch team
      const team = await tx.team.findUnique({ where: { id: data.teamId } });
      if (!team) throw new Error('Team not found');

      // 2. Check if team has enough purse
      if (team.remainingPurse < data.amount) {
        throw new Error('Insufficient purse');
      }

      // 3. Fetch player
      const player = await tx.player.findUnique({ where: { id: data.playerId } });
      if (!player) throw new Error('Player not found');
      if (player.status === 'SOLD') {
        throw new Error('Player already sold');
      }

      // 4. Fetch highest bid for this player to ensure new bid is higher
      const highestBid = await tx.bid.findFirst({
        where: { playerId: data.playerId },
        orderBy: { amount: 'desc' }
      });

      if (highestBid && data.amount <= highestBid.amount) {
        throw new Error('Bid must be higher than current highest bid');
      }

      if (data.amount < player.basePrice) {
         throw new Error('Bid must be at least the base price');
      }

      // 5. Create new bid
      const newBid = await tx.bid.create({
        data: {
          auctionId: data.auctionId,
          playerId: data.playerId,
          teamId: data.teamId,
          amount: data.amount,
        }
      });

      return newBid;
    });

    return { success: true, bid: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
