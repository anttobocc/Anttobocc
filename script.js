// Tema claro / oscuro (el valor inicial se aplica en el <head>)
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function syncThemeLabel() {
  const dark = root.dataset.theme === "dark";
  themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}
syncThemeLabel();

themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  syncThemeLabel();
  try { localStorage.setItem("tema", next); } catch (e) {}
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

// Macropad de tecnologías: cada tecla escribe su descripción en la pantalla.
// window.padBus comparte la selección y la escritura con el teclado 3D (teclado3d.js).
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

  // Los nombres de proyectos se resaltan en la pantalla
  const PROJECTS = /(EduControl|PlayCode|Capricho|Nutrivid|MerceNails|NutriPet)/g;

  const bus = (window.padBus = {
    projects: PROJECTS,
    title: "antonella",
    text: finePointer.matches ? "pasá el mouse por una tecla" : "tocá una tecla",
    count: Infinity,
    current: null,
    onRender: [],
    onSelect: [],
    select: null,
  });

  // Arma la pantalla con los primeros `count` caracteres, respetando los resaltados
  function render(text, count) {
    oledText.textContent = "";
    let shown = 0;
    for (const part of text.split(PROJECTS)) {
      if (!part || shown >= count) continue;
      const slice = part.slice(0, count - shown);
      shown += slice.length;
      if (PROJECTS.test(part)) {
        const hl = document.createElement("span");
        hl.className = "hl";
        hl.textContent = slice;
        oledText.append(hl);
      } else {
        oledText.append(slice);
      }
      PROJECTS.lastIndex = 0;
    }
    bus.text = text;
    bus.count = count;
    bus.onRender.forEach((fn) => fn());
  }

  function write(text) {
    clearInterval(typing);
    if (reduceMotion.matches) {
      render(text, text.length);
      return;
    }
    let i = 0;
    typing = setInterval(() => {
      i += 2;
      render(text, i);
      if (i >= text.length) clearInterval(typing);
    }, 16);
  }

  function select(key) {
    if (key === current) return;
    current = bus.current = key;
    keys.forEach((k) => k.setAttribute("aria-pressed", String(k === key)));
    bus.title = oledTitle.textContent = key.dataset.name.toLowerCase();
    bus.onSelect.forEach((fn) => fn(key));
    write(key.dataset.desc);
    oledLive.textContent = `${key.dataset.name}: ${key.dataset.desc}`;
  }
  bus.select = select;

  render(bus.text, Infinity);

  keys.forEach((key) => {
    key.addEventListener("click", () => select(key));
    key.addEventListener("focus", () => select(key));
    key.addEventListener("pointerenter", () => {
      if (finePointer.matches) select(key);
    });
  });
}

// Contacto: copiar el email al portapapeles
document.querySelectorAll(".cl-copy").forEach((btn) => {
  const label = btn.querySelector("span");
  const icon = btn.querySelector("i");
  let timer;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      label.textContent = "¡Copiado!";
      icon.className = "ph ph-check";
      btn.classList.add("is-done");
    } catch (e) {
      label.textContent = "No se pudo copiar";
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      label.textContent = "Copiar";
      icon.className = "ph ph-copy";
      btn.classList.remove("is-done");
    }, 1800);
  });
});

