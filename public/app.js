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

// Security: Don't store initData in localStorage
// Only use it from Telegram WebApp directly
if (!state.initData && process.env.NODE_ENV === "development") {
  console.warn("⚠️ Development mode: No Telegram initData available");
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
    const now = new Date();
    const isActive = expires > now;
    expiresEl.textContent = expires.toLocaleDateString();
    expiresEl.style.color = isActive ? "#4ade80" : "#ef4444";
  } else {
    expiresEl.textContent = translate("wallet.noSubscription");
    expiresEl.style.color = "#ef4444";
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
      : window.location.origin);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers || {}),
  };

  if (state.initData) {
    headers["x-telegram-initdata"] = state.initData;
  } else {
    console.warn("⚠️ Telegram initData not available");
  }

  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;

  console.log("🌐 apiFetch →", {
    url: fullUrl,
    method: options.method || "GET",
    hasInitData: !!state.initData,
  });

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(
        `❌ API Error (${res.status}): ${res.statusText}`,
        errorData
      );
      
      // Show user-friendly error messages
      if (res.status === 401) {
        showError(translate("errors.unauthorized") || "Authentication required");
      } else if (res.status === 429) {
        showError(translate("errors.rate_limit") || "Too many requests. Please wait.");
      } else if (errorData.message) {
        showError(errorData.message);
      }
    } else {
      console.log(`✅ API Response ${res.status}: ${fullUrl}`);
    }

    return res;
  } catch (err) {
    console.error("🚨 Network or Fetch Error:", err);
    showError(translate("errors.network") || "Network error. Please check your connection.");
    throw err;
  }
}

// Show error notification
function showError(message) {
  // Simple error notification (you can enhance this)
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-notification";
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(errorDiv);
  setTimeout(() => {
    errorDiv.style.animation = "slideOut 0.3s ease";
    setTimeout(() => errorDiv.remove(), 300);
  }, 3000);
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
    const changeClass = Number(m.change24h) >= 0 ? "profit" : "loss";
    card.innerHTML = `
      <div>
        <div class="title">${m.pair}</div>
        <div class="subtitle">${translate("markets.updated")}</div>
      </div>
      <div style="text-align: right;">
        <strong>$${Number(m.price || 0).toFixed(2)}</strong>
        <div class="${changeClass}" style="font-size: 0.875rem;">
          ${Number(m.change24h) >= 0 ? "+" : ""}${Number(m.change24h).toFixed(2)}%
        </div>
      </div>
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

    if (marketsRes?.ok) {
      const data = await safeJson(marketsRes);
      state.markets = data?.markets || [];
      renderMarkets();
    }

    if (tradesRes?.ok) {
      const data = await safeJson(tradesRes);
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

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  bootstrap();

  // Language switcher
  document.getElementById("langBtn")?.addEventListener("click", () => {
    const nextLang = supportedLangs[(supportedLangs.indexOf(state.lang) + 1) % supportedLangs.length];
    setLanguage(nextLang);
  });

  // Refresh button
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    loadDashboard();
  });

  // Tab switching
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabName)?.classList.add("active");
    });
  });

  // Key activation
  document.getElementById("activateKey")?.addEventListener("click", async () => {
    const keyInput = document.getElementById("keyInput");
    const statusEl = document.getElementById("activationStatus");
    const key = keyInput.value.trim();

    if (!key) {
      statusEl.textContent = translate("subscription.enterKey") || "Please enter a key";
      statusEl.style.color = "#ef4444";
      return;
    }

    statusEl.textContent = translate("subscription.activating") || "Activating...";
    statusEl.style.color = "#3b82f6";

    try {
      const res = await apiFetch("/api/keys/activate", {
        method: "POST",
        body: JSON.stringify({
          key,
          tg_id: telegramUser?.id,
          name: telegramUser?.first_name,
          username: telegramUser?.username,
        }),
      });

      const data = await safeJson(res);

      if (res.ok && data.ok) {
        statusEl.textContent = translate("subscription.success") || "Activated successfully!";
        statusEl.style.color = "#10b981";
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        statusEl.textContent = data.message || translate("subscription.failed") || "Activation failed";
        statusEl.style.color = "#ef4444";
      }
    } catch (err) {
      statusEl.textContent = translate("subscription.error") || "Error activating key";
      statusEl.style.color = "#ef4444";
    }
  });

  // Withdrawal form
  document.getElementById("withdrawForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("withdrawStatus");
    const method = document.getElementById("withdrawMethod").value;
    const address = document.getElementById("withdrawAddress").value.trim();
    const amount = document.getElementById("withdrawAmount").value;

    statusEl.textContent = translate("withdraw.processing") || "Processing...";
    statusEl.style.color = "#3b82f6";

    try {
      const res = await apiFetch("/api/withdraw", {
        method: "POST",
        body: JSON.stringify({ method, address, amount: Number(amount) }),
      });

      const data = await safeJson(res);

      if (res.ok && data.ok) {
        statusEl.textContent = translate("withdraw.success") || "Request submitted successfully!";
        statusEl.style.color = "#10b981";
        e.target.reset();
        setTimeout(() => {
          statusEl.textContent = "";
        }, 3000);
      } else {
        statusEl.textContent = data.message || translate("withdraw.failed") || "Request failed";
        statusEl.style.color = "#ef4444";
      }
    } catch (err) {
      statusEl.textContent = translate("withdraw.error") || "Error submitting request";
      statusEl.style.color = "#ef4444";
    }
  });
});
