const supportedLangs = ["en", "ar", "tr", "de"];
const state = {
  lang: localStorage.getItem("ql_lang") || "en",
  translations: {},
  user: null,
  markets: [],
  trades: [],
  initData: null,
};

const metaApiBase = document
  .querySelector('meta[name="ql-api-base"]')
  ?.getAttribute("content")
  ?.trim();
const REMOTE_API_FALLBACK = metaApiBase || "https://qltrading-render.onrender.com";
let resolvedApiBase = null;

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

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const app = document.getElementById("app");
  const subscriptionScreen = document.getElementById("subscription-screen");
  const keyInput = document.getElementById("keyInput");
  const activateKeyBtn = document.getElementById("activateKey");
  const activationStatus = document.getElementById("activationStatus");
  const langBtn = document.getElementById("langBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const notifySound = document.getElementById("notifySound");
  const withdrawForm = document.getElementById("withdrawForm");
  const withdrawStatus = document.getElementById("withdrawStatus");
  const liveFeed = document.getElementById("liveFeed");

  const balanceEl = document.getElementById("balance");
  const userLevelEl = document.getElementById("userLevel");
  const userNameEl = document.getElementById("userName");
  const subscriptionEl = document.getElementById("subscription");
  const expiresEl = document.getElementById("expires");
  const marketList = document.getElementById("marketList");
  const tradeList = document.getElementById("tradeList");

  const tabs = document.querySelectorAll(".tabs button");
  const sections = document.querySelectorAll(".tab");

  const fadeTimers = new WeakMap();
  const TRANSITION_MS = 450;
  let feedStarted = false;
  let dashboardInterval = null;

  function clearFadeTimer(element) {
    const timer = fadeTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      fadeTimers.delete(element);
    }
  }

  function showElement(element) {
    if (!element || element.classList.contains("is-visible")) return;
    clearFadeTimer(element);
    element.classList.remove("hidden");
    requestAnimationFrame(() => {
      element.classList.add("is-visible");
    });
  }

  function hideElement(element) {
    if (!element || element.classList.contains("hidden")) return;
    element.classList.remove("is-visible");
    clearFadeTimer(element);
    const timer = window.setTimeout(() => {
      element.classList.add("hidden");
      fadeTimers.delete(element);
    }, TRANSITION_MS);
    fadeTimers.set(element, timer);
  }

  function dismissLoader() {
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

  function scheduleDashboardRefresh() {
    if (dashboardInterval) return;
    dashboardInterval = window.setInterval(() => {
      loadDashboard(true);
    }, 60_000);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((btn) => btn.classList.remove("active"));
      sections.forEach((section) => section.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  langBtn.addEventListener("click", () => {
    const index = supportedLangs.indexOf(state.lang);
    const nextLang = supportedLangs[(index + 1) % supportedLangs.length];
    setLanguage(nextLang);
  });

  refreshBtn.addEventListener("click", () => {
    loadDashboard();
  });

  activateKeyBtn.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    if (!key) {
      activationStatus.textContent = translate("errors.keyRequired");
      return;
    }

    activationStatus.textContent = translate("messages.activating");
    try {
      const payload = { key };
      if (telegramUser?.id) payload.tg_id = telegramUser.id;
      if (telegramUser?.first_name) payload.name = telegramUser.first_name;
      if (telegramUser?.username) payload.username = telegramUser.username;

      console.info("[activateKey] sending request", {
        base: resolveApiBase(),
        hasInitData: Boolean(state.initData),
      });

      const res = await apiFetch("/api/keys/activate", {
        method: "POST",
        body: payload,
      });

      const data = await safeJson(res);
      if (res.ok && data.ok) {
        activationStatus.textContent = translate("messages.activated");
        state.user = data.user;
        window.setTimeout(() => {
          hideElement(subscriptionScreen);
          showElement(app);
          scheduleDashboardRefresh();
          loadDashboard();
        }, TRANSITION_MS);
      } else if (data?.error) {
        const activationErrors = {
          invalid_key: "errors.invalidKey",
          key_used: "errors.invalidKey",
          missing_key: "errors.keyRequired",
        };
        const errorKey = activationErrors[data.error] || "errors.server";
        activationStatus.textContent =
          translate(errorKey) || translate("errors.server") || translate("errors.invalidKey");
      } else {
        activationStatus.textContent = translate("errors.server");
      }
    } catch (err) {
      console.error("Activation error", err);
      activationStatus.textContent = translate("errors.server");
    }
  });

  withdrawForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    withdrawStatus.textContent = translate("messages.sending");

    const method = document.getElementById("withdrawMethod").value;
    const address = document.getElementById("withdrawAddress").value.trim();
    const amount = Number(document.getElementById("withdrawAmount").value);

    try {
      console.info("[withdraw] sending request", {
        base: resolveApiBase(),
        method,
        amount,
      });
      const res = await apiFetch("/api/withdraw", {
        method: "POST",
        body: { method, address, amount },
      });
      const data = await safeJson(res);
      if (res.ok && data.ok) {
        withdrawStatus.textContent = translate("messages.withdrawSuccess");
        withdrawForm.reset();
      } else if (data?.error) {
        withdrawStatus.textContent = translate("errors.withdrawFailed");
      } else {
        withdrawStatus.textContent = translate("errors.server");
      }
    } catch (err) {
      console.error("Withdraw error", err);
      withdrawStatus.textContent = translate("errors.server");
    }
  });

  function translate(path) {
    return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), state.translations) || "";
  }

  async function safeJson(response) {
    if (!response) return {};
    try {
      return await response.json();
    } catch (err) {
      console.warn("Response parse error", err);
      return {};
    }
  }

  async function setLanguage(lang) {
    state.lang = lang;
    localStorage.setItem("ql_lang", lang);
    await loadTranslations();
    applyTranslations();
    renderMarkets();
    renderTrades();
    updateProfile();
  }

  async function loadTranslations() {
    try {
      const res = await fetch(`lang/${state.lang}.json`);
      state.translations = res.ok ? await res.json().catch(() => ({})) : {};
    } catch (err) {
      console.error("Translation load error", err);
      state.translations = {};
    }
  }

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

    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      const value = translate(key);
      if (value) node.placeholder = value;
    });

    document.querySelectorAll("[data-i18n-option]").forEach((node) => {
      const key = node.dataset.i18nOption;
      const value = translate(key);
      if (value) node.textContent = value;
    });
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };
    if (state.initData) headers["x-telegram-initdata"] = state.initData;
    if (!headers.Accept) headers.Accept = "application/json";

    const requestConfig = { ...options, headers };

    const isFormData =
      typeof FormData !== "undefined" && requestConfig.body instanceof FormData;
    const isBlob = typeof Blob !== "undefined" && requestConfig.body instanceof Blob;

    if (requestConfig.body && typeof requestConfig.body === "object" && !isFormData && !isBlob) {
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json; charset=utf-8";
      try {
        requestConfig.body = JSON.stringify(requestConfig.body);
      } catch (err) {
        console.warn("[apiFetch] failed to stringify body", err);
      }
    }

    const baseURL = resolveApiBase();
    if (!requestConfig.credentials) {
      const sameOrigin =
        typeof window !== "undefined" &&
        typeof window.location?.origin === "string" &&
        baseURL?.startsWith(window.location.origin);
      requestConfig.credentials = sameOrigin ? "same-origin" : "include";
    }

    const targetUrl = buildApiUrl(url, baseURL);
    if (!requestConfig.mode) requestConfig.mode = "cors";
    if (!requestConfig.cache) requestConfig.cache = "no-store";

    console.debug("[apiFetch]", {
      url: targetUrl,
      base: baseURL,
      method: requestConfig.method || "GET",
    });

    try {
      const response = await fetch(targetUrl, requestConfig);
      const responseMeta = {
        url: targetUrl,
        status: response.status,
        ok: response.ok,
      };
      if (!response.ok) {
        console.warn("[apiFetch] non-200 response", responseMeta);
      } else {
        console.debug("[apiFetch] response", responseMeta);
      }
      return response;
    } catch (err) {
      console.error("[apiFetch] network error", {
        url: targetUrl,
        error: err?.message,
      });
      throw err;
    }
  }

  function buildApiUrl(url, baseURL = resolveApiBase()) {
    if (/^https?:/i.test(url)) return url;

    if (url.startsWith("/")) return `${baseURL}${url}`;
    return `${baseURL}/${url}`;
  }

  function resolveApiBase() {
    if (resolvedApiBase) return resolvedApiBase;

    const explicitBase = typeof window.API_BASE_URL === "string" ? window.API_BASE_URL.trim() : "";
    if (explicitBase) {
      resolvedApiBase = explicitBase;
      console.debug("[apiFetch] using explicit API base", resolvedApiBase);
      return resolvedApiBase;
    }

    const { origin, hostname, protocol } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalhost) {
      resolvedApiBase = "http://localhost:10000";
      console.debug("[apiFetch] using localhost API base", resolvedApiBase);
      return resolvedApiBase;
    }

    if (origin && origin !== "null" && protocol !== "file:") {
      const normalizedOrigin = origin.toLowerCase();
      const isTelegramHost = /telegram|telegraph|t\.me/.test(normalizedOrigin);
      if (!isTelegramHost) {
        resolvedApiBase = origin;
        console.debug("[apiFetch] using same-origin API base", resolvedApiBase);
        return resolvedApiBase;
      }
      console.debug("[apiFetch] telegram host detected, falling back to remote API", normalizedOrigin);
    }

    resolvedApiBase = REMOTE_API_FALLBACK;
    console.debug("[apiFetch] using fallback API base", resolvedApiBase);
    return resolvedApiBase;
  }

  function renderMarkets() {
    marketList.innerHTML = "";
    if (!state.markets.length) {
      const empty = document.createElement("div");
      empty.className = "card empty";
      empty.textContent = translate("markets.empty") || "No markets";
      marketList.appendChild(empty);
      return;
    }
    state.markets.forEach((market) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div>
          <div class="title">${market.pair}</div>
          <div class="subtitle">${translate("markets.updated")}</div>
        </div>
        <strong>$${Number(market.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      `;
      marketList.appendChild(card);
    });
  }

  function renderTrades() {
    if (!state.trades.length) {
      tradeList.classList.add("empty");
      tradeList.textContent = translate("trades.empty");
      return;
    }

    tradeList.classList.remove("empty");
    tradeList.innerHTML = "";
    state.trades.forEach((trade) => {
      const card = document.createElement("div");
      card.className = "card";
      const profitClass = trade.profit >= 0 ? "profit" : "loss";
      card.innerHTML = `
        <div>
          <div class="title">${trade.pair} • ${trade.type}</div>
          <div class="subtitle">${new Date(trade.opened_at).toLocaleString()}</div>
        </div>
        <strong class="${profitClass}">${trade.profit >= 0 ? "+" : ""}${Number(trade.profit).toFixed(2)}$</strong>
      `;
      tradeList.appendChild(card);
    });
  }

  function updateProfile() {
    if (!state.user) return;
    balanceEl.textContent = `$${Number(state.user.balance || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    userLevelEl.textContent = state.user.level;
    userNameEl.textContent = state.user.name || state.user.username || translate("wallet.unknown");
    subscriptionEl.textContent = translate("wallet.subtitle");
    if (state.user.sub_expires) {
      const expires = new Date(state.user.sub_expires);
      expiresEl.textContent = expires.toLocaleDateString();
    } else {
      expiresEl.textContent = translate("wallet.noSubscription");
    }
  }

  function addFeedMessage(text) {
    if (!liveFeed) return;
    const item = document.createElement("div");
    item.className = "feed-item";
    item.textContent = text;
    liveFeed.prepend(item);
    if (liveFeed.childElementCount > 5) {
      liveFeed.lastElementChild.remove();
    }
    notifySound?.play().catch(() => {});
  }

  const baseFeedMessages = [
    "💰 Ahmed closed a gold trade with $180 profit",
    "🚀 Lisa just subscribed for Platinum tier",
    "📈 BTC scalping trade returned $95",
    "💎 New VIP member joined from Dubai",
    "📤 Withdrawal request processed for $400",
  ];

  function startLiveFeed() {
    if (feedStarted || !liveFeed) return;
    feedStarted = true;
    addFeedMessage(baseFeedMessages[Math.floor(Math.random() * baseFeedMessages.length)]);
    window.setInterval(() => {
      const message = baseFeedMessages[Math.floor(Math.random() * baseFeedMessages.length)];
      addFeedMessage(message);
    }, 60_000);
  }

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
        const marketsData = marketsRes.ok ? await safeJson(marketsRes) : {};
        state.markets = marketsData?.markets || [];
        renderMarkets();
      }

      if (tradesRes) {
        const tradesData = tradesRes.ok ? await safeJson(tradesRes) : {};
        state.trades = tradesData?.trades || [];
        renderTrades();
      }
    } catch (err) {
      if (!silent) console.error("Dashboard load error", err);
    }
  }

  async function bootstrap() {
    await setLanguage(state.lang);
    await new Promise((resolve) => setTimeout(resolve, 900));

    let profileLoaded = false;
    try {
      const res = await apiFetch("/api/users/me");
      if (res?.ok) {
        const data = await safeJson(res);
        if (data?.ok) {
          state.user = data.user;
          profileLoaded = true;
          updateProfile();
        }
      }
    } catch (err) {
      console.warn("Profile check failed", err);
    }

    if (profileLoaded) {
      showElement(app);
      hideElement(subscriptionScreen);
      loadDashboard();
      startLiveFeed();
      scheduleDashboardRefresh();
    } else {
      hideElement(app);
      showElement(subscriptionScreen);
      startLiveFeed();
    }

    dismissLoader();
  }

  const detectedApiBase = resolveApiBase();
  if (detectedApiBase) {
    window.__QL_API_BASE = detectedApiBase;
    console.debug("[bootstrap] resolved API base", detectedApiBase);
  }

  bootstrap();
});
