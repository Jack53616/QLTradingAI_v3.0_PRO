// ✅ DOM elements
const app = document.getElementById("app");
const splash = document.getElementById("splash");
const btnLang = document.getElementById("btnLang");
const langMenu = document.getElementById("langMenu");

// ✅ Load language preference
let currentLang = localStorage.getItem("lang") || "en";

// ==============================
// 🌐 LANGUAGE SWITCHING SYSTEM
// ==============================
btnLang.addEventListener("click", () => {
  langMenu.classList.toggle("hidden");
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (!btnLang.contains(e.target) && !langMenu.contains(e.target)) {
    langMenu.classList.add("hidden");
  }
});

langMenu.querySelectorAll("div").forEach((el) => {
  el.addEventListener("click", () => {
    const lang = el.dataset.lang;
    localStorage.setItem("lang", lang);
    currentLang = lang;
    loadLang(lang);
    langMenu.classList.add("hidden");
  });
});

// ==============================
// 🗣️ LANGUAGE LOADER
// ==============================
async function loadLang(lang) {
  try {
    const res = await fetch(`./lang/${lang}.json`);
    if (!res.ok) throw new Error("Language file not found");
    const data = await res.json();

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (data[key]) el.textContent = data[key];
    });
  } catch (err) {
    console.warn("Language load error:", err.message);
  }
}

// ==============================
// 🧭 TABS NAVIGATION
// ==============================
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    // Switch active button
    document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Switch tab visibility
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.add("hidden");
      t.classList.remove("fade-in");
    });
    const activeTab = document.getElementById(tab);
    activeTab.classList.remove("hidden");
    activeTab.classList.add("fade-in");
  });
});

// ==============================
// 🚀 INITIALIZATION
// ==============================
window.addEventListener("load", () => {
  // Hide splash after load
  setTimeout(() => {
    splash.classList.add("hidden");
    app.classList.remove("hidden");
  }, 600); // smooth fade duration

  loadLang(currentLang);
});
