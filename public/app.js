// ============================================
// QL Trading AI v3.0 PRO - Frontend
// Professional Edition with Advanced UI/UX
// ============================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const API_BASE = window.location.origin;

const state = {
  user: null,
  markets: [],
  trades: [],
  tg_id: null,
  lang: "ar",
  feedTimer: null,
  tickerTimer: null,
  isAppOpen: false
};

// ============================================
// TELEGRAM WEBAPP INITIALIZATION
// ============================================

if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0814');
  tg.setBackgroundColor('#0a0814');
  
  const user = tg.initDataUnsafe?.user;
  if (user?.id) {
    state.tg_id = user.id;
    console.log("✅ Telegram user detected:", user.id);
  } else {
    console.warn("⚠️ No Telegram user found");
  }
} else {
  console.warn("⚠️ Not running in Telegram WebApp");
}

// ============================================
// API HELPER
// ============================================

async function apiCall(path, opts = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...opts.headers
    };

    // Add Telegram WebApp init data for authentication
    if (window.Telegram?.WebApp?.initData) {
      headers["X-Telegram-Init-Data"] = window.Telegram.WebApp.initData;
    }

    // For development: add tg_id to query if available
    if (state.tg_id && !window.Telegram?.WebApp?.initData) {
      const url = new URL(API_BASE + path);
      url.searchParams.set('tg_id', state.tg_id);
      path = url.pathname + url.search;
    }

    const res = await fetch(API_BASE + path, {
      ...opts,
      headers
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ API Error [${res.status}]:`, path, data);
    }
    
    return data;
  } catch (err) {
    console.error("❌ API call failed:", err);
    return { ok: false, error: err.message };
  }
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 QL Trading AI v3.0 PRO Initialized");
  
  // Hide splash after delay
  setTimeout(() => {
    const splash = $("#splash");
    if (splash) {
      splash.style.transition = "opacity 0.6s ease";
      splash.style.opacity = "0";
      setTimeout(() => {
        splash.remove();
        console.log("✅ Splash removed");
      }, 600);
    }
  }, 2500);

  // Setup event listeners
  setupEventListeners();

  // Try to open app
  setTimeout(async () => {
    const opened = await openApp();
    if (!opened) {
      showGate();
    }
  }, 2600);
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Gate activation
  $("#g-activate")?.addEventListener("click", handleActivation);
  $("#g-buy")?.addEventListener("click", () => {
    window.open("https://wa.me/message/PGBBPSDL2CC4D1", "_blank");
  });

  // Tabs
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Withdraw
  $("#withdrawBtn")?.addEventListener("click", showWithdrawSheet);
  $(".sheet-cancel")?.addEventListener("click", hideWithdrawSheet);
  $(".sheet-overlay")?.addEventListener("click", hideWithdrawSheet);
  
  $$(".method-btn").forEach(btn => {
    btn.addEventListener("click", () => handleWithdraw(btn.dataset.method));
  });

  // Language toggle
  $("#langBtn")?.addEventListener("click", toggleLanguage);
}

// ============================================
// GATE FUNCTIONS
// ============================================

function showGate() {
  console.log("🔒 Showing gate...");
  
  const gate = $("#gate");
  const app = $("#app");
  
  if (gate) {
    gate.classList.remove("hidden");
    gate.style.display = "flex";
  }
  
  if (app) {
    app.classList.add("hidden");
    app.style.display = "none";
  }
  
  state.isAppOpen = false;
  console.log("✅ Gate shown");
}

function hideGate() {
  console.log("🔓 Hiding gate...");
  
  const gate = $("#gate");
  const app = $("#app");
  
  if (gate) {
    gate.style.transition = "opacity 0.3s ease";
    gate.style.opacity = "0";
    
    setTimeout(() => {
      gate.classList.add("hidden");
      gate.style.display = "none";
      gate.style.opacity = "1";
      console.log("✅ Gate hidden");
    }, 300);
  }
  
  if (app) {
    setTimeout(() => {
      app.classList.remove("hidden");
      app.style.display = "block";
      state.isAppOpen = true;
      console.log("✅ App shown");
    }, 150);
  }
}

async function handleActivation() {
  const name = $("#g-name")?.value?.trim();
  const email = $("#g-email")?.value?.trim();
  const key = $("#g-key")?.value?.trim();

  if (!key) {
    showToast("⚠️ يرجى إدخال مفتاح الاشتراك", "error");
    return;
  }

  const btn = $("#g-activate");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-text">جاري التفعيل...</span>';
  }

  try {
    const payload = { key };
    if (state.tg_id) payload.tg_id = state.tg_id;
    if (name) payload.name = name;
    if (email) payload.email = email;

    console.log("🔑 Activating with payload:", { ...payload, key: "***" });

    const result = await apiCall("/api/keys/activate", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (result.ok) {
      showToast("✅ تم تفعيل الاشتراك بنجاح!", "success");
      console.log("✅ Activation successful");
      
      // Clear inputs
      if ($("#g-name")) $("#g-name").value = "";
      if ($("#g-email")) $("#g-email").value = "";
      if ($("#g-key")) $("#g-key").value = "";
      
      // Wait a bit then open app
      setTimeout(async () => {
        const opened = await openApp();
        if (opened) {
          hideGate();
        } else {
          showToast("⚠️ حدث خطأ، يرجى المحاولة مرة أخرى", "error");
        }
      }, 1500);
    } else {
      const errorMsg = result.error === "invalid_key" 
        ? "❌ مفتاح غير صحيح"
        : result.error === "key_used"
        ? "❌ هذا المفتاح مستخدم بالفعل"
        : "❌ " + (result.message || "حدث خطأ");
      
      showToast(errorMsg, "error");
      console.error("❌ Activation failed:", result);
    }
  } catch (err) {
    showToast("❌ حدث خطأ في الاتصال", "error");
    console.error("❌ Activation error:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-text">تفعيل الآن</span><span class="btn-shine"></span>';
    }
  }
}

function showToast(msg, type = "info") {
  const toast = $("#g-toast");
  if (!toast) return;
  
  toast.textContent = msg;
  toast.className = `gate-toast ${type}`;
  toast.style.opacity = "1";
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.textContent = "";
      toast.className = "gate-toast";
    }, 300);
  }, 3000);
}

// ============================================
// APP FUNCTIONS
// ============================================

async function openApp() {
  console.log("🔓 Opening app...");
  
  try {
    // Try to load user
    const result = await apiCall("/api/users/me");
    
    if (result.ok && result.user) {
      state.user = result.user;
      console.log("✅ User loaded:", result.user);
      
      // Render UI
      renderUser();
      
      // Load data
      await Promise.all([
        loadMarkets(),
        loadTrades()
      ]);
      
      // Start timers
      startBalanceTicker();
      startFakeFeed();
      
      return true;
    } else {
      console.warn("⚠️ User not found or not activated");
      return false;
    }
  } catch (err) {
    console.error("❌ Error opening app:", err);
    return false;
  }
}

function renderUser() {
  if (!state.user) return;
  
  const { balance = 0, level = "Bronze", subscription_end } = state.user;
  
  // Balance
  if ($("#balance")) {
    $("#balance").textContent = `$${balance.toFixed(2)}`;
  }
  
  // Level
  if ($("#userLevel")) {
    $("#userLevel").textContent = level;
  }
  
  // Subscription
  if ($("#subLeft") && subscription_end) {
    const daysLeft = Math.ceil((new Date(subscription_end) - new Date()) / (1000 * 60 * 60 * 24));
    $("#subLeft").textContent = daysLeft > 0 ? `${daysLeft} يوم` : "منتهي";
  }
}

// ============================================
// MARKETS
// ============================================

async function loadMarkets() {
  try {
    const result = await apiCall("/api/markets");
    
    if (result.ok && result.markets) {
      state.markets = result.markets;
      renderMarkets();
      console.log("✅ Markets loaded:", result.markets.length);
    }
  } catch (err) {
    console.error("❌ Error loading markets:", err);
  }
}

function renderMarkets() {
  const container = $("#marketsGrid");
  if (!container) return;
  
  container.innerHTML = state.markets.map(m => `
    <div class="market-card card-glass">
      <div class="market-header">
        <span class="market-name">${m.symbol}</span>
        <span class="market-change ${m.change >= 0 ? 'up' : 'down'}">
          ${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%
        </span>
      </div>
      <div class="market-price">$${m.price.toFixed(2)}</div>
    </div>
  `).join('');
}

// ============================================
// TRADES
// ============================================

async function loadTrades() {
  try {
    const result = await apiCall("/api/trades/me");
    
    if (result.ok && result.trades) {
      state.trades = result.trades;
      renderTrades();
      console.log("✅ Trades loaded:", result.trades.length);
    }
  } catch (err) {
    console.error("❌ Error loading trades:", err);
  }
}

function renderTrades() {
  const container = $("#tradesList");
  if (!container) return;
  
  if (state.trades.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد صفقات حالياً</p>';
    return;
  }
  
  container.innerHTML = state.trades.map(t => `
    <div class="trade-item">
      <strong>${t.pair || 'N/A'}</strong> - 
      ${t.type || 'N/A'} - 
      $${(t.amount || 0).toFixed(2)}
    </div>
  `).join('');
}

// ============================================
// BALANCE TICKER
// ============================================

function startBalanceTicker() {
  if (state.tickerTimer) clearInterval(state.tickerTimer);
  
  state.tickerTimer = setInterval(() => {
    if (!state.user || !state.isAppOpen) return;
    
    // Only tick if there are open trades
    const openTrades = state.trades.filter(t => t.status === 'open');
    if (openTrades.length === 0) {
      if ($("#ticker")) $("#ticker").textContent = "+0.00";
      return;
    }
    
    // Random small change
    const change = (Math.random() * 0.5 - 0.1).toFixed(2);
    const newBalance = parseFloat(state.user.balance) + parseFloat(change);
    
    state.user.balance = newBalance;
    
    if ($("#balance")) {
      $("#balance").textContent = `$${newBalance.toFixed(2)}`;
    }
    
    if ($("#ticker")) {
      $("#ticker").textContent = change >= 0 ? `+${change}` : change;
      $("#ticker").style.color = change >= 0 ? "var(--success)" : "var(--danger)";
    }
  }, 2000);
}

// ============================================
// FAKE ACTIVITY FEED
// ============================================

const FAKE_NAMES = [
  "أحمد محمد", "محمد علي", "خالد يوسف", "عمر حسن", "سارة أحمد",
  "فاطمة علي", "ليلى محمود", "نور الدين", "ياسمين خالد", "زينب عمر",
  "علي حسن", "حسن محمد", "يوسف أحمد", "كريم علي", "مريم حسن",
  "عائشة محمد", "رنا يوسف", "دينا خالد", "هدى عمر", "سلمى أحمد",
  "طارق محمد", "وليد علي", "سامي حسن", "رامي يوسف", "نادر خالد",
  "لينا محمد", "ريم علي", "هبة حسن", "منى يوسف", "نهى خالد"
];

function startFakeFeed() {
  if (state.feedTimer) clearInterval(state.feedTimer);
  
  state.feedTimer = setInterval(() => {
    if (!state.isAppOpen) return;
    
    const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const type = Math.random();
    
    let msg;
    if (type < 0.33) {
      const amount = (Math.random() * 200 + 50).toFixed(0);
      msg = `💰 ${name} قام بسحب $${amount}`;
    } else if (type < 0.66) {
      const profit = (Math.random() * 150 + 20).toFixed(0);
      msg = `📈 ${name} حقق ربح $${profit}`;
    } else {
      msg = `🎉 ${name} انضم للمنصة`;
    }
    
    addFeedItem(msg);
  }, 15000);
}

function addFeedItem(msg) {
  const container = $("#feed");
  if (!container) return;
  
  const item = document.createElement("div");
  item.className = "activity-item";
  item.textContent = msg;
  item.style.opacity = "0";
  item.style.transform = "translateY(-10px)";
  
  container.insertBefore(item, container.firstChild);
  
  setTimeout(() => {
    item.style.transition = "all 0.3s ease";
    item.style.opacity = "1";
    item.style.transform = "translateY(0)";
  }, 10);
  
  // Remove old items
  const items = container.querySelectorAll(".activity-item");
  if (items.length > 10) {
    items[items.length - 1].remove();
  }
}

// ============================================
// TABS
// ============================================

function switchTab(tabName) {
  // Update buttons
  $$(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  
  // Update content
  $$(".tab-content").forEach(content => {
    content.classList.toggle("show", content.id === tabName);
  });
  
  console.log("📑 Switched to tab:", tabName);
}

// ============================================
// WITHDRAW
// ============================================

function showWithdrawSheet() {
  const sheet = $("#withdrawSheet");
  if (sheet) {
    sheet.classList.remove("hidden");
  }
}

function hideWithdrawSheet() {
  const sheet = $("#withdrawSheet");
  if (sheet) {
    sheet.classList.add("hidden");
  }
}

async function handleWithdraw(method) {
  hideWithdrawSheet();
  
  if (!state.user) return;
  
  const amount = prompt(`كم تريد سحب؟ (الرصيد: $${state.user.balance.toFixed(2)})`);
  if (!amount || isNaN(amount) || amount <= 0) return;
  
  const address = prompt(`أدخل عنوان ${method}:`);
  if (!address) return;
  
  try {
    const result = await apiCall("/api/withdraw/request", {
      method: "POST",
      body: JSON.stringify({
        amount: parseFloat(amount),
        method,
        address
      })
    });
    
    if (result.ok) {
      alert("✅ تم إرسال طلب السحب بنجاح! سيتم المراجعة قريباً.");
    } else {
      alert("❌ " + (result.message || "حدث خطأ"));
    }
  } catch (err) {
    alert("❌ حدث خطأ في الاتصال");
    console.error(err);
  }
}

// ============================================
// LANGUAGE TOGGLE
// ============================================

function toggleLanguage() {
  state.lang = state.lang === "ar" ? "en" : "ar";
  document.documentElement.setAttribute("lang", state.lang);
  document.documentElement.setAttribute("dir", state.lang === "ar" ? "rtl" : "ltr");
  console.log("🌐 Language changed to:", state.lang);
}

// ============================================
// CLEANUP
// ============================================

window.addEventListener("beforeunload", () => {
  if (state.feedTimer) clearInterval(state.feedTimer);
  if (state.tickerTimer) clearInterval(state.tickerTimer);
});

console.log("✅ QL Trading AI v3.0 PRO - Ready!");
