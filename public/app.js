document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const app = document.getElementById("app");
  const subScreen = document.getElementById("subscription-screen");
  const keyBtn = document.getElementById("activateKey");
  const keyInput = document.getElementById("keyInput");
  const liveFeed = document.getElementById("liveFeed");
  const notifySound = document.getElementById("notifySound");

  // Simulate Loader
  setTimeout(() => {
    loader.classList.add("hidden");
    if (localStorage.getItem("activated")) app.classList.remove("hidden");
    else subScreen.classList.remove("hidden");
  }, 2500);

  keyBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) return alert("Enter your key first!");
    localStorage.setItem("activated", "true");
    subScreen.classList.add("hidden");
    app.classList.remove("hidden");
  };

  // Tabs
  document.querySelectorAll("nav button").forEach(btn => {
    btn.onclick = () => {
      document.querySelector("nav button.active")?.classList.remove("active");
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
      document.getElementById(btn.dataset.tab).classList.add("active");
    };
  });

  // Live Feed
  const messages = [
    "💰 أحمد ربح 40$ من صفقة على الذهب",
    "📤 سحب محمد 100$ بنجاح",
    "👤 مستخدم جديد انضم وأودع 250$",
    "💎 يوسف ربح 20$ من صفقة BTC",
    "📈 علي فتح صفقة على الذهب بقيمة 300$"
  ];
  setInterval(() => {
    const msg = document.createElement("div");
    msg.textContent = messages[Math.floor(Math.random() * messages.length)];
    liveFeed.prepend(msg);
    notifySound.play().catch(() => {});
    setTimeout(() => msg.remove(), 7000);
  }, 60000);
});
