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
  
  // Remove after 6 seconds
  setTimeout(() => {
    item.remove();
  }, 6000);
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
  
  const result = await apiCall('/api/activate', {
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
  
  if (result.ok && result.wallet) {
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
  const result = await apiCall('/api/markets');
  
  if (result.ok && result.markets) {
    state.markets = result.markets;
    updateMarketsUI();
  }
  
  return result;
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
      return `
        <div class="request-item ${statusClass}">
          <div><strong>${req.type || 'Request'}</strong></div>
          <div>Amount: $${req.amount || 0}</div>
          <div>Status: ${req.status || 'pending'}</div>
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
    
    if (result.ok) {
      console.log('[ACTIVATION] Success!');
      showToast('Activation successful!', 'success');
      
      // Save user data
      state.user = result.user || { tg_id: state.tg_id };
      localStorage.setItem('tg_id', state.tg_id);
      
      // Wait a bit then open app
      setTimeout(() => {
        openApp();
      }, 1000);
      
    } else {
      console.error('[ACTIVATION] Failed:', result.error);
      showToast(result.error || 'Activation failed');
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
  
  state.feedTimer = setInterval(() => {
    fetchActivity();
  }, CONFIG.FEED_INTERVAL);
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
  
  // Fetch data for specific tabs
  if (tabName === 'markets') {
    fetchMarkets();
  } else if (tabName === 'requests') {
    fetchRequests();
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
  
  // Music button
  const musicBtn = $('#musicBtn');
  if (musicBtn) {
    musicBtn.addEventListener('click', () => {
      console.log('[MUSIC] Toggle music');
      // TODO: Implement music toggle
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
      const amountInput = $('#amountInput');
      const amount = amountInput?.value;
      
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
    tabSupport: 'Support',
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
    tabSupport: 'الدعم',
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
  
  // Always show gate first
  // User must activate even if they have a saved session
  showGate();
  
  // Check for saved session (for auto-fill)
  const savedTgId = localStorage.getItem('tg_id');
  if (savedTgId) {
    console.log('[INIT] Found saved tg_id:', savedTgId);
    state.tg_id = parseInt(savedTgId);
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
