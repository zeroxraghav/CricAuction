const fs = require('fs');

async function test() {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync('test_teams.csv')]), 'test_teams.csv');
  formData.append('defaultBudget', '100');
  formData.append('defaultMaxPlayers', '15');

  try {
    const res = await fetch('http://localhost:4000/api/auctions/9b7dcd1e-747c-4a92-8f31-66b8a25256fa/teams/csv', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log(res.status, data);
  } catch (e) {
    console.error(e.message);
  }
}
test();
