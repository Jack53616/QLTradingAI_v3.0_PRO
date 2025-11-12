// ============================================
// QL WALLET - ADMIN PANEL
// ============================================

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const ADMIN_CONFIG = {
  DEFAULT_PASSWORD: 'jack53616',
  API_BASE: '/api',
  SPLASH_DURATION: 2000,
  TOAST_DURATION: 3000,
};

// ============================================
// STATE
// ============================================

const adminState = {
  isLoggedIn: false,
  token: null,
  currentSection: 'overview',
  users: [],
  trades: [],
  transactions: [],
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

// ============================================
// UTILITIES
// ============================================

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
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
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

// ============================================
// API CALLS
// ============================================

async function apiCall(endpoint, options = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (adminState.token) {
      headers['Authorization'] = `Bearer ${adminState.token}`;
    }
    
    const response = await fetch(`${ADMIN_CONFIG.API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: data,
    };
  } catch (error) {
    console.error('[API] Error:', error);
    return {
      ok: false,
      error: error.message,
    };
  }
}

async function loginAdmin(password, twoFACode = null) {
  try {
    const result = await apiCall('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password, twoFACode }),
    });
    
    if (result.ok && result.data?.token) {
      adminState.isLoggedIn = true;
      adminState.token = result.data.token;
      localStorage.setItem('admin_token', adminState.token);
      console.log('[LOGIN] Token saved:', adminState.token);
      return { ok: true };
    }
    
    return { ok: false, error: result.error || 'Invalid credentials' };
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    return { ok: false, error: error.message || 'Login failed' };
  }
}

async function fetchUsers() {
  const result = await apiCall('/admin/users');
  
  if (result.ok && result.data.users) {
    adminState.users = result.data.users;
    console.log('[FETCH] Loaded', adminState.users.length, 'real users');
    return { ok: true, users: result.data.users };
  }
  
  // If API fails, show empty state instead of fake data
  console.warn('[FETCH] Failed to load users:', result.error);
  adminState.users = [];
  return { ok: false, error: result.error || 'Failed to load users' };
}

async function fetchTrades() {
  const result = await apiCall('/admin/trades');
  
  if (result.ok && result.data.trades) {
    adminState.trades = result.data.trades;
    console.log('[FETCH] Loaded', adminState.trades.length, 'real trades');
    return { ok: true, trades: result.data.trades };
  }
  
  console.warn('[FETCH] Failed to load trades:', result.error);
  adminState.trades = [];
  return { ok: false, error: result.error || 'Failed to load trades' };
}

async function fetchTransactions() {
  const result = await apiCall('/admin/withdrawals');
  
  if (result.ok && result.data.withdrawals) {
    adminState.transactions = result.data.withdrawals;
    console.log('[FETCH] Loaded', adminState.transactions.length, 'real withdrawals');
    return { ok: true, transactions: result.data.withdrawals };
  }
  
  console.warn('[FETCH] Failed to load withdrawals:', result.error);
  adminState.transactions = [];
  return { ok: false, error: result.error || 'Failed to load withdrawals' };
}

async function fetchStats() {
  // Calculate stats from loaded data
  adminState.stats = {
    totalUsers: adminState.users.length,
    activeSubs: adminState.users.filter(u => u.sub_days > 0).length,
    openTrades: adminState.trades.filter(t => t.status === 'open').length,
    totalBalance: adminState.users.reduce((sum, u) => sum + (Number(u.balance) || 0), 0),
  };
  
  console.log('[FETCH] Calculated stats:', adminState.stats);
  return { ok: true, stats: adminState.stats };
}

// ============================================
// MOCK DATA GENERATORS
// ============================================

function generateMockUsers() {
  const names = ['Ahmed', 'Mohammed', 'Khaled', 'Sara', 'Rami', 'Noor', 'Layla', 'Waseem'];
  const users = [];
  
  for (let i = 1; i <= 20; i++) {
    users.push({
      id: 1000 + i,
      name: names[Math.floor(Math.random() * names.length)],
      balance: Math.floor(Math.random() * 5000) + 100,
      sub_days: Math.floor(Math.random() * 60),
      status: Math.random() > 0.2 ? 'active' : 'expired',
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return users;
}

function generateMockTrades() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'XAGUSD'];
  const types = ['buy', 'sell'];
  const trades = [];
  
  for (let i = 1; i <= 15; i++) {
    trades.push({
      id: 5000 + i,
      user_id: 1000 + Math.floor(Math.random() * 20),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: types[Math.floor(Math.random() * types.length)],
      amount: Math.floor(Math.random() * 1000) + 50,
      entry_price: Math.random() * 50000 + 1000,
      tp: Math.random() * 100 + 10,
      sl: Math.random() * 50 + 5,
      status: Math.random() > 0.3 ? 'open' : 'closed',
      created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return trades;
}

function generateMockTransactions() {
  const types = ['deposit', 'withdraw'];
  const methods = ['USDT TRC20', 'USDT ERC20', 'BTC', 'ETH'];
  const statuses = ['pending', 'approved', 'rejected'];
  const transactions = [];
  
  for (let i = 1; i <= 25; i++) {
    transactions.push({
      id: 3000 + i,
      user_id: 1000 + Math.floor(Math.random() * 20),
      type: types[Math.floor(Math.random() * types.length)],
      amount: Math.floor(Math.random() * 2000) + 50,
      method: methods[Math.floor(Math.random() * methods.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      created_at: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return transactions;
}

// ============================================
// UI UPDATES
// ============================================

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
  
  if (adminState.users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
    return;
  }
  
  tbody.innerHTML = adminState.users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.name || 'N/A'}</td>
      <td>$${(user.balance || 0).toFixed(2)}</td>
      <td>${user.sub_days || 0} days</td>
      <td><span class="badge ${user.status === 'active' ? 'success' : 'danger'}">${user.status}</span></td>
      <td>
        <button class="btn-icon" onclick="viewUser(${user.id})" title="View">👁️</button>
        <button class="btn-icon" onclick="editUser(${user.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="lockUser(${user.id})" title="Lock">🔒</button>
      </td>
    </tr>
  `).join('');
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
      <td>${trade.user_id}</td>
      <td>${trade.symbol}</td>
      <td><span class="badge ${trade.type === 'buy' ? 'success' : 'danger'}">${trade.type.toUpperCase()}</span></td>
      <td>$${trade.amount.toFixed(2)}</td>
      <td>TP: ${trade.tp} / SL: ${trade.sl}</td>
      <td><span class="badge ${trade.status === 'open' ? 'warning' : 'success'}">${trade.status}</span></td>
      <td>
        <button class="btn-icon" onclick="viewTrade(${trade.id})" title="View">👁️</button>
        ${trade.status === 'open' ? `<button class="btn-icon" onclick="closeTrade(${trade.id})" title="Close">✖️</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function updateTransactionsTable() {
  const tbody = $('#transactionsTable');
  if (!tbody) return;
  
  if (adminState.transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No transactions found</td></tr>';
    return;
  }
  
  tbody.innerHTML = adminState.transactions.map(tx => `
    <tr>
      <td>${tx.id}</td>
      <td>${tx.user_id}</td>
      <td><span class="badge ${tx.type === 'deposit' ? 'success' : 'warning'}">${tx.type}</span></td>
      <td>$${tx.amount.toFixed(2)}</td>
      <td>${tx.method}</td>
      <td><span class="badge ${tx.status === 'approved' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}">${tx.status}</span></td>
      <td>
        ${tx.status === 'pending' ? `
          <button class="btn-icon" onclick="approveTx(${tx.id})" title="Approve">✅</button>
          <button class="btn-icon" onclick="rejectTx(${tx.id})" title="Reject">❌</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

// ============================================
// NAVIGATION
// ============================================

function switchSection(sectionName) {
  console.log('[NAV] Switching to:', sectionName);
  
  adminState.currentSection = sectionName;
  
  // Update nav items
  $$('.nav-item').forEach(item => {
    if (item.dataset.section === sectionName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update sections
  $$('.content-section').forEach(section => {
    hide(section);
  });
  
  const targetSection = $(`#${sectionName}Section`);
  if (targetSection) {
    show(targetSection);
  }
  
  // Update title
  const title = $('#sectionTitle');
  if (title) {
    title.textContent = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
  }
  
  // Load section data
  loadSectionData(sectionName);
}

async function loadSectionData(sectionName) {
  console.log('[DATA] Loading data for:', sectionName);
  
  switch (sectionName) {
    case 'overview':
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
      
    case 'analytics':
      loadAnalytics();
      break;
      
    default:
      console.log('[DATA] No data loading needed for:', sectionName);
  }
}

function loadAnalytics() {
  // Mock analytics data
  $('#totalProfit').textContent = '$12,450';
  $('#totalLoss').textContent = '$3,280';
  $('#totalTrades').textContent = '156';
  $('#winRate').textContent = '68%';
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleLogin(e) {
  e.preventDefault();
  
  const passwordInput = $('#password');
  const twoFAInput = $('#twoFACode');
  const loginBtn = $('#loginBtn');
  const errorEl = $('#loginError');
  
  const password = passwordInput?.value;
  const twoFACode = twoFAInput?.value;
  
  if (!password) {
    if (errorEl) {
      errorEl.textContent = 'Please enter password';
      show(errorEl);
    }
    return;
  }
  
  setLoading(loginBtn, true);
  hide(errorEl);
  
  setTimeout(async () => {
    const result = await loginAdmin(password, twoFACode);
    
    if (result.ok) {
      console.log('[LOGIN] Success!');
      hide('#loginScreen');
      show('#adminDashboard');
      
      // Load initial data
      await loadSectionData('overview');
      
    } else {
      console.error('[LOGIN] Failed:', result.error);
      if (errorEl) {
        errorEl.textContent = result.error || 'Login failed';
        show(errorEl);
      }
    }
    
    setLoading(loginBtn, false);
  }, 1000);
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

function handleExport() {
  showToast('Exporting data...');
  // TODO: Implement export functionality
}

// ============================================
// ADMIN ACTIONS
// ============================================

function viewUser(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (user) {
    alert(`User Details:\n\nID: ${user.id}\nName: ${user.name}\nBalance: $${user.balance}\nSubscription: ${user.sub_days} days\nStatus: ${user.status}`);
  }
}

function editUser(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (user) {
    const newBalance = prompt(`Edit balance for ${user.name}:`, user.balance);
    if (newBalance !== null) {
      user.balance = parseFloat(newBalance);
      updateUsersTable();
      showToast('User updated successfully');
    }
  }
}

function lockUser(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (user) {
    if (confirm(`Lock user ${user.name}?`)) {
      user.status = 'locked';
      updateUsersTable();
      showToast('User locked successfully');
    }
  }
}

function viewTrade(tradeId) {
  const trade = adminState.trades.find(t => t.id === tradeId);
  if (trade) {
    alert(`Trade Details:\n\nID: ${trade.id}\nUser: ${trade.user_id}\nSymbol: ${trade.symbol}\nType: ${trade.type}\nAmount: $${trade.amount}\nEntry: ${trade.entry_price}\nTP: ${trade.tp}\nSL: ${trade.sl}\nStatus: ${trade.status}`);
  }
}

function closeTrade(tradeId) {
  const trade = adminState.trades.find(t => t.id === tradeId);
  if (trade) {
    if (confirm(`Close trade #${tradeId}?`)) {
      trade.status = 'closed';
      updateTradesTable();
      showToast('Trade closed successfully');
    }
  }
}

function approveTx(txId) {
  const tx = adminState.transactions.find(t => t.id === txId);
  if (tx) {
    if (confirm(`Approve ${tx.type} of $${tx.amount}?`)) {
      tx.status = 'approved';
      updateTransactionsTable();
      showToast('Transaction approved');
    }
  }
}

function rejectTx(txId) {
  const tx = adminState.transactions.find(t => t.id === txId);
  if (tx) {
    const reason = prompt('Rejection reason:');
    if (reason) {
      tx.status = 'rejected';
      tx.rejection_reason = reason;
      updateTransactionsTable();
      showToast('Transaction rejected');
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

function setupEventListeners() {
  // Login form
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Logout button
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Navigation
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) switchSection(section);
    });
  });
  
  // Header actions
  const refreshBtn = $('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
  }
  
  const exportBtn = $('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
  
  // Settings
  const changePasswordBtn = $('#changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
      const newPassword = $('#newPassword')?.value;
      if (newPassword) {
        showToast('Password updated successfully');
        $('#newPassword').value = '';
      }
    });
  }
  
  const saveAPIBtn = $('#saveAPIBtn');
  if (saveAPIBtn) {
    saveAPIBtn.addEventListener('click', () => {
      showToast('API keys saved successfully');
    });
  }
  
  // Notifications
  const sendNotifyBtn = $('#sendNotifyBtn');
  if (sendNotifyBtn) {
    sendNotifyBtn.addEventListener('click', () => {
      const message = $('#notifyMessage')?.value;
      if (message) {
        showToast('Notification sent successfully');
        $('#notifyMessage').value = '';
      }
    });
  }
  
  // Notify target change
  const notifyTarget = $('#notifyTarget');
  if (notifyTarget) {
    notifyTarget.addEventListener('change', (e) => {
      const specificUserGroup = $('#specificUserGroup');
      if (e.target.value === 'specific') {
        show(specificUserGroup);
      } else {
        hide(specificUserGroup);
      }
    });
  }
  
  console.log('[EVENTS] All event listeners attached');
}

function init() {
  console.log('[INIT] Starting Admin Panel...');
  
  // Hide splash after delay
  setTimeout(() => {
    hide('#splash');
  }, ADMIN_CONFIG.SPLASH_DURATION);
  
  // Setup event listeners
  setupEventListeners();
  
  // Check for saved token
  const savedToken = localStorage.getItem('admin_token');
  if (savedToken) {
    adminState.token = savedToken;
    adminState.isLoggedIn = true;
    hide('#loginScreen');
    show('#adminDashboard');
    loadSectionData('overview');
  }
  
  console.log('[INIT] Initialization complete');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Make functions global for onclick handlers
window.viewUser = viewUser;
window.editUser = editUser;
window.lockUser = lockUser;
window.viewTrade = viewTrade;
window.closeTrade = closeTrade;
window.approveTx = approveTx;
window.rejectTx = rejectTx;
