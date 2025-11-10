const btnLang = document.getElementById("btnLang");
const menu = document.getElementById("langMenu");
let currentLang = localStorage.getItem("lang") || "en";

btnLang.onclick = () => menu.classList.toggle("hidden");

menu.querySelectorAll("div").forEach(div => {
  div.onclick = () => {
    const lang = div.dataset.lang;
    loadLang(lang);
    currentLang = lang;
    localStorage.setItem("lang", lang);
    menu.classList.add("hidden");
  };
});

async function loadLang(lang) {
  try {
    const res = await fetch(`./lang/${lang}.json`);
    const data = await res.json();
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (data[key]) el.textContent = data[key];
    });
  } catch (e) {
    console.error("Language load error", e);
  }
}

document.querySelectorAll(".seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.add("hidden");
      t.classList.remove("fade-in");
    });
    const active = document.getElementById(tab);
    active.classList.remove("hidden");
    active.classList.add("fade-in");
  });
});

loadLang(currentLang);
