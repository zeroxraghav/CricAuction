const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const t = await prisma.team.findFirst();
    console.log(t);
  } catch(e) {
    console.log(e);
  }
}
run();
