import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const auction = await prisma.auction.create({
      data: {
        name: "Test Auction",
        hostId: "host-1",
      }
    });
    const team = await prisma.team.create({
      data: {
        name: "Test Team",
        shortName: "TT",
        budget: 100000,
        remainingPurse: 100000,
        auctionId: auction.id
      }
    });
    
    // Now try to fetch it with WRONG auctionId
    const found1 = await prisma.team.findUnique({
      where: {
        id: team.id,
        auctionId: "wrong-auction-id"
      }
    });
    console.log("Found with wrong auctionId:", found1);

    // Now try to fetch it with RIGHT auctionId
    const found2 = await prisma.team.findUnique({
      where: {
        id: team.id,
        auctionId: auction.id
      }
    });
    console.log("Found with right auctionId:", found2);
    
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.auction.delete({ where: { id: auction.id } });
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
