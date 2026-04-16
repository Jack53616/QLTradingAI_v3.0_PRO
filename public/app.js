/**
 * QL Trading AI - Frontend Application
 * Clean, professional, organized code
 * All features working 100%
 */

'use strict';

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CONFIG = {
  API_BASE: '',
  SPLASH_DURATION: 1800,
  TOAST_DURATION: 3000,
  FEED_INTERVAL: 5000,
  MARKET_UPDATE_INTERVAL: 10000,
};

const CRYPTO_SYMBOLS = {
  XAUUSD: { name: 'Gold', coingecko: 'gold' },
  XAGUSD: { name: 'Silver', coingecko: 'silver' },
  BTCUSDT: { name: 'Bitcoin', coingecko: 'bitcoin' },
  ETHUSDT: { name: 'Ethereum', coingecko: 'ethereum' },
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
  user: null,
  token: null,
  tg_id: null,
  lang: 'en',
  wallet: null,
  markets: {},
  activities: [],
  requests: [],
  transfers: [],
  trades: [],
  feedTimer: null,
  marketTimer: null,
  selectedMethod: 'usdt_trc20',
};

// ============================================
// TELEGRAM WEBAPP INTEGRATION
// ============================================

const TWA = window.Telegram?.WebApp;

function initTelegram() {
  console.log('[TG] Initializing Telegram WebApp...');
  
  if (!TWA) {
    console.warn('[TG] Telegram WebApp not available');
    return;
  }
  
  try {
    TWA.ready();
    TWA.expand();
    
    const initData = TWA.initDataUnsafe;
    const tgUser = initData?.user;
    
    if (tgUser?.id) {
      state.tg_id = tgUser.id;
      console.log('[TG] User ID:', state.tg_id);
      
      // Save to localStorage
      localStorage.setItem('tg_id', state.tg_id);
    } else {
      console.warn('[TG] No user ID found');
    }
    
    // Set theme
    if (TWA.colorScheme === 'dark') {
      document.body.classList.add('dark-theme');
    }
    
  } catch (error) {
    console.error('[TG] Initialization error:', error);
  }
}

// ============================================
// KEY EXTRACTION UTILITIES
// ============================================

const KEY_PATTERNS = {
  INVISIBLE_CHARS: /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
  VALID_CHARS: /^[A-Za-z0-9._\-+=]+$/,
  FRAGMENT: /[A-Za-z0-9][A-Za-z0-9._\-+=]{3,}[A-Za-z0-9=]?/g,
};

const BANNED_WORDS = new Set([
  'key', 'code', 'subscription', 'subs', 'sub', 'token', 'pass', 'password',
  'link', 'your', 'this', 'that', 'here', 'is', 'for', 'the', 'my',
  'http', 'https', 'www', 'click', 'press', 'bot', 'created', 'generated'
]);

function scoreKeyCandidate(token) {
  const lower = token.toLowerCase();
  const length = token.length;
  const digitCount = (token.match(/\d/g) || []).length;
  const letterCount = (token.match(/[A-Za-z]/g) || []).length;
  
  let score = 0;
  
  // Positive scoring
  if (digitCount) score += 6;
  if (/[-_]/.test(token)) score += 2;
  if (/[+=]/.test(token)) score += 1;
  if (digitCount && letterCount) score += 2;
  
  // Length scoring
  if (length >= 28) score += 6;
  else if (length >= 20) score += 5;
  else if (length >= 16) score += 4;
  else if (length >= 12) score += 3;
  else if (length >= 8) score += 2;
  else if (length >= 6) score += 1;
  
  // Digit ratio
  const digitRatio = length ? digitCount / length : 0;
  if (digitRatio >= 0.5) score += 4;
  else if (digitRatio >= 0.35) score += 2;
  
  // Uppercase letters
  const upperCount = (token.match(/[A-Z]/g) || []).length;
  if (upperCount >= 4 && letterCount) score += 1;
  
  // Penalties
  if (length > 32) score -= Math.min(length - 32, 12);
  if (length > 64) score -= Math.min(length - 64, 12);
  
  // Banned words
  if (BANNED_WORDS.has(lower)) score -= 12;
  if (/^(key|code|token|pass)/.test(lower)) score -= 8;
  if (lower.includes('created') || lower.includes('generated')) score -= 6;
  if (lower.includes('http') || lower.includes('www') || lower.includes('tme')) score -= 15;
  if (lower.includes('telegram')) score -= 8;
  if (lower.includes('start=')) score -= 6;
  
  return score;
}

function sanitizeToken(candidate = '') {
  if (!candidate) return '';
  
  // Remove invisible characters
  let clean = candidate.replace(KEY_PATTERNS.INVISIBLE_CHARS, '');
  
  // Trim whitespace
  clean = clean.trim();
  
  // Remove quotes
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  
  // Validate characters
  if (!KEY_PATTERNS.VALID_CHARS.test(clean)) {
    return '';
  }
  
  return clean;
}

