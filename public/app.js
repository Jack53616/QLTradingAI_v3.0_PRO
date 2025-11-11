// 🌍 Supported languages
const supportedLangs = ["en", "ar", "tr", "de"];

// 🌐 Environment-safe mode
const IS_DEV =
  window.location.hostname.includes("localhost") ||
  window.location.hostname.includes("127.0.0.1");

// 🧠 Global state
const state = {
  lang: localStorage.getItem("ql_lang") || "en",
  translations: {},
  user: null,
  markets: [],
  trades: [],
  initData: null,
};

// 🔹 Telegram WebApp Integration
const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready?.();
  telegram.expand?.();
  state.initData = telegram.initData;
}

const telegramUser = telegram?.initDataUnsafe?.user || null;

if (!state.initData && IS_DEV) {
  console.warn("⚠️ Development mode: No Telegram initData available");
}

// 🧠 Translation helper
function translate(path) {
  return (
    path
      .split(".")
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), state.translations) ||
    ""
  );
}

// 🧩 Safe JSON parsing
async function safeJson(response) {
  if (!response) return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// 🌐 Load translations
async function loadTranslations() {
  try {
    const res = await fetch(`lang/${state.lang}.json`);
    state.translations = res.ok ? await res.json().catch(() => ({})) : {};
  } catch {
    state.translations = {};
  }
}

// 🌍 Set language
async function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("ql_lang", lang);
  await loadTranslations();
  applyTranslations();
  renderMarkets();
  renderTrades();
  updateProfile();
}

// 🖋️ Apply translations
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    const value = translate(key);
    if (!value) return;
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      node.placeholder = value;
    } else {
      node.textContent = value;
    }
  });
}

