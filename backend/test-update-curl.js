const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const auction = await prisma.auction.create({
    data: { name: "Test Auction", hostId: "test-user-123" }
  });
  console.log("Auction ID:", auction.id);

  const team = await prisma.team.create({
    data: { name: "Team 1", shortName: "T1", budget: 10000, remainingPurse: 10000, auctionId: auction.id }
  });
  console.log("Team ID:", team.id);

  // Now we need to update it via the express server running on localhost:4000
  // But wait, it needs authentication!
  // I can bypass it for testing if I modify auctions.ts locally
}
run();