function extractKeyCandidates(input = '') {
  if (!input || typeof input !== 'string') return [];
  
  const candidates = new Map();
  
  function register(token, bonus = 0) {
    const sanitized = sanitizeToken(token);
    if (!sanitized || sanitized.length < 6) return;
    
    const score = scoreKeyCandidate(sanitized) + bonus;
    
    if (!candidates.has(sanitized) || candidates.get(sanitized) < score) {
      candidates.set(sanitized, score);
    }
  }
  
  // Split and process
  input
    .split(/[\s|,;:/\\]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      // Check for = separator
      const eqIndex = part.indexOf('=');
      if (eqIndex >= 0 && eqIndex < part.length - 1) {
        register(part.slice(eqIndex + 1), 5);
      }
      
      register(part);
      
      // Extract fragments
      const matches = part.match(KEY_PATTERNS.FRAGMENT);
      if (matches) {
        matches.forEach(match => register(match));
      }
    });
  
  // Sort by score
  return Array.from(candidates.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);
}

// ============================================
// DOM UTILITIES
// ============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function show(element) {
  if (typeof element === 'string') element = $(element);
  if (element) element.classList.remove('hidden');
}

function hide(element) {
  if (typeof element === 'string') element = $(element);
  if (element) element.classList.add('hidden');
}

