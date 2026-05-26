import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { name: true, photoUrl: true, createdAt: true }
  });
  console.log("Last 10 Players added:", JSON.stringify(players, null, 2));
}

main();
