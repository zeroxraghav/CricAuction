const fs = require('fs');

const files = [
    'src/app/host/[auctionId]/live/page.tsx',
    'src/app/host/[auctionId]/setup/page.tsx',
    'src/app/live/[id]/page.tsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // We only want to replace <img that don't already have referrerPolicy="no-referrer"
    // Also we want to handle any <img tag
    content = content.replace(/<img /g, '<img referrerPolicy="no-referrer" ');
    // Deduplicate if already present
    content = content.replace(/referrerPolicy="no-referrer" referrerPolicy="no-referrer"/g, 'referrerPolicy="no-referrer"');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
});