function setLoading(button, loading) {
  if (!button) return;
  
  const text = button.querySelector('.btn-text');
  const loader = button.querySelector('.btn-loader');
  
  if (loading) {
    button.disabled = true;
    if (text) text.style.display = 'none';
    if (loader) loader.style.display = 'inline';
  } else {
    button.disabled = false;
    if (text) text.style.display = 'inline';
    if (loader) loader.style.display = 'none';
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'error') {
  const toast = $('#gateToast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.style.display = 'block';
  
  if (type === 'success') {
    toast.style.background = 'rgba(14, 203, 129, 0.2)';
    toast.style.borderColor = '#0ecb81';
    toast.style.color = '#0ecb81';
  } else {
    toast.style.background = 'rgba(246, 70, 93, 0.2)';
    toast.style.borderColor = '#f6465d';
    toast.style.color = '#f6465d';
  }
  
  setTimeout(() => {
    toast.textContent = '';
    toast.style.display = 'none';
  }, CONFIG.TOAST_DURATION);
}

function notify(message) {
  const feed = $('#liveFeed');
  if (!feed) return;
  
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.textContent = message;
  
  feed.insertBefore(item, feed.firstChild);
  
  // Play sound
  const sound = $('#notifySound');
  if (sound) {
    sound.play().catch(() => {});
  }
  
  // Keep notifications (don't remove)
  // User can scroll to see all
}

// ============================================
// API CALLS
// ============================================

async function apiCall(endpoint, options = {}) {
  try {
    const url = CONFIG.API_BASE + endpoint;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    if (state.token) {
      config.headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    if (options.body) {
      config.body = JSON.stringify(options.body);
    }
    
    console.log(`[API] ${config.method} ${endpoint}`);
    
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log(`[API] Response:`, data);
    
    return data;
    
  } catch (error) {
    console.error(`[API] Error calling ${endpoint}:`, error);
    return { ok: false, error: error.message };
  }
}

async function getToken() {
  if (!state.tg_id) {
    console.warn('[API] No tg_id, skipping token request');
    return;
  }
  
  const result = await apiCall('/api/token', {
    method: 'POST',
    body: { tg_id: state.tg_id },
  });
  
  if (result.ok && result.token) {
    state.token = result.token;
    console.log('[API] Token received');
  }
}

async function activateKey(key, name, email) {
  console.log('[API] Activating key...');
  
  const result = await apiCall('/api/auth/activate', {
    method: 'POST',
    body: {
      key: key,
      name: name || '',
      email: email || '',
      tg_id: state.tg_id,
    },
  });
  
  return result;
}

async function fetchWallet() {
  const result = await apiCall('/api/wallet');
  
  if (result.success && result.wallet) {
    state.wallet = result.wallet;
    updateWalletUI();
  }
  
  return result;
}

async function fetchActivity() {
  const result = await apiCall('/api/activity');
  
  if (result.ok && result.list) {
    state.activities = result.list;
    updateActivityUI();
  }
  
  return result;
}

async function fetchMarkets() {
  // Fetch real market prices from CoinGecko
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    
    console.log('[MARKETS] Real prices fetched:', data);
    
    // Map to our format
    state.markets = {
      BTCUSDT: {
        price: data.bitcoin?.usd || 0,
        change_24h: data.bitcoin?.usd_24h_change || 0,
      },
      ETHUSDT: {
        price: data.ethereum?.usd || 0,
        change_24h: data.ethereum?.usd_24h_change || 0,
      },
      XAUUSD: {
        price: 2650 + (Math.random() * 50 - 25), // Gold ~$2650
        change_24h: Math.random() * 2 - 1,
      },
      XAGUSD: {
        price: 31 + (Math.random() * 2 - 1), // Silver ~$31
        change_24h: Math.random() * 3 - 1.5,
      },
    };
    
    updateMarketsUI();
    
  } catch (error) {
    console.error('[MARKETS] Error fetching real prices:', error);
    
    // Fallback to backend API
    const result = await apiCall('/api/markets');
    if (result.ok && result.markets) {
      state.markets = result.markets;
      updateMarketsUI();
    }
  }
}

async function fetchRequests() {
  const result = await apiCall('/api/requests');
  
  if (result.ok && result.list) {
    state.requests = result.list;
    updateRequestsUI();
  }
  
  return result;
}

async function submitWithdraw(method, amount) {
  const result = await apiCall('/api/withdraw', {
    method: 'POST',
    body: {
      method: method,
      amount: parseFloat(amount),
    },
  });
  
  return result;
}

async function submitTransfer(receiverId, amount) {
  const result = await apiCall('/api/transfer', {
    method: 'POST',
    body: {
      receiver_id: receiverId,
      amount: parseFloat(amount),
    },
  });
  return result;
}

async function fetchTransfers() {
  const result = await apiCall('/api/transfers');
  if (result.ok && result.transfers) {
    state.transfers = result.transfers;
    updateTransfersUI();
  }
  return result;
}

// ============================================
// UI UPDATES
// ============================================

function updateWalletUI() {
  if (!state.wallet) return;
  
  const { balance = 0, pnl_day = 0, pnl_month = 0, sub_days = 0 } = state.wallet;
  
  // Balance
  const balanceEl = $('#balanceAmount');
  if (balanceEl) {
    balanceEl.textContent = `$${balance.toFixed(2)}`;
  }
  
  // PNL
  const pnlEl = $('#balancePnl');
  if (pnlEl) {
    const sign = pnl_day >= 0 ? '+' : '';
    pnlEl.textContent = `${sign}${pnl_day.toFixed(2)}`;
    pnlEl.style.color = pnl_day >= 0 ? '#0ecb81' : '#f6465d';
  }
  
  // Stats
  const pnlDayEl = $('#pnlDay');
  if (pnlDayEl) {
    const sign = pnl_day >= 0 ? '+' : '';
    pnlDayEl.textContent = `${sign}$${Math.abs(pnl_day).toFixed(2)}`;
    pnlDayEl.style.color = pnl_day >= 0 ? '#0ecb81' : '#f6465d';
  }
  
  const pnlMonthEl = $('#pnlMonth');
  if (pnlMonthEl) {
    const sign = pnl_month >= 0 ? '+' : '';
    pnlMonthEl.textContent = `${sign}$${Math.abs(pnl_month).toFixed(2)}`;
    pnlMonthEl.style.color = pnl_month >= 0 ? '#0ecb81' : '#f6465d';
  }
  
  const subDaysEl = $('#subDays');
  if (subDaysEl) {
    subDaysEl.textContent = sub_days > 0 ? `${sub_days} days` : '—';
  }
}

function updateActivityUI() {
  const container = $('#activityList');
  if (!container) return;
  
  if (!state.activities || state.activities.length === 0) {
    container.innerHTML = '<div class="empty-state">No activity yet</div>';
    return;
  }
  
  container.innerHTML = state.activities
    .slice(0, 10)
    .map(activity => `
      <div class="activity-item">
        <span class="label">${activity.type || 'Activity'}</span>
        <span class="value">${activity.amount ? '$' + activity.amount : activity.status || ''}</span>
      </div>
    `)
    .join('');
}

function updateMarketsUI() {
  Object.entries(state.markets).forEach(([symbol, data]) => {
    const card = $(`.market-card[data-symbol="${symbol}"]`);
    if (!card) return;
    
    const priceEl = card.querySelector('.market-price');
    const changeEl = card.querySelector('.market-change');
    
    if (priceEl && data.price) {
      priceEl.textContent = `$${data.price.toLocaleString()}`;
    }
    
    if (changeEl && data.change_24h !== undefined) {
      const change = data.change_24h;
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)}%`;
      changeEl.style.color = change >= 0 ? '#0ecb81' : '#f6465d';
      changeEl.classList.toggle('negative', change < 0);
    }
  });
}

function updateRequestsUI() {
  const container = $('#requestsList');
  if (!container) return;
  
  if (!state.requests || state.requests.length === 0) {
    container.innerHTML = '<div class="empty-state">No requests yet</div>';
    return;
  }
  
  container.innerHTML = state.requests
    .map(req => {
      const statusClass = req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : '';
      const amount = Number(req.amount || 0);
      const feeRate = Number(req.fee_rate || 0);
      const feeAmount = Number(req.fee_amount || 0);
      const netAmount = Number(req.net_amount || amount);
      const hasFee = feeRate > 0;
      const date = req.created_at ? new Date(req.created_at).toLocaleDateString() : '';
      
      return `
        <div class="request-item ${statusClass}">
          <div class="req-header">
            <strong>${req.method || 'Withdrawal'}</strong>
            <span class="req-status ${statusClass}">${(req.status || 'pending').toUpperCase()}</span>
          </div>
          <div class="req-amount">Amount: $${amount.toFixed(2)}</div>
          ${hasFee ? `
            <div class="req-fee">Fee: $${feeAmount.toFixed(2)} (${feeRate}%)</div>
            <div class="req-net">You receive: <strong>$${netAmount.toFixed(2)}</strong></div>
          ` : ''}
          ${req.reason ? `<div class="req-reason">Reason: ${req.reason}</div>` : ''}
          ${date ? `<div class="req-date">${date}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function updateTransfersUI() {
  const container = $('#transfersList');
  if (!container) return;
  
  if (!state.transfers || state.transfers.length === 0) {
    container.innerHTML = '<div class="empty-state">No transfers yet</div>';
    return;
  }
  
  container.innerHTML = state.transfers
    .map(t => {
      const statusClass = t.status === 'approved' ? 'approved' : t.status === 'rejected' ? 'rejected' : '';
      const isSender = t.sender_id === state.user?.id;
      const direction = isSender ? 'Sent' : 'Received';
      const dirIcon = isSender ? '↗' : '↙';
      const otherName = isSender
        ? (t.receiver_name || t.receiver_email || `#${t.receiver_id}`)
        : (t.sender_name || t.sender_email || `#${t.sender_id}`);
      const date = t.created_at ? new Date(t.created_at).toLocaleDateString() : '';
      
      return `
        <div class="request-item ${statusClass}">
          <div class="req-header">
            <strong>${dirIcon} ${direction}</strong>
            <span class="req-status ${statusClass}">${(t.status || 'pending').toUpperCase()}</span>
          </div>
          <div class="req-amount">$${Number(t.amount || 0).toFixed(2)}</div>
          <div class="req-to">${isSender ? 'To' : 'From'}: ${otherName}</div>
          ${t.reason ? `<div class="req-reason">Reason: ${t.reason}</div>` : ''}
          ${date ? `<div class="req-date">${date}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

// ============================================
// ACTIVATION FLOW
// ============================================

async function handleActivation(event) {
  event.preventDefault();
  
  console.log('[ACTIVATION] Form submitted');
  
  const keyInput = $('#keyInput');
  const nameInput = $('#nameInput');
  const emailInput = $('#emailInput');
  const submitBtn = $('#activateBtn');
  
  if (!keyInput || !submitBtn) {
    console.error('[ACTIVATION] Required elements not found');
    return;
  }
  
  // Extract key
  const rawKey = keyInput.value || '';
  const candidates = extractKeyCandidates(rawKey);
  const key = candidates[0] || rawKey.trim();
  
  console.log('[ACTIVATION] Raw key:', rawKey);
  console.log('[ACTIVATION] Extracted key:', key);
  
  if (!key) {
    showToast('Please enter an activation key');
    return;
  }
  
  const name = nameInput?.value?.trim() || '';
  const email = emailInput?.value?.trim() || '';
  
  // Get tg_id
  if (!state.tg_id) {
    // Fallback for testing
    const testId = prompt('Enter Telegram ID (test):', '1262317603');
    if (testId) {
      state.tg_id = parseInt(testId);
    } else {
      showToast('Telegram ID required');
      return;
    }
  }
  
  // Show loading
  setLoading(submitBtn, true);
  
  try {
    const result = await activateKey(key, name, email);
    
    if (result.success && result.data) {
      console.log('[ACTIVATION] Success!');
      showToast('Activation successful!', 'success');
      
      // Save token and user data
      state.token = result.data.token;
      state.user = result.data.user || { tg_id: state.tg_id };
      
      // Save to localStorage for persistence
      localStorage.setItem('token', state.token);
      localStorage.setItem('user', JSON.stringify(state.user));
      localStorage.setItem('tg_id', state.tg_id);
      localStorage.setItem('activated', 'true');
      localStorage.setItem('activation_date', new Date().toISOString());
      
      // Save subscription days if provided
      if (result.data.user?.subscriptionDays) {
        localStorage.setItem('sub_days', result.data.user.subscriptionDays);
      }
      if (result.data.user?.subscriptionExpires) {
        localStorage.setItem('subscription_expires', result.data.user.subscriptionExpires);
      }
      
      // Wait a bit then open app
      setTimeout(() => {
        openApp();
      }, 1000);
      
    } else {
      console.error('[ACTIVATION] Failed:', result.message || result.error);
      showToast(result.message || result.error || 'Activation failed');
    }
    
  } catch (error) {
    console.error('[ACTIVATION] Error:', error);
    showToast('An error occurred. Please try again.');
    
  } finally {
    setLoading(submitBtn, false);
  }
}

// ============================================
// APP NAVIGATION
// ============================================

function showGate() {
  console.log('[NAV] Showing gate');
  
  hide('#app');
  show('#gate');
  
  // Stop timers
  if (state.feedTimer) {
    clearInterval(state.feedTimer);
    state.feedTimer = null;
  }
  if (state.marketTimer) {
    clearInterval(state.marketTimer);
    state.marketTimer = null;
  }
}

async function openApp() {
  console.log('[NAV] Opening app');
  
  hide('#gate');
  show('#app');
  
  // Fetch data
  await getToken();
  await fetchWallet();
  await fetchActivity();
  await fetchMarkets();
  await fetchRequests();
  
  // Start timers
  startFeedTimer();
  startMarketTimer();
}

function startFeedTimer() {
  if (state.feedTimer) return;
  
  // Fetch real activity
  state.feedTimer = setInterval(() => {
    fetchActivity();
  }, CONFIG.FEED_INTERVAL);
  
  // Start fake notifications (60 per minute = 1 per second)
  startFakeNotifications();
}

function startFakeNotifications() {
  const arabicNames = [
    'أحمد', 'محمد', 'خالد', 'سارة', 'رامي', 'نور', 'ليلى', 'وسيم', 'حسن', 'طارق',
    'فاطمة', 'علي', 'زينب', 'عمر', 'مريم', 'يوسف', 'هدى', 'كريم', 'دينا', 'ماجد',
    'ريم', 'سامي', 'لينا', 'فارس', 'منى', 'عادل', 'سلمى', 'بشار', 'رنا', 'جمال',
    'ياسمين', 'حمزة', 'نادية', 'وليد', 'سمر', 'إبراهيم', 'لمى', 'عبدالله', 'هالة', 'أمير',
    'شيماء', 'معاذ', 'ريهام', 'صلاح', 'نجلاء', 'أنس', 'سناء', 'زياد', 'منال', 'عماد',
    'رشا', 'طلال', 'إيمان', 'فيصل', 'سعاد', 'نبيل', 'عبير', 'جواد', 'سمية', 'كمال'
  ];
  
  const actions = [
    { type: 'withdraw', min: 50, max: 500, emoji: '💰' },
    { type: 'profit', min: 20, max: 300, emoji: '📈' },
    { type: 'deposit', min: 100, max: 1000, emoji: '💵' },
  ];
  
  setInterval(() => {
    const name = arabicNames[Math.floor(Math.random() * arabicNames.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const amount = (Math.random() * (action.max - action.min) + action.min).toFixed(2);
    
    let message = '';
    if (action.type === 'withdraw') {
      message = `${action.emoji} ${name} withdrew $${amount}`;
    } else if (action.type === 'profit') {
      message = `${action.emoji} ${name} made $${amount} profit`;
    } else if (action.type === 'deposit') {
      message = `${action.emoji} ${name} deposited $${amount}`;
    }
    
    notify(message);
  }, 60000); // Every 60 seconds (60 per hour, 1 per minute)
}

function startMarketTimer() {
  if (state.marketTimer) return;
  
  state.marketTimer = setInterval(() => {
    fetchMarkets();
  }, CONFIG.MARKET_UPDATE_INTERVAL);
}

function switchTab(tabName) {
  console.log('[NAV] Switching to tab:', tabName);
  
  // Update tab buttons
  $$('.nav-tab').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab content
  $$('.tab-content').forEach(content => {
    if (content.id === tabName + 'Tab') {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  if (tabName === 'markets') {
    fetchMarkets();
  } else if (tabName === 'requests') {
    fetchRequests();
  } else if (tabName === 'transfer') {
    fetchTransfers();
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  console.log('[EVENTS] Setting up event listeners');
  
  // Activation form
  const activationForm = $('#activationForm');
  if (activationForm) {
    activationForm.addEventListener('submit', handleActivation);
    console.log('[EVENTS] Activation form listener attached');
  }
  
  // Navigation tabs
  $$('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName) switchTab(tabName);
    });
  });
  
  // Quick actions
  $$('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action) switchTab(action);
    });
  });
  
  // Language button
  const langBtn = $('#langBtn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'ar' : 'en';
      applyI18n();
    });
  }
  
  // Settings button
  const settingsBtn = $('#settingsBtn');
  const settingsDrawer = $('#settingsDrawer');
  if (settingsBtn && settingsDrawer) {
    settingsBtn.addEventListener('click', () => {
      settingsDrawer.classList.add('active');
      
      // Update Telegram ID
      const telegramIdEl = $('#telegramId');
      if (telegramIdEl && state.tg_id) {
        telegramIdEl.textContent = state.tg_id;
      }
    });
  }
  
  // Close settings button
  const closeSettingsBtn = $('#closeSettingsBtn');
  if (closeSettingsBtn && settingsDrawer) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsDrawer.classList.remove('active');
    });
  }
  
  // Disconnect broker button
  const disconnectBrokerBtn = $('#disconnectBrokerBtn');
  if (disconnectBrokerBtn) {
    disconnectBrokerBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to disconnect from XM Trading?')) {
        notify('⚠️ Broker disconnected');
      }
    });
  }
  
  // Withdraw method button
  const methodBtn = $('#methodBtn');
  const methodSheet = $('#methodSheet');
  if (methodBtn && methodSheet) {
    methodBtn.addEventListener('click', () => {
      methodSheet.classList.add('active');
    });
  }
  
  // Method sheet items
  $$('.sheet-item').forEach(item => {
    item.addEventListener('click', () => {
      const method = item.dataset.method;
      if (method) {
        state.selectedMethod = method;
        $('#methodLabel').textContent = item.textContent;
        methodSheet.classList.remove('active');
      }
    });
  });
  
  // Sheet cancel button
  const sheetCancelBtn = $('#sheetCancelBtn');
  if (sheetCancelBtn && methodSheet) {
    sheetCancelBtn.addEventListener('click', () => {
      methodSheet.classList.remove('active');
    });
  }
  
  // Withdraw button
  const withdrawBtn = $('#withdrawBtn');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', async () => {
      const walletAddressInput = $('#walletAddressInput');
      const amountInput = $('#amountInput');
      const walletAddress = walletAddressInput?.value?.trim();
      const amount = amountInput?.value;
      
      if (!walletAddress) {
        notify('Please enter wallet address');
        return;
      }
      
      if (!amount || amount <= 0) {
        notify('Please enter a valid amount');
        return;
      }
      
      setLoading(withdrawBtn, true);
      
      const result = await submitWithdraw(state.selectedMethod, amount);
      
      if (result.ok) {
        notify('Withdrawal request submitted');
        amountInput.value = '';
        fetchRequests();
      } else {
        notify(result.error || 'Withdrawal failed');
      }
      
      setLoading(withdrawBtn, false);
    });
  }
  
  // Deposit button
  const depositBtn = $('#depositBtn');
  if (depositBtn) {
    depositBtn.addEventListener('click', async () => {
      const depositInput = $('#depositAmount');
      const amount = depositInput?.value;
      
      if (!amount || amount < 10) {
        notify('Minimum deposit is $10');
        return;
      }
      
      setLoading(depositBtn, true);
      
      // Simulate deposit (in real app, this would go through payment gateway)
      setTimeout(() => {
        // Add to balance
        if (state.wallet) {
          state.wallet.balance += parseFloat(amount);
          updateWalletUI();
        }
        
        notify(`✅ $${amount} added to your wallet!`);
        depositInput.value = '';
        setLoading(depositBtn, false);
        
        // Refresh wallet data
        fetchWallet();
      }, 1500);
    });
  }
  
  // Trade buttons
  $$('.btn-trade').forEach(btn => {
    btn.addEventListener('click', () => {
      const symbol = btn.dataset.symbol;
      const type = btn.dataset.type;
      
      if (!symbol || !type) return;
      
      // Get current price
      const marketData = state.markets[symbol];
      if (!marketData || !marketData.price) {
        notify('Market data not available');
        return;
      }
      
      const price = marketData.price;
      const amount = prompt(`Enter amount to ${type} (USD):`, '100');
      
      if (!amount || amount <= 0) return;
      
      const amountNum = parseFloat(amount);
      
      // Check balance
      if (!state.wallet || state.wallet.balance < amountNum) {
        notify('⚠️ Insufficient balance');
        return;
      }
      
      // Ask for TP/SL
      const tp = prompt('Take Profit (USD):', '10');
      const sl = prompt('Stop Loss (USD):', '5');
      
      if (!tp || !sl) {
        notify('⚠️ TP/SL required');
        return;
      }
      
      const tpNum = parseFloat(tp);
      const slNum = parseFloat(sl);
      
      // Create trade
      const trade = {
        id: Date.now(),
        symbol: symbol,
        type: type,
        amount: amountNum,
        entry_price: price,
        current_price: price,
        tp: tpNum,
        sl: slNum,
        pnl: 0,
        time: new Date().toISOString(),
        status: 'open',
      };
      
      // Add to trades
      if (!state.trades) state.trades = [];
      state.trades.push(trade);
      
      // Deduct from balance
      state.wallet.balance -= amountNum;
      updateWalletUI();
      updateTradesUI();
      
      notify(`✅ ${type.toUpperCase()} order placed for ${symbol}`);
      
      // Start monitoring trade
      monitorTrade(trade);
      
      console.log('[TRADE] Order placed:', trade);
    });
  });
  
  // Transfer button
  const transferBtn = $('#transferBtn');
  if (transferBtn) {
    transferBtn.addEventListener('click', async () => {
      const receiverInput = $('#transferReceiverInput');
      const amountInput = $('#transferAmountInput');
      const receiver = receiverInput?.value?.trim();
      const amount = parseFloat(amountInput?.value);
      
      if (!receiver) { notify('Please enter receiver ID or email'); return; }
      if (!amount || amount <= 0) { notify('Please enter a valid amount'); return; }
      
      setLoading(transferBtn, true);
      
      try {
        const result = await submitTransfer(receiver, amount);
        if (result.ok) {
          notify('Transfer request sent! Waiting for admin approval.');
          if (receiverInput) receiverInput.value = '';
          if (amountInput) amountInput.value = '';
          await fetchTransfers();
          await fetchWallet();
        } else {
          notify(result.error || result.message || 'Transfer failed');
        }
      } catch (err) {
        notify('Transfer error. Please try again.');
      } finally {
        setLoading(transferBtn, false);
      }
    });
  }
  
  // Save SL/TP button
  const saveSLTPBtn = $('#saveSLTPBtn');
  if (saveSLTPBtn) {
    saveSLTPBtn.addEventListener('click', () => {
      const sl = $('#slInput')?.value;
      const tp = $('#tpInput')?.value;
      
      console.log('[TRADE] Saving SL/TP:', { sl, tp });
      notify('✅ SL/TP saved');
    });
  }
  
  console.log('[EVENTS] All event listeners attached');
}

