import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.player.updateMany({
      data: { status: 'PENDING' }
    });
    console.log("Reset players:", res.count);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
