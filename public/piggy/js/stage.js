/* The stage: the pig, the rosette behind it, and everything that flies into the slot.
 * Money is animated with the Web Animations API inside a fixed layer whose bottom edge
 * is the slot line, so a coin really disappears into the pig. */

import { CONFIG, MONEY } from './config.js';
import { pigMarkup, rosetteMarkup, moneyMarkup, hammerMarkup, MONEY_VIEW, HAMMER_VIEW, varPaint } from './art.js';
import { FX } from './fx.js';

const PIG_ID = 'pig';
const GLAZE_VAR = 'pig';
const GLAZE_ROLES = Object.freeze(['light', 'base', 'dark', 'deep', 'blush']);
const DIV = 'div';
const SEL = Object.freeze({ slot: '.pig-slot', eye: '.pig-eye' });
const CLS = Object.freeze({
  flying: 'flying',
  float: 'float',
  hammer: 'hammer-wrap',
  blink: 'is-blink',
  happy: 'is-happy',
  wag: 'is-wag',
  cracked: 'is-cracked',
  gilding: 'is-gilding',
  gone: 'is-gone',
});
const EASE = Object.freeze({
  out: 'cubic-bezier(.2,.8,.2,1)',
  in: 'cubic-bezier(.55,0,1,.45)',
  linear: 'linear',
  spring: 'cubic-bezier(.25,1.6,.45,1)',
  swing: 'cubic-bezier(.6,0,.9,.4)',
});
const FILL = 'both'; // hold the first frame during a delay, and the last one after
const SLOT_FIT = 0.92;
const ENTRY_GAP = 2;
const SPARK_COLORS = Object.freeze(['#F2D37C', '#FFF4CF', '#FFFFFF', '#E2B24B']);
const CONFETTI_COLORS = Object.freeze(['#F2D37C', '#EFC556', '#FFF4CF', '#F39CB4', '#9FCCF3', '#FFFFFF']);
const COIN_COLORS = Object.freeze(['#E2B24B', '#F1C24C', '#C9CED4', '#EFC556']);

const rand = (min, max) => min + Math.random() * (max - min);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lerp = (a, b, k) => a + (b - a) * k;

function restart(el, className) {
  el.classList.remove(className);
  el.getBoundingClientRect(); // flush, so the animation starts over
  el.classList.add(className);
}

