/* The money counter, built like the register window of an old tin bank: one number
 * wheel per digit, leading zeros dimmed, and real carries — a wheel only turns while
 * the wheel to its right rolls from 9 to 0. Retargets smoothly if the value changes
 * mid-roll. */

const DIGITS = 10;
const CELLS = DIGITS + 1; // 0…9 plus a trailing 0, so 9 → 0 rolls forward
const CLS = Object.freeze({
  window: 'register-window',
  currency: 'register-currency',
  wheel: 'wheel',
  strip: 'wheel-strip',
  lead: 'is-lead',
  gap: 'is-gap',
  live: 'sr-only',
});
const SPAN = 'span';
const LTR = 'ltr';
const ATTR = Object.freeze({ hidden: 'aria-hidden', live: 'aria-live' });
const LIVE_POLITE = 'polite';
const TRUE = 'true';

const easeOut = (k) => 1 - (1 - k) ** 3;
const digitsOf = (v) => Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1);
const make = (className) => {
  const el = document.createElement(SPAN);
  if (className) el.className = className;
  return el;
};

/** Continuous position of wheel k for a (possibly fractional) value v. */
function wheelPosition(v, k) {
  if (k === 0) return v;
  const unit = DIGITS ** k;
  const whole = Math.floor(v / unit);
  const carry = Math.max(0, v - whole * unit - (unit - 1));
  return whole + carry;
}

export function createRegister(root, { minWheels, group, rollMs, rollPerDigitMs, rollMaxMs, rollCap, isReduced, describe }) {
  const windowEl = make(CLS.window);
  const symbol = make(CLS.currency);
  const live = make(CLS.live);
  windowEl.dir = LTR;
  windowEl.setAttribute(ATTR.hidden, TRUE);
  symbol.setAttribute(ATTR.hidden, TRUE);
  live.setAttribute(ATTR.live, LIVE_POLITE);
  root.replaceChildren(windowEl, symbol, live);

  const wheels = []; // wheels[k] is the k-th digit from the right
  let shown = 0;
  let from = 0;
  let target = 0;
  let start = 0;
  let duration = 0;
  let frame = 0;

  function build(count) {
    while (wheels.length < count) {
      const wheel = make(CLS.wheel);
      const strip = make(CLS.strip);
      for (let d = 0; d < CELLS; d++) {
        const cell = make();
        cell.textContent = d % DIGITS;
        strip.append(cell);
      }
      wheel.append(strip);
      windowEl.prepend(wheel);
      wheels.push({ wheel, strip });
    }
    while (wheels.length > count) wheels.pop().wheel.remove();
    wheels.forEach(({ wheel }, k) => wheel.classList.toggle(CLS.gap, k > 0 && k % group === 0));
  }

  function paint(v) {
    wheels.forEach(({ wheel, strip }, k) => {
      const p = wheelPosition(v, k) % DIGITS;
      strip.style.transform = `translateY(${(-p / CELLS) * 100}%)`;
      wheel.classList.toggle(CLS.lead, k > 0 && v < DIGITS ** k);
    });
  }

  const fit = (v) => build(Math.max(minWheels, digitsOf(v)));

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick(now) {
    const k = Math.min(1, (now - start) / duration);
    shown = from + (target - from) * easeOut(k);
    paint(shown);
    if (k < 1) {
      frame = requestAnimationFrame(tick);
      return;
    }
    frame = 0;
    shown = target;
    fit(target);
    paint(target);
  }

  /** set(value, { animate }) — roll to a whole amount. */
  function set(value, { animate = true } = {}) {
    const next = Math.max(0, Math.round(value));
    live.textContent = describe(next);
    if (!animate || isReduced()) {
      stop();
      shown = target = next;
      fit(next);
      paint(next);
      return;
    }
    if (next === target && (frame || shown === next)) return;
    from = shown;
    target = next;
    // A big jump starts close to the target, so the last digits still roll visibly.
    if (Math.abs(target - from) > rollCap) from = target - Math.sign(target - from) * rollCap;
    start = performance.now();
    duration = Math.min(rollMaxMs, rollMs + rollPerDigitMs * Math.log10(Math.abs(target - from) + 1));
    fit(Math.max(from, target));
    if (!frame) frame = requestAnimationFrame(tick);
  }

  /** Put the currency symbol on the side this language writes it. */
  function setCurrency({ symbol: text, first }) {
    symbol.textContent = text;
    if (first) root.prepend(symbol);
    else windowEl.after(symbol);
  }

  fit(0);
  paint(0);
  return { set, setCurrency, get value() { return target; } };
}
