// ============================================
// QL Trading AI v3.0 PRO - Frontend
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
  feedTimer: null
};

// Telegram WebApp
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  
  const user = tg.initDataUnsafe?.user;
  if (user?.id) {
    state.tg_id = user.id;
  }
}

// API Call
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

    const res = await fetch(API_BASE + path, {
      ...opts,
      headers
    });

    if (!res.ok && res.status >= 500) {
      console.error("Server error:", res.status);
      return { ok: false, error: "Server error" };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("API call failed:", err);
    return { ok: false, error: err.message };
  }
}

// Initialize
window.addEventListener("DOMContentLoaded", async () => {
  // Hide splash after delay
  setTimeout(() => {
    const splash = $(".splash");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 600);
    }
  }, 2000);

  // Try to open app
  const opened = await openApp();
  
  if (!opened) {
    showGate();
  }
});

// Toast
function toast(msg) {
  const el = $("#g-toast");
  if (el) {
    el.textContent = msg;
    setTimeout(() => el.textContent = "", 2500);
  }
}

// Notification
function notify(msg) {
  const el = document.createElement("div");
  el.className = "feed item";
  el.textContent = msg;
  $("#feed")?.prepend(el);
  setTimeout(() => { el.remove(); }, 6000);
}

// ============================================
// GATE FUNCTIONS - FIXED
// ============================================

function showGate() {
  console.log("🔒 Showing gate...");
  
  // Stop feed timer
  if (state.feedTimer) {
    clearInterval(state.feedTimer);
    state.feedTimer = null;
  }
  
  // Hide app completely
  const app = $("#app");
  if (app) {
    app.style.display = "none";
  }
  
  // Show gate
  const gate = $("#gate");
  if (gate) {
    gate.style.display = "flex";
    gate.classList.remove("hidden");
  }
  
  document.body.classList.add("is-gated");
  console.log("✅ Gate shown");
}

function unlockGate() {
  console.log("🔓 Unlocking gate...");
  
  // Hide gate completely
  const gate = $("#gate");
  if (gate) {
    gate.style.display = "none";
    gate.classList.add("hidden");
  }
  
  // Show app
  const app = $("#app");
  if (app) {
    app.style.display = "block";
  }
  
  document.body.classList.remove("is-gated");
  console.log("✅ Gate unlocked, app visible");
}

// ============================================
// ACTIVATION
// ============================================

const gateBtn = $("#g-activate");
gateBtn?.addEventListener("click", async () => {
  if (gateBtn.disabled) return;

  const key = $("#g-key")?.value?.trim();
  const name = $("#g-name")?.value?.trim();
  const email = $("#g-email")?.value?.trim();

  if (!key) {
    toast("أدخل مفتاح الاشتراك");
    return;
  }

  const restore = gateBtn.textContent;
  gateBtn.disabled = true;
  gateBtn.textContent = "...";

  try {
    const result = await apiCall("/api/keys/activate", {
      method: "POST",
      body: JSON.stringify({
        key,
        tg_id: state.tg_id,
        name,
        email
      })
    });

    if (!result?.ok) {
      toast(result?.message || result?.error || "مفتاح غير صالح");
      gateBtn.disabled = false;
      gateBtn.textContent = restore;
      return;
    }

    toast("✅ تم التفعيل بنجاح!");
    
    // Clear inputs
    $("#g-key").value = "";
    $("#g-name").value = "";
    $("#g-email").value = "";
    
    // Wait a bit then open app
    setTimeout(async () => {
      await openApp();
    }, 800);
    
  } catch (err) {
    console.error("Activation failed", err);
    toast("خطأ في الاتصال");
    gateBtn.disabled = false;
    gateBtn.textContent = restore;
  }
});

// ============================================
// OPEN APP
// ============================================

async function openApp() {
  console.log("🚀 Opening app...");
  
  try {
    const result = await apiCall("/api/users/me");
    
    if (!result?.ok || !result?.user) {
      console.log("❌ User not found or not activated");
      return false;
    }

    console.log("✅ User loaded:", result.user);
    state.user = result.user;
    hydrateUser(result.user);
    
    // Unlock gate FIRST
    unlockGate();
    
    // Then load data
    await Promise.all([
      refreshMarkets(),
      refreshTrades(),
      loadTrades()
    ]);
    
    startFeed();
    startBalanceTicker();
    
    return true;
  } catch (err) {
    console.error("Failed to open app", err);
    return false;
  }
}

// Hydrate User
function hydrateUser(user) {
  if (!user) return;
  
  $("#balance").textContent = "$" + Number(user.balance || 0).toFixed(2);
  
  if (user.sub_expires) {
    const expires = new Date(user.sub_expires);
    $("#subLeft").textContent = expires.toLocaleDateString();
  } else {
    $("#subLeft").textContent = "—";
  }
}

// Refresh User
async function refreshUser() {
  const result = await apiCall("/api/users/me");
  if (result?.ok && result?.user) {
    state.user = result.user;
    hydrateUser(result.user);
    return true;
  }
  return false;
}

// ============================================
// MARKETS
// ============================================

async function refreshMarkets() {
  const result = await apiCall("/api/markets");
  if (result?.ok && result?.markets) {
    state.markets = result.markets;
    renderMarkets(result.markets);
  }
}

function renderMarkets(markets) {
  const grid = $("#marketsGrid");
  if (!grid) return;

  grid.innerHTML = markets.map(m => `
    <div class="mkt card glass">
      <div class="mh">
        <span>${m.name}</span>
        <span style="color:${m.change >= 0 ? '#9df09d' : '#ff8899'}">${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%</span>
      </div>
      <div class="price">$${Number(m.price).toFixed(2)}</div>
    </div>
  `).join("");
}

