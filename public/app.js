const supportedLangs = ["en", "ar", "tr", "de"];
const state = {
  lang: localStorage.getItem("ql_lang") || "en",
  translations: {},
  user: null,
  markets: [],
  trades: [],
  initData: null,
};

const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
  telegram.expand?.();
  state.initData = telegram.initData;
}

const telegramUser = telegram?.initDataUnsafe?.user || null;
if (!state.initData) {
  const fallbackInit = localStorage.getItem("ql_initdata");
  if (fallbackInit) state.initData = fallbackInit;
}
if (state.initData) {
  localStorage.setItem("ql_initdata", state.initData);
}

// 🧠 ترجمة النصوص
function translate(path) {
  return (
    path
      .split(".")
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), state.translations) ||
    ""
  );
}

// 🧩 JSON آمن
async function safeJson(response) {
  if (!response) return {};
  try {
    return await response.json();
  } catch (err) {
    console.warn("Response parse error", err);
    return {};
  }
}

// 🌐 تحميل الترجمات
async function loadTranslations() {
  try {
    const res = await fetch(`lang/${state.lang}.json`);
    state.translations = res.ok ? await res.json().catch(() => ({})) : {};
  } catch (err) {
    console.error("Translation load error", err);
    state.translations = {};
  }
}

// 🌍 تعيين اللغة
async function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("ql_lang", lang);
  await loadTranslations();
  applyTranslations();
  renderMarkets();
  renderTrades();
  updateProfile();
}

// 🖋️ تطبيق الترجمات
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

// 🎯 تحديث بيانات المستخدم
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
    expiresEl.textContent = expires.toLocaleDateString();
  } else {
    expiresEl.textContent = translate("wallet.noSubscription");
  }
}

// ⚙️ دالة الطلبات العامة
async function apiFetch(url, options = {}) {
  const base =
    window.API_BASE_URL ||
    document.querySelector('meta[name="api-base"]')?.content ||
    (window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
      ? "http://localhost:10000"
      : "https://qltrading-render.onrender.com");

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers || {}),
  };

  if (state.initData) headers["x-telegram-initdata"] = state.initData;
  else console.warn("⚠️ Telegram initData غير موجود — سيتم الإرسال بدونها.");

  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;

  console.log("🌐 apiFetch →", {
    url: fullUrl,
    method: options.method || "GET",
    hasInitData: !!state.initData,
    headers,
    body: options.body || null,
  });

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      console.error(
        `❌ API Error (${res.status}): ${res.statusText}`,
        await res.text()
      );
    } else {
      console.log(`✅ API Response ${res.status}: ${fullUrl}`);
    }

    return res;
  } catch (err) {
    console.error("🚨 Network or Fetch Error:", err);
    throw err;
  }
}

// 🧱 واجهة العرض
function showElement(el) {
  if (!el || el.classList.contains("is-visible")) return;
  el.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.classList.add("is-visible");
  });
}

function hideElement(el) {
  if (!el || el.classList.contains("hidden")) return;
  el.classList.remove("is-visible");
  setTimeout(() => el.classList.add("hidden"), 450);
}

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

// 💹 الأسواق والصفقات
function renderMarkets() {
  const marketList = document.getElementById("marketList");
  marketList.innerHTML = "";
  if (!state.markets.length) {
    const empty = document.createElement("div");
    empty.className = "card empty";
    empty.textContent = translate("markets.empty") || "No markets";
    marketList.appendChild(empty);
    return;
  }
  state.markets.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div>
        <div class="title">${m.pair}</div>
        <div class="subtitle">${translate("markets.updated")}</div>
      </div>
      <strong>$${Number(m.price || 0).toFixed(2)}</strong>
    `;
    marketList.appendChild(card);
  });
}

function renderTrades() {
  const tradeList = document.getElementById("tradeList");
  if (!state.trades.length) {
    tradeList.classList.add("empty");
    tradeList.textContent = translate("trades.empty");
    return;
  }
  tradeList.classList.remove("empty");
  tradeList.innerHTML = "";
  state.trades.forEach((t) => {
    const card = document.createElement("div");
    card.className = "card";
    const cls = t.profit >= 0 ? "profit" : "loss";
    card.innerHTML = `
      <div>
        <div class="title">${t.pair} • ${t.type}</div>
        <div class="subtitle">${new Date(t.opened_at).toLocaleString()}</div>
      </div>
      <strong class="${cls}">${t.profit >= 0 ? "+" : ""}${Number(t.profit).toFixed(2)}$</strong>
    `;
    tradeList.appendChild(card);
  });
}

// 🔁 تحديث البيانات
async function loadDashboard(silent = false) {
  try {
    const [userRes, marketsRes, tradesRes] = await Promise.all([
      apiFetch("/api/users/me"),
      apiFetch("/api/markets"),
      apiFetch("/api/trades/me"),
    ]);

    if (userRes?.ok) {
      const userData = await safeJson(userRes);
      if (userData?.ok) {
        state.user = userData.user;
        updateProfile();
      }
    }

    if (marketsRes) {
      const data = marketsRes.ok ? await safeJson(marketsRes) : {};
      state.markets = data?.markets || [];
      renderMarkets();
    }

    if (tradesRes) {
      const data = tradesRes.ok ? await safeJson(tradesRes) : {};
      state.trades = data?.trades || [];
      renderTrades();
    }
  } catch (err) {
    if (!silent) console.error("Dashboard load error", err);
  }
}

// 🚀 التشغيل الرئيسي
async function bootstrap() {
  console.log("🚀 Bootstrapping QL Trading AI...");
  await setLanguage(state.lang);
  await new Promise((resolve) => setTimeout(resolve, 900));

  const app = document.getElementById("app");
  const subscriptionScreen = document.getElementById("subscription-screen");
  let profileLoaded = false;

  try {
    console.log("🔍 Checking user profile via /api/users/me...");
    const res = await apiFetch("/api/users/me", { method: "GET" });
    if (res?.ok) {
      const data = await safeJson(res);
      if (data?.ok && data.user) {
        state.user = data.user;
        updateProfile();
        profileLoaded = true;
      }
    }
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
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

// 🚀 ابدأ التشغيل بعد تحميل الصفحة
document.addEventListener("DOMContentLoaded", bootstrap);
