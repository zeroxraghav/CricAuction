const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const validTeams = [
      {
        name: 'Mumbai Warriors',
        shortName: 'MW',
        logoUrl: 'https://example.com/logo.png',
        budget: 10000000,
        remainingPurse: 10000000,
        maxPlayers: 15,
        auctionId: '9b7dcd1e-747c-4a92-8f31-66b8a25256fa'
      }
    ];
    await prisma.team.createMany({ data: validTeams, skipDuplicates: true });
    console.log("Success");
  } catch(e) {
    console.error(e);
  }
}
run();