// Hero: ventanas arrastrables desde la barra de título (solo escritorio).
// Inercia corta al soltar y rebote suave si pasan el borde; sin eso con movimiento reducido.
const heroSection = document.querySelector(".hero");
const browserStack = document.querySelector(".browser-stack");
if (heroSection && browserStack) {
  const windows = [...browserStack.querySelectorAll(".browser")];
  const heroCopy = heroSection.querySelector(".hero-copy");
  const hint = heroSection.querySelector(".hand--drag");
  const wide = window.matchMedia("(min-width: 861px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const FRICTION = 0.88; // por cuadro de 16,7 ms: inercia corta
  const SPRING = 0.0016; // fuerza que la devuelve al límite (rebote suave)
  const RUBBER = 0.3; // resistencia al arrastrar más allá del borde
  const MAX_SPEED = 2.4; // px/ms
  const state = new Map(windows.map((w) => [w, { x: 0, y: 0, vx: 0, vy: 0, raf: 0, b: null }]));
  let zTop = 2;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const apply = (w, s) => {
    w.style.transform = s.x || s.y ? `translate(${s.x}px, ${s.y}px)` : "";
  };

  // Límites del desplazamiento: dentro del hero y siempre a la derecha del texto
  function bounds(w, s) {
    const hero = heroSection.getBoundingClientRect();
    const rect = w.getBoundingClientRect();
    const baseLeft = rect.left - s.x, baseTop = rect.top - s.y;
    const minLeft = Math.max(hero.left + 12, heroCopy.getBoundingClientRect().right + 32);
    return {
      minX: minLeft - baseLeft,
      maxX: hero.right - 12 - w.offsetWidth - baseLeft,
      minY: hero.top + 12 - baseTop,
      maxY: hero.bottom - 12 - w.offsetHeight - baseTop,
    };
  }

  function hideHint() {
    if (!hint || hint.classList.contains("is-gone")) return;
    hint.classList.add("is-gone");
    try { sessionStorage.setItem("hero-arrastre", "1"); } catch (e) {}
  }
  try { if (sessionStorage.getItem("hero-arrastre")) hint?.classList.add("is-gone"); } catch (e) {}

  function glide(w, s) {
    cancelAnimationFrame(s.raf);
    const b = s.b;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      const decay = Math.pow(FRICTION, dt / 16.67);
      for (const [p, v, min, max] of [["x", "vx", b.minX, b.maxX], ["y", "vy", b.minY, b.maxY]]) {
        const pull = s[p] < min ? min - s[p] : s[p] > max ? max - s[p] : 0;
        s[v] = (s[v] + pull * SPRING * dt) * decay;
        s[p] += s[v] * dt;
      }
      apply(w, s);
      const outside = s.x < b.minX - 0.5 || s.x > b.maxX + 0.5 || s.y < b.minY - 0.5 || s.y > b.maxY + 0.5;
      if (outside || Math.abs(s.vx) + Math.abs(s.vy) > 0.01) {
        s.raf = requestAnimationFrame(step);
      } else {
        s.x = clamp(s.x, b.minX, b.maxX);
        s.y = clamp(s.y, b.minY, b.maxY);
        apply(w, s);
      }
    };
    s.raf = requestAnimationFrame(step);
  }

  windows.forEach((w) => {
    const s = state.get(w);
    const bar = w.querySelector(".browser-bar");
    let drag = null;

    w.addEventListener("click", (e) => {
      if (s.justDragged) e.preventDefault();
    }, true);

    // Clic en cualquier parte de la ventana: pasa adelante
    w.addEventListener("pointerdown", () => {
      if (heroSection.classList.contains("hero-drag")) w.style.zIndex = ++zTop;
    });

    bar.addEventListener("pointerdown", (e) => {
      if (!heroSection.classList.contains("hero-drag") || e.button !== 0) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      cancelAnimationFrame(s.raf);
      w.style.animation = "none";
      w.classList.remove("is-returning");
      s.b = bounds(w, s);
      drag = { px: e.clientX, py: e.clientY, x: s.x, y: s.y, moved: false, samples: [{ t: e.timeStamp, x: s.x, y: s.y }] };
      w.classList.add("is-dragging");
    });

    bar.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      if (!drag.moved && Math.hypot(dx, dy) > 3) {
        drag.moved = true;
        hideHint();
      }
      const b = s.b;
      const soft = (v, min, max) => {
        if (reduceMotion.matches) return clamp(v, min, max);
        if (v < min) return min - (min - v) * RUBBER;
        if (v > max) return max + (v - max) * RUBBER;
        return v;
      };
      s.x = soft(drag.x + dx, b.minX, b.maxX);
      s.y = soft(drag.y + dy, b.minY, b.maxY);
      apply(w, s);
      drag.samples.push({ t: e.timeStamp, x: s.x, y: s.y });
      while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
    });

    const release = () => {
      if (!drag) return;
      // Si hubo arrastre, el clic que llega después no navega al link de la captura
      if (drag.moved) {
        s.justDragged = true;
        setTimeout(() => (s.justDragged = false), 0);
      }
      const first = drag.samples[0], lastS = drag.samples[drag.samples.length - 1];
      const dt = Math.max(1, lastS.t - first.t);
      drag = null;
      w.classList.remove("is-dragging");
      if (reduceMotion.matches) {
        s.x = clamp(s.x, s.b.minX, s.b.maxX);
        s.y = clamp(s.y, s.b.minY, s.b.maxY);
        apply(w, s);
        return;
      }
      s.vx = clamp((lastS.x - first.x) / dt, -MAX_SPEED, MAX_SPEED);
      s.vy = clamp((lastS.y - first.y) / dt, -MAX_SPEED, MAX_SPEED);
      glide(w, s);
    };
    bar.addEventListener("pointerup", release);
    bar.addEventListener("pointercancel", release);

    // Doble clic en la barra: vuelve a su posición original
    bar.addEventListener("dblclick", () => {
      if (!heroSection.classList.contains("hero-drag")) return;
      cancelAnimationFrame(s.raf);
      s.x = s.y = s.vx = s.vy = 0;
      if (!reduceMotion.matches) {
        w.classList.add("is-returning");
        w.addEventListener("transitionend", () => w.classList.remove("is-returning"), { once: true });
      }
      apply(w, s);
    });
  });

  function setEnabled(on) {
    heroSection.classList.toggle("hero-drag", on);
    if (on) return;
    windows.forEach((w) => {
      const s = state.get(w);
      cancelAnimationFrame(s.raf);
      s.x = s.y = s.vx = s.vy = 0;
      w.style.zIndex = "";
      apply(w, s);
    });
  }
  setEnabled(wide.matches);
  wide.addEventListener("change", (e) => setEnabled(e.matches));

  // Si cambia el tamaño de la ventana, las ventanas se acomodan dentro de los nuevos límites
  window.addEventListener("resize", () => {
    if (!wide.matches) return;
    windows.forEach((w) => {
      const s = state.get(w);
      if (!s.x && !s.y) return;
      s.b = bounds(w, s);
      s.x = clamp(s.x, s.b.minX, s.b.maxX);
      s.y = clamp(s.y, s.b.minY, s.b.maxY);
      apply(w, s);
    });
  });
}