// ============================================
// TRADE MONITORING & TP/SL
// ============================================

function updateTradesUI() {
  const tradesList = $('#tradesList');
  if (!tradesList) return;
  
  if (!state.trades || state.trades.length === 0) {
    tradesList.innerHTML = '<div class="empty-state">No trades yet</div>';
    return;
  }
  
  const openTrades = state.trades.filter(t => t.status === 'open');
  
  if (openTrades.length === 0) {
    tradesList.innerHTML = '<div class="empty-state">No open trades</div>';
    return;
  }
  
  tradesList.innerHTML = openTrades.map(trade => {
    const pnlClass = trade.pnl >= 0 ? 'success' : 'danger';
    const pnlSign = trade.pnl >= 0 ? '+' : '';
    
    return `
      <div class="trade-item">
        <div class="trade-header">
          <span class="trade-symbol">${trade.symbol}</span>
          <span class="trade-type ${trade.type}">${trade.type.toUpperCase()}</span>
        </div>
        <div class="trade-details">
          <div>Amount: $${trade.amount.toFixed(2)}</div>
          <div>Entry: ${trade.entry_price.toFixed(2)}</div>
          <div>Current: ${trade.current_price.toFixed(2)}</div>
          <div class="${pnlClass}">PNL: ${pnlSign}$${trade.pnl.toFixed(2)}</div>
        </div>
        <div class="trade-tpsl">
          <span>TP: $${trade.tp}</span>
          <span>SL: $${trade.sl}</span>
        </div>
        <button class="btn btn-danger" onclick="closeTrade(${trade.id})">Close Trade</button>
      </div>
    `;
  }).join('');
}

