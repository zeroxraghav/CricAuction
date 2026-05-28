async function test() {
  const auctionRes = await fetch('http://localhost:4000/api/public/auctions');
  const auctions = await auctionRes.json();
  console.log('Auctions:', auctions);
}

test();
