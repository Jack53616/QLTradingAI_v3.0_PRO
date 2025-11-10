// ========== QL Trading AI App Logic ==========

// عناصر واجهة المستخدم
const balanceEl = document.getElementById("balance");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const tradesList = document.getElementById("tradesList");

// استدعاء بيانات المستخدم من السيرفر
async function loadUserData() {
  try {
    const res = await fetch("/api/users/me");
    const data = await res.json();

    if (data.ok) {
      balanceEl.textContent = data.user.balance.toFixed(2);
      levelEl.textContent = data.user.level || "Bronze";
      xpEl.textContent = data.user.xp || 0;
    } else {
      console.warn("User data not loaded:", data.message);
    }
  } catch (err) {
    console.error("Error loading user data:", err);
  }
}

// تحميل الأسواق (BTC, ETH, XAU)
async function loadMarkets() {
  try {
    const res = await fetch("/api/markets/live");
    const data = await res.json();

    if (data.ok) {
      const marketTab = document.getElementById("markets");
      marketTab.innerHTML = `
        <h2>Markets</h2>
        <div class="market-grid">
          ${data.markets
            .map(
              (m) => `
              <div class="market-card glass">
                <h3>${m.symbol}</h3>
                <p>${m.price}</p>
              </div>
            `
            )
            .join("")}
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading markets:", err);
  }
}

// تحميل الصفقات
async function loadTrades() {
  try {
    const res = await fetch("/api/trades/list");
    const data = await res.json();

    if (data.ok) {
      tradesList.innerHTML = data.trades
        .map(
          (t) => `
          <div class="trade-item glass">
            <p><b>${t.symbol}</b> — ${t.side.toUpperCase()} ${t.amount} USDT</p>
            <small>${new Date(t.date).toLocaleString()}</small>
          </div>
        `
        )
        .join("");
    } else {
      tradesList.innerHTML = `<p>No trades found.</p>`;
    }
  } catch (err) {
    console.error("Error loading trades:", err);
  }
}

// تشغيل تلقائي بعد الدخول
document.addEventListener("DOMContentLoaded", () => {
  const isActivated = localStorage.getItem("ql_sub_active");
  if (isActivated) {
    loadUserData();
    loadMarkets();
    loadTrades();
  }
});
