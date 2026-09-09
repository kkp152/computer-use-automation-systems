import http from 'node:http';
import url from 'node:url';
import { BANK_MEMBERS } from './data.js';

export interface ServerOptions {
  port?: number;
  showInterstitial?: boolean;
  simulateBlocker?: boolean;
}

export function createBankingServer(options: ServerOptions = {}) {
  const port = options.port || 3000;
  let showInterstitial = options.showInterstitial ?? false;
  let simulateBlocker = options.simulateBlocker ?? false;

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    const query = parsedUrl.query;

    // Check query params for runtime overrides
    if (query.interstitial === 'true') showInterstitial = true;
    if (query.interstitial === 'false') showInterstitial = false;
    if (query.blocker === 'true') simulateBlocker = true;
    if (query.blocker === 'false') simulateBlocker = false;

    // Handle interstitial dismiss action
    if (pathname === '/api/dismiss-interstitial' && req.method === 'POST') {
      showInterstitial = false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Interstitial dismissed' }));
      return;
    }

    // Handle supervisor unblock action
    if (pathname === '/api/supervisor-unblock' && req.method === 'POST') {
      simulateBlocker = false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Supervisor unblocked session' }));
      return;
    }

    // CSS Styling for legacy banking look & feel (table layouts, classic borders, distinct alerts)
    const baseCss = `
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: #eaedf1; margin: 0; padding: 0; color: #1a2530; }
      .app-header { background: #0c2340; color: #ffffff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #c59b27; }
      .institution-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
      .system-badge { background: #1e3a5f; padding: 4px 10px; border-radius: 3px; font-size: 12px; color: #d0e1fd; border: 1px solid #31537e; }
      .app-nav { background: #183354; padding: 0 24px; display: flex; gap: 4px; border-bottom: 1px solid #2a476e; }
      .app-nav a { color: #d0e1fd; text-decoration: none; padding: 10px 16px; font-size: 13px; font-weight: 600; display: inline-block; border-bottom: 3px solid transparent; }
      .app-nav a:hover, .app-nav a.active { background: #23436d; color: #ffffff; border-bottom: 3px solid #c59b27; }
      .container { max-width: 1100px; margin: 24px auto; padding: 0 20px; }
      .card { background: #ffffff; border: 1px solid #ccd4de; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
      .card-header { background: #f4f6f9; border-bottom: 1px solid #ccd4de; padding: 12px 18px; font-size: 15px; font-weight: 700; color: #0c2340; display: flex; justify-content: space-between; align-items: center; }
      .card-body { padding: 18px; }
      .legacy-grid { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
      .legacy-grid th { background: #edf1f6; color: #2c3e50; border: 1px solid #ccd4de; padding: 9px 12px; text-align: left; font-weight: 600; }
      .legacy-grid td { border: 1px solid #dce2e9; padding: 9px 12px; }
      .legacy-grid tr:nth-child(even) { background: #fbfcfd; }
      .legacy-grid tr:hover { background: #f0f4f9; }
      .btn { display: inline-block; padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 3px; cursor: pointer; border: 1px solid transparent; text-decoration: none; }
      .btn-primary { background: #0c2340; color: #ffffff; border-color: #071629; }
      .btn-primary:hover { background: #183354; }
      .btn-action { background: #2e7d32; color: #ffffff; padding: 5px 12px; font-size: 12px; }
      .btn-action:hover { background: #1b5e20; }
      .btn-secondary { background: #6c757d; color: #ffffff; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #2c3e50; }
      .form-control { width: 100%; max-width: 380px; padding: 8px 12px; font-size: 14px; border: 1px solid #aebac7; border-radius: 3px; }
      .alert { padding: 14px 18px; border-radius: 4px; margin-bottom: 18px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
      .alert-warning { background: #fff8e1; border: 1px solid #ffe082; color: #855300; }
      .alert-danger { background: #ffebee; border: 1px solid #ffcdd2; color: #b71c1c; }
      .alert-info { background: #e3f2fd; border: 1px solid #bbdefb; color: #0d47a1; }
      .badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 3px; }
      .badge-success { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
      .badge-gold { background: #fff8e1; color: #b78103; border: 1px solid #ffe082; }
      .badge-plat { background: #ede7f6; color: #512da8; border: 1px solid #d1c4e9; }
      .balance-hero { background: #f8fafc; border: 2px solid #0c2340; border-radius: 6px; padding: 18px; margin-bottom: 20px; display: flex; gap: 36px; }
      .balance-item { display: flex; flex-direction: column; }
      .balance-item .label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
      .balance-item .amount { font-size: 28px; font-weight: 800; color: #0c2340; margin-top: 4px; }
      .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); display: flex; justify-content: center; align-items: center; z-index: 1000; }
      .modal-dialog { background: #ffffff; width: 500px; max-width: 90%; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); border-top: 5px solid #c59b27; }
      .modal-header { padding: 16px 20px; border-bottom: 1px solid #eee; font-weight: 700; font-size: 16px; color: #0c2340; }
      .modal-body { padding: 20px; font-size: 14px; line-height: 1.5; color: #334155; }
      .modal-footer { padding: 14px 20px; background: #f8fafc; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
    `;

    // Interstitial Modal HTML (Recoverable condition)
    const interstitialHtml = showInterstitial ? `
      <div class="modal-backdrop" id="interstitialModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-dialog">
          <div class="modal-header" id="modalTitle">System Notice: Scheduled Maintenance</div>
          <div class="modal-body">
            <p><strong>Attention Core Banking Operator:</strong></p>
            <p>ApexCore batch settlement processing is scheduled for 11:00 PM EST. Please ensure all pending transactions are finalized prior to cutoff.</p>
            <p style="color: #64748b; font-size: 12px;">Notice Reference: SEC-NOT-2026-09</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="btnDismissNotice" onclick="dismissInterstitial()">Acknowledge & Dismiss</button>
          </div>
        </div>
      </div>
      <script>
        function dismissInterstitial() {
          fetch('/api/dismiss-interstitial', { method: 'POST' }).then(() => {
            document.getElementById('interstitialModal').remove();
          });
        }
      </script>
    ` : '';

    // Blocker / Roadblock HTML (Human Escalation trigger)
    const blockerHtml = simulateBlocker ? `
      <div class="alert alert-danger" role="alert" id="supervisorBlockerAlert">
        <div>
          <strong>SUPERVISOR INTERVENTION REQUIRED:</strong>
          Security policy trigger #8812 - Suspicious session concurrency detected. Terminal automation locked. An authorized human supervisor must review the session and authorize resumption.
        </div>
        <button class="btn btn-primary" style="margin-left: auto; white-space: nowrap;" onclick="supervisorUnlock()">Supervisor Override</button>
      </div>
      <script>
        function supervisorUnlock() {
          fetch('/api/supervisor-unblock', { method: 'POST' }).then(() => {
            location.reload();
          });
        }
      </script>
    ` : '';

    const pageShell = (title: string, navActive: string, content: string) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title} | ApexCore Banking Portal</title>
        <style>${baseCss}</style>
      </head>
      <body>
        <header class="app-header">
          <div class="institution-name">ApexCore Enterprise Banking v4.2 &mdash; Horizon Federal Credit Union</div>
          <div class="system-badge">Session: SEC-AUTH-9012 &bull; Station #14</div>
        </header>
        <nav class="app-nav">
          <a href="/" class="${navActive === 'home' ? 'active' : ''}">Dashboard</a>
          <a href="/members" class="${navActive === 'members' ? 'active' : ''}">Member Search</a>
          <a href="#" class="${navActive === 'transactions' ? 'active' : ''}">Batch Transactions</a>
          <a href="#" class="${navActive === 'wires' ? 'active' : ''}">Wires & ACH</a>
          <a href="#" class="${navActive === 'reports' ? 'active' : ''}">Regulatory Reports</a>
        </nav>
        <main class="container">
          ${interstitialHtml}
          ${blockerHtml}
          ${content}
        </main>
      </body>
      </html>
    `;

    // 1. Dashboard Route
    if (pathname === '/' || pathname === '/dashboard') {
      const content = `
        <div class="card">
          <div class="card-header">System Status & Servicing Console</div>
          <div class="card-body">
            <p>Welcome to the Horizon Federal Credit Union back-office servicing station. Use the top navigation to search member records or process servicing requests.</p>
            <div style="margin-top: 15px;">
              <a href="/members" class="btn btn-primary">Go to Member Search Directory</a>
            </div>
          </div>
        </div>
      `;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pageShell('Dashboard', 'home', content));
      return;
    }

    // 2. Member Search Route
    if (pathname === '/members') {
      const searchId = (query.memberId as string || '').trim();
      let resultsHtml = '';

      if (searchId) {
        const member = BANK_MEMBERS[searchId];
        if (member) {
          resultsHtml = `
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">Search Results (1 Member Found)</div>
              <div class="card-body">
                <table class="legacy-grid" summary="Member lookup query results">
                  <thead>
                    <tr>
                      <th>Member ID</th>
                      <th>Full Legal Name</th>
                      <th>Tax ID / SSN</th>
                      <th>Membership Tier</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="member-id-cell"><strong>${member.id}</strong></td>
                      <td class="member-name-cell">${member.fullName}</td>
                      <td>${member.ssnMasked}</td>
                      <td><span class="badge ${member.tier === 'PLATINUM' ? 'badge-plat' : 'badge-gold'}">${member.tier}</span></td>
                      <td><span class="badge badge-success">${member.status}</span></td>
                      <td>
                        <a href="/members/${member.id}" class="btn btn-action" aria-label="View Accounts for ${member.fullName}">View Accounts</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;
        } else {
          // Expected Business Outcome: Record Not Found
          resultsHtml = `
            <div class="alert alert-warning" role="alert" style="margin-top: 20px;" id="alertRecordNotFound">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong>Record Not Found:</strong> Member ID <strong>${searchId}</strong> does not exist in institution records or has been archived.
              </div>
            </div>
          `;
        }
      }

      const content = `
        <div class="card">
          <div class="card-header">Member Identification & Account Directory</div>
          <div class="card-body">
            <form action="/members" method="GET" name="memberSearchForm">
              <div class="form-group">
                <label for="inputMemberId">Member ID or SSN</label>
                <input type="text" id="inputMemberId" name="memberId" aria-label="Member ID or SSN" class="form-control" placeholder="e.g. 10042" value="${searchId}" required autocomplete="off" />
              </div>
              <button type="submit" class="btn btn-primary" id="btnSubmitSearch">Search Directory</button>
            </form>
            ${resultsHtml}
          </div>
        </div>
      `;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pageShell('Member Search', 'members', content));
      return;
    }

    // 3. Member Account List Route: /members/:id
    const memberMatch = pathname.match(/^\/members\/([0-9a-zA-Z]+)$/);
    if (memberMatch) {
      const memberId = memberMatch[1];
      const member = BANK_MEMBERS[memberId];

      if (!member) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(pageShell('Member Not Found', 'members', `<div class="alert alert-danger">Member ${memberId} not found in database.</div>`));
        return;
      }

      const accountsRows = member.accounts.map(acc => `
        <tr>
          <td><strong>${acc.id}</strong></td>
          <td>${acc.name}</td>
          <td>${acc.type}</td>
          <td style="font-weight: 700; color: #0c2340;">$${acc.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td><span class="badge badge-success">${acc.status}</span></td>
          <td>
            <a href="/members/${member.id}/accounts/${acc.id}" class="btn btn-action" aria-label="Inspect ${acc.name} details">Inspect Account Details</a>
          </td>
        </tr>
      `).join('');

      const content = `
        <div class="card">
          <div class="card-header">
            <span>Member Profile: ${member.fullName} (ID: ${member.id})</span>
            <span class="badge ${member.tier === 'PLATINUM' ? 'badge-plat' : 'badge-gold'}">${member.tier} MEMBER</span>
          </div>
          <div class="card-body">
            <table class="legacy-grid" style="margin-bottom: 24px;">
              <tbody>
                <tr>
                  <th style="width: 20%;">Full Name</th><td>${member.fullName}</td>
                  <th style="width: 20%;">Tax ID (SSN)</th><td>${member.ssnMasked}</td>
                </tr>
                <tr>
                  <th>Address</th><td>${member.address}</td>
                  <th>Primary Phone</th><td>${member.phone}</td>
                </tr>
              </tbody>
            </table>

            <h3 style="font-size: 15px; color: #0c2340; border-bottom: 2px solid #edf1f6; padding-bottom: 8px;">Associated Deposit & Loan Accounts</h3>
            <table class="legacy-grid" summary="Member deposit and credit accounts">
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Account Description</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${accountsRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pageShell(`Member ${member.fullName}`, 'members', content));
      return;
    }

    // 4. Account Detail Route: /members/:id/accounts/:accId
    const accountMatch = pathname.match(/^\/members\/([0-9a-zA-Z]+)\/accounts\/([0-9a-zA-Z-]+)$/);
    if (accountMatch) {
      const memberId = accountMatch[1];
      const accountId = accountMatch[2];
      const member = BANK_MEMBERS[memberId];
      const account = member?.accounts.find(a => a.id === accountId);

      if (!member || !account) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(pageShell('Account Not Found', 'members', `<div class="alert alert-danger">Account ${accountId} not found for member ${memberId}.</div>`));
        return;
      }

      const txnRows = account.recentTransactions.map(txn => `
        <tr>
          <td>${txn.date}</td>
          <td>${txn.description}</td>
          <td style="font-weight: 600; color: ${txn.amount >= 0 ? '#2e7d32' : '#c62828'};">
            ${txn.amount >= 0 ? '+' : ''}$${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </td>
          <td style="font-weight: 600;">$${txn.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');

      const content = `
        <div style="margin-bottom: 15px;">
          <a href="/members/${member.id}" style="color: #0c2340; text-decoration: none; font-size: 13px; font-weight: 600;">&larr; Back to Member Accounts</a>
        </div>
        <div class="card">
          <div class="card-header">
            <span>Account Ledger: ${account.name} (${account.id})</span>
            <span class="badge badge-success" id="accountStatusBadge">${account.status}</span>
          </div>
          <div class="card-body">
            <div class="balance-hero">
              <div class="balance-item">
                <span class="label">Current Ledger Balance</span>
                <span class="amount current-balance" id="savingsCurrentBalance">$${account.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="balance-item">
                <span class="label">Available Funds</span>
                <span class="amount available-balance" id="savingsAvailableBalance">$${account.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="balance-item">
                <span class="label">Yield / APY</span>
                <span class="amount" style="font-size: 22px; color: #2e7d32;">${account.interestRate}</span>
              </div>
            </div>

            <table class="legacy-grid" style="margin-bottom: 24px;">
              <tbody>
                <tr>
                  <th style="width: 25%;">Primary Account Holder</th><td id="holderName">${member.fullName}</td>
                  <th style="width: 25%;">Member Number</th><td id="holderMemberId">${member.id}</td>
                </tr>
                <tr>
                  <th>Routing Transit Number</th><td id="routingNumber">${account.routingNumber}</td>
                  <th>Account Opened Date</th><td>${account.openedDate}</td>
                </tr>
              </tbody>
            </table>

            <h3 style="font-size: 14px; color: #0c2340; margin-top: 20px;">Posted Ledger Transactions</h3>
            <table class="legacy-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Description</th>
                  <th>Amount</th>
                  <th>Resulting Balance</th>
                </tr>
              </thead>
              <tbody>
                ${txnRows.length > 0 ? txnRows : '<tr><td colspan="4">No recent ledger activity.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pageShell(`${account.name} Details`, 'members', content));
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  });

  return {
    server,
    start: () => new Promise<number>((resolve) => {
      server.listen(port, () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve(actualPort);
      });
    }),
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    })
  };
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const showInterstitial = process.argv.includes('--interstitial');
  const simulateBlocker = process.argv.includes('--blocker');
  const app = createBankingServer({ port, showInterstitial, simulateBlocker });
  app.start().then((p) => {
    console.log(`🏦 ApexCore Banking Portal live at http://localhost:${p}`);
    console.log(`   - Interstitial modal: ${showInterstitial ? 'ON' : 'OFF'}`);
    console.log(`   - Supervisor blocker: ${simulateBlocker ? 'ON' : 'OFF'}`);
  });
}
