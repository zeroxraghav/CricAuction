import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const players = [
    { name: 'Virat Kohli', country: 'India', role: 'BATSMAN', basePrice: 20000000, category: 'Marquee' },
    { name: 'Pat Cummins', country: 'Australia', role: 'BOWLER', basePrice: 20000000, category: 'Marquee' },
    { name: 'Rashid Khan', country: 'Afghanistan', role: 'ALLROUNDER', basePrice: 20000000, category: 'Marquee' },
    { name: 'MS Dhoni', country: 'India', role: 'WICKETKEEPER', basePrice: 20000000, category: 'Marquee' },
  ];

  for (const p of players) {
    await prisma.player.create({ data: { ...p, status: 'PENDING' } as any });
  }
  console.log('Added 4 test players to the auction pool!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
