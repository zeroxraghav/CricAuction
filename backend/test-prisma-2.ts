import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const auction = await prisma.auction.create({
      data: {
        name: "Test",
        hostId: "host-1",
      }
    });
    console.log("Created:", auction.id);
    
    // Now try to fetch it with a WRONG hostId
    const found1 = await prisma.auction.findUnique({
      where: {
        id: auction.id,
        hostId: "host-2"
      }
    });
    console.log("Found with wrong hostId:", found1);

    // Now try to fetch it with the RIGHT hostId
    const found2 = await prisma.auction.findUnique({
      where: {
        id: auction.id,
        hostId: "host-1"
      }
    });
    console.log("Found with right hostId:", found2);
    
    await prisma.auction.delete({ where: { id: auction.id } });
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
