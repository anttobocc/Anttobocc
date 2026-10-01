// Teclado 3D de tecnologías (Three.js).
// Solo en escritorio con WebGL, y recién cuando la sección se acerca a la pantalla.
// Si algo falla, queda la versión CSS (#pad), que además conserva los botones reales
// para teclado y lectores de pantalla.
(() => {
  const wrap = document.querySelector(".pad-wrap");
  const pad = document.getElementById("pad");
  const bus = window.padBus;
  if (!wrap || !pad || !bus) return;

  const THREE_SRC = "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js";
  const THREE_SRI = "sha384-Lwojr+0fOVR25P8bdL6E0T2dv0q0ZT4Yy2Ia1dGOz6b5jLSzWZkdqlw0cKTQYKzT";
  const desktop = window.matchMedia("(min-width: 721px) and (hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function hasWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }

  if (!desktop.matches || !hasWebGL()) return;

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      loadThree()
        .then(init)
        .catch((err) => {
          // Queda la versión CSS
          wrap.classList.remove("is-3d");
          console.warn("Teclado 3D no disponible:", err);
        });
    },
    { rootMargin: "400px 0px" }
  );
  io.observe(wrap);

  function loadThree() {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve();
      const s = document.createElement("script");
      s.src = THREE_SRC;
      s.integrity = THREE_SRI;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------- utilidades de color ----------
  function mixHex(a, b, p) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (v, s) => (v >> s) & 255;
    const m = (s) => Math.round(ch(pa, s) * p + ch(pb, s) * (1 - p));
    return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
  }

  function roundedRect(T, w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Caja redondeada apoyada en y = 0, con la tapa hacia arriba
  function roundedBox(T, w, d, h, r, bevel) {
    const g = new T.ExtrudeGeometry(roundedRect(T, w - bevel * 2, d - bevel * 2, Math.max(r - bevel, 0.01)), {
      depth: h - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 5,
      curveSegments: 10,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    return g;
  }

  async function init() {
    await document.fonts.ready;
    const T = window.THREE;

    // ---------- medidas (en unidades de tecla) ----------
    const U = 1, KEY = 0.93, KD = 0.99, ROW = 1.05, G = 0.32, LABEL = 0.62, M = 0.4;
    const KEY_H = 0.38;
    const W = 9 * U + 2 * G;
    const D = LABEL + 2 * ROW + LABEL + ROW;
    const X0 = -W / 2, Z0 = -D / 2;
    const rowBottom = Z0 + LABEL + 2 * ROW + LABEL;
    const PLACE = {
      front: { x: X0, z: Z0 + LABEL, cols: 4, label: "frontend" },
      back: { x: X0 + 4 * U + G, z: Z0 + LABEL, cols: 2, label: "backend" },
      data: { x: X0, z: rowBottom, cols: 3, label: "datos" },
      hw: { x: X0 + 3 * U + G, z: rowBottom, cols: 3, label: "hardware" },
      tools: { x: X0 + 6 * U + 2 * G, z: rowBottom, cols: 3, label: "herramientas" },
    };
    const SCREEN = { x: X0 + 6 * U + 2 * G - 0.04, z: Z0 + 0.14, w: 3 * U + 0.04, d: LABEL + 2 * ROW - 0.2 };

    // ---------- renderer, escena, cámara ----------
    const canvas = document.createElement("canvas");
    canvas.className = "pad-canvas";
    canvas.setAttribute("aria-hidden", "true");
    wrap.appendChild(canvas);

    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap; // con radius: sombras de borde suave
    renderer.outputColorSpace = T.SRGBColorSpace;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(26, 2, 0.1, 100);
    camera.position.set(0.8, 13.6, 8.2);
    camera.lookAt(0.2, -0.6, 0.55);

    const world = new T.Group();
    world.rotation.y = 0.16; // el extremo derecho queda más lejos, como en la referencia
    scene.add(world);

    // ---------- luces ----------
    scene.add(new T.HemisphereLight(0xfff7f2, 0x2a2430, 1.15));
    const sun = new T.DirectionalLight(0xffffff, 3.2);
    sun.position.set(-3.5, 12, 3); // arriba a la izquierda
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 5;
    sun.shadow.blurSamples = 16;
    scene.add(sun);
    const fill = new T.DirectionalLight(0xf6d7e4, 0.22);
    fill.position.set(6, 4, 6);
    scene.add(fill);

    // ---------- placa (color según el tema) ----------
    // Modo claro: placa oscura. Modo oscuro: placa lavanda casi blanca.
    const THEME = {
      light: { board: new T.Color("#24232a"), silkDark: 0, silkLight: 1, keyShadow: 0.28 },
      dark: { board: new T.Color("#ded8ee"), // iluminada se ve cerca de #ece8f5
        silkDark: 1, silkLight: 0, keyShadow: 0.5 },
    };
    const themeOf = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

    const BW = W + M * 2, BD = D + M * 2 - 0.1, BH = 0.5;
    const boardGeo = roundedBox(T, BW, BD, BH, 0.55, 0.14);
    // Los bordes y la parte de abajo quedan un poco más oscuros que la tapa (ej. #ece8f5 → ~#d4cde6)
    {
      const pos = boardGeo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let v = 0; v < pos.count; v++) {
        const t = pos.getY(v) / BH;
        const f = t > 0.97 ? 1 : 0.84 + 0.1 * t;
        col.set([f * 0.97, f * 0.95, f], v * 3); // leve tinte lila en los bordes
      }
      boardGeo.setAttribute("color", new T.BufferAttribute(col, 3));
    }
    const boardMat = new T.MeshStandardMaterial({
      color: THEME[themeOf()].board.clone(),
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.08,
    });
    const board = new T.Mesh(boardGeo, boardMat);
    board.position.y = -BH;
    board.castShadow = true;
    board.receiveShadow = true;
    world.add(board);

    // Sombra difusa sobre el "piso" (solo la sombra, el fondo queda transparente)
    const ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -BH - 0.01;
    ground.receiveShadow = true;
    world.add(ground);

    function softTexture(stops) {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const x = c.getContext("2d");
      const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
      return new T.CanvasTexture(c);
    }

    // Sombra difusa y amplia debajo de la placa
    const blobMesh = new T.Mesh(
      new T.PlaneGeometry(BW * 1.35, BD * 1.9),
      new T.MeshBasicMaterial({
        map: softTexture([[0, "rgba(30,18,28,0.55)"], [0.55, "rgba(30,18,28,0.22)"], [1, "rgba(30,18,28,0)"]]),
        transparent: true,
        depthWrite: false,
      })
    );
    blobMesh.rotation.x = -Math.PI / 2;
    blobMesh.position.set(0.3, -BH - 0.02, 0.6);
    world.add(blobMesh);

    // Nombres de grupos con corchete, impresos sobre la placa.
    // Dos versiones (clara y oscura) que se funden al cambiar el tema.
    const PX = 140;
    function silkPlane(text, line) {
      const silk = document.createElement("canvas");
      silk.width = Math.round(BW * PX);
      silk.height = Math.round(BD * PX);
      const sctx = silk.getContext("2d");
      const toPx = (x, z) => [(x + BW / 2) * PX, (z + BD / 2) * PX];
      sctx.font = `500 ${0.25 * PX}px Geist, system-ui, sans-serif`;
      sctx.textBaseline = "middle";
      for (const p of Object.values(PLACE)) {
        const [x1, zc] = toPx(p.x + 0.02, p.z - LABEL * 0.52);
        const [x2] = toPx(p.x + p.cols * U - 0.05, 0);
        const tw = sctx.measureText(p.label).width;
        const tx = x1 + 0.28 * PX;
        sctx.fillStyle = text;
        sctx.fillText(p.label, tx, zc);
        sctx.strokeStyle = line;
        sctx.lineWidth = 0.022 * PX;
        sctx.lineCap = "round";
        sctx.lineJoin = "round";
        const yl = zc + 0.02 * PX, drop = 0.12 * PX;
        sctx.beginPath();
        sctx.moveTo(x1, yl + drop);
        sctx.lineTo(x1, yl);
        sctx.lineTo(tx - 0.08 * PX, yl);
        sctx.moveTo(tx + tw + 0.08 * PX, yl);
        sctx.lineTo(x2, yl);
        sctx.lineTo(x2, yl + drop);
        sctx.stroke();
      }
      const tex = new T.CanvasTexture(silk);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const mesh = new T.Mesh(
        new T.PlaneGeometry(BW, BD),
        new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, opacity: 0 })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.003;
      mesh.receiveShadow = true;
      world.add(mesh);
      return mesh.material;
    }
    const silkLight = silkPlane("#c3bece", "rgba(255,255,255,0.22)"); // sobre placa oscura
    const silkDark = silkPlane("#5f5875", "rgba(70,55,110,0.32)"); // sobre placa lavanda
    silkLight.opacity = THEME[themeOf()].silkLight;
    silkDark.opacity = THEME[themeOf()].silkDark;

    // Sombra de contacto bajo cada tecla: les da presencia sobre la placa clara
    const contactTex = softTexture([[0, "rgba(40,25,60,0.9)"], [0.5, "rgba(40,25,60,0.45)"], [1, "rgba(40,25,60,0)"]]);
    const contactMat = new T.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      opacity: THEME[themeOf()].keyShadow,
    });
    const contactGeo = new T.PlaneGeometry(1.25, 1.3);

    // ---------- pantalla ----------
    const bezel = new T.Mesh(
      roundedBox(T, SCREEN.w, SCREEN.d, 0.14, 0.2, 0.05),
      new T.MeshStandardMaterial({ color: 0x0d0c10, roughness: 0.4, metalness: 0.2 })
    );
    bezel.position.set(SCREEN.x + SCREEN.w / 2, 0, SCREEN.z + SCREEN.d / 2);
    bezel.castShadow = true;
    bezel.receiveShadow = true;
    world.add(bezel);

    const SW = SCREEN.w - 0.2, SD = SCREEN.d - 0.2;
    const scr = document.createElement("canvas");
    scr.width = 1024;
    scr.height = Math.round((1024 * SD) / SW);
    const cctx = scr.getContext("2d");
    const scrTex = new T.CanvasTexture(scr);
    scrTex.colorSpace = T.SRGBColorSpace;
    scrTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const screen = new T.Mesh(new T.PlaneGeometry(SW, SD), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(bezel.position.x, 0.142, bezel.position.z);
    world.add(screen);

    let cursorOn = true;
    function drawScreen() {
      const w = scr.width, h = scr.height;
      const grd = cctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#1a1920");
      grd.addColorStop(1, "#121116");
      cctx.fillStyle = grd;
      cctx.fillRect(0, 0, w, h);
      // brillo suave arriba del vidrio
      const glare = cctx.createLinearGradient(0, 0, 0, h * 0.35);
      glare.addColorStop(0, "rgba(255,255,255,0.06)");
      glare.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = glare;
      cctx.fillRect(0, 0, w, h * 0.35);

      const pad = 56;
      ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
        cctx.fillStyle = c;
        cctx.beginPath();
        cctx.arc(pad + 12 + i * 40, 58, 12, 0, Math.PI * 2);
        cctx.fill();
      });

      cctx.textBaseline = "alphabetic";
      cctx.font = `500 58px "Geist Mono", ui-monospace, monospace`;
      cctx.fillStyle = "#7ee0a1";
      cctx.fillText(`> ${bus.title}`, pad, 176);

      // descripción con resaltados, cortada en líneas
      const size = 54, lh = size * 1.45;
      cctx.font = `400 ${size}px "Geist Mono", ui-monospace, monospace`;
      const maxW = w - pad * 2;
      const text = bus.text;
      const count = Math.min(bus.count, text.length);
      const parts = text.split(bus.projects);
      bus.projects.lastIndex = 0;
      const tokens = []; // palabras con color
      let idx = 0;
      for (const part of parts) {
        if (!part) continue;
        const hl = bus.projects.test(part);
        bus.projects.lastIndex = 0;
        for (const word of part.split(/(\s+)/)) {
          if (!word) continue;
          tokens.push({ word, hl, start: idx });
          idx += word.length;
        }
      }
      let x = pad, y = 276;
      const spaceW = cctx.measureText(" ").width;
      let endX = x, endY = y;
      for (const t of tokens) {
        if (t.start >= count) break;
        const visible = t.word.slice(0, count - t.start);
        if (/^\s+$/.test(t.word)) {
          x += spaceW;
          continue;
        }
        const ww = cctx.measureText(t.word).width;
        if (x + ww > pad + maxW && x > pad) {
          x = pad;
          y += lh;
        }
        cctx.fillStyle = t.hl ? "#b9a5ff" : "#ecebf0";
        cctx.fillText(visible, x, y);
        x += cctx.measureText(visible).width;
        endX = x;
        endY = y;
      }
      if (cursorOn) {
        cctx.fillStyle = "#b9a5ff";
        cctx.fillRect(endX + 8, endY - size * 0.82, 5, size * 0.98);
      }
      scrTex.needsUpdate = true;
    }

    // ---------- teclas ----------
    const keyGeo = roundedBox(T, KEY, KD, KEY_H, 0.22, 0.09);
    const topY = KEY_H;
    const keys = [];
    const pickables = [];

    function drawCap(btn, logoColor, labelColor) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = Math.round((256 * KD) / KEY);
      const x = c.getContext("2d");
      x.textAlign = "center";
      x.textBaseline = "middle";
      const glyphEl = btn.querySelector(".glyph");
      const iconEl = btn.querySelector("i");
      x.fillStyle = logoColor;
      if (glyphEl) {
        x.font = `800 104px Nunito, system-ui, sans-serif`;
        x.fillText(glyphEl.textContent, c.width / 2, c.height * 0.42);
      } else if (iconEl) {
        const cs = getComputedStyle(iconEl, "::before");
        const ch = (cs.content || "").replace(/^["']|["']$/g, "");
        x.font = `${cs.fontWeight === "700" ? 700 : 400} 112px ${getComputedStyle(iconEl).fontFamily}`;
        x.fillText(ch, c.width / 2, c.height * 0.42);
      }
      x.fillStyle = labelColor;
      x.font = `500 40px Nunito, system-ui, sans-serif`;
      x.fillText(btn.dataset.name, c.width / 2, c.height * 0.8);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }

    for (const [name, p] of Object.entries(PLACE)) {
      const btns = [...pad.querySelectorAll(`.cluster--${name} .key`)];
      btns.forEach((btn, i) => {
        const col = i % p.cols, row = Math.floor(i / p.cols);
        const st = btn.style;
        const cap = st.getPropertyValue("--cap").trim();
        const side = st.getPropertyValue("--side").trim();
        const ink = st.getPropertyValue("--ink").trim();
        const dark = btn.classList.contains("key--dark");

        // Color por vértice: el costado se oscurece hacia abajo, la tapa queda en su pastel
        const geo = keyGeo.clone();
        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const cTop = new T.Color(cap), cSide = new T.Color(side), cBase = new T.Color(side).multiplyScalar(0.62);
        const tmp = new T.Color();
        for (let v = 0; v < pos.count; v++) {
          const t = pos.getY(v) / topY;
          if (t > 0.86) tmp.copy(cTop);
          else if (t > 0.45) tmp.copy(cSide).lerp(cTop, (t - 0.45) / 0.41);
          else tmp.copy(cBase).lerp(cSide, t / 0.45);
          colors.set([tmp.r, tmp.g, tmp.b], v * 3);
        }
        geo.setAttribute("color", new T.BufferAttribute(colors, 3));

        const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, emissive: new T.Color(cap), emissiveIntensity: 0 });
        const body = new T.Mesh(geo, mat);
        body.castShadow = true;
        body.receiveShadow = true;

        const decal = new T.Mesh(
          new T.PlaneGeometry(KEY * 0.84, KD * 0.84),
          new T.MeshStandardMaterial({
            map: drawCap(btn, dark ? "#f4f2f8" : mixHex(ink, cap, 0.68), dark ? "#cfcbd8" : mixHex(ink, cap, 0.52)),
            transparent: true,
            roughness: 0.72,
            depthWrite: false,
          })
        );
        decal.rotation.x = -Math.PI / 2;
        decal.position.y = topY + 0.002;

        const contact = new T.Mesh(contactGeo, contactMat);
        contact.rotation.x = -Math.PI / 2;
        contact.position.set(p.x + col * U + U / 2 - 0.035 + 0.05, 0.004, p.z + row * ROW + ROW / 2 - 0.03 + 0.08);
        world.add(contact);

        const key = new T.Group();
        key.add(body, decal);
        key.position.set(p.x + col * U + U / 2 - 0.035, 0, p.z + row * ROW + ROW / 2 - 0.03);
        world.add(key);

        const k = { btn, group: key, mat, y: 0, target: 0, glow: 0, glowTarget: 0 };
        body.userData.k = decal.userData.k = k;
        pickables.push(body, decal);
        keys.push(k);
      });
    }

    // ---------- estado e interacción ----------
    let hovered = null, pressed = null, focused = null;
    const byBtn = new Map(keys.map((k) => [k.btn, k]));

    function updateTargets() {
      for (const k of keys) {
        const sel = bus.current === k.btn;
        k.target = k === pressed ? -0.15 : sel ? -0.1 : k === hovered ? -0.05 : 0;
        k.glowTarget = k === focused ? 0.4 : sel ? 0.22 : k === hovered ? 0.1 : 0;
      }
      wake();
    }

    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    function pick(ev) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      return hit ? hit.object.userData.k : null;
    }

    canvas.addEventListener("pointermove", (ev) => {
      const k = pick(ev);
      canvas.style.cursor = k ? "pointer" : "";
      if (k === hovered) return;
      hovered = k;
      if (k) bus.select(k.btn);
      updateTargets();
    });
    canvas.addEventListener("pointerleave", () => {
      hovered = null;
      canvas.style.cursor = "";
      updateTargets();
    });
    canvas.addEventListener("pointerdown", (ev) => {
      const k = pick(ev);
      if (!k) return;
      pressed = k;
      bus.select(k.btn);
      updateTargets();
    });
    window.addEventListener("pointerup", () => {
      if (!pressed) return;
      pressed = null;
      updateTargets();
    });

    // Teclado: los botones reales siguen enfocables aunque estén ocultos
    pad.addEventListener("focusin", (ev) => {
      focused = byBtn.get(ev.target.closest(".key")) || null;
      updateTargets();
    });
    pad.addEventListener("focusout", () => {
      focused = null;
      updateTargets();
    });
    bus.onSelect.push(() => updateTargets());
    bus.onRender.push(() => {
      drawScreen();
      wake();
    });

    // ---------- tamaño ----------
    // Encuadre: la placa (con margen para la sombra) ocupa el canvas y queda centrada
    // Puntos de referencia: los vértices reales de la placa (respeta las esquinas redondeadas)
    const corners = [];
    {
      const pos = boardGeo.attributes.position;
      for (let v = 0; v < pos.count; v += 3) corners.push(new T.Vector3(pos.getX(v), pos.getY(v) - BH, pos.getZ(v)));
    }
    const tmpV = new T.Vector3();
    function bounds() {
      world.updateMatrixWorld();
      camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        tmpV.copy(c).applyMatrix4(world.matrixWorld).project(camera);
        x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x);
        y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y);
      }
      return { x0, x1, y0, y1 };
    }
    // El canvas mide justo lo que ocupa la placa: se proyecta en un cuadro "completo"
    // y se recorta con setViewOffset dejando TOP px arriba y BOTTOM px abajo (para la sombra)
    const TOP = 8, BOTTOM = 44;
    function resize() {
      const w = wrap.clientWidth;
      const fullH = Math.round(w * 0.6);
      camera.aspect = w / fullH;
      camera.clearViewOffset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      let b = bounds();
      camera.zoom = 1.9 / (b.x1 - b.x0);
      camera.updateProjectionMatrix();
      b = bounds();
      const left = ((b.x0 + 1) / 2) * w, right = ((b.x1 + 1) / 2) * w;
      const top = ((1 - b.y1) / 2) * fullH, bottom = ((1 - b.y0) / 2) * fullH;
      const h = Math.round(bottom - top + TOP + BOTTOM);
      camera.setViewOffset(w, fullH, (left + right) / 2 - w / 2, top - TOP, w, h);
      renderer.setSize(w, h, false);
      canvas.style.height = h + "px";
      wake();
    }
    new ResizeObserver(resize).observe(wrap);

    // ---------- loop (solo dibuja cuando hace falta y la sección está visible) ----------
    let visible = true, raf = 0, idle = 0, lastBlink = 0;
    function wake() {
      clearTimeout(idle);
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      let moving = false;
      const snap = reduceMotion.matches;
      // Transición de color de la placa al cambiar el tema
      const th = THEME[themeOf()];
      const e = snap ? 1 : 0.12;
      if (!boardMat.color.equals(th.board)) {
        boardMat.color.lerp(th.board, e);
        if (Math.abs(boardMat.color.r - th.board.r) + Math.abs(boardMat.color.g - th.board.g) < 0.002) boardMat.color.copy(th.board);
        moving = true;
      }
      for (const [m, target] of [[silkLight, th.silkLight], [silkDark, th.silkDark], [contactMat, th.keyShadow]]) {
        const d = target - m.opacity;
        if (Math.abs(d) > 0.004) {
          m.opacity += d * e;
          moving = true;
        } else m.opacity = target;
      }
      for (const k of keys) {
        const dy = k.target - k.y, dg = k.glowTarget - k.glow;
        if (Math.abs(dy) > 0.0005 || Math.abs(dg) > 0.002) {
          k.y = snap ? k.target : k.y + dy * 0.32;
          k.glow = snap ? k.glowTarget : k.glow + dg * 0.25;
          k.group.position.y = k.y;
          k.mat.emissiveIntensity = k.glow;
          moving = true;
        }
      }
      if (!snap && now - lastBlink > 530) {
        lastBlink = now;
        cursorOn = !cursorOn;
        drawScreen();
      }
      renderer.render(scene, camera);
      if (moving) wake();
      // Quieto: solo vuelve a dibujar para el parpadeo del cursor (no con movimiento reducido)
      else if (!snap) idle = setTimeout(wake, 540 - (now - lastBlink));
    }

    // El botón de tema cambia data-theme en <html>: arrancamos la transición
    new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) wake();
    }).observe(wrap);

    drawScreen();
    resize();
    updateTargets();
    wrap.classList.add("is-3d");
  }
})();