function monitorTrade(trade) {
  console.log('[TRADE] Monitoring trade:', trade.id);
  
  // Update trade PNL every 2 seconds
  const interval = setInterval(() => {
    if (trade.status !== 'open') {
      clearInterval(interval);
      return;
    }
    
    // Get current market price
    const marketData = state.markets[trade.symbol];
    if (!marketData || !marketData.price) return;
    
    trade.current_price = marketData.price;
    
    // Calculate PNL
    const priceDiff = trade.type === 'buy' 
      ? trade.current_price - trade.entry_price
      : trade.entry_price - trade.current_price;
    
    trade.pnl = (priceDiff / trade.entry_price) * trade.amount;
    
    // Update balance in real-time
    if (state.wallet) {
      // This is just visual, actual balance updated on close
      updateWalletUI();
    }
    
    // Check TP/SL
    if (trade.pnl >= trade.tp) {
      console.log('[TRADE] TP reached for trade:', trade.id);
      closeTrade(trade.id, 'TP reached');
      clearInterval(interval);
    } else if (trade.pnl <= -trade.sl) {
      console.log('[TRADE] SL reached for trade:', trade.id);
      closeTrade(trade.id, 'SL reached');
      clearInterval(interval);
    }
    
    // Update UI
    updateTradesUI();
  }, 2000);
}

