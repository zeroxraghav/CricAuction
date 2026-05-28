const fs = require('fs');
const { parse } = require('csv-parse');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultBudgetValue = 10000000;
const defaultMaxPlayersValue = 15;
const id = '9b7dcd1e-747c-4a92-8f31-66b8a25256fa'; // User's auction ID

function convertGoogleDriveUrl(url) {
  if (!url) return null;
  return url;
}

const results = [];
fs.createReadStream('test_teams.csv')
  .pipe(parse({ columns: true, skip_empty_lines: true }))
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      const validTeams = results.map(row => {
        const normalized = {};
        for (const key of Object.keys(row)) {
          const cleanKey = key.replace(/^\ufeff/, '').toLowerCase().trim().replace(/[\s_-]+/g, '');
          const val = row[key];
          normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
        }

        const name = normalized.name || normalized.teamname || normalized.team || '';
        const shortName = normalized.shortname || normalized.teamshortname || normalized.short || normalized.code || '';
        let budget = parseInt(normalized.budget) || defaultBudgetValue;
        if (budget < 10000) {
          budget = budget * 100000;
        }
        const maxPlayers = parseInt(normalized.maxplayers) || defaultMaxPlayersValue;
        const logoUrl = convertGoogleDriveUrl(normalized.logourl || normalized.logo || normalized.imageurl || normalized.image);

        return {
          name,
          shortName,
          logoUrl,
          budget: budget,
          remainingPurse: budget,
          maxPlayers,
          auctionId: id
        };
      });

      console.log(validTeams);
      await prisma.team.createMany({ data: validTeams, skipDuplicates: true });
      console.log("Success");
    } catch (err) {
      console.error(err);
    }
  });
