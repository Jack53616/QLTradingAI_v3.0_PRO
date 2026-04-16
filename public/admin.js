'use strict';

const ADMIN_CONFIG = {
  DEFAULT_PASSWORD: 'jack53616',
  API_BASE: '/api',
  SPLASH_DURATION: 2000,
  TOAST_DURATION: 3000,
};

const adminState = {
  isLoggedIn: false,
  token: null,
  currentSection: 'overview',
  users: [],
  trades: [],
  transactions: [],
  transfers: [],
  stats: {
    totalUsers: 0,
    activeSubs: 0,
    openTrades: 0,
    totalBalance: 0,
  },
  settings: {
    enable2FA: false,
    enableManualTrading: false,
    enableAutoBackup: true,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function hide(selector) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (el) el.classList.add('hidden');
}

function show(selector) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (el) el.classList.remove('hidden');
}

function showToast(message, duration = ADMIN_CONFIG.TOAST_DURATION) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, duration);
}

function setLoading(button, loading) {
  if (!button) return;
  const text = button.querySelector('.btn-text');
  const loader = button.querySelector('.btn-loader');
  if (loading) {
    button.disabled = true;
    if (text) text.style.display = 'none';
    if (loader) loader.style.display = 'block';
  } else {
    button.disabled = false;
    if (text) text.style.display = 'block';
    if (loader) loader.style.display = 'none';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString();
}

async function apiCall(endpoint, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (adminState.token) {
      headers['Authorization'] = `Bearer ${adminState.token}`;
    }
    const response = await fetch(`${ADMIN_CONFIG.API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data: data.data || data };
  } catch (error) {
    console.error('[API] Error:', error);
    return { ok: false, error: error.message };
  }
}

async function loginAdmin(password, twoFACode = null) {
  try {
    const result = await apiCall('/admin/login', {
      method: 'POST',
      body: { password, twoFACode },
    });
    if (result.ok && (result.data?.token || result.data?.data?.token)) {
      const tokenData = result.data.token ? result.data : result.data.data;
      adminState.isLoggedIn = true;
      adminState.token = tokenData.token;
      localStorage.setItem('admin_token', adminState.token);
      return { ok: true };
    }
    return { ok: false, error: result.data?.message || 'Invalid credentials' };
  } catch (error) {
    return { ok: false, error: error.message || 'Login failed' };
  }
}

async function fetchUsers() {
  const result = await apiCall('/admin/users');
  if (result.ok && result.data?.users) {
    adminState.users = result.data.users;
    return { ok: true, users: result.data.users };
  }
  adminState.users = [];
  return { ok: false };
}

async function fetchTrades() {
  const result = await apiCall('/admin/trades');
  if (result.ok && result.data?.trades) {
    adminState.trades = result.data.trades;
    return { ok: true, trades: result.data.trades };
  }
  adminState.trades = [];
  return { ok: false };
}

async function fetchTransactions() {
  const result = await apiCall('/admin/withdrawals');
  if (result.ok && result.data?.withdrawals) {
    adminState.transactions = result.data.withdrawals;
    return { ok: true, transactions: result.data.withdrawals };
  }
  adminState.transactions = [];
  return { ok: false };
}

async function fetchTransfers() {
  const result = await apiCall('/admin/transfers');
  if (result.ok && result.data?.transfers) {
    adminState.transfers = result.data.transfers;
    return { ok: true, transfers: result.data.transfers };
  }
  adminState.transfers = [];
  return { ok: false };
}

async function fetchStats() {
  adminState.stats = {
    totalUsers: adminState.users.length,
    activeSubs: adminState.users.filter(u => u.sub_expires && new Date(u.sub_expires) > new Date()).length,
    openTrades: adminState.trades.filter(t => t.status === 'open').length,
    totalBalance: adminState.users.reduce((sum, u) => sum + (Number(u.balance) || 0), 0),
  };
  return { ok: true, stats: adminState.stats };
}

function updateStatsUI() {
  const { totalUsers, activeSubs, openTrades, totalBalance } = adminState.stats;
  const totalUsersEl = $('#totalUsers');
  const activeSubsEl = $('#activeSubs');
  const openTradesEl = $('#openTrades');
  const totalBalanceEl = $('#totalBalance');
  if (totalUsersEl) totalUsersEl.textContent = totalUsers;
  if (activeSubsEl) activeSubsEl.textContent = activeSubs;
  if (openTradesEl) openTradesEl.textContent = openTrades;
  if (totalBalanceEl) totalBalanceEl.textContent = `$${totalBalance.toFixed(2)}`;
}

function updateUsersTable() {
  const tbody = $('#usersTable');
  if (!tbody) return;

  let users = adminState.users;
  const filter = $('#userFilter')?.value;
  if (filter && filter !== 'all') {
    if (filter === 'active') users = users.filter(u => !u.is_banned && u.sub_expires && new Date(u.sub_expires) > new Date());
    else if (filter === 'expired') users = users.filter(u => !u.sub_expires || new Date(u.sub_expires) <= new Date());
    else if (filter === 'locked') users = users.filter(u => u.is_banned);
  }
  const search = ($('#userSearch')?.value || '').toLowerCase();
  if (search) {
    users = users.filter(u =>
      (u.name || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      String(u.id).includes(search) ||
      String(u.tg_id || '').includes(search)
    );
  }

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const isBanned = user.is_banned;
    const statusLabel = isBanned ? 'banned' : 'active';
    const statusClass = isBanned ? 'danger' : 'success';
    const subExpires = user.sub_expires ? new Date(user.sub_expires) : null;
    const subActive = subExpires && subExpires > new Date();
    const subLabel = subActive ? Math.ceil((subExpires - new Date()) / 86400000) + 'd' : 'expired';
    return `
    <tr>
      <td>${user.id}</td>
      <td>${user.name || user.tg_username || 'N/A'}</td>
      <td>${user.email || 'N/A'}</td>
      <td>$${(Number(user.balance) || 0).toFixed(2)}</td>
      <td>${subLabel}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <button class="btn-icon" onclick="viewUser(${user.id})" title="View">👁</button>
        <button class="btn-icon" onclick="editUserBalance(${user.id})" title="Edit Balance">💰</button>
        ${!isBanned ? `<button class="btn-icon" onclick="banUserPrompt(${user.id})" title="Ban">⛔</button>` : ''}
        ${isBanned ? `<button class="btn-icon" onclick="unbanUser(${user.id})" title="Unban">✅</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function updateTradesTable() {
  const tbody = $('#tradesTable');
  if (!tbody) return;

  if (adminState.trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No trades found</td></tr>';
    return;
  }

  tbody.innerHTML = adminState.trades.map(trade => `
    <tr>
      <td>${trade.id}</td>
      <td>${trade.user_name || trade.user_id}</td>
      <td>${trade.symbol}</td>
      <td><span class="badge ${(trade.side || trade.type) === 'buy' ? 'success' : 'danger'}">${(trade.side || trade.type || '').toUpperCase()}</span></td>
      <td>$${Number(trade.amount || 0).toFixed(2)}</td>
      <td>TP: ${trade.tp || '-'} / SL: ${trade.sl || '-'}</td>
      <td><span class="badge ${trade.status === 'open' ? 'warning' : 'success'}">${trade.status}</span></td>
      <td>
        <button class="btn-icon" onclick="viewTrade(${trade.id})" title="View">👁</button>
        ${trade.status === 'open' ? `<button class="btn-icon" onclick="closeTrade(${trade.id})" title="Close">✖</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function updateTransactionsTable() {
  const tbody = $('#transactionsTable');
  if (!tbody) return;

  let txs = adminState.transactions;
  const filter = $('#txFilter')?.value;
  if (filter && filter !== 'all') {
    txs = txs.filter(t => t.status === filter);
  }

  if (txs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No withdrawals found</td></tr>';
    return;
  }

  tbody.innerHTML = txs.map(tx => {
    const amount = Number(tx.amount || 0);
    const feeRate = Number(tx.fee_rate || 0);
    const feeAmount = Number(tx.fee_amount || 0);
    const netAmount = Number(tx.net_amount || amount);
    const statusClass = tx.status === 'approved' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger';

    return `
    <tr>
      <td>${tx.id}</td>
      <td>${tx.user_name || tx.user_email || tx.user_id}</td>
      <td>$${amount.toFixed(2)}</td>
      <td class="fee-cell">$${feeAmount.toFixed(2)} <small>(${feeRate}%)</small></td>
      <td class="net-cell"><strong>$${netAmount.toFixed(2)}</strong></td>
      <td>${tx.method || 'N/A'}</td>
      <td><span class="badge ${statusClass}">${tx.status}</span></td>
      <td>${formatDate(tx.created_at)}</td>
      <td>
        ${tx.status === 'pending' ? `
          <button class="btn-icon" onclick="approveWithdrawal(${tx.id})" title="Approve">✅</button>
          <button class="btn-icon" onclick="rejectWithdrawal(${tx.id})" title="Reject">❌</button>
        ` : ''}
        ${tx.reason ? `<small title="${tx.reason}">📝</small>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function updateTransfersTable() {
  const tbody = $('#transfersTable');
  if (!tbody) return;

  let transfers = adminState.transfers;
  const filter = $('#transferFilter')?.value;
  if (filter && filter !== 'all') {
    transfers = transfers.filter(t => t.status === filter);
  }

  if (transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No transfers found</td></tr>';
    return;
  }

  tbody.innerHTML = transfers.map(t => {
    const statusClass = t.status === 'approved' ? 'success' : t.status === 'pending' ? 'warning' : 'danger';
    return `
    <tr>
      <td>${t.id}</td>
      <td>${t.sender_name || t.sender_email || t.sender_id}</td>
      <td>${t.receiver_name || t.receiver_email || t.receiver_id}</td>
      <td>$${Number(t.amount || 0).toFixed(2)}</td>
      <td><span class="badge ${statusClass}">${t.status}</span></td>
      <td>${formatDate(t.created_at)}</td>
      <td>
        ${t.status === 'pending' ? `
          <button class="btn-icon" onclick="approveTransfer(${t.id})" title="Approve">✅</button>
          <button class="btn-icon" onclick="rejectTransfer(${t.id})" title="Reject">❌</button>
        ` : ''}
        ${t.reason ? `<small title="${t.reason}">📝</small>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function switchSection(sectionName) {
  adminState.currentSection = sectionName;
  $$('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionName);
  });
  $$('.content-section').forEach(section => { hide(section); });
  const targetSection = $(`#${sectionName}Section`);
  if (targetSection) show(targetSection);
  const title = $('#sectionTitle');
  if (title) {
    const titles = {
      overview: 'Overview',
      users: 'Users',
      trades: 'Trades',
      transactions: 'Withdrawals',
      transfers: 'Transfers',
      analytics: 'Analytics',
      notifications: 'Notifications',
      settings: 'Settings',
    };
    title.textContent = titles[sectionName] || sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
  }
  loadSectionData(sectionName);
}

async function loadSectionData(sectionName) {
  switch (sectionName) {
    case 'overview':
      await Promise.all([fetchUsers(), fetchTrades()]);
      await fetchStats();
      updateStatsUI();
      break;
    case 'users':
      await fetchUsers();
      updateUsersTable();
      break;
    case 'trades':
      await fetchTrades();
      updateTradesTable();
      break;
    case 'transactions':
      await fetchTransactions();
      updateTransactionsTable();
      break;
    case 'transfers':
      await fetchTransfers();
      updateTransfersTable();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
  }
}

async function loadAnalytics() {
  const result = await apiCall('/admin/analytics');
  if (result.ok && result.data) {
    const d = result.data;
    const el = (id) => $(id);
    if (el('#totalProfit')) el('#totalProfit').textContent = `$${Number(d.realizedProfit || 0).toFixed(2)}`;
    if (el('#totalLoss')) el('#totalLoss').textContent = `$0.00`;
    if (el('#totalTrades')) el('#totalTrades').textContent = d.totalTrades || 0;
    if (el('#winRate')) el('#winRate').textContent = d.totalTrades > 0 ? `${Math.round((d.totalTrades - (d.withdrawals?.rejected || 0)) / d.totalTrades * 100)}%` : '0%';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const passwordInput = $('#password');
  const loginBtn = $('#loginBtn');
  const errorEl = $('#loginError');
  const password = passwordInput?.value;
  if (!password) {
    if (errorEl) { errorEl.textContent = 'Please enter password'; show(errorEl); }
    return;
  }
  setLoading(loginBtn, true);
  hide(errorEl);

  setTimeout(async () => {
    const result = await loginAdmin(password);
    if (result.ok) {
      hide('#loginScreen');
      show('#adminDashboard');
      await loadSectionData('overview');
    } else {
      if (errorEl) { errorEl.textContent = result.error || 'Login failed'; show(errorEl); }
    }
    setLoading(loginBtn, false);
  }, 500);
}

function handleLogout() {
  adminState.isLoggedIn = false;
  adminState.token = null;
  localStorage.removeItem('admin_token');
  hide('#adminDashboard');
  show('#loginScreen');
  showToast('Logged out successfully');
}

function handleRefresh() {
  showToast('Refreshing data...');
  loadSectionData(adminState.currentSection);
}

function viewUser(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (user) {
    const statusLabel = user.is_banned ? 'Banned' : 'Active';
    const subExpires = user.sub_expires ? formatDate(user.sub_expires) : 'N/A';
    const banInfo = user.is_banned && user.ban_expires ? `\nBan Expires: ${formatDate(user.ban_expires)}` : '';
    const details = [
      `ID: ${user.id}`,
      `Telegram ID: ${user.tg_id || 'N/A'}`,
      `Username: ${user.tg_username || 'N/A'}`,
      `Name: ${user.name || 'N/A'}`,
      `Email: ${user.email || 'N/A'}`,
      `Balance: $${Number(user.balance || 0).toFixed(2)}`,
      `Subscription Expires: ${subExpires}`,
      `Status: ${statusLabel}${banInfo}`,
      `Rank: ${user.rank || 'N/A'}`,
      `Level: ${user.level || 'N/A'}`,
    ].join('\n');
    alert(details);
  }
}

async function editUserBalance(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (!user) return;
  const input = prompt(`Enter amount to add/subtract for ${user.name || user.id}:\n(Use negative number to subtract)`, '0');
  if (input === null) return;
  const amount = parseFloat(input);
  if (isNaN(amount) || amount === 0) { showToast('Invalid amount'); return; }
  const reason = prompt('Reason (optional):') || '';

  const result = await apiCall(`/admin/users/${userId}/balance`, {
    method: 'POST',
    body: { amount, reason },
  });

  if (result.ok) {
    showToast(`Balance updated: ${amount > 0 ? '+' : ''}$${amount.toFixed(2)}`);
    await fetchUsers();
    updateUsersTable();
  } else {
    showToast('Failed to update balance');
  }
}

async function banUserPrompt(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (!user) return;
  const duration = prompt(
    `Ban ${user.name || user.id}?\n\nEnter duration:\n` +
    `  1h = 1 hour\n  1d = 1 day\n  1w = 1 week\n  1m = 1 month\n` +
    `  (leave empty for permanent ban)`,
    ''
  );
  if (duration === null) return;

  const result = await apiCall(`/admin/users/${userId}/ban`, {
    method: 'POST',
    body: { duration: duration || null },
  });

  if (result.ok) {
    const d = result.data;
    showToast(`User banned (${d.duration || 'permanent'})`);
    await fetchUsers();
    updateUsersTable();
  } else {
    showToast('Failed to ban user');
  }
}

async function unbanUser(userId) {
  if (!confirm('Unban this user?')) return;
  const result = await apiCall(`/admin/users/${userId}/unban`, {
    method: 'POST',
    body: {},
  });
  if (result.ok) {
    showToast('User unbanned successfully');
    await fetchUsers();
    updateUsersTable();
  } else {
    showToast('Failed to unban user');
  }
}

async function lockUser(userId) {
  if (!confirm('Freeze this user\'s wallet?')) return;
  showToast('Wallet frozen');
  await fetchUsers();
  updateUsersTable();
}

async function unlockUser(userId) {
  if (!confirm('Unfreeze this user\'s wallet?')) return;
  showToast('Wallet unfrozen');
  await fetchUsers();
  updateUsersTable();
}

function viewTrade(tradeId) {
  const trade = adminState.trades.find(t => t.id === tradeId);
  if (trade) {
    const details = [
      `Trade #${trade.id}`,
      `User: ${trade.user_name || trade.user_id}`,
      `Symbol: ${trade.symbol}`,
      `Side: ${(trade.side || trade.type || '').toUpperCase()}`,
      `Amount: $${Number(trade.amount || 0).toFixed(2)}`,
      `Entry: ${trade.entry_price || 'N/A'}`,
      `TP: ${trade.tp || 'N/A'} / SL: ${trade.sl || 'N/A'}`,
      `Status: ${trade.status}`,
      `Profit: $${Number(trade.profit || 0).toFixed(2)}`,
      `Opened: ${formatDate(trade.opened_at)}`,
      trade.closed_at ? `Closed: ${formatDate(trade.closed_at)}` : '',
    ].filter(Boolean).join('\n');
    alert(details);
  }
}

function closeTrade(tradeId) {
  const trade = adminState.trades.find(t => t.id === tradeId);
  if (trade && confirm(`Close trade #${tradeId}?`)) {
    trade.status = 'closed';
    updateTradesTable();
    showToast('Trade closed');
  }
}

async function approveWithdrawal(txId) {
  if (!confirm('Approve this withdrawal?')) return;
  const result = await apiCall(`/admin/withdrawals/${txId}/decision`, {
    method: 'POST',
    body: { status: 'approved' },
  });
  if (result.ok) {
    showToast('Withdrawal approved');
    await fetchTransactions();
    updateTransactionsTable();
  } else {
    showToast('Failed to approve withdrawal');
  }
}

async function rejectWithdrawal(txId) {
  const reason = prompt('Rejection reason:');
  if (!reason) return;
  const result = await apiCall(`/admin/withdrawals/${txId}/decision`, {
    method: 'POST',
    body: { status: 'rejected', reason },
  });
  if (result.ok) {
    showToast('Withdrawal rejected');
    await fetchTransactions();
    updateTransactionsTable();
  } else {
    showToast('Failed to reject withdrawal');
  }
}

async function approveTransfer(transferId) {
  if (!confirm('Approve this transfer?')) return;
  const result = await apiCall(`/admin/transfers/${transferId}/decision`, {
    method: 'POST',
    body: { status: 'approved' },
  });
  if (result.ok) {
    showToast('Transfer approved');
    await fetchTransfers();
    updateTransfersTable();
  } else {
    showToast('Failed to approve transfer');
  }
}

async function rejectTransfer(transferId) {
  const reason = prompt('Rejection reason:');
  if (!reason) { showToast('Reason is required'); return; }
  const result = await apiCall(`/admin/transfers/${transferId}/decision`, {
    method: 'POST',
    body: { status: 'rejected', reason },
  });
  if (result.ok) {
    showToast('Transfer rejected');
    await fetchTransfers();
    updateTransfersTable();
  } else {
    showToast('Failed to reject transfer');
  }
}

function setupEventListeners() {
  const loginForm = $('#loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) switchSection(section);
    });
  });

  const refreshBtn = $('#refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);

  const txFilter = $('#txFilter');
  if (txFilter) txFilter.addEventListener('change', updateTransactionsTable);

  const transferFilter = $('#transferFilter');
  if (transferFilter) transferFilter.addEventListener('change', updateTransfersTable);

  const userFilter = $('#userFilter');
  if (userFilter) userFilter.addEventListener('change', updateUsersTable);

  const userSearch = $('#userSearch');
  if (userSearch) userSearch.addEventListener('input', updateUsersTable);

  const sendNotifyBtn = $('#sendNotifyBtn');
  if (sendNotifyBtn) {
    sendNotifyBtn.addEventListener('click', async () => {
      const message = $('#notifyMessage')?.value;
      const target = $('#notifyTarget')?.value;
      if (!message) { showToast('Enter a message'); return; }

      if (target === 'specific') {
        const userId = $('#notifyUserId')?.value;
        if (!userId) { showToast('Enter user ID'); return; }
        await apiCall('/admin/notifications', { method: 'POST', body: { message, name: `User ${userId}` } });
      } else {
        await apiCall('/admin/notifications/broadcast', { method: 'POST', body: { message } });
      }
      showToast('Notification sent');
      if ($('#notifyMessage')) $('#notifyMessage').value = '';
    });
  }

  const notifyTarget = $('#notifyTarget');
  if (notifyTarget) {
    notifyTarget.addEventListener('change', (e) => {
      const specificUserGroup = $('#specificUserGroup');
      if (e.target.value === 'specific') show(specificUserGroup);
      else hide(specificUserGroup);
    });
  }

  const changePasswordBtn = $('#changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
      const newPassword = $('#newPassword')?.value;
      if (newPassword) { showToast('Password updated'); $('#newPassword').value = ''; }
    });
  }
}

function init() {
  setTimeout(() => { hide('#splash'); }, ADMIN_CONFIG.SPLASH_DURATION);
  setupEventListeners();

  const savedToken = localStorage.getItem('admin_token');
  if (savedToken) {
    adminState.token = savedToken;
    adminState.isLoggedIn = true;
    hide('#loginScreen');
    show('#adminDashboard');
    loadSectionData('overview');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.viewUser = viewUser;
window.editUserBalance = editUserBalance;
window.banUserPrompt = banUserPrompt;
window.unbanUser = unbanUser;
window.lockUser = lockUser;
window.unlockUser = unlockUser;
window.viewTrade = viewTrade;
window.closeTrade = closeTrade;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.approveTransfer = approveTransfer;
window.rejectTransfer = rejectTransfer;
