// ========== QL Trading AI App Logic ==========

// عناصر واجهة المستخدم
const balanceEl = document.getElementById("balance");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const tradesList = document.getElementById("tradesList");

const subscribeScreen = document.getElementById("subscribeScreen");
const appEl = document.getElementById("app");
const activateBtn = document.getElementById("activateBtn");
const buyBtn = document.getElementById("buyBtn");
const subKeyInput = document.getElementById("subKey");

// ✅ التحقق من حالة الاشتراك
document.addEventListener("DOMContentLoaded", () => {
  const isActivated = localStorage.getItem("ql_sub_active");

  if (isActivated) {
    subscribeScreen.style.display = "none";
    appEl.classList.remove("hidden");
    initApp();
  } else {
    subscribeScreen.style.display = "flex";
  }
});

// ✅ عند الضغط على زر Activate
activateBtn.addEventListener("click", async () => {
  const key = subKeyInput.value.trim();
  if (!key) return alert("Please enter your subscription key.");

  try {
    const res = await fetch("/api/keys/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });

    const data = await res.json();
    if (data.ok) {
      localStorage.setItem("ql_sub_active", "true");
      subscribeScreen.style.opacity = 0;
      setTimeout(() => {
        subscribeScreen.style.display = "none";
        appEl.classList.remove("hidden");
        initApp();
      }, 700);
    } else {
      alert("❌ Invalid key or expired.");
    }
  } catch (err) {
    console.error("Activation error:", err);
    alert("Server error. Please try again.");
  }
});

// ✅ زر شراء المفتاح (واتساب)
buyBtn.addEventListener("click", () => {
  window.open("https://wa.me/212645014913", "_blank");
});

// ✅ دالة تشغيل التطبيق بعد التفعيل
function initApp() {
  loadUserData();
  loadMarkets();
  loadTrades();
}

// تحميل بيانات المستخدم
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
