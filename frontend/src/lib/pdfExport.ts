export const exportAuctionSummaryPDF = async (auctionInfo: any, teams: any[], players: any[]) => {
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const getRoleColor = (role: string) => {
    if (role.includes('BAT')) return 'background: #dbeafe; color: #1e40af;';
    if (role.includes('BOWL')) return 'background: #dcfce7; color: #166534;';
    if (role.includes('ALL')) return 'background: #fef9c3; color: #854d0e;';
    if (role.includes('WICKET')) return 'background: #f3e8ff; color: #6b21a8;';
    return 'background: #f1f5f9; color: #475569;'; 
  };

  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Auction Summary - ${auctionInfo?.name || 'BidArena'}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; padding: 20px; color: #0f172a; }
      .header-title { text-align: center; color: #1e293b; margin-bottom: 20px; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
      .team-container { background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
      .team-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
      .team-name { font-size: 20px; font-weight: bold; color: #2563eb; display: flex; align-items: center; gap: 12px; }
      .team-logo { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; }
      .stats { display: flex; gap: 8px; flex-wrap: wrap; }
      .stat-badge { background: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; border: 1px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f8fafc; text-align: left; padding: 10px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 14px; }
      td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 14px; }
      .role-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      .price { font-family: monospace; font-weight: bold; font-size: 13px; }
      .unsold-container { background: #fff1f2; border: 1px solid #ffe4e6; }
      .unsold-title { color: #e11d48; border-bottom-color: #fecdd3; }
      .unsold-th { background: #ffe4e6; color: #be123c; border-bottom-color: #fecdd3; }
    </style>
  </head>
  <body>
    <div class="header-title">${auctionInfo?.name || 'BidArena'} - Final Summary</div>
  `;

  teams.forEach(team => {
    const spent = team.budget - team.remainingPurse;
    html += `
    <div class="team-container">
      <div class="team-header">
        <div class="team-name">
          ${team.logoUrl ? `<img src="${team.logoUrl}" class="team-logo" />` : ''}
          ${team.name}
        </div>
        <div class="stats">
          <div class="stat-badge">Total Budget: ${fmt(team.budget)}</div>
          <div class="stat-badge" style="background: #fef2f2; color: #991b1b;">Spent: ${fmt(spent)}</div>
          <div class="stat-badge" style="background: #f0fdf4; color: #166534;">Remaining: ${fmt(team.remainingPurse)}</div>
          <div class="stat-badge">Squad Size: ${team.players?.length || 0}</div>
        </div>
      </div>
      ${team.players && team.players.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Player Name</th>
            <th>Role</th>
            <th>Base Price</th>
            <th>Sold Price</th>
          </tr>
        </thead>
        <tbody>
          ${team.players.map((p: any) => `
          <tr class="player-row">
            <td style="font-weight: bold;">${p.name}</td>
            <td><span class="role-badge" style="${getRoleColor(p.role)}">${p.role}</span></td>
            <td class="price" style="color: #64748b;">${fmt(p.basePrice)}</td>
            <td class="price text-green-600">
              ${p.status === 'RETAINED' ? '<span class="role-badge" style="background: #fef08a; color: #854d0e;">RETAINED</span>' : fmt(p.soldPrice)}
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<div style="color: #64748b; font-style: italic;">No players bought yet.</div>'}
    </div>
    `;
  });

  const unsold = players.filter(p => p.status === 'UNSOLD');
  if (unsold.length > 0) {
    html += `
    <div class="team-container unsold-container">
      <div class="team-header unsold-title">
        <div class="team-name" style="color: #e11d48;">Unsold Players</div>
        <div class="stat-badge" style="background: #ffe4e6; color: #be123c; border-color: #fecdd3;">Count: ${unsold.length}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="unsold-th">Player Name</th>
            <th class="unsold-th">Role</th>
            <th class="unsold-th">Base Price</th>
          </tr>
        </thead>
        <tbody>
          ${unsold.map((p: any) => `
          <tr class="player-row">
            <td style="font-weight: bold;">${p.name}</td>
            <td><span class="role-badge" style="${getRoleColor(p.role)}">${p.role}</span></td>
            <td class="price">${fmt(p.basePrice)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }

  html += `
  </body>
  </html>
  `;

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      iframe.contentWindow?.focus();
      // Slight delay to ensure images/fonts load if any
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    }
  } catch (error) {
    console.error("Failed to generate PDF", error);
  }
};
