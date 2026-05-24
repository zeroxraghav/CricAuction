import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cricauction.com' },
    update: {},
    create: {
      email: 'admin@cricauction.com',
      password: 'admin', // plain text for demo
      role: 'ADMIN',
    },
  });
  console.log('Admin created:', admin.email);

  // Create a Demo Team
  const team = await prisma.team.upsert({
    where: { shortName: 'CSK' },
    update: {},
    create: {
      name: 'Chennai Super Kings',
      shortName: 'CSK',
      budget: 850000000,
      remainingPurse: 850000000,
    }
  });

  // Create Team Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@cricauction.com' },
    update: {},
    create: {
      email: 'owner@cricauction.com',
      password: 'owner', // plain text for demo
      role: 'OWNER',
      ownedTeam: {
        connect: { id: team.id }
      }
    },
  });
  console.log('Owner created:', owner.email, 'for team', team.shortName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
