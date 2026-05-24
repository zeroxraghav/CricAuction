import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { SocketEvents } from 'shared';

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting backend automated tests...");
  
  // 1. Setup Data
  const hostId = "test-host-" + Date.now();
  const auction = await prisma.auction.create({
    data: {
      name: "Automated Test Auction",
      hostId: hostId,
      status: "IDLE"
    }
  });
  
  const team1 = await prisma.team.create({
    data: {
      name: "Test Team 1", shortName: "TT1", budget: 1000, remainingPurse: 1000, auctionId: auction.id
    }
  });

  const team2 = await prisma.team.create({
    data: {
      name: "Test Team 2", shortName: "TT2", budget: 1000, remainingPurse: 1000, auctionId: auction.id
    }
  });

  const player = await prisma.player.create({
    data: {
      name: "Test Player", country: "Test", role: "BATSMAN", basePrice: 100, status: "PENDING", auctionId: auction.id
    }
  });

  console.log(`Created Auction: ${auction.id}`);

  // Fake JWT
  const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI${hostId}In0.signature`;

  // 2. Connect Sockets
  const hostSocket = io('http://localhost:4000', {
    auth: { token: fakeToken }
  });

  const spectatorSocket = io('http://localhost:4000');

  let passed = true;

  hostSocket.on('connect', () => {
    hostSocket.emit(SocketEvents.JOIN_AUCTION, auction.id);
  });

  spectatorSocket.on('connect', () => {
    spectatorSocket.emit(SocketEvents.JOIN_AUCTION, auction.id);
  });

  // Wait for connections
  await new Promise(r => setTimeout(r, 1000));

  // Listeners
  let stateUpdates = 0;
  spectatorSocket.on(SocketEvents.AUCTION_STATE_UPDATE, (state) => {
    stateUpdates++;
  });

  // Action 1: Next Player
  console.log("-> Emitting NEXT_PLAYER");
  hostSocket.emit(SocketEvents.NEXT_PLAYER, { auctionId: auction.id });
  await new Promise(r => setTimeout(r, 500));

  // Action 2: Place Bid (Team 1)
  console.log("-> Emitting PLACE_BID for Team 1 (200)");
  hostSocket.emit(SocketEvents.PLACE_BID, { auctionId: auction.id, teamId: team1.id, amount: 200 });
  await new Promise(r => setTimeout(r, 500));

  // Action 3: Place Bid (Team 2)
  console.log("-> Emitting PLACE_BID for Team 2 (300)");
  hostSocket.emit(SocketEvents.PLACE_BID, { auctionId: auction.id, teamId: team2.id, amount: 300 });
  await new Promise(r => setTimeout(r, 500));

  // Action 4: Reset Bids
  console.log("-> Emitting RESET_CURRENT_BIDS");
  hostSocket.emit(SocketEvents.RESET_CURRENT_BIDS, { auctionId: auction.id });
  await new Promise(r => setTimeout(r, 500));

  // Action 5: Place Bid (Team 1)
  console.log("-> Emitting PLACE_BID for Team 1 (150)");
  hostSocket.emit(SocketEvents.PLACE_BID, { auctionId: auction.id, teamId: team1.id, amount: 150 });
  await new Promise(r => setTimeout(r, 500));

  // Action 6: Sell Player
  console.log("-> Emitting PLAYER_SOLD");
  hostSocket.emit(SocketEvents.PLAYER_SOLD, { auctionId: auction.id });
  await new Promise(r => setTimeout(r, 1000));

  // Verify Database State
  const updatedPlayer = await prisma.player.findUnique({ where: { id: player.id } });
  const updatedTeam = await prisma.team.findUnique({ where: { id: team1.id } });

  if (updatedPlayer?.status !== 'SOLD' || updatedPlayer?.soldPrice !== 150) {
    console.error("FAIL: Player not sold correctly.", updatedPlayer);
    passed = false;
  } else {
    console.log("SUCCESS: Player status updated to SOLD with correct price.");
  }

  if (updatedTeam?.remainingPurse !== 850) {
    console.error("FAIL: Team purse not deducted correctly.", updatedTeam);
    passed = false;
  } else {
    console.log("SUCCESS: Team purse deducted correctly.");
  }

  if (stateUpdates < 5) {
    console.error("FAIL: Spectator did not receive enough state updates.");
    passed = false;
  } else {
    console.log(`SUCCESS: Spectator received ${stateUpdates} state updates.`);
  }

  // Cleanup
  await prisma.auction.delete({ where: { id: auction.id } });
  hostSocket.disconnect();
  spectatorSocket.disconnect();
  await prisma.$disconnect();

  if (passed) {
    console.log("\nALL TESTS PASSED SUCCESSFULLY! 🚀");
    process.exit(0);
  } else {
    console.error("\nTESTS FAILED! ❌");
    process.exit(1);
  }
}

runTest().catch(console.error);