export function createStage({ dom, fx, isReduced, isRtl }) {
  dom.pigArt.innerHTML = pigMarkup({ paint: varPaint(GLAZE_VAR), id: PIG_ID });
  dom.rosette.innerHTML = rosetteMarkup(CONFIG.rosette);
  const art = dom.pigArt.firstElementChild;
  const slot = art.querySelector(SEL.slot);
  const eye = art.querySelector(SEL.eye);
  const live = { squash: null, jump: null, shadow: null, rosette: null };
  let rosetteAngle = 0;
  let happyTimer = 0;
  let busy = false;

  /* ── geometry ── */

  function slotOnScreen() {
    const r = slot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }

  function flyer(kind, look, width) {
    const el = document.createElement(DIV);
    el.className = CLS.flying;
    el.innerHTML = moneyMarkup(kind, look);
    const view = MONEY_VIEW[kind];
    const w = width;
    const h = (width * view.h) / view.w;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    dom.clip.append(el);
    return { el, w, h, at: (cx, cy, rest = '') => `translate(${cx - w / 2}px, ${cy - h / 2}px) ${rest}` };
  }

  /* ── flight paths, one per kind of money ── */

  function coinPath(size, s, look) {
    const m = CONFIG.motion.coin;
    const f = flyer(MONEY.COIN, look, size.flight);
    const x = s.x + rand(-m.jitter, m.jitter);
    const apex = s.y - m.rise - f.h / 2;
    const total = m.popMs + m.fallMs;
    const frames = [
      { transform: f.at(x, apex + f.h * 0.6, 'scale(.25) rotateY(0deg)'), opacity: 0, offset: 0, easing: EASE.out },
      { transform: f.at(x, apex, 'scale(1) rotateY(180deg)'), opacity: 1, offset: m.popMs / total, easing: EASE.in },
      { transform: f.at(s.x, s.y + f.h / 2 + ENTRY_GAP, `scale(1) rotateY(${m.spins * 360}deg)`), opacity: 1, offset: 1 },
    ];
    return { el: f.el, animation: f.el.animate(frames, { duration: total, fill: FILL }) };
  }

  function billPath(size, s, look) {
    const m = CONFIG.motion.bill;
    const f = flyer(MONEY.BILL, look, size.flight);
    const top = s.y - m.rise - f.h;
    const end = s.y + f.h / 2 + ENTRY_GAP;
    const squeeze = Math.min(1, (s.w * SLOT_FIT) / f.w);
    const frames = [];
    for (let i = 0; i <= m.steps; i++) {
      const k = i / m.steps;
      const calm = 1 - k;
      const phase = k * m.waves * Math.PI * 2;
      const cx = s.x + Math.sin(phase) * m.sway * calm;
      const cy = lerp(top, end, 0.35 * k + 0.65 * k * k);
      const tilt = Math.cos(phase) * m.tilt * calm;
      const flutter = Math.sin(phase * 1.5) * 35 * calm;
      const sx = k > 0.8 ? lerp(1, squeeze, (k - 0.8) / 0.2) : 1;
      frames.push({ transform: f.at(cx, cy, `rotate(${tilt}deg) rotateX(${flutter}deg) scale(${sx}, 1)`), opacity: i ? 1 : 0, offset: k });
    }
    return { el: f.el, animation: f.el.animate(frames, { duration: m.fallMs, easing: EASE.linear, fill: FILL }) };
  }

  function barPath(size, s, look) {
    const m = CONFIG.motion.bar;
    const f = flyer(MONEY.BAR, look, size.flight);
    const top = s.y - m.rise - f.h;
    const touch = s.y - f.h / 2;
    const end = s.y + f.h / 2 + ENTRY_GAP;
    const squeeze = Math.min(1, (s.w * SLOT_FIT) / f.w);
    const frames = [
      { transform: f.at(s.x, top, 'rotate(-10deg) scale(.6)'), opacity: 0, offset: 0, easing: EASE.out },
      { transform: f.at(s.x, top + 24, 'rotate(-5deg) scale(1)'), opacity: 1, offset: 0.14, easing: EASE.in },
      { transform: f.at(s.x, touch, 'rotate(0deg) scale(1, 1)'), opacity: 1, offset: m.squeezeAt, easing: EASE.linear },
      { transform: f.at(s.x, end, `rotate(0deg) scale(${squeeze}, 1)`), opacity: 1, offset: 1 },
    ];
    return { el: f.el, animation: f.el.animate(frames, { duration: m.fallMs, fill: FILL }) };
  }

  const PATHS = Object.freeze({ [MONEY.COIN]: coinPath, [MONEY.BILL]: billPath, [MONEY.BAR]: barPath });

  function showerCoin(s, look, delay, onEnter) {
    const m = CONFIG.motion.shower;
    const f = flyer(MONEY.COIN, look, m.width);
    const x = s.x + rand(-1, 1) * s.w * m.spread;
    const top = s.y - m.rise * rand(0.7, 1.2) - f.h;
    const frames = [
      { transform: f.at(x, top, 'rotateY(0deg)'), opacity: 0, offset: 0 },
      { transform: f.at(x, top + 10, 'rotateY(90deg)'), opacity: 1, offset: 0.1, easing: EASE.in },
      { transform: f.at(s.x, s.y + f.h / 2 + ENTRY_GAP, 'rotateY(720deg)'), opacity: 1, offset: 1 },
    ];
    const animation = f.el.animate(frames, { duration: m.fallMs, delay, fill: FILL });
    animation.onfinish = () => { f.el.remove(); onEnter(); };
    return () => { animation.cancel(); f.el.remove(); };
  }

  /**
   * drop(size, look, { onEnter, onShowerCoin, showerLook }) — fly one piece of money into the slot.
   * Returns cancel(), which stops it before it lands (used by undo).
   */
  function drop(size, look, { onEnter, onShowerCoin, showerLook }) {
    if (isReduced()) {
      const timer = setTimeout(onEnter, CONFIG.motion.coin.popMs);
      return () => clearTimeout(timer);
    }
    const s = slotOnScreen();
    dom.clip.style.height = `${Math.max(0, s.y)}px`;
    const { el, animation } = PATHS[size.money](size, s, look);
    const cancels = [];
    let landed = false;
    animation.onfinish = () => {
      landed = true;
      el.remove();
      onEnter();
      for (let i = 0; i < size.shower; i++) {
        cancels.push(showerCoin(s, showerLook, CONFIG.motion.shower.delayMs + i * CONFIG.motion.shower.gapMs, () => {
          sparkle(size, CONFIG.motion.shower.scale);
          onShowerCoin?.();
        }));
      }
    };
    return () => {
      if (!landed) { animation.cancel(); el.remove(); }
      cancels.forEach((cancel) => cancel());
    };
  }

  /* ── reactions ── */

  function happy() {
    art.classList.add(CLS.happy);
    clearTimeout(happyTimer);
    happyTimer = setTimeout(() => art.classList.remove(CLS.happy), CONFIG.timing.happyMs);
  }

  function turnRosette(degrees) {
    if (isReduced()) return;
    const from = rosetteAngle;
    rosetteAngle += degrees;
    live.rosette?.cancel();
    live.rosette = dom.rosette.animate(
      [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${rosetteAngle}deg)` }],
      { duration: CONFIG.motion.rosette.turnMs, easing: EASE.spring, fill: FILL },
    );
  }

  /** Squash, hop, wag and grin — harder for a bigger no. */
  function react(size, strength = 1) {
    happy();
    if (isReduced()) return;
    const ms = CONFIG.motion.pigReactMs;
    const s = size.squash * strength;
    const hop = size.hop * strength;
    [live.squash, live.jump, live.shadow].forEach((a) => a?.cancel());
    live.squash = dom.pigSquash.animate([
      { transform: 'scale(1, 1)' },
      { transform: `scale(${1 + s * 0.7}, ${1 - s})`, offset: 0.16 },
      { transform: `scale(${1 - s * 0.35}, ${1 + s * 0.5})`, offset: 0.42 },
      { transform: `scale(${1 + s * 0.18}, ${1 - s * 0.16})`, offset: 0.74 },
      { transform: 'scale(1, 1)' },
    ], { duration: ms, easing: EASE.out });
    live.jump = dom.pigJump.animate([
      { transform: 'translateY(0px)' },
      { transform: 'translateY(0px)', offset: 0.16, easing: EASE.out },
      { transform: `translateY(${-hop}px)`, offset: 0.42, easing: EASE.in },
      { transform: 'translateY(0px)', offset: 0.7 },
      { transform: 'translateY(0px)' },
    ], { duration: ms });
    live.shadow = dom.pigShadow.animate([
      { transform: 'scale(1, 1)', opacity: 1 },
      { transform: `scale(${1 + s * 0.6}, 1)`, opacity: 1, offset: 0.16 },
      { transform: `scale(${Math.max(0.5, 1 - hop / 90)}, 1)`, opacity: 0.55, offset: 0.42 },
      { transform: 'scale(1, 1)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1, 1)', opacity: 1 },
    ], { duration: ms });
    restart(art, CLS.wag);
    turnRosette(size.turn * strength);
  }

  function sparkle(size, scale = 1) {
    if (isReduced()) return;
    const s = slotOnScreen();
    fx.burst({
      x: s.x, y: s.y, kind: FX.SPARK, count: Math.round(size.sparks * scale), colors: SPARK_COLORS,
      angle: -Math.PI / 2, spread: Math.PI * 0.95, speed: [0.12, 0.42 + size.squash], life: [420, 900], size: [2.5, 6.5],
      area: { rx: s.w * 0.4, ry: 2 },
    });
  }

  /** A "+₪5" that rises out of the slot. */
  function float(text) {
    const s = slotOnScreen();
    const el = document.createElement(DIV);
    el.className = CLS.float;
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    dom.floatLayer.append(el);
    const m = CONFIG.motion.float;
    const frames = isReduced()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
      : [
        { transform: 'translate(-50%, -50%) translateY(0px) scale(.7)', opacity: 0 },
        { transform: 'translate(-50%, -50%) translateY(-22px) scale(1.06)', opacity: 1, offset: 0.22 },
        { transform: `translate(-50%, -50%) translateY(${-m.rise}px) scale(1)`, opacity: 0 },
      ];
    el.animate(frames, { duration: m.ms, easing: EASE.out }).onfinish = () => el.remove();
  }

  function blinkLoop() {
    const { blinkMinMs, blinkMaxMs } = CONFIG.timing;
    setTimeout(() => {
      if (!art.classList.contains(CLS.happy)) restart(eye, CLS.blink);
      blinkLoop();
    }, rand(blinkMinMs, blinkMaxMs));
  }

  /* ── looks ── */

  function setGlaze(glaze) {
    GLAZE_ROLES.forEach((role) => dom.stage.style.setProperty(`--${GLAZE_VAR}-${role}`, glaze[role]));
  }

  /** 0 = a slim new pig, 1 = as round as it gets. */
  function setFatness(p) {
    const f = CONFIG.motion.fat;
    dom.pigFat.style.scale = `${1 + f.x * p} ${1 + f.y * p}`;
  }

  /** A sweep of light and a burst of confetti when the pig turns gold. */
  function gild() {
    restart(art, CLS.gilding);
    if (isReduced()) return;
    const r = dom.pig.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height * 0.4;
    fx.burst({ x, y, kind: FX.CONFETTI, count: CONFIG.motion.gild.confetti, colors: CONFETTI_COLORS, angle: -Math.PI / 2, spread: Math.PI * 1.1, speed: [0.25, 0.75], life: [1200, 2200], size: [6, 11], spin: [-0.02, 0.02], gravityScale: 0.55 });
    fx.burst({ x, y, kind: FX.COIN, count: Math.round(CONFIG.motion.gild.confetti / 3), colors: COIN_COLORS, angle: -Math.PI / 2, spread: Math.PI * 0.9, speed: [0.3, 0.7], life: [1000, 1800], size: [5, 8], gravityScale: 0.8 });
  }

  function nudge() {
    if (isReduced()) return;
    const s = CONFIG.motion.switchHop;
    dom.pigSquash.animate([
      { transform: 'scale(1, 1)' },
      { transform: `scale(${1 - s}, ${1 + s * 1.4})`, offset: 0.35 },
      { transform: 'scale(1, 1)' },
    ], { duration: CONFIG.motion.pigReactMs * 0.7, easing: EASE.out });
  }

  /* ── breaking the pig ── */

  /** A hammer swings from behind the pig, it cracks and bursts into shards and coins, a new pig pops up. */
  async function smash({ amount, shardColors, onImpact, onShatter }) {
    busy = true;
    const m = CONFIG.motion.smash;
    if (isReduced()) {
      onImpact();
      onShatter();
      busy = false;
      return;
    }
    const s = slotOnScreen();
    const pig = dom.pig.getBoundingClientRect();
    const side = isRtl() ? 1 : -1; // the hammer comes from the pig's rear
    const size = pig.width * 0.46;
    const reach = ((HAMMER_VIEW.pivotY - HAMMER_VIEW.headY) / HAMMER_VIEW.h) * size;
    const pivotX = s.x + side * reach;
    const pivotY = s.y - (HAMMER_VIEW.faceHalf / HAMMER_VIEW.h) * size;
    const wrap = document.createElement(DIV);
    wrap.className = CLS.hammer;
    wrap.innerHTML = hammerMarkup();
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
    wrap.style.left = `${pivotX - size / 2}px`;
    wrap.style.top = `${pivotY - (HAMMER_VIEW.pivotY / HAMMER_VIEW.h) * size}px`;
    wrap.style.transformOrigin = `50% ${(HAMMER_VIEW.pivotY / HAMMER_VIEW.h) * 100}%`;
    dom.floatLayer.append(wrap);
    const hit = -side * 90;
    await wrap.animate([
      { transform: `rotate(${side * 25}deg)`, opacity: 0 },
      { transform: `rotate(${side * 35}deg)`, opacity: 1, offset: 0.3, easing: EASE.swing },
      { transform: `rotate(${hit}deg)`, opacity: 1 },
    ], { duration: m.swingMs, fill: FILL }).finished;

    onImpact();
    art.classList.add(CLS.cracked);
    wrap.animate([{ transform: `rotate(${hit}deg)` }, { transform: `rotate(${hit + side * 14}deg)`, offset: 0.4 }, { transform: `rotate(${hit + side * 8}deg)`, opacity: 0 }], { duration: m.crackMs, fill: FILL });
    dom.pigSquash.animate([
      { transform: 'translateX(0px) scale(1, 1)' },
      { transform: 'translateX(-5px) scale(1.04, .94)', offset: 0.2 },
      { transform: 'translateX(5px) scale(.98, 1.02)', offset: 0.45 },
      { transform: 'translateX(-3px) scale(1.01, .99)', offset: 0.7 },
      { transform: 'translateX(0px) scale(1, 1)' },
    ], { duration: m.crackMs });
    await wait(m.crackMs);

    const cx = pig.left + pig.width / 2;
    const cy = pig.top + pig.height * 0.52;
    const area = { rx: pig.width * 0.32, ry: pig.height * 0.3 };
    fx.burst({ x: cx, y: cy, kind: FX.SHARD, count: m.shards, colors: shardColors, radial: true, area, speed: [0.25, 0.6], lift: 0.25, life: [900, 1500], size: [7, 16], spin: [-0.02, 0.02] });
    const coins = Math.round(Math.min(m.coinsMax, m.coinsMin + m.coinsPerDecade * Math.log10(amount + 1)));
    fx.burst({ x: cx, y: cy, kind: FX.COIN, count: coins, colors: COIN_COLORS, radial: true, area, speed: [0.2, 0.55], lift: 0.35, life: [1000, 1700], size: [5, 9] });
    dom.pig.classList.add(CLS.gone);
    wrap.remove();
    onShatter();
    await wait(m.holdMs);

    art.classList.remove(CLS.cracked);
    dom.pig.classList.remove(CLS.gone);
    await dom.pigJump.animate([
      { transform: 'translateY(0px) scale(0, 0)', opacity: 0 },
      { transform: 'translateY(-14px) scale(1.08, 1.08)', opacity: 1, offset: 0.55 },
      { transform: 'translateY(0px) scale(.97, 1.03)', offset: 0.8 },
      { transform: 'translateY(0px) scale(1, 1)', opacity: 1 },
    ], { duration: m.rebornMs, easing: EASE.out }).finished;
    happy();
    busy = false;
  }

  blinkLoop();

  return {
    drop, react, sparkle, float, setGlaze, setFatness, gild, nudge, smash,
    get busy() { return busy; },
  };
}
