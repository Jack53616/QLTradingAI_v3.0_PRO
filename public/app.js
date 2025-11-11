// QL Trading AI v3.0 PRO - Enhanced Frontend
// Combines beautiful old design with new secure backend

const TWA = window.Telegram?.WebApp;
const API_BASE = window.location.origin;

// State
const state = {
  lang: localStorage.getItem("ql_lang") || "ar",
  user: null,
  tg_id: null,
  initData: null,
  method: "usdt_trc20",
  musicOn: false,
  feedTimer: null,
  markets: {},
  trades: []
};

// i18n
const i18n = {
  en: {
    gateTitle: "QL Trading — Access",
    gateSub: "Enter your subscription key to unlock your wallet",
    confirm: "Confirm",
    buyKey: "Buy a key",
    tabWallet: "Home",
    tabMarkets: "Markets",
    tabTrades: "My Trades",
    tabWithdraw: "Withdraw",
    tabRequests: "Requests",
    tabSupport: "Support",
    noOpenTrade: "No open trade",
    withdraw: "Withdraw",
    markets: "Markets",
    support: "Support",
    day: "Day",
    month: "Month",
    subLeft: "Subscription",
    recent: "Recent activity",
    live: "Live feed",
    withdrawCrypto: "Withdraw (Crypto only)",
    request: "Request",
    savedAddr: "* Saved address for selected method will be used.",
    deposit: "Deposit",
    yourRequests: "Your requests",
    supportCenter: "Support Center",
    chooseMethod: "Choose withdraw method",
    cancel: "Cancel",
    myTrades: "My Trades",
    save: "Save"
  },
  ar: {
    gateTitle: "QL Trading — دخول",
    gateSub: "أدخل مفتاح الاشتراك لفتح محفظتك",
    confirm: "تأكيد",
    buyKey: "شراء مفتاح",
    tabWallet: "الرئيسية",
    tabMarkets: "الأسواق",
    tabTrades: "صفقاتي",
    tabWithdraw: "السحب",
    tabRequests: "الطلبات",
    tabSupport: "الدعم",
    noOpenTrade: "لا توجد صفقة مفتوحة",
    withdraw: "سحب",
    markets: "أسواق",
    support: "الدعم",
    day: "اليوم",
    month: "الشهر",
    subLeft: "الاشتراك",
    recent: "النشاط الأخير",
    live: "بث مباشر",
    withdrawCrypto: "سحب (عملات رقمية فقط)",
    request: "طلب",
    savedAddr: "* سيتم استخدام العنوان المحفوظ للطريقة المحددة.",
    deposit: "إيداع",
    yourRequests: "طلباتك",
    supportCenter: "مركز الدعم",
    chooseMethod: "اختر طريقة السحب",
    cancel: "إلغاء",
    myTrades: "صفقاتي",
    save: "حفظ"
  }
};

function t(key) {
  const lang = state.lang;
  return (i18n[lang] && i18n[lang][key]) || (i18n.en[key] || key);
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.body.dir = (state.lang === "ar") ? "rtl" : "ltr";
}

const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

// Detect Telegram
function detectTG() {
  try {
    if (TWA) {
      TWA.ready();
      TWA.expand();
      const initDataUnsafe = TWA.initDataUnsafe;
      state.tg_id = initDataUnsafe?.user?.id || null;
      state.initData = TWA.initData || null;
    }
  } catch {
    state.tg_id = null;
    state.initData = null;
  }
}

// API Helper
async function apiCall(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  // إضافة Telegram initData للمصادقة
  if (state.initData) {
    headers["x-telegram-initdata"] = state.initData;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("API Error:", err);
    return { ok: false, error: "network_error" };
  }
}

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
  $("#sndNotify")?.play().catch(() => {});
  setTimeout(() => { el.remove(); }, 6000);
}

// Gate
function showGate() {
  if (state.feedTimer) {
    clearInterval(state.feedTimer);
    state.feedTimer = null;
  }
  document.body.classList.add("is-gated");
  $("#gate")?.classList.remove("hidden");
  $("#app")?.classList.add("hidden");
}

function unlockGate() {
  document.body.classList.remove("is-gated");
  $("#gate")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");
}

// Activate Key
const gateBtn = $("#g-activate");
gateBtn?.addEventListener("click", async () => {
  if (gateBtn.disabled) return;

  const key = $("#g-key")?.value?.trim();
  const name = $("#g-name")?.value?.trim();
  const email = $("#g-email")?.value?.trim();

  if (!key) return toast("Enter key");

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
      toast(result?.message || result?.error || "Invalid key");
      return;
    }

    toast("✅ Activated successfully!");
    $("#g-key").value = "";
    
    // Load user data and open app
    await openApp();
  } catch (err) {
    console.error("Activation failed", err);
    toast("Connection error");
  } finally {
    gateBtn.disabled = false;
    gateBtn.textContent = restore;
  }
});