// 🎯 Update user info
function updateProfile() {
  const balanceEl = document.getElementById("balance");
  const userLevelEl = document.getElementById("userLevel");
  const userNameEl = document.getElementById("userName");
  const subscriptionEl = document.getElementById("subscription");
  const expiresEl = document.getElementById("expires");

  if (!state.user) return;

  balanceEl.textContent = `$${Number(state.user.balance || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  userLevelEl.textContent = state.user.level || "Bronze";
  userNameEl.textContent = state.user.name || state.user.username || translate("wallet.unknown");
  subscriptionEl.textContent = translate("wallet.subtitle");

  if (state.user.sub_expires) {
    const expires = new Date(state.user.sub_expires);
    const isActive = expires > new Date();
    expiresEl.textContent = expires.toLocaleDateString();
    expiresEl.style.color = isActive ? "#4ade80" : "#ef4444";
  } else {
    expiresEl.textContent = translate("wallet.noSubscription");
    expiresEl.style.color = "#ef4444";
  }
}

// ⚙️ API Fetch wrapper (improved)
async function apiFetch(url, options = {}) {
  const base =
    window.API_BASE_URL ||
    document.querySelector('meta[name="api-base"]')?.content ||
    (IS_DEV ? "http://localhost:10000" : window.location.origin);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers || {}),
  };

  if (state.initData) headers["x-telegram-initdata"] = state.initData;

  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  console.log("🌐 apiFetch →", { url: fullUrl, method: options.method || "GET" });

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: "include",
    });

    let body = {};
    try {
      body = await res.clone().json();
    } catch {
      body = {};
    }

    if (!res.ok) {
      console.error(`❌ API Error ${res.status}`, body);
      if (res.status === 401) showError("Authentication required");
      else if (res.status === 429) showError("Too many requests");
      else if (body.message) showError(body.message);
      return { ok: false, status: res.status, body };
    }

    console.log(`✅ API OK ${res.status}:`, body);
    return { ok: true, status: res.status, body };
  } catch (err) {
    console.error("🚨 Network error:", err);
    showError("Network error, check your connection");
    return { ok: false, status: 0, body: {} };
  }
}

// 🔔 Error notification
function showError(message) {
  const div = document.createElement("div");
  div.textContent = message;
  div.style.cssText =
    "position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:16px 24px;border-radius:8px;z-index:9999;";
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// 🎛️ UI visibility helpers
function showElement(el) {
  if (!el || el.classList.contains("is-visible")) return;
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("is-visible"));
}

function hideElement(el) {
  if (!el || el.classList.contains("hidden")) return;
  el.classList.remove("is-visible");
  setTimeout(() => el.classList.add("hidden"), 450);
}

// ⏳ Loader dismiss
function dismissLoader() {
  const loader = document.getElementById("loader");
  if (!loader || loader.classList.contains("hidden")) return;
  loader.classList.add("fade-out");
  loader.addEventListener(
    "animationend",
    () => {
      loader.classList.add("hidden");
      loader.classList.remove("fade-out");
    },
    { once: true }
  );
}

// 🚀 Boot
async function bootstrap() {
  await setLanguage(state.lang);
  await new Promise((r) => setTimeout(r, 500));

  const app = document.getElementById("app");
  const subscriptionScreen = document.getElementById("subscription-screen");
  let profileLoaded = false;

  try {
    const res = await apiFetch("/api/users/me");
    if (res.ok && res.body.ok && res.body.user) {
      state.user = res.body.user;
      updateProfile();
      profileLoaded = true;
    }
  } catch (e) {
    console.error("Profile load error", e);
  }

  dismissLoader();
  if (profileLoaded) {
    showElement(app);
    hideElement(subscriptionScreen);
    loadDashboard();
  } else {
    hideElement(app);
    showElement(subscriptionScreen);
  }
}

// 💹 Markets
function renderMarkets() {
  const list = document.getElementById("marketList");
  list.innerHTML = "";
  if (!state.markets.length) {
    const empty = document.createElement("div");
    empty.className = "card empty";
    empty.textContent = translate("markets.empty") || "No markets";
    list.appendChild(empty);
    return;
  }
  state.markets.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    const cls = Number(m.change24h) >= 0 ? "profit" : "loss";
    card.innerHTML = `
      <div>
        <div class="title">${m.pair}</div>
        <div class="subtitle">${translate("markets.updated")}</div>
      </div>
      <div style="text-align:right">
        <strong>$${Number(m.price || 0).toFixed(2)}</strong>
        <div class="${cls}">${Number(m.change24h).toFixed(2)}%</div>
      </div>`;
    list.appendChild(card);
  });
}

// 📊 Trades
function renderTrades() {
  const list = document.getElementById("tradeList");
  if (!state.trades.length) {
    list.textContent = translate("trades.empty") || "No trades";
    return;
  }
  list.innerHTML = "";
  state.trades.forEach((t) => {
    const c = document.createElement("div");
    c.className = "card";
    const cls = t.profit >= 0 ? "profit" : "loss";
    c.innerHTML = `
      <div>
        <div class="title">${t.pair} • ${t.type}</div>
        <div class="subtitle">${new Date(t.opened_at).toLocaleString()}</div>
      </div>
      <strong class="${cls}">${t.profit >= 0 ? "+" : ""}${Number(t.profit).toFixed(2)}$</strong>`;
    list.appendChild(c);
  });
}

// 🔁 Dashboard loader
async function loadDashboard() {
  try {
    const [u, m, t] = await Promise.all([
      apiFetch("/api/users/me"),
      apiFetch("/api/markets"),
      apiFetch("/api/trades/me"),
    ]);
    if (u.ok && u.body.ok) {
      state.user = u.body.user;
      updateProfile();
    }
    if (m.ok) {
      state.markets = m.body.markets || [];
      renderMarkets();
    }
    if (t.ok) {
      state.trades = t.body.trades || [];
      renderTrades();
    }
  } catch (e) {
    console.error("Dashboard error", e);
  }
}

// 🧭 DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  bootstrap();

  document.getElementById("langBtn")?.addEventListener("click", () => {
    const next =
      supportedLangs[(supportedLangs.indexOf(state.lang) + 1) % supportedLangs.length];
    setLanguage(next);
  });

  document.getElementById("refreshBtn")?.addEventListener("click", () => loadDashboard());

  // Activation
  document.getElementById("activateKey")?.addEventListener("click", async () => {
    const input = document.getElementById("keyInput");
    const status = document.getElementById("activationStatus");
    const key = input.value.trim();
    if (!key) {
      status.textContent = "Please enter a key";
      status.style.color = "#ef4444";
      return;
    }

    status.textContent = "Activating...";
    status.style.color = "#3b82f6";

    const res = await apiFetch("/api/keys/activate", {
      method: "POST",
      body: JSON.stringify({
        key,
        tg_id: telegramUser?.id,
        name: telegramUser?.first_name,
        username: telegramUser?.username,
      }),
    });

    if (res.ok && res.body.ok) {
      status.textContent = "Activated successfully!";
      status.style.color = "#10b981";
      setTimeout(() => window.location.reload(), 1500);
    } else {
      status.textContent =
        res.body.message || "Activation failed (" + res.status + ")";
      status.style.color = "#ef4444";
      console.warn("Activation failed:", res);
    }
  });
});
