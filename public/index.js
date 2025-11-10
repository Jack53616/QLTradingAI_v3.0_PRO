// ========== QL Trading AI Front System ==========

// عناصر رئيسية
const gate = document.getElementById("gate");
const subscriptionScreen = document.getElementById("subscription-screen");
const app = document.getElementById("app");
const activateBtn = document.getElementById("activateBtn");
const subKeyInput = document.getElementById("subKey");
const subStatus = document.getElementById("subStatus");
const tabButtons = document.querySelectorAll(".seg-btn");
const tabs = document.querySelectorAll(".tab");

// ✅ إظهار شاشة البداية (Gate) ثم الانتقال لشاشة الاشتراك
window.addEventListener("load", () => {
  setTimeout(() => {
    gate.classList.add("hide");
    setTimeout(() => {
      gate.classList.remove("active");
      gate.style.display = "none";
      showSubscription();
    }, 900);
  }, 1800);
});

// ✅ عرض شاشة الاشتراك أو المحفظة حسب الحالة
function showSubscription() {
  const isActivated = localStorage.getItem("ql_sub_active");
  if (isActivated) {
    subscriptionScreen.classList.add("hidden");
    app.classList.remove("hidden");
  } else {
    subscriptionScreen.classList.remove("hidden");
  }
}

// ✅ زر تفعيل الكود
activateBtn.addEventListener("click", async () => {
  const key = subKeyInput.value.trim();
  if (!key) {
    subStatus.textContent = "Please enter your key.";
    return;
  }

  subStatus.textContent = "Verifying...";
  try {
    const res = await fetch("/api/keys/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    const data = await res.json();

    if (data.ok) {
      subStatus.textContent = "✅ Activated successfully!";
      localStorage.setItem("ql_sub_active", "true");
      setTimeout(() => {
        subscriptionScreen.classList.add("hidden");
        app.classList.remove("hidden");
      }, 800);
    } else {
      subStatus.textContent = "❌ Invalid or expired key.";
    }
  } catch (err) {
    console.error("Activation error:", err);
    subStatus.textContent = "⚠️ Connection error.";
  }
});

// ✅ نظام التبويبات (Wallet, Markets, Trades, Withdraw, Requests)
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabs.forEach((t) => t.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ✅ زر اللغة (بسيط مبدئيًا)
document.getElementById("btnLang").addEventListener("click", () => {
  alert("🌐 Language options coming soon...");
});

// ✅ زر الموسيقى (اختياري)
let musicEnabled = false;
document.getElementById("btnMusic").addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  alert(musicEnabled ? "🎵 Music ON" : "🔇 Music OFF");
});
