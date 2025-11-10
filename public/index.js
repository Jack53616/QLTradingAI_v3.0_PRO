// ==================================
// 🧠 QL Trading AI - Main Script
// ==================================

// Safe DOM ready check
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const splash = document.getElementById("splash");

  // Ensure app is hidden initially until load done
  if (app) app.classList.add("hidden");

  // Hide splash smoothly once everything loaded
  window.addEventListener("load", () => {
    setTimeout(() => {
      splash?.classList.add("hidden");
      app?.classList.remove("hidden");
    }, 600);
  });

  // Tabs navigation fix (prevent lag)
  const segButtons = document.querySelectorAll(".seg-btn");
  const tabs = document.querySelectorAll(".tab");

  segButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // deactivate all buttons
      segButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // switch tab view
      const target = btn.getAttribute("data-tab");
      tabs.forEach((tab) => {
        if (tab.id === target) {
          tab.classList.remove("hidden");
          tab.classList.add("fade-in");
        } else {
          tab.classList.add("hidden");
          tab.classList.remove("fade-in");
        }
      });
    });
  });

  // Scroll behavior fix for mobile
  document.body.addEventListener(
    "touchmove",
    (e) => {
      if (e.scale !== 1) e.preventDefault();
    },
    { passive: false }
  );

  // Optional console greeting
  console.log("🚀 QL Trading AI Interface Loaded Successfully");
});
