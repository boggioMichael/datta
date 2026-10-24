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
  const isVoice = (id) => id <= S.god || id === S.sounds.iam;
  const optIndex = (key) => S.opts.findIndex((o) => o.key === key);
  const opt = (key) => X.omg_get_opt(optIndex(key));

  // ───────────────────────── colours
  const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  // ───────────────────────── icons & sprites
  const icons = {};
  let iconBundle = null;
  function loadIcon(key) {
    return new Promise((resolve) => {
      if (!key) return resolve(null);
      const src = iconBundle && iconBundle[key] ? Promise.resolve(iconBundle[key]) : fetch(`icons/${key}.svg`).then((r) => { if (!r.ok) throw 0; return r.text(); });
      src.then((txt) => {
        txt = txt.replace('<svg ', '<svg width="512" height="512" ');
        const url = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => { icons[key] = img; resolve(img); };
        img.onerror = () => resolve(null);
        img.src = url;
      }).catch(() => resolve(null));
    });
  }
  // white "sticker" outline behind each picture, made once per icon
  const outlined = {};
  function stickerOf(img, size) {
    const k = img.src + '|' + size;
    if (outlined[k]) return outlined[k];
    const pad = Math.ceil(size * 0.05);
    const c = document.createElement('canvas'); c.width = c.height = size + pad * 2;
    const g = c.getContext('2d');
    const sil = document.createElement('canvas'); sil.width = sil.height = size;
    const sg = sil.getContext('2d');
    sg.drawImage(img, 0, 0, size, size);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, size, size);
    const steps = 16, rad = pad * 0.85;
    for (let k2 = 0; k2 < steps; k2++) { const a = k2 / steps * TAU; g.drawImage(sil, pad + Math.cos(a) * rad, pad + Math.sin(a) * rad); }
    g.drawImage(img, pad, pad, size, size);
    outlined[k] = c;
    return c;
  }
  const SPR_S = 128, SPR_L = 384;
  const sprites = new Map();
  let ballStyle = 0;
  function sprite(i, big = false, style = ballStyle) {
    const SPR = big ? SPR_L : SPR_S;
    const key = (i * 8 + style) * 2 + (big ? 1 : 0);
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = SPR;
    const g = c.getContext('2d');
    const T = S.tiers[i];
    const col = hex2rgb(T.color), fill = hex2rgb(T.fill);
    const cx = SPR / 2, cy = SPR / 2, R = SPR * 0.4;
    if (i === S.god) {
      // the God of Israel: no image, only light
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, SPR / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.28, 'rgba(255,252,240,1)');
      gr.addColorStop(0.55, 'rgba(255,236,180,.85)');
      gr.addColorStop(0.8, 'rgba(255,214,120,.35)');
      gr.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
      sprites.set(key, c);
      return c;
    }
    // soft halo in the ride's colour
    let gr = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, SPR / 2);
    gr.addColorStop(0, rgba(...col, style === 2 ? 0.7 : style === 4 ? 0.2 : 0.36)); gr.addColorStop(1, rgba(...col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
    const ink = [21, 21, 42];
    if (style === 4) {
      // a living cell: a translucent membrane in the ride's colour, lit from the top left
      gr = g.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.08, cx, cy, R);
      gr.addColorStop(0, rgba(...mixc(col, [255, 255, 255], 0.8), 0.55));
      gr.addColorStop(0.55, rgba(...mixc(col, [255, 255, 255], 0.38), 0.4));
      gr.addColorStop(0.86, rgba(...col, 0.5));
      gr.addColorStop(1, rgba(...mixc(col, [16, 16, 40], 0.4), 0.88));
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
      // a soft light behind the picture, like a nucleus
      gr = g.createRadialGradient(cx, cy + R * 0.04, 0, cx, cy, R * 0.82);
      gr.addColorStop(0, 'rgba(255,255,255,.66)'); gr.addColorStop(0.6, 'rgba(255,255,255,.26)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    } else if (style === 0) {
      // sticker: a bright pastel disc in the ride's colour, dark ink rim
      gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      gr.addColorStop(0, rgba(...mixc(col, [255, 255, 255], 0.86), 1));
      gr.addColorStop(0.65, rgba(...mixc(col, [255, 255, 255], 0.62), 1));
      gr.addColorStop(1, rgba(...mixc(col, [255, 255, 255], 0.3), 1));
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
    } else if (style === 3) {
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = rgba(...col, 1); g.fill();
    } else {
      const lit = style === 1 ? 0.42 : 0.26;
      gr = g.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.05, cx, cy, R);
      gr.addColorStop(0, rgba(...mixc(fill, [255, 255, 255], lit), 1));
      gr.addColorStop(0.6, rgba(...fill, 1));
      gr.addColorStop(1, rgba(...mixc(fill, [0, 0, 0], style === 2 ? 0.7 : 0.45), 1));
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
      gr = g.createRadialGradient(cx, cy + R * 0.7, 0, cx, cy + R * 0.5, R);
      gr.addColorStop(0, rgba(...col, 0.3)); gr.addColorStop(1, rgba(...col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    }
    // the picture
    const img = icons[T.icon];
    const lw = R * (style === 2 ? 0.06 : style === 0 ? 0.075 : style === 4 ? 0.05 : 0.085);
    if (img) {
      const box = Math.round(R * (style === 0 || style === 3 ? 1.78 : style === 4 ? 1.58 : 1.62));
      g.save(); g.beginPath(); g.arc(cx, cy, R - lw * 0.6, 0, TAU); g.clip();
      if (style === 1 || style === 2 || style === 4) {
        const st = stickerOf(img, box);
        const pad = (st.width - box) / 2;
        g.drawImage(st, cx - box / 2 - pad, cy - box / 2 - pad);
      } else {
        g.drawImage(img, cx - box / 2, cy - box / 2 + R * 0.02, box, box);
      }
      g.restore();
    } else {
      g.fillStyle = style === 0 ? rgba(...ink, 1) : '#fff'; g.font = `800 ${R * 0.42}px Assistant, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(T.len || '?', cx, cy, R * 1.6);
    }
    if (style === 4) {
      // the membrane: a light band, a fine dark edge, bounce light along the bottom, a wet highlight
      g.lineWidth = R * 0.055; g.strokeStyle = rgba(...mixc(col, [255, 255, 255], 0.5), 0.8);
      g.beginPath(); g.arc(cx, cy, R - R * 0.03, 0, TAU); g.stroke();
      g.lineWidth = R * 0.024; g.strokeStyle = rgba(...mixc(col, [16, 16, 40], 0.55), 0.85);
      g.beginPath(); g.arc(cx, cy, R - R * 0.012, 0, TAU); g.stroke();
      g.lineCap = 'round';
      g.lineWidth = R * 0.06; g.strokeStyle = rgba(...mixc(col, [255, 255, 255], 0.72), 0.42);
      g.beginPath(); g.arc(cx, cy, R * 0.88, Math.PI * 0.16, Math.PI * 0.72); g.stroke();
      g.save(); g.translate(cx - R * 0.38, cy - R * 0.44); g.rotate(-0.72); g.scale(1, 0.5);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
      gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.34, 0, TAU); g.fill(); g.restore();
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(cx - R * 0.52, cy - R * 0.5, R * 0.055, 0, TAU); g.fill();
      sprites.set(key, c);
      return c;
    }
    // rim
    if (style === 2) { g.shadowColor = rgba(...col, 1); g.shadowBlur = R * 0.25; }
    g.lineWidth = lw;
    g.strokeStyle = style === 0 ? rgba(...mixc(col, [0, 0, 0], 0.18), 1) : style === 2 ? rgba(...mixc(col, [255, 255, 255], 0.35), 1) : style === 3 ? rgba(...ink, 1) : rgba(...col, 1);
    g.beginPath(); g.arc(cx, cy, R - lw / 2, 0, TAU); g.stroke();
    g.shadowBlur = 0;
    if (style === 0) {
      g.lineWidth = R * 0.03; g.strokeStyle = rgba(...ink, 0.9);
      g.beginPath(); g.arc(cx, cy, R - R * 0.015, 0, TAU); g.stroke();
    } else if (style !== 3) {
      g.lineWidth = R * 0.02; g.strokeStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.arc(cx, cy, R - lw * 1.3, 0, TAU); g.stroke();
    }
    // gloss
    if (style !== 3) {
      gr = g.createLinearGradient(0, cy - R, 0, cy);
      gr.addColorStop(0, `rgba(255,255,255,${style === 1 ? 0.38 : style === 0 ? 0.28 : 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy - R * 0.5, R * 0.66, R * 0.34, 0, 0, TAU); g.fill();
    }
    sprites.set(key, c);
    return c;
  }
  // the journey's special cells (OP_ITEM index 1000 + kind): 1 scrap, 2 antimatter, 3 divine
  function specialSprite(kind, big = false) {
    const SPR = big ? SPR_L : SPR_S;
    const key = 'sp' + kind + (big ? 'L' : 'S');
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = SPR;
    const g = c.getContext('2d');
    const cx = SPR / 2, cy = SPR / 2, R = SPR * 0.4;
    let gr;
    if (kind === 1) {
      // scrap: a dented lump of rusty metal
      g.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = k / 18 * TAU;
        const rr = R * (0.86 + 0.1 * Math.sin(k * 2.7 + 1) + 0.06 * Math.cos(k * 4.3));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      gr.addColorStop(0, '#b8b0a4'); gr.addColorStop(0.55, '#77706a'); gr.addColorStop(1, '#3c3632');
      g.fillStyle = gr; g.fill();
      g.lineWidth = R * 0.05; g.strokeStyle = 'rgba(20,16,14,.85)'; g.stroke();
      g.save(); g.clip();
      for (const [x, y, rr] of [[-0.35, 0.2, 0.22], [0.28, -0.3, 0.16], [0.3, 0.38, 0.13], [-0.1, -0.5, 0.1]]) {
        gr = g.createRadialGradient(cx + x * R, cy + y * R, 0, cx + x * R, cy + y * R, rr * R);
        gr.addColorStop(0, 'rgba(176,84,34,.85)'); gr.addColorStop(1, 'rgba(176,84,34,0)');
        g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
      }
      g.strokeStyle = 'rgba(25,20,18,.75)'; g.lineWidth = R * 0.045; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - R * 0.5, cy - R * 0.1); g.lineTo(cx - R * 0.1, cy + R * 0.05); g.lineTo(cx + R * 0.05, cy + R * 0.45); g.stroke();
      g.beginPath(); g.moveTo(cx + R * 0.2, cy - R * 0.55); g.lineTo(cx + R * 0.45, cy - R * 0.15); g.stroke();
      g.fillStyle = 'rgba(30,26,24,.9)';
      for (const [x, y] of [[0.48, 0.12], [-0.52, -0.38], [0.05, -0.2]]) { g.beginPath(); g.arc(cx + x * R, cy + y * R, R * 0.07, 0, TAU); g.fill(); }
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx - R * 0.35, cy - R * 0.45, R * 0.28, R * 0.12, -0.6, 0, TAU); g.fill();
    } else if (kind === 2) {
      // antimatter: a hole of dark matter ringed with violet light
      gr = g.createRadialGradient(cx, cy, R * 0.7, cx, cy, SPR / 2);
      gr.addColorStop(0, 'rgba(190,80,255,.55)'); gr.addColorStop(1, 'rgba(190,80,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
      gr = g.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.05, cx, cy, R);
      gr.addColorStop(0, '#3a1458'); gr.addColorStop(0.6, '#12041f'); gr.addColorStop(1, '#05000b');
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
      g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(${k === 1 ? '120,230,255' : '226,120,255'},${0.75 - k * 0.15})`; g.lineWidth = R * (0.07 - k * 0.012);
        g.beginPath(); g.arc(cx, cy, R * (0.78 - k * 0.2), k * 2.1, k * 2.1 + 3.6); g.stroke();
      }
      g.lineWidth = R * 0.07; g.strokeStyle = '#e07bff';
      g.beginPath(); g.arc(cx, cy, R * 0.97, 0, TAU); g.stroke();
      g.fillStyle = '#fff'; g.font = `800 ${R * 0.62}px Assistant, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('−', cx, cy + R * 0.02);
    } else {
      // divine: a golden cell with a star of light in it
      gr = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, SPR / 2);
      gr.addColorStop(0, 'rgba(255,214,110,.75)'); gr.addColorStop(1, 'rgba(255,214,110,0)');
      g.fillStyle = gr; g.fillRect(0, 0, SPR, SPR);
      gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
      gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.45, '#ffd968'); gr.addColorStop(1, '#c98a10');
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = gr; g.fill();
      g.lineWidth = R * 0.05; g.strokeStyle = 'rgba(255,250,225,.95)'; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, TAU); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU - Math.PI / 2, rr = k % 2 === 0 ? R * 0.62 : R * 0.16;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx - R * 0.5, cy - R * 0.5, R * 0.08, 0, TAU); g.fill();
    }
    sprites.set(key, c);
    return c;
  }
  // plain picture: a tier's illustration (index < 1000) or a story sprite (1000 + i)
  function plainIcon(idx) {
    const key = idx >= 1000 ? (S.story_icons || [])[idx - 1000] : (S.tiers[idx] && S.tiers[idx].icon);
    return key ? icons[key] : null;
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

  // blurred silhouettes of the giants waiting in the deep (tinted on a scratch canvas per draw)
  const ghosts = new Map();
  const GH = 96;
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = GH;
  const scx = scratch.getContext('2d');
  function ghostOf(idx, lvl) {
    const key = idx * 4 + lvl;
    const hit = ghosts.get(key);
    if (hit) return hit;
    const img = plainIcon(idx);
    if (!img) return null;
    const small = [GH, 34, 18][lvl] || 18;
    const s = document.createElement('canvas'); s.width = s.height = small;
    const sg = s.getContext('2d'); sg.drawImage(img, 0, 0, small, small);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, small, small);
    const c = document.createElement('canvas'); c.width = c.height = GH;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
    if (lvl === 0) g.drawImage(s, 0, 0, GH, GH);
    else {
      const k = lvl === 1 ? 2.5 : 5;
      g.globalAlpha = 0.34;
      for (const [dx, dy] of [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k], [k * 0.7, k * 0.7], [-k * 0.7, -k * 0.7]]) g.drawImage(s, dx, dy, GH, GH);
    }
    ghosts.set(key, c);
    return c;
  }
  // a lens bokeh disc in a colour (quantised so the cache stays small)
  const bokehs = new Map();
  function bokehOf(r, g, b) {
    const q = (v) => Math.max(0, Math.min(15, Math.round(v * 15)));
    const key = (q(r) << 8) | (q(g) << 4) | q(b);
    let c = bokehs.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const col = [q(r) * 17, q(g) * 17, q(b) * 17];
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, rgba(...col, 0.4)); gr.addColorStop(0.74, rgba(...col, 0.48)); gr.addColorStop(0.9, rgba(...col, 0.8)); gr.addColorStop(1, rgba(...col, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    bokehs.set(key, c);
    return c;
  }
  let shadowSpr = null;
  function shadowOf() {
    if (shadowSpr) return shadowSpr;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    shadowSpr = c;
    return c;
  }
  // a wobbly closed curve around (cx, cy): the living membrane's shape
  function wobblePath(cx, cy, rad, a0, a1, wob, now, closed) {
    ctx.beginPath();
    const n = 128;
    for (let k = 0; k <= n; k++) {
      const an = a0 + (a1 - a0) * k / n;
      const w = wob * (Math.sin(an * 3 + now * 2.1) * 0.6 + Math.sin(an * 5 - now * 3.3) * 0.4) + rad * 0.0045 * Math.sin(an * 2 + now * 0.9);
      const x = cx + Math.cos(an) * (rad + w), y = cy + Math.sin(an) * (rad + w);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (closed) ctx.closePath();
  }

  const puffs = new Map();
  function puff(r, g, b) {
    const key = ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
    let c = puffs.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(r * 255, g * 255, b * 255, 1)); gr.addColorStop(0.6, rgba(r * 255, g * 255, b * 255, 0.5)); gr.addColorStop(1, rgba(r * 255, g * 255, b * 255, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    puffs.set(key, c);
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
    const P = new Float32Array(X.memory.buffer, X.omg_paths_ptr(), X.omg_paths_len());
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
          const wob = D[i + 15];
          const st = ringStyle(cx, cy, theme, hue, accent);
          const a0 = -Math.PI / 2 + gap * 1.02, a1 = Math.PI * 1.5 - gap * 1.02;
          const ringPath = () => {
            ctx.beginPath();
            if (wob < 0.3) { ctx.arc(cx, cy, r, a0, a1); return; }
            const n = 96, ph = performance.now() / 1000 * 9;
            for (let k = 0; k <= n; k++) {
              const an = a0 + (a1 - a0) * k / n;
              const rr = r + wob * Math.sin(an * 6 + ph) * Math.sin(Math.PI * k / n);
              const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr;
              if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
          };
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'lighter';
          const passes = [[th * 7, 0.05 * gl], [th * 3.4, 0.12 * gl], [th * 1.8, 0.28]];
          for (const [w, al] of passes) {
            ctx.globalAlpha = a * Math.min(1, al); ctx.lineWidth = w; ctx.strokeStyle = st;
            ringPath(); ctx.stroke();
          }
          if (pulse > 0.02) {
            ctx.globalAlpha = a * pulse * 0.55; ctx.lineWidth = th * 2.2; ctx.strokeStyle = rgba(...pc, 1);
            ringPath(); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = a; ctx.lineWidth = th; ctx.strokeStyle = st;
          ringPath(); ctx.stroke();
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
          const orphan = D[i + 10], hl = D[i + 11], heLbl = D[i + 12] > 0.5, sq = D[i + 13], sqa = D[i + 14];
          ballStyle = D[i + 15] | 0;
          if (r < 0.5) break;
          const s = ti >= 1000 ? specialSprite(ti - 1000, r * DPR > 46) : sprite(ti, r * DPR > 46);
          ctx.globalAlpha = a;
          if (ti === S.god) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(s, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(s, x - r * 1.05, y - r * 1.05, r * 2.1, r * 2.1);
          } else {
            ctx.save(); ctx.translate(x, y);
            if (sq > 0.01) {
              // squash along the impact normal, stretch across it
              ctx.rotate(sqa); ctx.scale(1 - sq, 1 + sq * 0.6); ctx.rotate(-sqa);
            }
            ctx.rotate(ang);
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
          if (la > 0.01 && ti !== S.god) {
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
          ctx.drawImage(sprite(ti, r * DPR > 46), D[i + 2] - r * 1.25, D[i + 3] - r * 1.25, r * 2.5, r * 2.5);
          ctx.globalAlpha = 1;
          break;
        }
        case 10: { // RECT
          let x = D[i + 1], y = D[i + 2], w = D[i + 3], h = D[i + 4];
          if (w < 0) { x += w; w = -w; }
          if (h < 0) { y += h; h = -h; }
          const rad = Math.max(0, Math.min(D[i + 9], h / 2, w / 2));
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
        case 16: { // PATH
          const off = D[i + 1] | 0, np = D[i + 2] | 0;
          if (np < 2) break;
          ctx.globalCompositeOperation = D[i + 13] > 0.5 ? 'lighter' : 'source-over';
          ctx.beginPath();
          ctx.moveTo(P[off], P[off + 1]);
          for (let k = 1; k < np; k++) ctx.lineTo(P[off + k * 2], P[off + k * 2 + 1]);
          if (D[i + 12] > 0.5) ctx.closePath();
          if (D[i + 6] > 0.001) { ctx.globalAlpha = Math.min(1, D[i + 6]); ctx.fillStyle = rgba(D[i + 3] * 255, D[i + 4] * 255, D[i + 5] * 255, 1); ctx.fill(); }
          if (D[i + 10] > 0.001 && D[i + 11] > 0) { ctx.globalAlpha = Math.min(1, D[i + 10]); ctx.lineWidth = D[i + 11]; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(D[i + 7] * 255, D[i + 8] * 255, D[i + 9] * 255, 1); ctx.stroke(); }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 17: { // CIRCLE
          const x = D[i + 1], y = D[i + 2], r = D[i + 3];
          if (r <= 0) break;
          ctx.globalCompositeOperation = D[i + 13] > 0.5 ? 'lighter' : 'source-over';
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
          if (D[i + 7] > 0.001) { ctx.globalAlpha = Math.min(1, D[i + 7]); ctx.fillStyle = rgba(D[i + 4] * 255, D[i + 5] * 255, D[i + 6] * 255, 1); ctx.fill(); }
          if (D[i + 11] > 0.001 && D[i + 12] > 0) { ctx.globalAlpha = Math.min(1, D[i + 11]); ctx.lineWidth = D[i + 12]; ctx.strokeStyle = rgba(D[i + 8] * 255, D[i + 9] * 255, D[i + 10] * 255, 1); ctx.stroke(); }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 18: { // CONFETTI
          const x = D[i + 1], y = D[i + 2], s2 = D[i + 3], an = D[i + 4];
          ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(an * 1.7))));
          ctx.globalAlpha = D[i + 8]; ctx.fillStyle = rgba(D[i + 5] * 255, D[i + 6] * 255, D[i + 7] * 255, 1);
          ctx.fillRect(-s2, -s2 * 0.5, s2 * 2, s2);
          ctx.restore();
          break;
        }
        case 20: { // SPRITE: plain picture [idx, x, y, size, rot, flip, alpha]
          const img = plainIcon(D[i + 1] | 0);
          const sz = D[i + 4], a = D[i + 7];
          if (!img || sz < 1 || a <= 0.003) break;
          ctx.save(); ctx.translate(D[i + 2], D[i + 3]);
          if (D[i + 5]) ctx.rotate(D[i + 5]);
          if (D[i + 6] > 0.5) ctx.scale(-1, 1);
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        }
        case 21: { // VGRAD: vertical gradient band [y0, y1, r0,g0,b0,a0, r1,g1,b1,a1, x0, x1]
          const y0 = D[i + 1], y1 = D[i + 2];
          const x0 = D[i + 11] || 0, x1 = D[i + 12] || W;
          const g = ctx.createLinearGradient(0, y0, 0, y1);
          g.addColorStop(0, rgba(D[i + 3] * 255, D[i + 4] * 255, D[i + 5] * 255, D[i + 6]));
          g.addColorStop(1, rgba(D[i + 7] * 255, D[i + 8] * 255, D[i + 9] * 255, D[i + 10]));
          ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          break;
        }
        case 19: { // SMOKE
          const x = D[i + 1], y = D[i + 2], r = D[i + 3], a = D[i + 7];
          if (r <= 0 || a <= 0.003) break;
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(puff(D[i + 4], D[i + 5], D[i + 6]), x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 22: { // MEMBRANE: the bubble of life [cx, cy, r, thick, wob, layer, tint rgb, light rgb, alpha, pore, pulse]
          const cx = D[i + 1], cy = D[i + 2], r = D[i + 3], th = D[i + 4], wob = D[i + 5], layer = D[i + 6];
          const tint = [D[i + 7] * 255, D[i + 8] * 255, D[i + 9] * 255], lit = [D[i + 10] * 255, D[i + 11] * 255, D[i + 12] * 255];
          const a = D[i + 13], pore = D[i + 14], pulse = D[i + 15];
          if (a <= 0.003 || r < 2) break;
          const now = performance.now() / 1000;
          if (layer < 0.5) {
            // the fluid inside: clear near the light, denser toward the wall and the floor
            const g = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.36, r * 0.08, cx, cy, r);
            g.addColorStop(0, rgba(...mixc(tint, [255, 255, 255], 0.55), 0.1 * a));
            g.addColorStop(0.72, rgba(...tint, 0.17 * a));
            g.addColorStop(1, rgba(...mixc(tint, [0, 0, 0], 0.35), 0.4 * a));
            ctx.fillStyle = g; wobblePath(cx, cy, r, 0, TAU, wob, now, true); ctx.fill();
            const f = ctx.createLinearGradient(0, cy, 0, cy + r);
            f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, `rgba(0,0,0,${0.16 * a})`);
            ctx.fillStyle = f; ctx.fill();
            break;
          }
          const a0 = -Math.PI / 2 + pore, a1 = Math.PI * 1.5 - pore;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          // a halo of light around the wall
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * (0.08 + 0.3 * pulse); ctx.lineWidth = th * 3.4; ctx.strokeStyle = rgba(...lit, 1);
          wobblePath(cx, cy, r + th * 0.5, a0, a1, wob, now, false); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          // the wall: lit at the top left, deeper at the bottom right
          const lg = ctx.createLinearGradient(cx - r * 0.75, cy - r * 0.75, cx + r * 0.75, cy + r * 0.75);
          lg.addColorStop(0, rgba(...mixc(lit, [255, 255, 255], 0.45), 0.9));
          lg.addColorStop(0.5, rgba(...mixc(tint, lit, 0.45), 0.55));
          lg.addColorStop(1, rgba(...mixc(tint, [0, 0, 0], 0.4), 0.8));
          ctx.globalAlpha = a; ctx.lineWidth = th; ctx.strokeStyle = lg;
          wobblePath(cx, cy, r + th * 0.5, a0, a1, wob, now, false); ctx.stroke();
          ctx.globalAlpha = a * 0.5; ctx.lineWidth = Math.max(1, th * 0.16); ctx.strokeStyle = '#fff';
          wobblePath(cx, cy, r + th * 0.1, a0, a1, wob, now, false); ctx.stroke();
          ctx.globalAlpha = a * 0.5; ctx.lineWidth = Math.max(1, th * 0.14); ctx.strokeStyle = rgba(...mixc(tint, [0, 0, 0], 0.65), 1);
          wobblePath(cx, cy, r + th * 0.96, a0, a1, wob, now, false); ctx.stroke();
          // wet highlights: a long arc at the top left, a spot, bounce light at the bottom right
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.32; ctx.lineWidth = th * 1.2; ctx.strokeStyle = '#fff';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.94, Math.PI * 1.06, Math.PI * 1.36); ctx.stroke();
          ctx.globalAlpha = a * 0.16; ctx.lineWidth = th * 0.6;
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, Math.PI * 1.42, Math.PI * 1.5); ctx.stroke();
          const sx2 = cx + Math.cos(Math.PI * 1.2) * r * 0.88, sy2 = cy + Math.sin(Math.PI * 1.2) * r * 0.88, ss = th * 2.2;
          ctx.globalAlpha = a * 0.9; ctx.drawImage(glow(1, 1, 1), sx2 - ss, sy2 - ss, ss * 2, ss * 2);
          ctx.globalAlpha = a * (0.22 + 0.3 * pulse); ctx.lineWidth = th * 0.8; ctx.strokeStyle = rgba(...lit, 1);
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.955, Math.PI * 0.08, Math.PI * 0.46); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          // the lips of the pore the stem feeds through
          if (pore > 0.001) {
            ctx.globalAlpha = a;
            for (const an of [a0, a1]) {
              const x = cx + Math.cos(an) * (r + th * 0.5), y = cy + Math.sin(an) * (r + th * 0.5);
              const lg2 = ctx.createRadialGradient(x - th * 0.3, y - th * 0.3, 0, x, y, th * 0.9);
              lg2.addColorStop(0, rgba(...mixc(lit, [255, 255, 255], 0.5), 1)); lg2.addColorStop(1, rgba(...mixc(tint, [0, 0, 0], 0.3), 1));
              ctx.fillStyle = lg2; ctx.beginPath(); ctx.arc(x, y, th * 0.85, 0, TAU); ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 23: { // GHOST: a blurred, tinted silhouette [idx, x, y, size, rot, flip, alpha, blur 0..2, r, g, b]
          const sz = D[i + 4], a = D[i + 7];
          if (sz < 2 || a <= 0.003) break;
          const c = ghostOf(D[i + 1] | 0, D[i + 8] | 0);
          if (!c) break;
          scx.globalCompositeOperation = 'copy'; scx.drawImage(c, 0, 0);
          scx.globalCompositeOperation = 'source-in'; scx.fillStyle = rgba(D[i + 9] * 255, D[i + 10] * 255, D[i + 11] * 255, 1); scx.fillRect(0, 0, GH, GH);
          ctx.save(); ctx.translate(D[i + 2], D[i + 3]);
          if (D[i + 5]) ctx.rotate(D[i + 5]);
          if (D[i + 6] > 0.5) ctx.scale(-1, 1);
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(scratch, -sz / 2, -sz / 2, sz, sz);
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        }
        case 24: { // BOKEH: an out-of-focus light [x, y, r, r, g, b, alpha]
          const r = D[i + 3], a = D[i + 7];
          if (r < 0.5 || a <= 0.003) break;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(bokehOf(D[i + 4], D[i + 5], D[i + 6]), D[i + 1] - r, D[i + 2] - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        }
        case 25: { // SHADOW: a soft dark ellipse [x, y, rx, ry, alpha]
          const a = D[i + 5];
          if (a <= 0.003 || D[i + 3] < 0.5) break;
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(shadowOf(), D[i + 1] - D[i + 3], D[i + 2] - D[i + 4], D[i + 3] * 2, D[i + 4] * 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 26: { // BLOB: a wobbling glossy droplet of goo [x, y, r, wob, phase, r, g, b, alpha, highlight]
          const x = D[i + 1], y = D[i + 2], r = D[i + 3], wob = D[i + 4], ph = D[i + 5], a = D[i + 9];
          if (r < 0.5 || a <= 0.003) break;
          const col = [D[i + 6] * 255, D[i + 7] * 255, D[i + 8] * 255];
          ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const an = k / 20 * TAU;
            const rr = r * (1 + wob * (Math.sin(an * 3 + ph) * 0.5 + Math.sin(an * 2 - ph * 1.3) * 0.5));
            const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr;
            if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.1);
          g.addColorStop(0, rgba(...mixc(col, [255, 255, 255], 0.7), a)); g.addColorStop(0.6, rgba(...col, a * 0.85)); g.addColorStop(1, rgba(...mixc(col, [0, 0, 0], 0.3), a * 0.9));
          ctx.fillStyle = g; ctx.fill();
          if (D[i + 10] > 0 && r > 2) { ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.36, y - r * 0.38, r * 0.17, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
          break;
        }
        case 28: // SHIFT: move what follows (a shake) [dx, dy]
          ctx.setTransform(DPR, 0, 0, DPR, D[i + 1] * DPR, D[i + 2] * DPR);
          break;
        case 27: { // VIGNETTE: darken toward the edges [cx, cy, r0, r1, r, g, b, alpha]
          const g = ctx.createRadialGradient(D[i + 1], D[i + 2], D[i + 3], D[i + 1], D[i + 2], D[i + 4]);
          const col = [D[i + 5] * 255, D[i + 6] * 255, D[i + 7] * 255];
          g.addColorStop(0, rgba(...col, 0)); g.addColorStop(1, rgba(...col, Math.min(1, D[i + 8])));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          break;
        }
        default: break;
      }
    }
  }

  // ───────────────────────── audio (PCM rendered by the Rust sound engine in a worker)
  const audio = {
    ctx: null, master: null, voice: null, sfx: null, music: null, notes: null, recDest: null,
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
      this.voice = c.createGain(); this.sfx = c.createGain(); this.music = c.createGain(); this.notes = c.createGain();
      this.voice.connect(this.master); this.sfx.connect(this.master); this.music.connect(this.master); this.notes.connect(this.master);
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
        setTimeout(() => { const id = S.sounds.music0 + this.musicCat; if (this.musicCat >= 0 && this.buffers.has(id)) this.startMusic(id); }, 50);
      }
    },
    volumes() {
      if (!this.ctx || !X) return;
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : opt('vol'), now, 0.03);
      this.voice.gain.setTargetAtTime(opt('volvoice'), now, 0.03);
      this.sfx.gain.setTargetAtTime(opt('volsfx'), now, 0.03);
      this.music.gain.setTargetAtTime(opt('music') > 0.5 ? opt('volmusic') : 0, now, 0.3);
      this.notes.gain.setTargetAtTime(opt('notes') > 0.5 ? opt('volnotes') : 0, now, 0.05);
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
          if (m.style !== this.style && isVoice(m.id)) { if (this.want.has(m.id)) this.worker.postMessage({ type: 'render', id: m.id, style: this.style }); return; }
          const frames = m.data.length / 2;
          if (!frames) return;
          const buf = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
          const L = buf.getChannelData(0), R = buf.getChannelData(1);
          for (let k = 0, j = 0; k < frames; k++, j += 2) { L[k] = m.data[j]; R[k] = m.data[j + 1]; }
          this.buffers.set(m.id, buf);
          const w = this.want.get(m.id);
          this.want.delete(m.id);
          if (w && w.play && this.ctx.currentTime - w.at < 0.8) this.play(m.id, w.gain, w.pan, w.rate);
          if (m.id >= S.sounds.music0 && m.id - S.sounds.music0 === this.musicCat) this.startMusic(m.id);
        } else if (m.type === 'error') {
          console.warn('audio worker:', m.message);
        }
      };
      const decode = (ab) => new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      Promise.all((S.clips || []).map((name) => fetch(`voice/${name}.mp3`).then((r) => r.arrayBuffer()).then(decode)
        .then((b) => ({ data: b.getChannelData(0).slice(), sr: b.sampleRate })).catch(() => ({ data: new Float32Array(0), sr: 24000 }))))
        .then((clips) => {
          this.worker.postMessage({ type: 'init', wasm: wasmBytes.slice(0), sampleRate: this.ctx.sampleRate, clips, god: S.god, iam: S.sounds.iam }, clips.map((c) => c.data.buffer));
        });
    },
    ensure(id, play = false, gain = 1, pan = 0, rate = 1) {
      if (!this.ctx) return;
      if (this.buffers.has(id)) return;
      const prev = this.want.get(id);
      if (prev) { if (play) Object.assign(prev, { play, gain, pan, rate, at: this.ctx.currentTime }); return; }
      this.want.set(id, { play, gain, pan, rate, at: this.ctx.currentTime });
      if (this.ready) this.worker.postMessage({ type: 'render', id, style: this.style, urgent: play });
    },
    prefetch(maxTier) {
      const s0 = S.sounds.sfx0;
      // the long creation sounds (held breath, creation swell) only near the end
      for (let id = s0; id <= S.sounds.sfx1; id++) if (id !== S.sounds.iam && (id < s0 + 23 || id > s0 + 25)) this.ensure(id);
      for (let k = 0; k < 5; k++) this.ensure(S.sounds.note0 + k);
      const lo = Math.max(0, maxTier - 1), hi = Math.min(S.god, maxTier + 5);
      for (let k = lo; k <= hi; k++) this.ensure(k);
      if (maxTier >= S.god - 10) { this.ensure(S.god); this.ensure(S.sounds.iam); this.ensure(s0 + 23); this.ensure(s0 + 24); this.ensure(s0 + 25); }
      // the narration of the ending, well before it's needed
      if (maxTier >= S.god - 24) story.preload(he);
    },
    note(timbre, midi, gain, pan) {
      if (!this.ctx || this.ctx.state !== 'running' || opt('notes') < 0.5) return;
      const id = S.sounds.note0 + timbre;
      const buf = this.buffers.get(id);
      if (!buf) { this.ensure(id); return; }
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (midi - 72) / 12);
      const g = c.createGain(); g.gain.value = gain;
      let node = src;
      if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); src.connect(p); node = p; }
      node.connect(g); g.connect(this.notes);
      src.start();
    },
    play(id, gain = 1, pan = 0, rate = 1) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const buf = this.buffers.get(id);
      if (!buf) { this.ensure(id, true, gain, pan, rate); return; }
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = buf;
      if (rate && rate !== 1) src.playbackRate.value = rate;
      const g = c.createGain(); g.gain.value = gain;
      let node = src;
      if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); src.connect(p); node = p; }
      node.connect(g);
      g.connect(isVoice(id) ? this.voice : this.sfx);
      src.start();
      if (isVoice(id)) {
        // let the music breathe around the words
        if (this.musicGain && id > 6) { const now = c.currentTime; const mg = this.musicGain.gain; mg.cancelScheduledValues(now); mg.setTargetAtTime(0.35, now, 0.05); mg.setTargetAtTime(1, now + Math.min(6, buf.duration * 0.8), 0.6); }
        const rec = { src, g, tier: id === S.sounds.iam ? 999 : id };
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
      if (cat < 0) {
        if (this.musicSrc) { const old = this.musicSrc, og = this.musicGain, now = this.ctx.currentTime; og.gain.setTargetAtTime(0.0001, now, 1.2); setTimeout(() => { try { old.stop(); } catch { /* */ } }, 6000); this.musicSrc = null; }
        return;
      }
      const id = S.sounds.music0 + cat;
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
      for (const k of [...this.buffers.keys()]) if (isVoice(k)) this.buffers.delete(k);
      if (this.ready) this.worker.postMessage({ type: 'style', style: s });
    },
    // the held breath of creation: a long low choir, faded in and out
    droneSrc: null, droneGain: null,
    drone(on) {
      if (!this.ctx) return;
      const id = S.sounds.sfx0 + 23, c = this.ctx, now = c.currentTime;
      if (on) {
        if (this.droneSrc) return;
        const buf = this.buffers.get(id);
        if (!buf) { this.ensure(id); return; }
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.9, now, 0.35);
        src.connect(g); g.connect(this.music);
        src.start();
        this.droneSrc = src; this.droneGain = g;
        src.onended = () => { if (this.droneSrc === src) { this.droneSrc = null; this.droneGain = null; } };
      } else if (this.droneSrc) {
        const src = this.droneSrc, g = this.droneGain;
        g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, 0.18);
        setTimeout(() => { try { src.stop(); } catch { /* */ } }, 1200);
        this.droneSrc = null; this.droneGain = null;
      }
    },
    toggleMute() {
      this.muted = !this.muted; store.set('omg.muted', this.muted ? '1' : '0');
      this.volumes();
      $('#btn-sound').classList.toggle('muted', this.muted);
    },
  };

  // ───────────────────────── the Genesis narration (one MP3 per language, streamed)
  const story = {
    el: null, node: null, gain: null, lang: null, on: false, failed: false, unlocked: false, held: false, paused: false,
    make() {
      if (this.el) return;
      const el = new Audio();
      el.preload = 'none'; el.playsInline = true; el.setAttribute('playsinline', '');
      el.addEventListener('error', () => { if (this.on) this.failed = true; });
      this.el = el;
    },
    // iOS lets a media element play later only if a tap started it once
    unlock() {
      this.make();
      if (this.unlocked) return;
      this.unlocked = true;
      try {
        const el = this.el;
        el.src = 'story/silence.mp3';
        const pr = el.play();
        if (pr && pr.then) pr.then(() => { el.pause(); el.removeAttribute('src'); el.load(); if (this.lang) { el.src = this.url(this.lang === 'he'); el.load(); } }).catch(() => {});
      } catch { /* old browsers */ }
    },
    url(isHe) { return `story/genesis_${isHe ? 'he' : 'en'}.mp3`; },
    preload(isHe) {
      this.make();
      const l = isHe ? 'he' : 'en';
      if (this.lang === l) return;
      this.lang = l;
      this.el.preload = 'auto';
      this.el.src = this.url(isHe);
      try { this.el.load(); } catch { /* */ }
    },
    route() {
      if (this.node || !audio.ctx) return;
      try {
        this.node = audio.ctx.createMediaElementSource(this.el);
        this.gain = audio.ctx.createGain();
        this.node.connect(this.gain); this.gain.connect(audio.voice);
      } catch { this.node = null; this.gain = null; }
    },
    start(isHe, at = 0) {
      this.preload(isHe);
      audio.ensure(S.sounds.sfx0 + 23); audio.ensure(S.sounds.sfx0 + 24);
      this.on = true; this.failed = false; this.held = false; this.paused = false;
      this.route();
      if (this.gain) { this.gain.gain.cancelScheduledValues(0); this.gain.gain.value = 1; }
      const el = this.el;
      const seek = () => { try { el.currentTime = at || 0; } catch { /* */ } };
      if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
      const pr = el.play();
      if (pr && pr.catch) pr.catch(() => { this.failed = true; });
      $('#story-skip').hidden = false;
      $('#zoom').hidden = true;
      toolsUI(false);
    },
    stop() {
      this.on = false; this.held = false;
      audio.drone(false);
      if (this.el) try { this.el.pause(); } catch { /* */ }
      $('#story-skip').hidden = true;
    },
    // the story waits for the player: the narration goes quiet, the world holds its breath
    hold(at) {
      this.held = true;
      audio.drone(true);
      if (!this.on || this.failed || !this.el) return;
      const el = this.el;
      if (this.gain && audio.ctx) {
        const g = this.gain.gain, now = audio.ctx.currentTime;
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.06);
        setTimeout(() => { if (this.held) { try { el.pause(); el.currentTime = at; } catch { /* */ } } }, 70);
      } else { try { el.pause(); el.currentTime = at; } catch { /* */ } }
    },
    // …and goes on from the moment of creation
    release(at) {
      this.held = false;
      audio.drone(false);
      if (!this.on || this.failed || !this.el || this.paused) return;
      const el = this.el;
      try { el.currentTime = at; } catch { /* */ }
      const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
      if (this.gain && audio.ctx) {
        const g = this.gain.gain, now = audio.ctx.currentTime;
        g.cancelScheduledValues(now); g.setValueAtTime(0, now); g.linearRampToValueAtTime(1, now + 0.08);
      }
    },
    pause(p) {
      this.paused = p;
      if (this.on && this.el && !this.failed && !this.held) { if (p) this.el.pause(); else this.el.play().catch(() => {}); }
    },
    // the story's clock: the narration's position, or −1 to let the engine keep time
    tick() {
      if (!this.on) return;
      const el = this.el;
      X.omg_story_time(this.failed || !el ? -1 : el.currentTime);
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
        case 1: audio.play(a | 0, b, c, d || 1); break;
        case 2: break;
        case 4: showEnd(a, b, c, d | 0); break;
        case 5: persist(); break;
        case 6: if (navigator.vibrate) try { navigator.vibrate(a | 0); } catch { /* */ } break;
        case 7: showOver(a | 0, b | 0, c, d | 0); break;
        case 8: break;
        case 9: audio.duck(a | 0); break;
        case 10: toolsUI(true); break;
        case 11: audio.setMusic(a | 0); break;
        case 12: audio.note(a | 0, b, c, d); break;
        case 14: if (rec.on && rec.reel) rec.stop(); break;
        case 13:
          if (a > 2.5) story.release(b);
          else if (a > 1.5) story.hold(b);
          else if (a > 0.5) story.start(b > 0.5, c);
          else story.stop();
          break;
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
  const perf = { sim: 0, draw: 0, n: 0, fixed: 0 };
  function loop(ts) {
    // perf.fixed (debug): advance a fixed step per frame, so slow captures still see every moment
    const dt = perf.fixed > 0 ? perf.fixed : last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
    last = ts;
    const p0 = performance.now();
    story.tick();
    X.omg_frame(dt);
    events();
    const p1 = performance.now();
    render();
    const p2 = performance.now();
    perf.sim += p1 - p0; perf.draw += p2 - p1; perf.n++;
    if (rec.on) rec.frame(ts);
    toolsTick += dt;
    if (toolsTick > 0.1) { toolsTick = 0; toolsUI(false); }
    requestAnimationFrame(loop);
  }

  // ───────────────────────── input
  function bindInput() {
    const pos = (e) => [e.clientX, e.clientY];
    // two fingers pinch-zoom and pan; one finger taps, tilts, or looks around when zoomed in
    const pts = new Map();
    let pinch = null;
    const mid = () => { const v = [...pts.values()]; return [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2, Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1])]; };
    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock(); story.unlock();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
      pts.set(e.pointerId, pos(e));
      if (pts.size === 2) { X.omg_pointer(3, ...pos(e)); pinch = mid(); return; }
      if (pts.size === 1) X.omg_pointer(0, ...pos(e));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse' && running) X.omg_pointer(4, ...pos(e)); return; }
      pts.set(e.pointerId, pos(e));
      if (pinch && pts.size >= 2) {
        const m = mid();
        if (pinch[2] > 10 && m[2] > 10) X.omg_view(0, m[2] / pinch[2], m[0], m[1]);
        X.omg_view(1, m[0] - pinch[0], m[1] - pinch[1], 0);
        pinch = m; zoomUI();
        return;
      }
      if (!pinch) X.omg_pointer(1, ...pos(e));
    });
    const up = (e, kind) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pinch) { if (pts.size === 0) pinch = null; return; }
      X.omg_pointer(kind, ...pos(e));
    };
    canvas.addEventListener('pointerup', (e) => up(e, 2));
    canvas.addEventListener('pointercancel', (e) => up(e, 3));
    canvas.addEventListener('wheel', (e) => {
      if (!running) return;
      e.preventDefault();
      const k = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0022);
      X.omg_view(0, k, e.clientX, e.clientY); zoomUI();
    }, { passive: false });
    const centre = () => [X.omg_layout(5), X.omg_layout(6)];
    $('#btn-zin').addEventListener('click', () => { X.omg_view(0, 1.6, ...centre()); zoomUI(); });
    $('#btn-zout').addEventListener('click', () => { X.omg_view(0, 1 / 1.6, ...centre()); zoomUI(); });
    $('#btn-zauto').addEventListener('click', () => { X.omg_view(2, 0, 0, 0); zoomUI(); });
    const keys = { ArrowLeft: 1, ArrowRight: 2, ' ': 3, Enter: 3, ArrowDown: 13, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, '+': 10, '=': 10, '-': 11, _: 11, 0: 12 };
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { menuOpen ? closeMenu() : openMenu('modes'); return; }
      if (!running || menuOpen) return;
      if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
      if (e.key === 'm' || e.key === 'M') { audio.toggleMute(); return; }
      const k = keys[e.key];
      if (k && !e.repeat) { e.preventDefault(); audio.unlock(); story.unlock(); X.omg_key(k, 1); if (k >= 10) zoomUI(); }
    });
    window.addEventListener('keyup', (e) => { const k = keys[e.key]; if (k === 1 || k === 2) X.omg_key(k, 0); });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    window.addEventListener('pagehide', () => { if (X) persist(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (running) X.omg_pause(1); persist(); story.pause(true); if (audio.ctx) audio.ctx.suspend().catch(() => {}); }
      else { if (running && !userPaused && !menuOpen) { X.omg_pause(0); story.pause(false); } if (audio.ctx && audio.unlocked) audio.ctx.resume().catch(() => {}); }
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
    const show = running && m !== 1 && !X.omg_info(17);
    box.hidden = !show;
    zoomUI();
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
    const skill = X.omg_info(32) > 0.5;
    [...box.children].forEach((b, i) => {
      const cd = X.omg_tool_state(i, 0), act = X.omg_tool_state(i, 1), ch = X.omg_tool_state(i, 2), armed = X.omg_tool_state(i, 3);
      b.hidden = X.omg_tool_state(i, 4) < 0.5;
      b.style.setProperty('--cd', cd.toFixed(3));
      b.classList.toggle('active', act > 0);
      b.classList.toggle('cooling', cd > 0);
      b.classList.toggle('armed', armed > 0);
      b.classList.toggle('empty', skill && ch < 1);
      const chEl = b.querySelector('.ch');
      chEl.textContent = skill || S.tools[i].key === 'upgrade' ? String(ch | 0) : '';
    });
  }

  function zoomUI() {
    const z = $('#zoom');
    const show = running && !X.omg_info(17) && !X.omg_info(2);
    z.hidden = !show;
    if (show) $('#btn-zauto').classList.toggle('on', X.omg_info(19) > 0.5);
  }

  // ───────────────────────── sandbox picker
  function sandboxUI() {
    const box = $('#sandbox-pick');
    const m = X.omg_info(4) | 0;
    box.hidden = !(running && m === 7);
    if (box.hidden) return;
    box.innerHTML = '';
    for (let k = 0; k < S.god; k++) {
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
    document.title = he ? 'OH MY GOD — מזחילה עד אלוהים · DATTA' : 'OH MY GOD — From Crawling to God · DATTA';
    buildModes();
    buildLadder();
    if (running) { toolsUI(true); sandboxUI(); }
    if (menuOpen) showTab(currentTab);
  }
  function setLang(isHe) { he = isHe; X.omg_set_lang(he ? 1 : 0); applyLang(); persist(); }
  function goHome() {
    if (rec.on) rec.stop();
    closeMenu(true); running = false; story.stop(); X.omg_pause(1); persist();
    $('#start').hidden = false; document.body.classList.add('home');
    buildLadder(); buildModes(); toolsUI(false); sandboxUI();
  }

  function buildLadder() {
    const box = $('#ladder-preview'); box.innerHTML = '';
    for (let k = 0; k < S.n; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 40;
      c.getContext('2d').drawImage(sprite(k), -10, -10, 60, 60);
      if (!X.omg_unlocked(k)) c.className = 'locked';
      c.title = X.omg_unlocked(k) ? tierName(k) : '?';
      box.appendChild(c);
    }
  }
  function buildModes() {
    const box = $('#mode-list'); box.innerHTML = '';
    S.modes.forEach((m, i) => {
      const b = document.createElement('button'); b.className = 'mode' + (i === mode ? ' on' : '') + (i === 0 ? ' journey' : '');
      b.innerHTML = `<b>${m.icon}</b><span>${m[he ? 'he' : 'en']}</span>`;
      b.addEventListener('click', () => { mode = i; store.set('omg.mode', String(i)); buildModes(); });
      box.appendChild(b);
    });
    let d = $('#mode-desc');
    if (!d) { d = document.createElement('p'); d.id = 'mode-desc'; d.className = 'mode-desc'; box.after(d); }
    d.textContent = S.modes[mode][he ? 'dhe' : 'den'];
    // the journey's difficulty
    let dl = $('#diff-list');
    if (!dl) { dl = document.createElement('div'); dl.id = 'diff-list'; dl.className = 'diffs'; $('#btn-play').after(dl); }
    dl.hidden = mode !== 0;
    dl.innerHTML = '';
    if (mode === 0) {
      const cur = Math.round(opt('difficulty'));
      const chips = document.createElement('div'); chips.className = 'chips';
      S.diffs.forEach((df, i) => {
        const c = document.createElement('button'); c.className = 'chip' + (i === cur ? ' on' : ''); c.textContent = df[he ? 'he' : 'en'];
        c.addEventListener('click', () => { X.omg_set_opt(optIndex('difficulty'), i); persist(); buildModes(); });
        chips.appendChild(c);
      });
      const p = document.createElement('p'); p.className = 'diff-desc'; p.textContent = S.diffs[cur] ? S.diffs[cur][he ? 'dhe' : 'den'] : '';
      dl.append(chips, p);
    }
    // continue the journey in progress
    const sj = savedJourney();
    const cb = $('#btn-continue');
    cb.hidden = !sj;
    if (sj) {
      $('#continue-info').textContent = `${S.cats[sj[0]][he ? 'he' : 'en']} · ${fmtTime(sj[1])} · ${S.diffs[sj[2]] ? S.diffs[sj[2]][he ? 'he' : 'en'] : ''}`;
    }
    $('#btn-play').querySelector('span').textContent = mode === 0 && sj ? t('new_journey') : t('play');
    $('#btn-play').classList.toggle('second', mode === 0 && !!sj);
  }

  // a journey kept to continue: [era, seconds, difficulty, tier] or null
  function savedJourney() {
    if (!X || X.omg_run_info(0) < 0.5) return null;
    return [X.omg_run_info(1) | 0, X.omg_run_info(2), X.omg_run_info(3) | 0, X.omg_run_info(4) | 0];
  }
  let confirmNew = 0;
  function enterGame() {
    $('#start').hidden = true; $('#end').hidden = true;
    document.body.classList.remove('home');
    closeMenu(true);
    story.stop();
    running = true; userPaused = false;
    X.omg_pause(0);
    $('#btn-pause').classList.remove('paused');
    lastMax = -1;
    toolsUI(true); sandboxUI();
    audio.prefetch(X.omg_info(5) | 0);
  }
  function startGame(m = mode, force = false) {
    audio.unlock();
    // a new journey replaces the one in progress: ask once
    if (m === 0 && !force && savedJourney() && !(running && X.omg_info(4) === 0 && X.omg_info(2) > 0.5)) {
      if (performance.now() - confirmNew > 4000) { confirmNew = performance.now(); toast(t('new_journey_q')); return; }
    }
    confirmNew = 0;
    mode = m; store.set('omg.mode', String(m));
    X.omg_start(m);
    enterGame();
    persist();
  }
  function continueJourney() {
    audio.unlock(); story.unlock();
    mode = 0; store.set('omg.mode', '0');
    if (!X.omg_continue()) { startGame(0, true); return; }
    enterGame();
  }
  function retryEra() {
    audio.unlock();
    X.omg_retry();
    $('#end').hidden = true;
    if (!running) enterGame();
    toolsUI(true);
  }
  function togglePause() {
    userPaused = !userPaused;
    X.omg_pause(userPaused || menuOpen ? 1 : 0);
    story.pause(userPaused);
    $('#btn-pause').classList.toggle('paused', userPaused);
    if (audio.ctx) userPaused ? audio.ctx.suspend().catch(() => {}) : audio.ctx.resume().catch(() => {});
  }
  function fmtTime(s) {
    if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.floor((s - h * 3600) / 60), r = Math.floor(s % 60); return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }
    const m = Math.floor(s / 60); const r = s - m * 60; return `${m}:${String(Math.floor(r)).padStart(2, '0')}.${Math.floor((r % 1) * 10)}`;
  }

  // a big number for the menus (HTML): 12, 3.4K … 1.2T, then 10 with a raised exponent, always left to right
  function fmtPow(log10, prefix = '') {
    if (!(log10 >= 0)) return '0';
    let v;
    if (log10 < 15) { const x = Math.pow(10, log10); v = x < 1e3 ? String(Math.round(x)) : x < 1e6 ? (x / 1e3).toFixed(1) + 'K' : x < 1e9 ? (x / 1e6).toFixed(1) + 'M' : x < 1e12 ? (x / 1e9).toFixed(1) + 'B' : (x / 1e12).toFixed(1) + 'T'; }
    else v = `10<sup>${Math.floor(log10)}</sup>`;
    return `<span dir="ltr" class="num">${prefix}${v}</span>`;
  }
  // the road this run took: every era it reached, with its first ride and the time it got there
  function evolutionUI() {
    let box = $('#end-evo');
    if (!box) { box = document.createElement('div'); box.id = 'end-evo'; $('#end-stats').after(box); }
    box.innerHTML = '';
    const head = document.createElement('div'); head.className = 'evo-h'; head.textContent = t('evolution');
    const row = document.createElement('div'); row.className = 'evo-row';
    const n = S.ncats || 20;
    for (let c = 0; c < n; c++) {
      const at = X.omg_era_time(c);
      const first = S.tiers.findIndex((T) => T.cat === c);
      const it = document.createElement('div'); it.className = 'evo-it' + (at >= 0 ? '' : ' off');
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      if (at >= 0 && first >= 0) cv.getContext('2d').drawImage(sprite(first), -16, -16, 96, 96);
      const lb = document.createElement('span'); lb.textContent = at >= 0 ? fmtTime(at).replace(/\.\d$/, '') : '';
      it.title = `${S.cats[c][he ? 'he' : 'en']}${at >= 0 ? ' · ' + fmtTime(at) : ''}`;
      it.append(cv, lb); row.appendChild(it);
    }
    box.append(head, row);
  }
  function showEnd(time, merges, drops, m) {
    const el = $('#end'); el.classList.add('god'); el.classList.remove('burst');
    endKind = 'god';
    $('#btn-again').textContent = t('again');
    $('#btn-end-rec').hidden = false;
    $('#end-title').textContent = t('end_title');
    $('#end-sub').textContent = t('end_story');
    const best = X.omg_stat(10 + m);
    const st = $('#end-stats'); st.classList.add('five'); st.classList.toggle('six', m === 0);
    st.innerHTML = `<div><dt>${t('end_time')}</dt><dd>${fmtTime(time)}</dd></div><div><dt>${t('end_merges')}</dt><dd>${merges | 0}</dd></div><div><dt>${t('end_drops')}</dt><dd>${drops | 0}</dd></div>`
      + `<div><dt>👶 ${t('end_babies')}</dt><dd>${fmtPow(X.omg_info(15))}</dd></div><div><dt>🔍 ${t('end_zoom')}</dt><dd>${fmtPow(X.omg_info(16), '×')}</dd></div>`
      + (m === 0 ? `<div><dt>💥 ${t('bursts')}</dt><dd>${X.omg_info(35) | 0}</dd></div>` : '');
    evolutionUI();
    const rec = $('#end-record');
    rec.classList.remove('mercy');
    rec.hidden = !(best > 0 && Math.abs(best - time) < 0.05 && [0, 2, 3, 4, 5].includes(m));
    rec.textContent = t('end_record');
    $('#btn-stay').hidden = false;
    el.hidden = false;
    persist();
  }
  let endKind = '';
  function showOver(reason, top, time, era) {
    const el = $('#end'); el.classList.remove('god');
    $('#end-stats').classList.remove('five', 'six');
    if (reason === 2) {
      // the journey: the bubble burst under the strain — back to the start of the era
      endKind = 'burst';
      el.classList.add('burst');
      $('#end-title').textContent = t('burst_title');
      $('#end-sub').textContent = `${t('burst_sub')}: ${S.cats[era] ? S.cats[era][he ? 'he' : 'en'] : ''}`;
      $('#end-stats').innerHTML = `<div><dt>${t('attempt')}</dt><dd>${(X.omg_info(34) | 0) + 1}</dd></div><div><dt>${t('end_time')}</dt><dd>${fmtTime(time)}</dd></div><div><dt>${t('tier')}</dt><dd>${top + 1}/${S.n}</dd></div>`;
      evolutionUI();
      // every burst in the same era makes the bubble a little more patient
      const mercy = $('#end-record');
      mercy.textContent = t(X.omg_info(45) > 0.5 ? 'mercy' : 'mercy_max');
      mercy.classList.add('mercy');
      mercy.hidden = false;
      $('#btn-again').textContent = t('retry');
      $('#btn-stay').hidden = true;
      $('#btn-end-rec').hidden = true;
      el.hidden = false;
      persist();
      return;
    }
    endKind = 'over';
    el.classList.remove('burst');
    $('#end-record').classList.remove('mercy');
    $('#btn-again').textContent = t('again');
    $('#btn-end-rec').hidden = false;
    $('#end-title').textContent = reason === 1 ? t('over_time') : t('over_jam');
    $('#end-sub').textContent = `${t('over_reached')}: ${tierName(top)}`;
    $('#end-stats').innerHTML = `<div><dt>${t('tier')}</dt><dd>${top + 1}/${S.n}</dd></div><div><dt>${t('end_time')}</dt><dd>${fmtTime(time)}</dd></div><div><dt>${t('end_merges')}</dt><dd>${X.omg_info(8) | 0}</dd></div>`;
    evolutionUI();
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
    let cont = null;
    if (savedJourney() && !(running && X.omg_info(4) === 0)) {
      cont = document.createElement('button'); cont.className = 'cta'; cont.textContent = t('continue');
      cont.addEventListener('click', () => continueJourney());
    }
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;gap:14px;justify-items:center';
    wrap.append(list, desc, go);
    if (cont) wrap.prepend(cont);
    const how = document.createElement('div'); how.className = 'about';
    const laws = S.laws.map((l, e) => {
      if (!l.icon) return '';
      const met = !!X.omg_unlocked(S.cats[e].first);
      return `<li><b>${met ? l.icon : '?'}</b><span><strong>${S.cats[e][he ? 'he' : 'en']} · ${met ? l[he ? 'he' : 'en'] : '???'}</strong>${met ? ' — ' + l[he ? 'dhe' : 'den'] : ''}</span></li>`;
    }).join('');
    how.innerHTML = `<h3>${t('how')}</h3><ul class="how"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ul><h3>${t('laws')}</h3><ul class="tool-list">${laws}</ul><h3>${t('tools')}</h3><ul class="tool-list">${S.tools.map((x) => `<li><b>${x.icon}</b><span><strong>${x[he ? 'he' : 'en']}</strong> — ${x[he ? 'dhe' : 'den']}</span></li>`).join('')}</ul>`;
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
    if (key === 'ballstyle') { ballStyle = Math.round(opt('ballstyle')); buildLadder(); }
    persist();
  }
  function tabGarage(body) {
    let n = 0; for (let k = 0; k < S.n; k++) n += X.omg_unlocked(k);
    const p = document.createElement('p'); p.className = 'count'; p.textContent = `${t('unlocked')}: ${n}/${S.n}`;
    body.appendChild(p);
    const grid = document.createElement('div'); grid.className = 'garage';
    let lastCat = -1;
    S.tiers.forEach((T, k) => {
      if (T.cat !== lastCat) { lastCat = T.cat; const h = document.createElement('div'); h.className = 'cat-h'; h.textContent = `${S.cats[T.cat][he ? 'he' : 'en']}${S.cats[T.cat][he ? 'she' : 'sen'] ? ' · ' + S.cats[T.cat][he ? 'she' : 'sen'] : ''}`; h.style.color = S.cats[T.cat].accent; grid.appendChild(h); }
      const open = !!X.omg_unlocked(k);
      const c = document.createElement('button'); c.className = 'card' + (open ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      const g = cv.getContext('2d'); if (!open) g.filter = 'grayscale(1) brightness(.5)'; g.drawImage(sprite(k, true), -28, -28, 168, 168);
      const info = document.createElement('div');
      const wide = k > 0 && k < S.god ? ` · 👶${fmtPow(k * Math.log10(opt('sizegrow')), '×')}` : '';
      info.innerHTML = `<div class="n">${t('tier')} ${k + 1}${open ? wide : ''}</div><div class="t">${open ? T[he ? 'he' : 'en'] : '???'}</div><div class="b">${open ? T[he ? 'bhe' : 'ben'] : t('locked')}</div>`;
      c.append(cv, info);
      if (open) c.addEventListener('click', () => { audio.unlock(); audio.play(k, 1, 0); });
      grid.appendChild(c);
    });
    body.appendChild(grid);
  }
  function tabStats(body) {
    const rows = [
      ['s_runs', X.omg_stat(0) | 0], ['s_merges', X.omg_stat(1) | 0], ['s_omgs', X.omg_stat(2) | 0], ['s_drops', X.omg_stat(3) | 0],
      ['s_gods', X.omg_stat(4) | 0], ['s_played', fmtTime(X.omg_stat(5))], ['s_top', tierName(X.omg_stat(6) | 0)], ['s_combo', `×${X.omg_stat(8) | 0}`],
    ];
    const ta = X.omg_stat(7) | 0; if (ta > 0) rows.push(['s_ta', tierName(ta)]);
    const box = document.createElement('div'); box.className = 'stats';
    for (const [k, v] of rows) box.insertAdjacentHTML('beforeend', `<div>${t(k)}</div><div>${v}</div>`);
    S.modes.forEach((m, i) => { if (i === 0) return; const b = X.omg_stat(10 + i); if (b > 0) box.insertAdjacentHTML('beforeend', `<div>${t('best')} · ${m[he ? 'he' : 'en']}</div><div>${fmtTime(b)}</div>`); });
    S.diffs.forEach((df, i) => { const b = X.omg_best_journey(i); if (b > 0) box.insertAdjacentHTML('beforeend', `<div>${t('s_journey')} · ${df[he ? 'he' : 'en']}</div><div>${fmtTime(b)}</div>`); });
    body.appendChild(box);
  }
  function tabAbout(body) {
    const d = document.createElement('div'); d.className = 'about';
    d.innerHTML = `<h3>${t('how')}</h3><ul class="how"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ul><h3>${t('credits')}</h3><p>${t('credits_body')}</p><p>${t('not_brands')}</p><p><a href="${he ? '../he/' : '../en/'}">${t('site')}</a></p>`;
    body.appendChild(d);
  }

  // ───────────────────────── reel recording
  // The video is the 9:16 heart of the stage, copied 30 times a second into a canvas of its own, with the game's sound.
  const UA = navigator.userAgent || '';
  const WEBKIT = /AppleWebKit/.test(UA) && !/Chrome|Chromium|Edg\/|OPR\//.test(UA);
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const rec = {
    on: false, reel: false, mr: null, chunks: [], cv: null, cx: null, mime: '', last: 0, t0: 0, dur: 0, url: '',
    // H.264 + AAC in MP4 opens everywhere: phones, editors, every app. WebM only where MP4 can't be made.
    pick() {
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
      const ok = (ty) => { try { return MediaRecorder.isTypeSupported(ty); } catch { return false; } };
      // Safari, and every browser on an iPhone, makes H.264 + AAC for plain MP4
      if (WEBKIT && ok('video/mp4')) return 'video/mp4';
      // elsewhere plain MP4 may hold VP9, which phones won't play: ask for H.264 by name
      for (const ty of ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d4028,mp4a.40.2', 'video/mp4;codecs=avc1.42e028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.640028,opus', 'video/mp4;codecs=avc1,opus']) if (ok(ty)) return ty;
      for (const ty of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (ok(ty)) return ty;
      return ok('video/mp4') ? 'video/mp4' : '';
    },
    start(reel) {
      if (this.on) { this.stop(); return false; }
      audio.unlock();
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast(t('record_unsupported')); return false; }
      const small = !!navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
      const cv = document.createElement('canvas'); cv.width = small ? 720 : 1080; cv.height = small ? 1280 : 1920;
      // Safari only records a canvas that is part of the page
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;opacity:0;pointer-events:none';
      document.body.appendChild(cv);
      this.cv = cv; this.cx = cv.getContext('2d', { alpha: false }) || cv.getContext('2d');
      this.last = 0; this.frame(performance.now(), true);
      const tracks = [...cv.captureStream(30).getVideoTracks()];
      if (audio.recDest) tracks.push(...audio.recDest.stream.getAudioTracks());
      this.mime = this.pick();
      const o = { videoBitsPerSecond: small ? 5_000_000 : 8_000_000, audioBitsPerSecond: 160_000 };
      let mr = null;
      try { mr = new MediaRecorder(new MediaStream(tracks), this.mime ? { ...o, mimeType: this.mime } : o); } catch { try { mr = new MediaRecorder(new MediaStream(tracks)); } catch { mr = null; } }
      if (!mr) { toast(t('record_unsupported')); this.drop(); return false; }
      this.mr = mr; this.chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      mr.onstop = () => this.done();
      mr.onerror = () => { toast(t('record_failed')); this.stop(); };
      // Safari hands over the whole file at the end; elsewhere it comes in one-second pieces
      try { if (WEBKIT) mr.start(); else mr.start(1000); } catch { toast(t('record_unsupported')); this.mr = null; this.drop(); return false; }
      this.on = true; this.reel = !!reel; this.t0 = performance.now();
      $('#btn-rec').classList.add('on'); $('#rec-badge').hidden = false;
      return true;
    },
    frame(now, force) {
      if (!this.cx) return;
      // the recording keeps 30 frames a second; drawing more would only take time from the game
      if (!force && now - this.last < 1000 / 31) return;
      this.last = now;
      const W = this.cv.width, H = this.cv.height;
      const cw = stage.w, ch = Math.min(stage.h, cw * 16 / 9);
      const top = Math.max(stage.y, Math.min(stage.y + stage.h - ch, (stage.cy || stage.y + stage.h / 2) - ch * 0.47));
      this.cx.fillStyle = '#000'; this.cx.fillRect(0, 0, W, H);
      this.cx.drawImage(canvas, stage.x * DPR, top * DPR, cw * DPR, ch * DPR, 0, 0, W, H);
      if (this.on) {
        const len = this.reel ? X.omg_info(50) : 0;
        $('#rec-badge span').textContent = `REC ${clock((now - this.t0) / 1000)}${len > 0 ? ` / ~${clock(len)}` : ''}`;
      }
    },
    stop() {
      if (this.reel) { try { X.omg_reel(-1); } catch { /* */ } }
      this.reel = false;
      const mr = this.mr;
      if (this.on) this.dur = (performance.now() - this.t0) / 1000;
      this.on = false; $('#btn-rec').classList.remove('on'); $('#rec-badge').hidden = true;
      if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch { this.done(); } }
      else if (this.chunks.length) this.done();
      else this.drop();
    },
    drop() { if (this.cv) this.cv.remove(); this.cv = null; this.cx = null; },
    async done() {
      const type = ((this.mr && this.mr.mimeType) || this.mime || 'video/webm').split(';')[0].trim() || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      let blob = new Blob(this.chunks, { type });
      this.chunks = []; this.mr = null; this.drop();
      if (!blob.size) { toast(t('record_failed')); return; }
      // a recorder's WebM doesn't say how long it is, and players then can't show or seek it
      if (ext === 'webm') { try { blob = await webmWithDuration(blob, this.dur * 1000); } catch { /* keep it as it is */ } }
      if (this.url) URL.revokeObjectURL(this.url);
      const url = this.url = URL.createObjectURL(blob);
      const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
      const name = `oh-my-god-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.${ext}`;
      const file = new File([blob], name, { type });
      $('#video-preview').src = url;
      const mb = blob.size / 1048576;
      $('#video-info').textContent = `${clock(this.dur)} · 9:16 · ${mb.toFixed(mb < 10 ? 1 : 0)} MB · ${ext.toUpperCase()}`;
      const a = $('#video-save'); a.href = url; a.download = name;
      a.onclick = async (e) => {
        // on phones the share sheet saves straight to the photos
        let can = false;
        try { can = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch { can = false; }
        if (!can) { setTimeout(() => toast(t('record_downloaded')), 400); return; } // the link downloads it
        e.preventDefault();
        try { await navigator.share({ files: [file] }); } catch (err) {
          if (err && err.name === 'AbortError') return;
          // the sheet couldn't open: download it instead
          const l = document.createElement('a'); l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove();
          toast(t('record_downloaded'));
        }
      };
      $('#video-ready').hidden = false;
    },
  };

  // A recorder's WebM has no length in its header: write one in, so players can show and seek it.
  async function webmWithDuration(blob, ms) {
    const head = new Uint8Array(await blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer());
    const idAt = (i) => { const b = head[i]; let n = 1; while (n <= 4 && !(b & (0x80 >> (n - 1)))) n++; let v = 0; for (let k = 0; k < n; k++) v = v * 256 + head[i + k]; return [v, n]; };
    const sizeAt = (i) => {
      const b = head[i]; let n = 1; while (n <= 8 && !(b & (0x80 >> (n - 1)))) n++;
      const mask = (0x80 >> (n - 1)) - 1; let v = b & mask, ones = v === mask;
      for (let k = 1; k < n; k++) { v = v * 256 + head[i + k]; if (head[i + k] !== 0xff) ones = false; }
      return [v, n, ones];
    };
    let [id, n] = idAt(0); if (id !== 0x1a45dfa3) return blob;
    let [sz, m] = sizeAt(n); let i = n + m + sz;
    [id, n] = idAt(i); if (id !== 0x18538067) return blob;
    [sz, m] = sizeAt(i + n); i += n + m; // inside the segment
    while (i < head.length - 12) {
      [id, n] = idAt(i);
      const [csz, cm, unknown] = sizeAt(i + n);
      const body = i + n + cm;
      if (id === 0x1549a966 && !unknown && body + csz <= head.length) { // Info
        let j = body, scale = 1e6, at = -1, len = 0;
        while (j < body + csz) {
          const [kid, kn] = idAt(j); const [ksz, km] = sizeAt(j + kn); const kb = j + kn + km;
          if (kid === 0x2ad7b1) { let v = 0; for (let q = 0; q < ksz; q++) v = v * 256 + head[kb + q]; scale = v || 1e6; }
          if (kid === 0x4489) { at = kb; len = ksz; }
          j = kb + ksz;
        }
        const val = ms * 1e6 / scale;
        if (at >= 0) {
          if (len !== 8 && len !== 4) return blob;
          const out = new Uint8Array(await blob.arrayBuffer());
          const dv = new DataView(out.buffer, at, len);
          if (len === 8) dv.setFloat64(0, val); else dv.setFloat32(0, val);
          return new Blob([out], { type: blob.type });
        }
        // add a Duration (an 8-byte float) at the end of Info, and write Info's new size on 8 bytes
        const add = new Uint8Array(11); add.set([0x44, 0x89, 0x88]); new DataView(add.buffer).setFloat64(3, val);
        const size8 = new Uint8Array(8); size8[0] = 0x01;
        let x = csz + add.length; for (let k = 7; k >= 1; k--) { size8[k] = x % 256; x = Math.floor(x / 256); }
        return new Blob([blob.slice(0, i + n), size8, blob.slice(body, body + csz), add, blob.slice(body + csz)], { type: blob.type });
      }
      if (unknown) break;
      i = body + csz;
    }
    return blob;
  }

  // ───────────────────────── the record sheet: a reel from the start, or the screen from here
  // the automatic modes a reel can be made of; anything else makes its reel in Watch
  const reelMode = () => ([1, 2, 3, 4, 5].includes(mode) ? mode : 1);
  let sheetPaused = false;
  function openRecSheet() {
    if (rec.on) { rec.stop(); return; }
    audio.unlock();
    const chipsFor = (key, box) => {
      const i = optIndex(key), o = S.opts[i]; box.innerHTML = '';
      o.choices.forEach((c) => {
        const b = document.createElement('button'); b.className = 'chip' + (Math.abs(c[2] - X.omg_get_opt(i)) < 1e-3 ? ' on' : ''); b.textContent = c[he ? 0 : 1];
        b.addEventListener('click', () => { X.omg_set_opt(i, c[2]); [...box.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); persist(); });
        box.appendChild(b);
      });
    };
    chipsFor('reel', $('#rec-len')); chipsFor('kickoff', $('#rec-kick'));
    $('#rec-note').textContent = reelMode() === mode ? t('reel_auto') : `${t('reel_auto')} ${t('reel_watch')}`;
    $('#btn-rec-here').hidden = !running;
    $('#rec-sheet').hidden = false;
    sheetPaused = running && !userPaused;
    if (sheetPaused) X.omg_pause(1);
  }
  function closeRecSheet() {
    $('#rec-sheet').hidden = true;
    if (sheetPaused && running && !userPaused && !menuOpen) X.omg_pause(0);
    sheetPaused = false;
  }
  function startReel() {
    closeRecSheet();
    $('#end').hidden = true; $('#video-ready').hidden = true;
    story.unlock();
    startGame(reelMode(), true);
    const len = opt('reel');
    X.omg_reel(len);
    if (!rec.start(true)) { X.omg_reel(-1); return; }
    toast(len > 0 ? t('reel_started').replace('{t}', clock(len)) : t('reel_started_full'));
  }
  function recordHere() { closeRecSheet(); if (rec.start(false)) toast(t('recording')); }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  // ───────────────────────── wiring
  function bindUI() {
    $('#btn-play').addEventListener('click', () => { story.unlock(); startGame(mode); });
    $('#btn-continue').addEventListener('click', () => continueJourney());
    $('#btn-lang').addEventListener('click', () => setLang(!he));
    $('#btn-start-settings').addEventListener('click', () => openMenu('settings'));
    $('#btn-menu').addEventListener('click', () => { audio.unlock(); openMenu('modes'); });
    $('#btn-close').addEventListener('click', () => closeMenu());
    $('#btn-resume').addEventListener('click', () => closeMenu());
    $('#btn-restart').addEventListener('click', () => startGame(X.omg_info(4) | 0));
    $('#btn-end-home').addEventListener('click', () => { $('#end').hidden = true; goHome(); });
    $('#btn-home').addEventListener('click', () => goHome());
    $('#story-skip').addEventListener('click', () => { X.omg_story_skip(); });
    $('#btn-sound').addEventListener('click', () => { audio.unlock(); audio.toggleMute(); });
    $('#btn-pause').addEventListener('click', () => togglePause());
    $('#btn-rec').addEventListener('click', () => openRecSheet());
    $('#btn-reel').addEventListener('click', () => startReel());
    $('#btn-rec-here').addEventListener('click', () => recordHere());
    $('#btn-rec-close').addEventListener('click', () => closeRecSheet());
    $('#btn-again').addEventListener('click', () => { if (endKind === 'burst') retryEra(); else startGame(X.omg_info(4) | 0, true); });
    $('#btn-stay').addEventListener('click', () => { $('#end').hidden = true; });
    $('#btn-end-rec').addEventListener('click', () => startReel());
    $('#video-close').addEventListener('click', () => { $('#video-ready').hidden = true; });
    $('#btn-sound').classList.toggle('muted', audio.muted);
  }

  // ?sheet — every ball as the game draws it (for checking the artwork)
  function debugSheet() {
    const st = +((location.search.match(/style=(\d)/) || [])[1] || 0);
    const cols = 8, cell = 120, rows = Math.ceil(S.n / cols);
    const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * (cell + 18);
    c.style.cssText = 'position:fixed;inset:0;z-index:99;background:#202028;width:' + (cols * cell / 2) + 'px';
    const g = c.getContext('2d'); g.fillStyle = '#202028'; g.fillRect(0, 0, c.width, c.height);
    g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ddd';
    for (let k = 0; k < S.n; k++) {
      const x = (k % cols) * cell, y = Math.floor(k / cols) * (cell + 18);
      g.drawImage(sprite(k, true, st), x - cell * 0.25, y - cell * 0.25, cell * 1.5, cell * 1.5);
      g.fillStyle = '#ddd'; g.fillText(`${k + 1}. ${S.tiers[k].key}`, x + cell / 2, y + cell + 12);
    }
    document.body.appendChild(c);
    document.querySelectorAll('.screen').forEach((e) => { e.hidden = true; });
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
    try { iconBundle = await (await fetch('icons/all.json')).json(); } catch { iconBundle = null; }
    const keys = [...new Set(S.tiers.map((x) => x.icon).filter(Boolean).concat(S.story_icons || []))];
    await Promise.all(keys.map(loadIcon));
    iconBundle = null;
    ballStyle = Math.round(opt('ballstyle'));
    try { await document.fonts.load('800 20px Assistant'); } catch { /* */ }
    bindInput(); bindUI(); applyLang();
    $('#loading').hidden = true;
    if (!$('#start').hidden) document.body.classList.add('home');
    audio.create();
    if (/[?&]play/.test(location.search)) startGame(mode);
    if (/[?&]sheet/.test(location.search)) debugSheet();
    requestAnimationFrame(loop);
  }
  boot().catch((e) => { console.error(e); const l = $('#loading'); l.hidden = false; l.textContent = 'WebAssembly failed to load: ' + (e && e.message); });
  window.__omg = { get X() { return X; }, get S() { return S; }, audio, story, startGame, openMenu, perf, rec, webmWithDuration };
})();