// ============================================
// TRADES
// ============================================

async function refreshTrades() {
  const result = await apiCall("/api/trades/me");
  if (result?.ok) {
    state.trades = result.trades || [];
    renderTrades(result.trades || []);
  }
}

function renderTrades(trades) {
  const list = $("#tradesList");
  if (!list) return;

  if (!trades || trades.length === 0) {
    list.innerHTML = '<div class="op" style="justify-content:center">لا توجد صفقات</div>';
    return;
  }

  list.innerHTML = trades.map(t => {
    const status = t.closed_at ? "مغلقة" : "مفتوحة";
    const color = t.profit >= 0 ? "#9df09d" : "#ff8899";
    return `
      <div class="op">
        <div>
          <div>${t.pair} • ${t.type}</div>
          <small style="color:var(--muted)">${status} • $${Number(t.amount).toFixed(2)}</small>
        </div>
        <div style="color:${color}; font-weight:700">${t.profit >= 0 ? '+' : ''}$${Number(t.profit).toFixed(2)}</div>
      </div>
    `;
  }).join("");
}

async function loadTrades() {
  await refreshTrades();
}

// ============================================
// WITHDRAW
// ============================================

const withdrawBtn = $("#withdrawBtn");
withdrawBtn?.addEventListener("click", () => {
  $("#withdrawSheet")?.classList.remove("hidden");
});

$$(".s-item").forEach(btn => {
  btn.addEventListener("click", async () => {
    const method = btn.dataset.method;
    const address = prompt(`أدخل عنوان ${method}:`);
    if (!address) return;

    const amount = prompt("أدخل المبلغ:");
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      toast("مبلغ غير صالح");
      return;
    }

    const result = await apiCall("/api/withdraw", {
      method: "POST",
      body: JSON.stringify({ method, address, amount: Number(amount) })
    });

    if (result?.ok) {
      toast("✅ تم إرسال طلب السحب");
      $("#withdrawSheet")?.classList.add("hidden");
      await refreshUser();
    } else {
      toast(result?.error || "فشل طلب السحب");
    }
  });
});

$(".s-cancel")?.addEventListener("click", () => {
  $("#withdrawSheet")?.classList.add("hidden");
});

// ============================================
// FAKE ACTIVITY FEED
// ============================================

const fakeNames = [
  "أحمد محمد", "محمد علي", "خالد أحمد", "عمر يوسف", "يوسف خالد",
  "علي حسن", "حسن محمود", "محمود عبدالله", "عبدالله سعيد", "سعيد ناصر",
  "ناصر فهد", "فهد سلطان", "سلطان راشد", "راشد مبارك", "مبارك سالم",
  "سالم عادل", "عادل كريم", "كريم طارق", "طارق وليد", "وليد ماجد",
  "سارة أحمد", "فاطمة علي", "نور محمد", "ريم خالد", "لينا حسن",
  "مريم يوسف", "هدى سعيد", "دانة ناصر", "شهد فهد", "جنى سلطان"
];

function startFeed() {
  const once = () => {
    const name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const type = Math.random();
    let msg;
    
    if (type < 0.33) {
      const amount = (Math.random() * 200 + 50).toFixed(2);
      msg = `🪙 ${name} قام بسحب $${amount}`;
    } else if (type < 0.66) {
      const profit = (Math.random() * 150 + 20).toFixed(2);
      msg = `💰 ${name} حقق ربح $${profit}`;
    } else {
      msg = `👋 ${name} انضم للمنصة`;
    }
    
    notify(msg);
  };
  
  once();
  state.feedTimer = setInterval(once, 20000); // Every 20 seconds
}

// ============================================
// BALANCE TICKER
// ============================================

let tickerI = 0;
function startBalanceTicker() {
  setInterval(() => {
    if (!state.user) return;
    
    // Check if there are open trades
    const hasOpenTrades = state.trades && state.trades.some(t => !t.closed_at);
    
    if (!hasOpenTrades) {
      // No open trades - show static
      const ticker = $("#ticker");
      if (ticker) {
        ticker.textContent = "+0.00";
        ticker.style.color = "#9df09d";
      }
      return;
    }
    
    // Simulate balance movement ONLY when trades are open
    const dir = Math.random() > 0.5 ? 1 : -1;
    const step = (Math.random() * 0.8) * dir;
    const cur = Number(String($("#balance")?.textContent || "0").replace(/[^\d.]/g, "")) || 0;
    const next = Math.max(0, cur + step);
    
    $("#balance").textContent = "$" + next.toFixed(2);
    
    const change = (dir > 0 ? "+" : "") + step.toFixed(2);
    const ticker = $("#ticker");
    if (ticker) {
      ticker.textContent = change;
      ticker.style.color = (dir > 0) ? "#9df09d" : "#ff8899";
    }
    
    // Animate chart path
    const p = $("#chartPath");
    if (p) {
      tickerI = (tickerI + 1) % 100;
      const y = 12 + Math.sin(tickerI / 8) * 3 + (dir > 0 ? -1 : 1);
      p.setAttribute("d", `M0,18 C15,12 22,16 30,15 C40,14 52,10 60,12 C70,14 82,${y} 100,12`);
    }
  }, 2000);
}

// ============================================
// TABS
// ============================================

$$(".seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    
    $$(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    $$(".tab").forEach(t => t.classList.remove("show"));
    $(`#${target}`)?.classList.add("show");
  });
});

// ============================================
// LANGUAGE TOGGLE
// ============================================

$("#langBtn")?.addEventListener("click", () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  document.documentElement.setAttribute("dir", state.lang === "ar" ? "rtl" : "ltr");
  // Here you can add translation logic
});

console.log("✅ QL Trading AI v3.0 PRO initialized");
