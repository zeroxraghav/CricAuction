import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const auction = await prisma.auction.findUnique({
      where: {
        id: "some-id",
        hostId: "some-host-id"
      }
    });
    console.log("Auction:", auction);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
