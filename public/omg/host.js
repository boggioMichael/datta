/* OH MY GOD — browser shell.
 * The game itself (physics, rules, tiers, options, progression, sound synthesis)
 * is Rust compiled to omg.wasm. This file only paints the draw list the engine
 * produces, plays the PCM its sound engine renders (in a worker), forwards input
 * and builds menus from the schema the engine exports. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const TAU = Math.PI * 2;
  const canvas = $('#game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  let X = null;            // wasm exports
  let S = null;            // schema
  let wasmBytes = null;
  let W = 0, H = 0, DPR = 1;
  let stage = { x: 0, y: 0, w: 0, h: 0 };
  let he = true;
  let mode = +(store.get('omg.mode') || 0);
  let userPaused = false;
  let running = false;
  let menuOpen = false;

  // ───────────────────────── wasm helpers
  const u8 = () => new Uint8Array(X.memory.buffer);
  const str = (p, n) => dec.decode(u8().subarray(p, p + n));
  function withString(s, fn) {
    const b = enc.encode(s);
    const p = X.omg_alloc(b.length || 1);
    u8().set(b, p);
    fn(p, b.length);
    X.omg_free(p, b.length || 1);
  }
  const t = (k) => { const v = S && S.ui[k]; return v ? v[he ? 0 : 1] : k; };
  const tierName = (i) => S.tiers[i][he ? 'he' : 'en'];
  const optIndex = (key) => S.opts.findIndex((o) => o.key === key);
  const opt = (key) => X.omg_get_opt(optIndex(key));

  // ───────────────────────── colours
  const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  // ───────────────────────── icons & sprites
  const FALLBACK = {
    'sedan-electric': 'city-car', 'sedan-sport': 'city-car', supercar: 'race-car', hypercar: 'f1-car', 'hypercar-wing': 'f1-car',
    bizjet: 'commercial-airplane', 'jumbo-747': 'commercial-airplane', 'superjumbo-a380': 'commercial-airplane', concorde: 'commercial-airplane',
    'blackbird-sr71': 'jet-fighter', soyuz: 'rocket', 'saturn-v': 'rocket', starship: 'rocket', 'flying-car': 'city-car',
    'lightspeed-ship': 'starfighter', 'sun-barque': 'sailboat', 'sun-chariot': 'chariot', 'fire-chariot': 'chariot',
    'goat-chariot': 'goat', sleipnir: 'horse-head',
  };
  const icons = {};
  function loadIcon(key) {
    return new Promise((resolve) => {
      if (!key) return resolve(null);
      const tryKey = (k, last) => fetch(`icons/${k}.svg`).then((r) => { if (!r.ok) throw 0; return r.text(); }).then((txt) => {
        txt = txt.replace('<svg ', '<svg width="512" height="512" ');
        const url = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => { icons[key] = img; resolve(img); };
        img.onerror = () => (last ? resolve(null) : tryKey(FALLBACK[key] || 'city-car', true));
        img.src = url;
      }).catch(() => (last ? resolve(null) : tryKey(FALLBACK[key] || 'city-car', true)));
      tryKey(key, false);
    });
  }
  const SPR = 256;
  const sprites = [];
  function sprite(i) {
    if (sprites[i]) return sprites[i];
    const c = document.createElement('canvas');
    c.width = c.height = SPR;
    const g = c.getContext('2d');
    const T = S.tiers[i];
    const col = hex2rgb(T.color), fill = hex2rgb(T.fill);
    const cx = SPR / 2, cy = SPR / 2, R = SPR * 0.4;
    if (i === 36) {
      // the God of Israel: no image, only light
      let gr = g.createRadialGradient(cx, cy, 0, cx, cy, SPR / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.28, 'rgba(255,252,240,1)');
      gr.addColorStop(0.55, 'rgba(255,236,180,.85)');
      gr.addColorStop(0.8, 'rgba(255,214,120,.35)');
      gr.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
      sprites[i] = c;
      return c;
    }
    let gr = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, SPR / 2);
    gr.addColorStop(0, rgba(...col, 0.42)); gr.addColorStop(1, rgba(...col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
    gr = g.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.05, cx, cy, R);
    gr.addColorStop(0, rgba(...mixc(fill, [255, 255, 255], 0.28), 1));
    gr.addColorStop(0.6, rgba(...fill, 1));
    gr.addColorStop(1, rgba(...mixc(fill, [0, 0, 0], 0.45), 1));
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
    gr = g.createRadialGradient(cx, cy + R * 0.7, 0, cx, cy + R * 0.5, R);
    gr.addColorStop(0, rgba(...col, 0.28)); gr.addColorStop(1, rgba(...col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const lw = R * 0.08;
    g.lineWidth = lw; g.strokeStyle = rgba(...col, 1);
    g.beginPath(); g.arc(cx, cy, R - lw / 2, 0, TAU); g.stroke();
    g.lineWidth = R * 0.018; g.strokeStyle = 'rgba(255,255,255,.4)';
    g.beginPath(); g.arc(cx, cy, R - lw * 1.25, 0, TAU); g.stroke();
    const img = icons[T.icon];
    if (img) {
      const box = Math.round(R * 1.5);
      const tc = document.createElement('canvas'); tc.width = tc.height = box;
      const tg = tc.getContext('2d');
      tg.drawImage(img, 0, 0, box, box);
      tg.globalCompositeOperation = 'source-in';
      const lg = tg.createLinearGradient(0, 0, 0, box);
      lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.55, '#ffffff'); lg.addColorStop(1, rgba(...mixc([255, 255, 255], col, 0.45), 1));
      tg.fillStyle = lg; tg.fillRect(0, 0, box, box);
      const sc = document.createElement('canvas'); sc.width = sc.height = box;
      const sg = sc.getContext('2d');
      sg.drawImage(img, 0, 0, box, box);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = 'rgba(0,0,0,.55)'; sg.fillRect(0, 0, box, box);
      g.drawImage(sc, cx - box / 2, cy - box / 2 + R * 0.05);
      g.drawImage(tc, cx - box / 2, cy - box / 2);
    } else {
      g.fillStyle = '#fff'; g.font = `800 ${R * 0.42}px Assistant, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(T.len || '?', cx, cy, R * 1.6);
    }
    gr = g.createLinearGradient(0, cy - R, 0, cy);
    gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy - R * 0.45, R * 0.72, R * 0.42, 0, 0, TAU); g.fill();
    sprites[i] = c;
    return c;
  }
  const glows = new Map();
  function glow(r, g, b) {
    const key = ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
    let c = glows.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(255,255,255,1)`);
    gr.addColorStop(0.18, rgba(r * 255, g * 255, b * 255, 0.95));
    gr.addColorStop(0.5, rgba(r * 255, g * 255, b * 255, 0.3));
    gr.addColorStop(1, rgba(r * 255, g * 255, b * 255, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glows.set(key, c);
    return c;
  }

  // ───────────────────────── layout
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (!X) {
      const sw = Math.min(W, H * 9 / 16) || W, sh = Math.min(H, sw * 19.5 / 9);
      stage = { x: (W - sw) / 2, y: (H - sh) / 2, w: sw, h: sh, cy: H / 2, tools: H - 80 };
    } else {
      X.omg_resize(W, H, DPR);
      stage = { x: X.omg_layout(0), y: X.omg_layout(1), w: X.omg_layout(2), h: X.omg_layout(3), cy: X.omg_layout(6), r: X.omg_layout(7), tools: X.omg_layout(10) };
    }
    const r = document.documentElement.style;
    r.setProperty('--sx', stage.x + 'px'); r.setProperty('--sy', stage.y + 'px');
    r.setProperty('--sw', stage.w + 'px'); r.setProperty('--sh', stage.h + 'px');
  }

  // ───────────────────────── renderer
  const RING_THEMES = {
    2: ['#fff4c2', '#ffb300', '#ff8f00', '#ffe082', '#fff4c2'],
    3: ['#e0f7ff', '#4fc3f7', '#b388ff', '#80deea', '#e0f7ff'],
    4: ['#ffffff', '#dfe7ff', '#ffffff', '#e8e0ff', '#ffffff'],
    5: ['#ffea00', '#ff3d00', '#ff9100', '#ff1744', '#ffea00'],
  };
  const FONTS = ['800 {s}px Assistant, system-ui, sans-serif', '600 {s}px "Frank Ruhl Libre", "Times New Roman", serif', '600 {s}px Assistant, system-ui, sans-serif', '500 {s}px "IBM Plex Mono", ui-monospace, monospace'];
  let accent = [124, 139, 255];
  function ringStyle(cx, cy, theme, hue, catAccent) {
    if (!ctx.createConicGradient) return rgba(...catAccent, 1);
    const g = ctx.createConicGradient(hue, cx, cy);
    if (theme === 0) {
      for (let k = 0; k <= 6; k++) g.addColorStop(k / 6, `hsl(${(k * 60 + 300) % 360},100%,62%)`);
    } else if (theme === 1) {
      const a = catAccent, w = mixc(a, [255, 255, 255], 0.65), d = mixc(a, [0, 0, 0], 0.15);
      [a, w, d, w, a].forEach((c, k) => g.addColorStop(k / 4, rgba(...c, 1)));
    } else {
      const st = RING_THEMES[theme] || RING_THEMES[4];
      st.forEach((c, k) => g.addColorStop(k / (st.length - 1), c));
    }
    return g;
  }
  function textCmd(D, i, T) {
    const x = D[i + 1], y = D[i + 2], size = D[i + 3], align = D[i + 4], font = D[i + 5] | 0;
    const a = D[i + 9];
    const s = dec.decode(T.subarray(D[i + 10], D[i + 10] + D[i + 11]));
    const glowA = D[i + 12], maxw = D[i + 13], dir = D[i + 14];
    let fs = size;
    ctx.direction = dir === 1 ? 'rtl' : dir === 2 ? 'ltr' : 'inherit';
    ctx.font = FONTS[font].replace('{s}', fs.toFixed(1));
    if (maxw > 0) {
      const w = ctx.measureText(s).width;
      if (w > maxw) { fs = Math.max(size * 0.55, size * maxw / w); ctx.font = FONTS[font].replace('{s}', fs.toFixed(1)); }
    }
    ctx.textAlign = align === 1 ? 'start' : align === 2 ? 'end' : 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = a;
    const r = D[i + 6] * 255, g = D[i + 7] * 255, b = D[i + 8] * 255;
    if (glowA > 0) {
      ctx.shadowColor = rgba(r, g, b, 0.7 * glowA);
      ctx.shadowBlur = fs * 0.6;
    }
    if (font === 0 && size > 18) { ctx.lineWidth = Math.max(2, fs * 0.12); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = rgba(r, g, b, 1);
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  function render() {
    const n = X.omg_draw_len();
    const D = new Float32Array(X.memory.buffer, X.omg_draw_ptr(), n);
    const T = new Uint8Array(X.memory.buffer, X.omg_text_ptr(), X.omg_text_len());
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i += 16) {
      switch (D[i]) {
        case 1: { // BG
          const top = [D[i + 1] * 255, D[i + 2] * 255, D[i + 3] * 255], bot = [D[i + 4] * 255, D[i + 5] * 255, D[i + 6] * 255];
          accent = [D[i + 9] * 255, D[i + 10] * 255, D[i + 11] * 255];
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, rgba(...top, 1)); g.addColorStop(1, rgba(...bot, 1));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          const cx = stage.x + stage.w / 2, cy = stage.cy || (stage.y + stage.h * 0.5);
          const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, stage.w * 0.9);
          rg.addColorStop(0, rgba(...accent, 0.13 + D[i + 13] * 0.08)); rg.addColorStop(1, rgba(...accent, 0));
          ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
          if (D[i + 7] > 0) { ctx.fillStyle = `rgba(255,248,228,${D[i + 7]})`; ctx.fillRect(0, 0, W, H); }
          break;
        }
        case 2: { // RING
          const cx = D[i + 1], cy = D[i + 2], r = D[i + 3], th = D[i + 4], hue = D[i + 5], gl = D[i + 6], theme = D[i + 7] | 0, gap = D[i + 8], a = D[i + 9];
          const pc = [D[i + 10] * 255, D[i + 11] * 255, D[i + 12] * 255], pulse = D[i + 14];
          const st = ringStyle(cx, cy, theme, hue, accent);
          const a0 = -Math.PI / 2 + gap * 1.02, a1 = Math.PI * 1.5 - gap * 1.02;
          ctx.lineCap = 'round';
          ctx.globalCompositeOperation = 'lighter';
          const passes = [[th * 7, 0.05 * gl], [th * 3.4, 0.12 * gl], [th * 1.8, 0.28]];
          for (const [w, al] of passes) {
            ctx.globalAlpha = a * Math.min(1, al); ctx.lineWidth = w; ctx.strokeStyle = st;
            ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
          }
          if (pulse > 0.02) {
            ctx.globalAlpha = a * pulse * 0.55; ctx.lineWidth = th * 2.2; ctx.strokeStyle = rgba(...pc, 1);
            ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = a; ctx.lineWidth = th; ctx.strokeStyle = st;
          ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 3: { // LINE
          const w = D[i + 5], a = D[i + 9], gl = D[i + 10];
          ctx.lineCap = 'butt';
          const col = rgba(D[i + 6] * 255, D[i + 7] * 255, D[i + 8] * 255, 1);
          if (gl > 0) {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.18 * gl; ctx.lineWidth = w * 4; ctx.strokeStyle = col;
            ctx.beginPath(); ctx.moveTo(D[i + 1], D[i + 2]); ctx.lineTo(D[i + 3], D[i + 4]); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha = a; ctx.lineWidth = w; ctx.strokeStyle = col;
          ctx.beginPath(); ctx.moveTo(D[i + 1], D[i + 2]); ctx.lineTo(D[i + 3], D[i + 4]); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 4: { // ITEM
          const ti = D[i + 1] | 0, x = D[i + 2], y = D[i + 3], r = D[i + 4], ang = D[i + 5], fl = D[i + 6], a = D[i + 7], la = D[i + 8];
          const orphan = D[i + 10], hl = D[i + 11], heLbl = D[i + 12] > 0.5;
          if (r < 0.5) break;
          const s = sprite(ti);
          ctx.globalAlpha = a;
          if (ti === 36) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(s, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(s, x - r * 1.05, y - r * 1.05, r * 2.1, r * 2.1);
          } else {
            ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
            ctx.drawImage(s, -r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
            ctx.restore();
          }
          if (orphan > 0.05) { ctx.globalAlpha = a * orphan * 0.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
          if (fl > 0.01) {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * fl * 0.85;
            ctx.drawImage(glow(1, 1, 1), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
            ctx.globalCompositeOperation = 'source-over';
          }
          if (hl > 0.01) {
            ctx.globalAlpha = hl; ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = '#ffe27a';
            ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
          }
          if (la > 0.01 && ti !== 36) {
            const T2 = S.tiers[ti];
            const lbl = heLbl ? T2.lhe : T2.len;
            if (lbl) {
              const fs = Math.max(9, r * 0.24);
              ctx.font = FONTS[0].replace('{s}', fs.toFixed(1)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.direction = heLbl ? 'rtl' : 'ltr';
              ctx.globalAlpha = a * la; ctx.lineWidth = fs * 0.28; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineJoin = 'round';
              ctx.strokeText(lbl, x, y + r * 0.66, r * 1.5);
              ctx.fillStyle = '#fff'; ctx.fillText(lbl, x, y + r * 0.66, r * 1.5);
            }
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 5: { // DOT
          const x = D[i + 1], y = D[i + 2], s = D[i + 3], a = D[i + 7];
          if (D[i + 8] > 0.5) {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
            const gs = s * 4;
            ctx.drawImage(glow(D[i + 4], D[i + 5], D[i + 6]), x - gs / 2, y - gs / 2, gs, gs);
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.globalAlpha = a; ctx.fillStyle = rgba(D[i + 4] * 255, D[i + 5] * 255, D[i + 6] * 255, 1);
            ctx.fillRect(x - s / 2, y - s / 2, s, s);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 6: { // STREAK
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, D[i + 9]);
          ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.5, D[i + 5]);
          ctx.strokeStyle = rgba(D[i + 6] * 255, D[i + 7] * 255, D[i + 8] * 255, 1);
          ctx.beginPath(); ctx.moveTo(D[i + 1], D[i + 2]); ctx.lineTo(D[i + 3], D[i + 4]); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 7: { // WAVE
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, D[i + 8]);
          ctx.lineWidth = Math.max(0.5, D[i + 4]); ctx.strokeStyle = rgba(D[i + 5] * 255, D[i + 6] * 255, D[i + 7] * 255, 1);
          ctx.beginPath(); ctx.arc(D[i + 1], D[i + 2], Math.max(0.1, D[i + 3]), 0, TAU); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 8: textCmd(D, i, T); break;
        case 9: { // ICON
          const ti = D[i + 1] | 0, r = D[i + 4];
          ctx.globalAlpha = D[i + 5];
          ctx.drawImage(sprite(ti), D[i + 2] - r * 1.25, D[i + 3] - r * 1.25, r * 2.5, r * 2.5);
          ctx.globalAlpha = 1;
          break;
        }
        case 10: { // RECT
          const x = D[i + 1], y = D[i + 2], w = D[i + 3], h = D[i + 4], rad = Math.min(D[i + 9], h / 2, w / 2);
          if (D[i + 10] > 0.5) ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = D[i + 8]; ctx.fillStyle = rgba(D[i + 5] * 255, D[i + 6] * 255, D[i + 7] * 255, 1);
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad); else ctx.rect(x, y, w, h);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 11: { // RAYS
          const x = D[i + 1], y = D[i + 2], r0 = D[i + 3], r1 = D[i + 4], cnt = D[i + 5] | 0, rot = D[i + 6], a = D[i + 10];
          const col = [D[i + 7] * 255, D[i + 8] * 255, D[i + 9] * 255];
          const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
          g.addColorStop(0, rgba(...col, a)); g.addColorStop(1, rgba(...col, 0));
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
          ctx.beginPath();
          const half = Math.PI / cnt * 0.42;
          for (let k = 0; k < cnt; k++) {
            const an = rot + k * TAU / cnt;
            ctx.moveTo(x + Math.cos(an - half * 0.3) * r0, y + Math.sin(an - half * 0.3) * r0);
            ctx.lineTo(x + Math.cos(an - half) * r1, y + Math.sin(an - half) * r1);
            ctx.lineTo(x + Math.cos(an + half) * r1, y + Math.sin(an + half) * r1);
            ctx.lineTo(x + Math.cos(an + half * 0.3) * r0, y + Math.sin(an + half * 0.3) * r0);
            ctx.closePath();
          }
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 12: { // FLASH
          ctx.fillStyle = rgba(D[i + 1] * 255, D[i + 2] * 255, D[i + 3] * 255, Math.min(1, D[i + 4]));
          ctx.fillRect(0, 0, W, H);
          break;
        }
        case 13: { // GLOW
          const x = D[i + 1], y = D[i + 2], r = D[i + 3], a = D[i + 7];
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          const c = [D[i + 4] * 255, D[i + 5] * 255, D[i + 6] * 255];
          g.addColorStop(0, rgba(...c, a)); g.addColorStop(0.4, rgba(...c, a * 0.45)); g.addColorStop(1, rgba(...c, 0));
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 14: { // COIN
          const x = D[i + 1], y = D[i + 2], s = D[i + 3], an = D[i + 4], a = D[i + 5];
          ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.12, Math.abs(Math.cos(an))), 1);
          ctx.globalAlpha = a; ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
          ctx.lineWidth = s * 0.25; ctx.strokeStyle = '#b8860b'; ctx.stroke();
          ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.25, s * 0.3, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 15: { // FLAME
          const x = D[i + 1], y = D[i + 2], s = D[i + 3], a = D[i + 7];
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
          ctx.drawImage(glow(D[i + 4], D[i + 5] * 0.8, D[i + 6] * 0.4), x - s * 2, y - s * 2.6, s * 4, s * 5);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        default: break;
      }
    }
  }

  // ───────────────────────── audio (PCM rendered by the Rust sound engine in a worker)
  const audio = {
    ctx: null, master: null, voice: null, sfx: null, music: null, recDest: null,
    buffers: new Map(), want: new Map(), worker: null, ready: false, unlocked: false,
    playing: [], musicSrc: null, musicGain: null, musicCat: -1, muted: store.get('omg.muted') === '1', style: 0,
    create() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
      const c = this.ctx;
      this.master = c.createGain();
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
      this.voice = c.createGain(); this.sfx = c.createGain(); this.music = c.createGain();
      this.voice.connect(this.master); this.sfx.connect(this.master); this.music.connect(this.master);
      this.master.connect(lim); lim.connect(c.destination);
      try { this.recDest = c.createMediaStreamDestination(); lim.connect(this.recDest); } catch { this.recDest = null; }
      this.volumes();
      this.startWorker();
    },
    unlock() {
      this.create();
      if (!this.ctx) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* old Safari */ }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      if (!this.unlocked) {
        const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        this.unlocked = true;
        setTimeout(() => { if (this.musicCat >= 0 && this.buffers.has(60 + this.musicCat)) this.startMusic(60 + this.musicCat); }, 50);
      }
    },
    volumes() {
      if (!this.ctx || !X) return;
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : opt('vol'), now, 0.03);
      this.voice.gain.setTargetAtTime(opt('volvoice'), now, 0.03);
      this.sfx.gain.setTargetAtTime(opt('volsfx'), now, 0.03);
      this.music.gain.setTargetAtTime(opt('music') > 0.5 ? opt('volmusic') : 0, now, 0.3);
    },
    startWorker() {
      try {
        this.worker = new Worker('audio-worker.js');
      } catch { this.worker = null; return; }
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') {
          this.ready = true;
          for (const [id, w] of this.want) this.worker.postMessage({ type: 'render', id, style: this.style, urgent: !!w.play });
        } else if (m.type === 'sound') {
          if (m.style !== this.style && (m.id <= 36 || m.id === 51)) { if (this.want.has(m.id)) this.worker.postMessage({ type: 'render', id: m.id, style: this.style }); return; }
          const frames = m.data.length / 2;
          if (!frames) return;
          const buf = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
          const L = buf.getChannelData(0), R = buf.getChannelData(1);
          for (let k = 0, j = 0; k < frames; k++, j += 2) { L[k] = m.data[j]; R[k] = m.data[j + 1]; }
          this.buffers.set(m.id, buf);
          const w = this.want.get(m.id);
          this.want.delete(m.id);
          if (w && w.play && this.ctx.currentTime - w.at < 0.8) this.play(m.id, w.gain, w.pan);
          if (m.id >= 60 && m.id - 60 === this.musicCat) this.startMusic(m.id);
        } else if (m.type === 'error') {
          console.warn('audio worker:', m.message);
        }
      };
      const decode = (ab) => new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      Promise.all((S.clips || []).map((name) => fetch(`voice/${name}.mp3`).then((r) => r.arrayBuffer()).then(decode)
        .then((b) => ({ data: b.getChannelData(0).slice(), sr: b.sampleRate })).catch(() => ({ data: new Float32Array(0), sr: 24000 }))))
        .then((clips) => {
          this.worker.postMessage({ type: 'init', wasm: wasmBytes.slice(0), sampleRate: this.ctx.sampleRate, clips }, clips.map((c) => c.data.buffer));
        });
    },
    ensure(id, play = false, gain = 1, pan = 0) {
      if (!this.ctx) return;
      if (this.buffers.has(id)) return;
      const prev = this.want.get(id);
      if (prev) { if (play) Object.assign(prev, { play, gain, pan, at: this.ctx.currentTime }); return; }
      this.want.set(id, { play, gain, pan, at: this.ctx.currentTime });
      if (this.ready) this.worker.postMessage({ type: 'render', id, style: this.style, urgent: play });
    },
    prefetch(maxTier) {
      for (const id of [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52, 53, 54]) this.ensure(id);
      const lo = Math.max(0, maxTier - 1), hi = Math.min(36, maxTier + 4);
      for (let k = lo; k <= hi; k++) this.ensure(k);
      if (maxTier >= 30) { this.ensure(36); this.ensure(51); }
    },
    play(id, gain = 1, pan = 0) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const buf = this.buffers.get(id);
      if (!buf) { this.ensure(id, true, gain, pan); return; }
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain(); g.gain.value = gain;
      let node = src;
      if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); src.connect(p); node = p; }
      node.connect(g);
      g.connect(id <= 36 || id === 51 ? this.voice : this.sfx);
      src.start();
      if (id <= 36 || id === 51) {
        // let the music breathe around the words
        if (this.musicGain && id > 2) { const now = c.currentTime; const mg = this.musicGain.gain; mg.cancelScheduledValues(now); mg.setTargetAtTime(0.35, now, 0.05); mg.setTargetAtTime(1, now + Math.min(6, buf.duration * 0.8), 0.6); }
        const rec = { src, g, tier: id === 51 ? 99 : id };
        this.playing.push(rec);
        src.onended = () => { const k = this.playing.indexOf(rec); if (k >= 0) this.playing.splice(k, 1); };
      }
    },
    duck(tier) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const p of this.playing) if (p.tier < tier) { p.g.gain.cancelScheduledValues(now); p.g.gain.setTargetAtTime(0.0001, now, 0.06); try { p.src.stop(now + 0.4); } catch { /* already */ } }
    },
    setMusic(cat) {
      this.musicCat = cat;
      if (!this.ctx) return;
      const id = 60 + cat;
      if (this.buffers.has(id)) this.startMusic(id); else this.ensure(id);
    },
    startMusic(id) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const c = this.ctx, now = c.currentTime;
      if (this.musicSrc && this.musicSrc._id === id) return;
      if (this.musicSrc) { const old = this.musicSrc, og = this.musicGain; og.gain.setTargetAtTime(0.0001, now, 0.8); setTimeout(() => { try { old.stop(); } catch { /* */ } }, 4000); }
      const src = c.createBufferSource(); src.buffer = this.buffers.get(id); src.loop = true; src._id = id;
      const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(1, now, 1.2);
      src.connect(g); g.connect(this.music); src.start();
      this.musicSrc = src; this.musicGain = g;
    },
    setStyle(s) {
      if (s === this.style) return;
      this.style = s;
      for (const k of [...this.buffers.keys()]) if (k <= 36 || k === 51) this.buffers.delete(k);
      if (this.ready) this.worker.postMessage({ type: 'style', style: s });
    },
    toggleMute() {
      this.muted = !this.muted; store.set('omg.muted', this.muted ? '1' : '0');
      this.volumes();
      $('#btn-sound').classList.toggle('muted', this.muted);
    },
  };

  // ───────────────────────── events from the engine
  let lastMax = -1;
  function events() {
    const n = X.omg_events_len();
    if (!n) return;
    const E = new Float32Array(X.memory.buffer, X.omg_events_ptr(), n).slice();
    X.omg_events_clear();
    for (let i = 0; i < n; i += 5) {
      const a = E[i + 1], b = E[i + 2], c = E[i + 3], d = E[i + 4];
      switch (E[i]) {
        case 1: audio.play(a | 0, b, c); break;
        case 2: break;
        case 4: showEnd(a, b, c, d | 0); break;
        case 5: persist(); break;
        case 6: if (navigator.vibrate) try { navigator.vibrate(a | 0); } catch { /* */ } break;
        case 7: showOver(a | 0, b | 0, c); break;
        case 8: break;
        case 9: audio.duck(a | 0); break;
        case 10: toolsUI(true); break;
        case 11: audio.setMusic(a | 0); break;
        default: break;
      }
    }
    const mx = X.omg_info(5) | 0;
    if (mx !== lastMax) { lastMax = mx; audio.prefetch(mx); }
  }
  function persist() {
    const p = X.omg_save_ptr();
    store.set('omg.save', str(p, X.omg_save_len()));
  }

  // ───────────────────────── main loop
  let last = 0;
  let toolsTick = 0;
  function loop(ts) {
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
    last = ts;
    X.omg_frame(dt);
    events();
    render();
    if (rec.on) rec.frame();
    toolsTick += dt;
    if (toolsTick > 0.1) { toolsTick = 0; toolsUI(false); }
    requestAnimationFrame(loop);
  }

  // ───────────────────────── input
  function bindInput() {
    const pos = (e) => [e.clientX, e.clientY];
    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
      X.omg_pointer(0, ...pos(e));
    });
    canvas.addEventListener('pointermove', (e) => X.omg_pointer(1, ...pos(e)));
    canvas.addEventListener('pointerup', (e) => X.omg_pointer(2, ...pos(e)));
    canvas.addEventListener('pointercancel', (e) => X.omg_pointer(3, ...pos(e)));
    const keys = { ArrowLeft: 1, ArrowRight: 2, ' ': 3, Enter: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9 };
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { menuOpen ? closeMenu() : openMenu('modes'); return; }
      if (!running || menuOpen) return;
      if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
      if (e.key === 'm' || e.key === 'M') { audio.toggleMute(); return; }
      const k = keys[e.key];
      if (k && !e.repeat) { e.preventDefault(); audio.unlock(); X.omg_key(k, 1); }
    });
    window.addEventListener('keyup', (e) => { const k = keys[e.key]; if (k === 1 || k === 2) X.omg_key(k, 0); });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (running) X.omg_pause(1); if (audio.ctx) audio.ctx.suspend().catch(() => {}); }
      else { if (running && !userPaused && !menuOpen) X.omg_pause(0); if (audio.ctx && audio.unlocked) audio.ctx.resume().catch(() => {}); }
    });
  }

  // device tilt
  let tiltOn = false;
  function onOrient(e) { if (e.gamma != null) X.omg_device_tilt((e.gamma * Math.PI / 180) * 0.9); }
  async function setDeviceTilt(on) {
    if (on && !tiltOn) {
      try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } } catch { return false; }
      window.addEventListener('deviceorientation', onOrient); tiltOn = true;
    } else if (!on && tiltOn) { window.removeEventListener('deviceorientation', onOrient); tiltOn = false; X.omg_device_tilt(0); }
    return true;
  }

  // ───────────────────────── tools
  function toolsUI(rebuild) {
    const box = $('#tools');
    const m = X.omg_info(4) | 0;
    const show = running && m !== 1;
    box.hidden = !show;
    if (!show) return;
    if (rebuild || !box.children.length) {
      box.innerHTML = '';
      S.tools.forEach((tl, i) => {
        const b = document.createElement('button');
        b.className = 'tool'; b.title = `${tl[he ? 'he' : 'en']} — ${tl[he ? 'dhe' : 'den']}`;
        b.setAttribute('aria-label', tl[he ? 'he' : 'en']);
        b.innerHTML = `<span>${tl.icon}</span><span class="ch"></span>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); X.omg_tool(i); toolsUI(false); });
        box.appendChild(b);
      });
    }
    [...box.children].forEach((b, i) => {
      const cd = X.omg_tool_state(i, 0), act = X.omg_tool_state(i, 1), ch = X.omg_tool_state(i, 2), armed = X.omg_tool_state(i, 3);
      b.style.setProperty('--cd', cd.toFixed(3));
      b.classList.toggle('active', act > 0);
      b.classList.toggle('cooling', cd > 0);
      b.classList.toggle('armed', armed > 0);
      const chEl = b.querySelector('.ch');
      chEl.textContent = S.tools[i].key === 'upgrade' ? String(ch | 0) : '';
    });
  }

  // ───────────────────────── sandbox picker
  function sandboxUI() {
    const box = $('#sandbox-pick');
    const m = X.omg_info(4) | 0;
    box.hidden = !(running && m === 5);
    if (box.hidden) return;
    box.innerHTML = '';
    for (let k = 0; k < 36; k++) {
      if (!X.omg_unlocked(k)) continue;
      const b = document.createElement('button'); b.className = 'sb'; b.title = tierName(k);
      const c = document.createElement('canvas'); c.width = c.height = 92;
      c.getContext('2d').drawImage(sprite(k), -23, -23, 138, 138);
      b.appendChild(c);
      b.addEventListener('click', () => { X.omg_set_sandbox_tier(k); [...box.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
      box.appendChild(b);
    }
    if (box.firstChild) box.firstChild.classList.add('on');
  }

  // ───────────────────────── screens
  function applyLang() {
    document.documentElement.lang = he ? 'he' : 'en';
    document.documentElement.dir = he ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ui]').forEach((el) => { el.textContent = t(el.dataset.ui); });
    $('#lnk-site').href = he ? '../he/' : '../en/';
    $('#btn-menu').setAttribute('aria-label', t('menu'));
    $('#btn-pause').setAttribute('aria-label', t('pause'));
    $('#btn-sound').setAttribute('aria-label', t('sound'));
    $('#btn-rec').setAttribute('aria-label', t('record'));
    document.title = he ? 'OH MY GOD — מפיקנטו עד אלוהים · DATTA' : 'OH MY GOD — From a Picanto to God · DATTA';
    buildModes();
    buildLadder();
    if (running) { toolsUI(true); sandboxUI(); }
    if (menuOpen) showTab(currentTab);
  }
  function setLang(isHe) { he = isHe; X.omg_set_lang(he ? 1 : 0); applyLang(); persist(); }

  function buildLadder() {
    const box = $('#ladder-preview'); box.innerHTML = '';
    for (let k = 0; k < 37; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 44;
      c.getContext('2d').drawImage(sprite(k), -11, -11, 66, 66);
      if (!X.omg_unlocked(k)) c.className = 'locked';
      c.title = X.omg_unlocked(k) ? tierName(k) : '?';
      box.appendChild(c);
    }
  }
  function buildModes() {
    const box = $('#mode-list'); box.innerHTML = '';
    S.modes.forEach((m, i) => {
      const b = document.createElement('button'); b.className = 'mode' + (i === mode ? ' on' : '');
      b.innerHTML = `<b>${m.icon}</b><span>${m[he ? 'he' : 'en']}</span>`;
      b.addEventListener('click', () => { mode = i; store.set('omg.mode', String(i)); buildModes(); });
      box.appendChild(b);
    });
    let d = $('#mode-desc');
    if (!d) { d = document.createElement('p'); d.id = 'mode-desc'; d.className = 'mode-desc'; box.after(d); }
    d.textContent = S.modes[mode][he ? 'dhe' : 'den'];
  }

  function startGame(m = mode) {
    audio.unlock();
    mode = m; store.set('omg.mode', String(m));
    $('#start').hidden = true; $('#end').hidden = true;
    closeMenu(true);
    X.omg_start(m);
    running = true; userPaused = false;
    X.omg_pause(0);
    $('#btn-pause').classList.remove('paused');
    lastMax = -1;
    toolsUI(true); sandboxUI();
    audio.prefetch(X.omg_info(5) | 0);
  }
  function togglePause() {
    userPaused = !userPaused;
    X.omg_pause(userPaused || menuOpen ? 1 : 0);
    $('#btn-pause').classList.toggle('paused', userPaused);
    if (audio.ctx) userPaused ? audio.ctx.suspend().catch(() => {}) : audio.ctx.resume().catch(() => {});
  }
  function fmtTime(s) { const m = Math.floor(s / 60); const r = s - m * 60; return `${m}:${String(Math.floor(r)).padStart(2, '0')}.${Math.floor((r % 1) * 10)}`; }

  function showEnd(time, merges, drops, m) {
    const el = $('#end'); el.classList.add('god');
    $('#end-title').textContent = t('end_title');
    $('#end-sub').textContent = S.tiers[36][he ? 'bhe' : 'ben'];
    const best = X.omg_stat(10 + m);
    $('#end-stats').innerHTML = `<div><dt>${t('end_time')}</dt><dd>${fmtTime(time)}</dd></div><div><dt>${t('end_merges')}</dt><dd>${merges | 0}</dd></div><div><dt>${t('end_drops')}</dt><dd>${drops | 0}</dd></div>`;
    const rec = $('#end-record');
    rec.hidden = !(best > 0 && Math.abs(best - time) < 0.05 && (m === 0 || m === 2 || m === 3));
    rec.textContent = t('end_record');
    $('#btn-stay').hidden = false;
    el.hidden = false;
    persist();
  }
  function showOver(reason, top, time) {
    const el = $('#end'); el.classList.remove('god');
    $('#end-title').textContent = reason === 1 ? t('over_time') : t('over_jam');
    $('#end-sub').textContent = `${t('over_reached')}: ${tierName(top)}`;
    $('#end-stats').innerHTML = `<div><dt>${t('tier')}</dt><dd>${top + 1}/37</dd></div><div><dt>${t('end_time')}</dt><dd>${fmtTime(time)}</dd></div><div><dt>${t('end_merges')}</dt><dd>${X.omg_info(8) | 0}</dd></div>`;
    $('#end-record').hidden = true;
    $('#btn-stay').hidden = true;
    el.hidden = false;
    persist();
  }

  // ───────────────────────── menu sheet
  const TABS = [['modes', 'modes'], ['settings', 'settings'], ['garage', 'garage'], ['stats', 'stats'], ['about', 'about']];
  let currentTab = 'modes';
  function openMenu(tab = 'modes') {
    menuOpen = true;
    if (running) X.omg_pause(1);
    $('#menu').hidden = false;
    $('#btn-resume').hidden = !running;
    $('#btn-restart').hidden = !running;
    $('#btn-home').hidden = !running;
    showTab(tab);
  }
  function closeMenu(silent) {
    if (!menuOpen) return;
    menuOpen = false;
    $('#menu').hidden = true;
    if (running && !userPaused && !silent) X.omg_pause(0);
    if (running && !userPaused) X.omg_pause(0);
  }
  function showTab(tab) {
    currentTab = tab;
    const tabs = $('#tabs'); tabs.innerHTML = '';
    TABS.forEach(([k, label]) => {
      const b = document.createElement('button'); b.className = 'tab' + (k === tab ? ' on' : ''); b.textContent = t(label);
      b.addEventListener('click', () => showTab(k));
      tabs.appendChild(b);
    });
    const body = $('#sheet-body'); body.innerHTML = '';
    body.scrollTop = 0;
    ({ modes: tabModes, settings: tabSettings, garage: tabGarage, stats: tabStats, about: tabAbout })[tab](body);
  }
  function tabModes(body) {
    const list = document.createElement('div'); list.className = 'modes';
    const desc = document.createElement('p'); desc.className = 'mode-desc';
    let sel = mode;
    const draw = () => {
      list.innerHTML = '';
      S.modes.forEach((m, i) => {
        const b = document.createElement('button'); b.className = 'mode' + (i === sel ? ' on' : '');
        b.innerHTML = `<b>${m.icon}</b><span>${m[he ? 'he' : 'en']}</span>`;
        b.addEventListener('click', () => { sel = i; draw(); });
        list.appendChild(b);
      });
      desc.textContent = S.modes[sel][he ? 'dhe' : 'den'];
    };
    draw();
    const go = document.createElement('button'); go.className = 'cta'; go.textContent = t('play');
    go.addEventListener('click', () => startGame(sel));
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;gap:14px;justify-items:center';
    wrap.append(list, desc, go);
    const how = document.createElement('div'); how.className = 'about';
    how.innerHTML = `<h3>${t('how')}</h3><ul class="how"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ul><h3>${t('tools')}</h3><ul class="tool-list">${S.tools.map((x) => `<li><b>${x.icon}</b><span><strong>${x[he ? 'he' : 'en']}</strong> — ${x[he ? 'dhe' : 'den']}</span></li>`).join('')}</ul>`;
    body.append(wrap, how);
  }
  function tabSettings(body) {
    const lang = document.createElement('div'); lang.className = 'opt';
    lang.innerHTML = `<div class="opt-row"><span class="opt-label">${he ? 'שפה' : 'Language'}</span></div>`;
    const chips = document.createElement('div'); chips.className = 'chips';
    [['עברית', true], ['English', false]].forEach(([l, v]) => { const c = document.createElement('button'); c.className = 'chip' + (he === v ? ' on' : ''); c.textContent = l; c.addEventListener('click', () => setLang(v)); chips.appendChild(c); });
    lang.appendChild(chips); body.appendChild(lang);
    S.groups.forEach((g, gi) => {
      const h = document.createElement('div'); h.className = 'grp'; h.textContent = g[he ? 0 : 1]; body.appendChild(h);
      S.opts.forEach((o, i) => {
        if (o.group !== gi) return;
        const row = document.createElement('div'); row.className = 'opt';
        const v = X.omg_get_opt(i);
        const label = o[he ? 'he' : 'en'], hint = o[he ? 'hhe' : 'hen'];
        if (o.kind === 'toggle') {
          row.innerHTML = `<div class="opt-row"><span class="opt-label">${label}</span><button class="sw${v > 0.5 ? ' on' : ''}" role="switch" aria-checked="${v > 0.5}" aria-label="${label}"></button></div>`;
          const sw = row.querySelector('.sw');
          sw.addEventListener('click', async () => {
            let nv = X.omg_get_opt(i) > 0.5 ? 0 : 1;
            if (o.key === 'devicetilt') { const ok = await setDeviceTilt(nv === 1); if (!ok) nv = 0; }
            X.omg_set_opt(i, nv); sw.classList.toggle('on', nv === 1); sw.setAttribute('aria-checked', String(nv === 1));
            onOpt(o.key);
          });
        } else if (o.kind === 'choice') {
          row.innerHTML = `<div class="opt-row"><span class="opt-label">${label}</span></div>`;
          const ch = document.createElement('div'); ch.className = 'chips';
          o.choices.forEach((c) => {
            const b = document.createElement('button'); b.className = 'chip' + (Math.abs(c[2] - v) < 1e-3 ? ' on' : ''); b.textContent = c[he ? 0 : 1];
            b.addEventListener('click', () => { X.omg_set_opt(i, c[2]); [...ch.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); onOpt(o.key); });
            ch.appendChild(b);
          });
          row.appendChild(ch);
        } else if (o.key === 'starttier') {
          row.innerHTML = `<div class="opt-row"><span class="opt-label">${label}</span></div>`;
          const s = document.createElement('select');
          for (let k = 0; k < 36; k++) { if (!X.omg_unlocked(k)) continue; const op = document.createElement('option'); op.value = k + 1; op.textContent = `${k + 1}. ${tierName(k)}`; if (k + 1 === Math.round(v)) op.selected = true; s.appendChild(op); }
          s.addEventListener('change', () => { X.omg_set_opt(i, +s.value); });
          row.appendChild(s);
        } else {
          row.innerHTML = `<div class="opt-row"><span class="opt-label">${label}</span><span class="val">${Math.round(v * 100)}%</span></div><input type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" aria-label="${label}">`;
          const r = row.querySelector('input'), val = row.querySelector('.val');
          r.addEventListener('input', () => { X.omg_set_opt(i, +r.value); val.textContent = `${Math.round(+r.value * 100)}%`; onOpt(o.key); });
        }
        if (hint) { const p = document.createElement('div'); p.className = 'opt-hint'; p.textContent = hint; row.appendChild(p); }
        if (o.key === 'caption') {
          const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 80; inp.placeholder = t('caption_ph');
          inp.value = store.get('omg.caption') || '';
          inp.addEventListener('input', () => { store.set('omg.caption', inp.value); withString(inp.value, X.omg_set_caption); });
          row.appendChild(inp);
        }
        body.appendChild(row);
      });
    });
    const reset = document.createElement('button'); reset.className = 'ghost danger'; reset.textContent = t('reset');
    reset.addEventListener('click', () => { if (confirm(t('reset_q'))) { X.omg_reset_progress(); persist(); buildLadder(); showTab('settings'); } });
    body.appendChild(reset);
  }
  function onOpt(key) {
    if (key.startsWith('vol') || key === 'music') audio.volumes();
    if (key === 'voicestyle') audio.setStyle(Math.round(opt('voicestyle')));
    persist();
  }
  function tabGarage(body) {
    let n = 0; for (let k = 0; k < 37; k++) n += X.omg_unlocked(k);
    const p = document.createElement('p'); p.className = 'count'; p.textContent = `${t('unlocked')}: ${n}/37`;
    body.appendChild(p);
    const grid = document.createElement('div'); grid.className = 'garage';
    let lastCat = -1;
    S.tiers.forEach((T, k) => {
      if (T.cat !== lastCat) { lastCat = T.cat; const h = document.createElement('div'); h.className = 'cat-h'; h.textContent = S.cats[T.cat][he ? 'he' : 'en']; h.style.color = S.cats[T.cat].accent; grid.appendChild(h); }
      const open = !!X.omg_unlocked(k);
      const c = document.createElement('button'); c.className = 'card' + (open ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      const g = cv.getContext('2d'); if (!open) g.filter = 'grayscale(1) brightness(.5)'; g.drawImage(sprite(k), -28, -28, 168, 168);
      const info = document.createElement('div');
      info.innerHTML = `<div class="n">${t('tier')} ${k + 1}</div><div class="t">${open ? T[he ? 'he' : 'en'] : '???'}</div><div class="b">${open ? T[he ? 'bhe' : 'ben'] : t('locked')}</div>`;
      c.append(cv, info);
      if (open) c.addEventListener('click', () => { audio.unlock(); audio.play(k, 1, 0); });
      grid.appendChild(c);
    });
    body.appendChild(grid);
  }
  function tabStats(body) {
    const rows = [
      ['s_runs', X.omg_stat(0) | 0], ['s_merges', X.omg_stat(1) | 0], ['s_omgs', X.omg_stat(2) | 0], ['s_drops', X.omg_stat(3) | 0],
      ['s_gods', X.omg_stat(4) | 0], ['s_played', fmtTime(X.omg_stat(5))], ['s_top', tierName(X.omg_stat(6) | 0)],
    ];
    const ta = X.omg_stat(7) | 0; if (ta > 0) rows.push(['s_ta', tierName(ta)]);
    const box = document.createElement('div'); box.className = 'stats';
    for (const [k, v] of rows) box.insertAdjacentHTML('beforeend', `<div>${t(k)}</div><div>${v}</div>`);
    S.modes.forEach((m, i) => { const b = X.omg_stat(10 + i); if (b > 0) box.insertAdjacentHTML('beforeend', `<div>${t('best')} · ${m[he ? 'he' : 'en']}</div><div>${fmtTime(b)}</div>`); });
    body.appendChild(box);
  }
  function tabAbout(body) {
    const d = document.createElement('div'); d.className = 'about';
    d.innerHTML = `<h3>${t('how')}</h3><ul class="how"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ul><h3>${t('credits')}</h3><p>${t('credits_body')}</p><p>${t('not_brands')}</p><p><a href="${he ? '../he/' : '../en/'}">${t('site')}</a></p>`;
    body.appendChild(d);
  }

  // ───────────────────────── reel recording
  const rec = {
    on: false, mr: null, chunks: [], cv: null, cx: null, mime: '',
    pick() {
      const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      for (const ty of types) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(ty)) return ty;
      return '';
    },
    start() {
      if (this.on) return this.stop();
      audio.unlock();
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast(t('record_unsupported')); return; }
      this.cv = document.createElement('canvas'); this.cv.width = 1080; this.cv.height = 1920;
      this.cx = this.cv.getContext('2d');
      this.frame();
      const vs = this.cv.captureStream(30);
      const tracks = [...vs.getVideoTracks()];
      if (audio.recDest) tracks.push(...audio.recDest.stream.getAudioTracks());
      this.mime = this.pick();
      try { this.mr = new MediaRecorder(new MediaStream(tracks), this.mime ? { mimeType: this.mime, videoBitsPerSecond: 8_000_000 } : undefined); } catch { toast(t('record_unsupported')); return; }
      this.chunks = [];
      this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.onstop = () => this.done();
      this.mr.start(500);
      this.on = true; this.t0 = performance.now();
      $('#btn-rec').classList.add('on'); $('#rec-badge').hidden = false;
      toast(t('recording'));
    },
    frame() {
      if (!this.cx) return;
      const cw = stage.w, ch = Math.min(stage.h, cw * 16 / 9);
      const top = Math.max(stage.y, Math.min(stage.y + stage.h - ch, (stage.cy || stage.y + stage.h / 2) - ch * 0.47));
      this.cx.fillStyle = '#000'; this.cx.fillRect(0, 0, 1080, 1920);
      this.cx.drawImage(canvas, stage.x * DPR, top * DPR, cw * DPR, ch * DPR, 0, 0, 1080, 1920);
      if (this.on) { const s = (performance.now() - this.t0) / 1000; $('#rec-badge span').textContent = `REC ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
    },
    stop() { if (this.mr && this.mr.state !== 'inactive') this.mr.stop(); this.on = false; $('#btn-rec').classList.remove('on'); $('#rec-badge').hidden = true; },
    done() {
      const type = (this.mr && this.mr.mimeType) || this.mime || 'video/webm';
      const blob = new Blob(this.chunks, { type });
      const url = URL.createObjectURL(blob);
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const v = $('#video-preview'); v.src = url;
      const a = $('#video-save'); a.href = url; a.download = `oh-my-god.${ext}`;
      a.onclick = async (e) => {
        try {
          const f = new File([blob], `oh-my-god.${ext}`, { type });
          if (navigator.canShare && navigator.canShare({ files: [f] })) { e.preventDefault(); await navigator.share({ files: [f], title: 'OH MY GOD' }); }
        } catch { /* fall back to download */ }
      };
      $('#video-ready').hidden = false;
      this.cx = null;
    },
  };

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  // ───────────────────────── wiring
  function bindUI() {
    $('#btn-play').addEventListener('click', () => startGame(mode));
    $('#btn-lang').addEventListener('click', () => setLang(!he));
    $('#btn-start-settings').addEventListener('click', () => openMenu('settings'));
    $('#btn-menu').addEventListener('click', () => { audio.unlock(); openMenu('modes'); });
    $('#btn-close').addEventListener('click', () => closeMenu());
    $('#btn-resume').addEventListener('click', () => closeMenu());
    $('#btn-restart').addEventListener('click', () => startGame(X.omg_info(4) | 0));
    $('#btn-home').addEventListener('click', () => { closeMenu(true); running = false; X.omg_pause(1); $('#start').hidden = false; buildLadder(); buildModes(); toolsUI(false); sandboxUI(); });
    $('#btn-sound').addEventListener('click', () => { audio.unlock(); audio.toggleMute(); });
    $('#btn-pause').addEventListener('click', () => togglePause());
    $('#btn-rec').addEventListener('click', () => rec.start());
    $('#btn-again').addEventListener('click', () => startGame(X.omg_info(4) | 0));
    $('#btn-stay').addEventListener('click', () => { $('#end').hidden = true; });
    $('#btn-end-rec').addEventListener('click', () => { $('#end').hidden = true; startGame(X.omg_info(4) | 0); rec.start(); });
    $('#video-close').addEventListener('click', () => { $('#video-ready').hidden = true; });
    $('#btn-sound').classList.toggle('muted', audio.muted);
  }

  async function boot() {
    resize();
    const res = await fetch('omg.wasm');
    wasmBytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    X = instance.exports;
    X.omg_init((Math.random() * 2 ** 31) >>> 0);
    const saved = store.get('omg.save');
    if (saved) withString(saved, X.omg_load);
    else { const nl = (navigator.languages || [navigator.language || '']).join(',').toLowerCase(); he = !/^en/.test(nl) || /(^|,)he/.test(nl); X.omg_set_lang(he ? 1 : 0); }
    he = !!X.omg_get_lang();
    const cap = store.get('omg.caption'); if (cap) withString(cap, X.omg_set_caption);
    S = JSON.parse(str(X.omg_schema_ptr(), X.omg_schema_len()));
    X.omg_resize(W, H, DPR);
    if (opt('devicetilt') > 0.5) X.omg_set_opt(optIndex('devicetilt'), 0);
    const keys = [...new Set(S.tiers.map((x) => x.icon).filter(Boolean))];
    await Promise.all(keys.map(loadIcon));
    try { await document.fonts.load('800 20px Assistant'); } catch { /* */ }
    bindInput(); bindUI(); applyLang();
    $('#loading').hidden = true;
    audio.create();
    if (/[?&]play/.test(location.search)) startGame(mode);
    requestAnimationFrame(loop);
  }
  boot().catch((e) => { console.error(e); const l = $('#loading'); l.hidden = false; l.textContent = 'WebAssembly failed to load: ' + (e && e.message); });
  window.__omg = { get X() { return X; }, get S() { return S; }, audio, startGame, openMenu };
})();