// Open App
async function openApp() {
  try {
    const result = await apiCall("/api/users/me");
    
    if (!result?.ok || !result?.user) {
      showGate();
      return false;
    }

    state.user = result.user;
    hydrateUser(result.user);
    unlockGate();
    
    // Load data
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
    showGate();
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

// Markets - Real prices from API
async function refreshMarkets() {
  try {
    const result = await apiCall("/api/markets");
    if (!result?.ok || !result?.markets) return;

    state.markets = {};
    result.markets.forEach(m => {
      state.markets[m.pair] = m;
    });

    // Update UI
    $$(".mkt").forEach(card => {
      const sym = card.dataset.sym;
      const market = state.markets[sym];
      
      if (market) {
        card.querySelector(".price").textContent = "$" + Number(market.price || 0).toFixed(2);
        
        const change = Number(market.change24h || 0);
        const pct = card.querySelector(".pct");
        pct.textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";
        pct.style.color = (change >= 0) ? "#9df09d" : "#ff8899";
        
        // Draw sparkline
        drawSparkline(card.querySelector("canvas"), change);
      }
    });
  } catch (err) {
    console.error("Markets refresh error:", err);
  }
}

function drawSparkline(canvas, trend) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  
  let y = 40 + (Math.random() * 8);
  ctx.moveTo(0, y);
  
  for (let x = 0; x < canvas.width; x += 8) {
    y += (Math.random() - 0.5) * 4 + (trend > 0 ? -0.1 : 0.1);
    y = Math.max(10, Math.min(50, y));
    ctx.lineTo(x, y);
  }
  
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7fe0ff";
  ctx.stroke();
}

// Trades
async function refreshTrades() {
  try {
    const result = await apiCall("/api/trades/me");
    if (result?.ok && result?.trades) {
      state.trades = result.trades;
    }
  } catch (err) {
    console.error("Trades refresh error:", err);
  }
}

async function loadTrades() {
  const box = $("#tradesList");
  if (!box) return;
  
  box.innerHTML = "";
  
  if (state.trades.length === 0) {
    box.innerHTML = '<div class="op"><span>No trades yet</span></div>';
    return;
  }
  
  state.trades.forEach(trade => {
    const div = document.createElement("div");
    div.className = "op";
    const profit = Number(trade.profit || 0);
    const profitClass = profit >= 0 ? "profit" : "loss";
    div.innerHTML = `
      <span>${trade.pair} • ${trade.type}</span>
      <b class="${profitClass}">${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}</b>
    `;
    box.appendChild(div);
  });
}

// Withdraw
const sheet = $("#sheet");
$("#pickMethod")?.addEventListener("click", () => sheet?.classList.add("show"));
$("#sCancel")?.addEventListener("click", () => sheet?.classList.remove("show"));

$$(".s-item").forEach(b => {
  b.addEventListener("click", () => {
    state.method = b.dataset.method;
    $("#methodLabel").textContent = b.textContent;
    renderMethod();
    sheet?.classList.remove("show");
  });
});

function renderMethod() {
  const map = {
    usdt_trc20: "USDT (TRC20)",
    usdt_erc20: "USDT (ERC20)",
    btc: "Bitcoin",
    eth: "Ethereum"
  };
  
  $("#methodLabel").textContent = map[state.method] || "USDT (TRC20)";
  
  const view = $("#methodView");
  if (view) {
    view.innerHTML = `
      <div class="muted">Saved address:</div>
      <input id="addr" class="input" placeholder="Your ${map[state.method] || 'Wallet'} address..."/>
      <button id="saveAddr" class="btn">Save</button>
    `;
    
    $("#saveAddr").onclick = async () => {
      const address = $("#addr").value.trim();
      notify("✅ Address saved");
    };
  }
}

$("#reqWithdraw")?.addEventListener("click", async () => {
  const amount = Number($("#amount")?.value || 0);
  if (amount <= 0) return notify("Enter amount");

  const result = await apiCall("/api/withdraw", {
    method: "POST",
    body: JSON.stringify({
      amount,
      method: state.method.toUpperCase().replace("_", "-"),
      address: $("#addr")?.value?.trim() || null
    })
  });

  if (!result?.ok) {
    return notify("❌ " + (result?.message || result?.error || "Error"));
  }

  notify("✅ Request sent");
  
  // Update balance
  if (result.new_balance !== undefined) {
    state.user.balance = result.new_balance;
    $("#balance").textContent = "$" + Number(result.new_balance).toFixed(2);
  }
  
  await refreshUser();
  await refreshRequests();
});

// Requests
async function refreshRequests() {
  try {
    const result = await apiCall("/api/withdraw/history");
    const box = $("#reqList");
    if (!box) return;
    
    box.innerHTML = "";
    
    if (!result?.ok || !result?.requests || result.requests.length === 0) {
      box.innerHTML = '<div class="op"><span>No requests yet</span></div>';
      return;
    }
    
    result.requests.forEach(req => {
      const div = document.createElement("div");
      div.className = "op";
      div.innerHTML = `
        <span>#${req.id} — ${req.method} — ${req.status}</span>
        <b>$${Number(req.amount).toFixed(2)}</b>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    console.error("Requests refresh error:", err);
  }
}

// Live Feed (Fake notifications)
const names = [
  "أحمد", "محمد", "خالد", "سارة", "رامي", "نور", "ليلى", "وسيم", "حسن", "طارق",
  "فاطمة", "علي", "زينب", "عمر", "مريم", "يوسف", "هدى", "كريم", "دينا", "ماجد",
  "ريم", "سامي", "لينا", "فارس", "منى", "عادل", "سلمى", "بشار", "رنا", "جمال"
];

function startFeed() {
  if (state.feedTimer) clearInterval(state.feedTimer);
  
  const feed = $("#feed");
  if (!feed) return;
  
  const push = (txt) => {
    const it = document.createElement("div");
    it.className = "item";
    it.textContent = txt;
    feed.prepend(it);
    $("#sndNotify")?.play().catch(() => {});
    while (feed.childElementCount > 12) feed.lastChild.remove();
  };
  
  const once = () => {
    const r = Math.random();
    const name = names[Math.floor(Math.random() * names.length)];
    
    if (r < 0.34) {
      const v = 50 + Math.floor(Math.random() * 200);
      push(`🪙 ${name} سحب ${v}$ بنجاح`);
    } else if (r < 0.67) {
      const v = 20 + Math.floor(Math.random() * 120);
      const m = ["Gold", "BTC", "ETH", "Silver"][Math.floor(Math.random() * 4)];
      push(`💰 ${name} ربح ${v}$ من صفقة ${m}`);
    } else {
      const v = 150 + Math.floor(Math.random() * 400);
      push(`🎉 مستخدم جديد انضم وأودع ${v}$`);
    }
  };
  
  once();
  state.feedTimer = setInterval(once, 20000); // Every 20 seconds
}

// Balance Ticker (Fake movement when trade is open)
let tickerI = 0;
function startBalanceTicker() {
  setInterval(() => {
    if (!state.user) return;
    
    // Simulate balance movement
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
  }, 2000); // Every 2 seconds
}

// Tabs
$$(".seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    
    $$(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    $$(".tab").forEach(t => t.classList.remove("show"));
    $(`#tab-${tab}`)?.classList.add("show");
    
    // Refresh data when switching tabs
    if (tab === "markets") refreshMarkets();
    if (tab === "trades") loadTrades();
    if (tab === "requests") refreshRequests();
  });
});

// Quick actions
$("#goWithdraw")?.addEventListener("click", () => {
  $$(".seg-btn").forEach(b => b.classList.remove("active"));
  $(".seg-btn[data-tab='withdraw']")?.classList.add("active");
  $$(".tab").forEach(t => t.classList.remove("show"));
  $("#tab-withdraw")?.classList.add("show");
});

$("#goMarkets")?.addEventListener("click", () => {
  $$(".seg-btn").forEach(b => b.classList.remove("active"));
  $(".seg-btn[data-tab='markets']")?.classList.add("active");
  $$(".tab").forEach(t => t.classList.remove("show"));
  $("#tab-markets")?.classList.add("show");
  refreshMarkets();
});

$("#goSupport")?.addEventListener("click", () => {
  $$(".seg-btn").forEach(b => b.classList.remove("active"));
  $(".seg-btn[data-tab='support']")?.classList.add("active");
  $$(".tab").forEach(t => t.classList.remove("show"));
  $("#tab-support")?.classList.add("show");
});

// Language toggle
$("#btnLang")?.addEventListener("click", () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  localStorage.setItem("ql_lang", state.lang);
  applyI18n();
});

// Music toggle
$("#btnMusic")?.addEventListener("click", () => {
  state.musicOn = !state.musicOn;
  // Add music functionality if needed
  notify(state.musicOn ? "🎵 Music ON" : "🔇 Music OFF");
});

// WhatsApp
$("#whatsapp")?.addEventListener("click", () => {
  window.open("https://wa.me/message/P6BBPSDL2CC4D1", "_blank");
});

// SL/TP Save
$("#saveSLTP")?.addEventListener("click", () => {
  notify("✅ SL/TP saved");
});

// Splash
setTimeout(() => {
  $("#splash")?.classList.add("hidden");
}, 1800);

// Boot
(async function() {
  detectTG();
  applyI18n();
  renderMethod();
  
  // Try to open app automatically
  const opened = await openApp();
  if (!opened) {
    showGate();
  }
  
  // Refresh markets every 30 seconds
  setInterval(refreshMarkets, 30000);
})();
