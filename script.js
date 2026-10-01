// Tema claro / oscuro (el valor inicial se aplica en el <head>)
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function syncThemeLabel() {
  const dark = root.dataset.theme !== "light";
  themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}
syncThemeLabel();

themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  syncThemeLabel();
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// Menú mobile
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
function setMenu(open) {
  navLinks.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
}
menuBtn.addEventListener("click", () => setMenu(!navLinks.classList.contains("open")));
navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

// Link activo según la sección visible
const sections = document.querySelectorAll("main section[id]");
const links = navLinks.querySelectorAll("a");
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((l) =>
        l.classList.toggle("active", l.getAttribute("href") === "#" + entry.target.id)
      );
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
sections.forEach((s) => navObserver.observe(s));

// Animación al hacer scroll
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// Macropad de tecnologías: cada tecla escribe su descripción en la pantalla
const pad = document.getElementById("pad");
if (pad) {
  const keys = pad.querySelectorAll(".key");
  const oledTitle = document.getElementById("oledTitle");
  const oledText = document.getElementById("oledText");
  const oledLive = document.getElementById("oledLive");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let typing = null;
  let current = null;

  oledText.textContent = finePointer.matches ? "pasá el mouse por una tecla" : "tocá una tecla";

  function write(text) {
    clearInterval(typing);
    if (reduceMotion.matches) {
      oledText.textContent = text;
      return;
    }
    let i = 0;
    oledText.textContent = "";
    typing = setInterval(() => {
      i += 2;
      oledText.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typing);
    }, 16);
  }

  function select(key) {
    if (key === current) return;
    current = key;
    keys.forEach((k) => k.setAttribute("aria-pressed", String(k === key)));
    oledTitle.textContent = key.dataset.name.toLowerCase();
    write(key.dataset.desc);
    oledLive.textContent = `${key.dataset.name}: ${key.dataset.desc}`;
  }

  keys.forEach((key) => {
    key.addEventListener("click", () => select(key));
    key.addEventListener("focus", () => select(key));
    key.addEventListener("pointerenter", () => {
      if (finePointer.matches) select(key);
    });
  });
}