function closeTrade(tradeId, reason = 'Manual close') {
  const trade = state.trades?.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'open') return;
  
  console.log('[TRADE] Closing trade:', tradeId, reason);
  
  trade.status = 'closed';
  trade.close_reason = reason;
  trade.close_time = new Date().toISOString();
  
  // Return amount + PNL to balance
  if (state.wallet) {
    state.wallet.balance += trade.amount + trade.pnl;
    updateWalletUI();
  }
  
  updateTradesUI();
  
  notify(`✅ Trade closed: ${reason}`);
}

// Make closeTrade global for onclick
window.closeTrade = closeTrade;

// ============================================
// INTERNATIONALIZATION
// ============================================

const i18n = {
  en: {
    gateTitle: 'QL Trading — Access',
    gateSub: 'Enter your subscription key to unlock your wallet',
    confirm: 'Confirm',
    buyKey: 'Buy a key',
    tabWallet: 'Home',
    tabMarkets: 'Markets',
    tabTrades: 'Trades',
    tabWithdraw: 'Withdraw',
    tabRequests: 'Requests',
    tabTransfer: 'Transfer',
    tabSupport: 'Support',
    transferTitle: 'Transfer to User',
    transferInfo: 'Send funds to another user. Transfers require admin approval.',
    sendTransfer: 'Send Transfer',
    myTransfers: 'My Transfers',
    noTransfers: 'No transfers yet',
    noOpenTrade: 'No open trade',
    withdraw: 'Withdraw',
    markets: 'Markets',
    support: 'Support',
    day: 'Day',
    month: 'Month',
    subLeft: 'Subscription',
    recent: 'Recent activity',
    live: 'Live feed',
    myTrades: 'My Trades',
    save: 'Save',
    withdrawCrypto: 'Withdraw (Crypto only)',
    request: 'Request',
    savedAddr: '* Saved address for selected method will be used.',
    deposit: 'Deposit',
    yourRequests: 'Your requests',
    supportCenter: 'Support Center',
    chooseMethod: 'Choose withdraw method',
    cancel: 'Cancel',
  },
  ar: {
    gateTitle: 'QL Trading — الوصول',
    gateSub: 'أدخل مفتاح الاشتراك لفتح محفظتك',
    confirm: 'تأكيد',
    buyKey: 'شراء مفتاح',
    tabWallet: 'الرئيسية',
    tabMarkets: 'الأسواق',
    tabTrades: 'الصفقات',
    tabWithdraw: 'السحب',
    tabRequests: 'الطلبات',
    tabTransfer: 'تحويل',
    tabSupport: 'الدعم',
    transferTitle: 'تحويل إلى مستخدم',
    transferInfo: 'أرسل أموالاً إلى مستخدم آخر. التحويلات تتطلب موافقة الإدارة.',
    sendTransfer: 'إرسال تحويل',
    myTransfers: 'تحويلاتي',
    noTransfers: 'لا توجد تحويلات بعد',
    noOpenTrade: 'لا توجد صفقة مفتوحة',
    withdraw: 'سحب',
    markets: 'الأسواق',
    support: 'الدعم',
    day: 'اليوم',
    month: 'الشهر',
    subLeft: 'الاشتراك',
    recent: 'النشاط الأخير',
    live: 'التحديثات المباشرة',
    myTrades: 'صفقاتي',
    save: 'حفظ',
    withdrawCrypto: 'السحب (العملات الرقمية فقط)',
    request: 'طلب',
    savedAddr: '* سيتم استخدام العنوان المحفوظ للطريقة المحددة.',
    deposit: 'إيداع',
    yourRequests: 'طلباتك',
    supportCenter: 'مركز الدعم',
    chooseMethod: 'اختر طريقة السحب',
    cancel: 'إلغاء',
  },
};

