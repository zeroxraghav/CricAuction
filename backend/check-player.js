const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const players = await prisma.player.findMany({
        where: {
            name: {
                contains: 'Madhav',
                mode: 'insensitive'
            }
        },
        select: {
            name: true,
            photoUrl: true
        }
    });
    console.dir(players, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