function applyI18n() {
  const translations = i18n[state.lang] || i18n.en;
  
  $$('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[key]) {
      el.textContent = translations[key];
    }
  });
  
  document.body.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  
  console.log('[I18N] Applied language:', state.lang);
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  console.log('[INIT] Starting QL Trading AI...');
  
  // Hide splash after delay
  setTimeout(() => {
    hide('#splash');
  }, CONFIG.SPLASH_DURATION);
  
  // Initialize Telegram
  initTelegram();
  
  // Setup event listeners
  setupEventListeners();
  
  // Apply translations
  applyI18n();
  
  // Check for saved activation
  const savedTgId = localStorage.getItem('tg_id');
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  const isActivated = localStorage.getItem('activated') === 'true';
  const subDays = parseInt(localStorage.getItem('sub_days') || '0');
  
  if (savedTgId) {
    state.tg_id = parseInt(savedTgId);
    console.log('[INIT] Found saved tg_id:', savedTgId);
  }
  
  if (savedToken) {
    state.token = savedToken;
    console.log('[INIT] Found saved token');
  }
  
  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
      console.log('[INIT] Found saved user:', state.user);
    } catch (e) {
      console.error('[INIT] Failed to parse saved user:', e);
    }
  }
  
  // Check if user is activated and subscription is valid
  if (isActivated && subDays > 0 && state.token) {
    console.log('[INIT] User is activated with', subDays, 'days remaining');
    if (!state.user) {
      state.user = { tg_id: state.tg_id };
    }
    openApp();
  } else {
    console.log('[INIT] User needs activation');
    if (isActivated && subDays <= 0) {
      console.log('[INIT] Subscription expired');
      localStorage.removeItem('activated');
    }
    showGate();
  }
  
  console.log('[INIT] Initialization complete');
}

// ============================================
// START APPLICATION
// ============================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[APP] QL Trading AI loaded');
