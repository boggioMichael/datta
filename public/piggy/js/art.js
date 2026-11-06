/* Pure SVG markup builders — no DOM, so the same art renders the page and the app icons.
 * Colours come from a `paint(role)` function: CSS variables on the page, plain hex in exports. */

import { MONEY } from './config.js';

const INK = '#22161A';
const WHITE = '#FFFFFF';
const HAMMER = Object.freeze({ wood: '#A8743F', woodDark: '#6B4422', steel: '#BEC6CC', steelDark: '#5F6970' });
const ENTITY = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' });
const ESCAPE = /[&<>"]/g;
const TAU = Math.PI * 2;

const esc = (text) => String(text).replace(ESCAPE, (c) => ENTITY[c]);
const num = (n) => Math.round(n * 10) / 10;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Viewbox of each piece of art, so callers can size them by aspect ratio. */
export const PIG_VIEW = Object.freeze({ w: 360, h: 280 });
export const MONEY_VIEW = Object.freeze({
  [MONEY.COIN]: { w: 100, h: 100 },
  [MONEY.BILL]: { w: 160, h: 84 },
  [MONEY.BAR]: { w: 140, h: 76 },
});
export const HAMMER_VIEW = Object.freeze({ w: 120, h: 120, pivotX: 60, pivotY: 116, headY: 29, faceHalf: 42 });

/** paint for the live page: role → var(--prefix-role). */
export const varPaint = (prefix) => (role) => `var(--${prefix}-${role})`;
/** paint for static exports: role → the palette's hex. */
export const palettePaint = (palette) => (role) => palette[role];

/* ───────────────────────── pig ───────────────────────── */

/** A glazed ceramic piggy bank facing right (the page mirrors it for right-to-left).
 *  Classed parts animate from CSS: tail, ear, eye (open / happy), cheek, slot, shine, cracks. */
export function pigMarkup({ paint, id }) {
  const p = paint;
  const fill = (role) => `style="fill:${p(role)}"`;
  const stroke = (role) => `style="stroke:${p(role)}"`;
  const stop = (offset, role) => `<stop offset="${offset}" style="stop-color:${p(role)}"/>`;
  return `<svg class="pig-art" viewBox="0 0 ${PIG_VIEW.w} ${PIG_VIEW.h}" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="${id}-body" cx="0.34" cy="0.26" r="0.86">${stop(0, 'light')}${stop(0.5, 'base')}${stop(1, 'dark')}</radialGradient>
<radialGradient id="${id}-snout" cx="0.38" cy="0.3" r="0.8">${stop(0, 'light')}${stop(1, 'base')}</radialGradient>
<linearGradient id="${id}-leg" x1="0" y1="0" x2="0" y2="1">${stop(0, 'base')}${stop(1, 'dark')}</linearGradient>
<linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${WHITE}" stop-opacity="0"/><stop offset="0.5" stop-color="${WHITE}" stop-opacity="0.8"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></linearGradient>
<clipPath id="${id}-clip"><ellipse cx="178" cy="150" rx="124" ry="94"/></clipPath>
</defs>
<g class="pig-tail"><path d="M58 146 C43 147 33 136 38 126 C43 116 57 117 58 127 C59 135 49 138 46 131" fill="none" ${stroke('dark')} stroke-width="7" stroke-linecap="round"/></g>
<rect x="92" y="192" width="34" height="62" rx="15" ${fill('dark')}/>
<rect x="218" y="192" width="34" height="62" rx="15" ${fill('dark')}/>
<path d="M192 84 C187 60 197 40 216 29 C227 45 229 66 223 88 Z" ${fill('dark')}/>
<ellipse cx="178" cy="150" rx="124" ry="94" fill="url(#${id}-body)"/>
<ellipse cx="178" cy="150" rx="123" ry="93" fill="none" ${stroke('deep')} stroke-opacity="0.22" stroke-width="2"/>
<ellipse cx="128" cy="99" rx="58" ry="23" transform="rotate(-20 128 99)" fill="${WHITE}" opacity="0.26"/>
<ellipse cx="103" cy="92" rx="16" ry="6.5" transform="rotate(-24 103 92)" fill="${WHITE}" opacity="0.6"/>
<g clip-path="url(#${id}-clip)"><rect class="pig-shine" x="-40" y="40" width="90" height="230" fill="url(#${id}-shine)"/></g>
<rect x="146" y="59" width="64" height="14" rx="7" ${fill('deep')} opacity="0.55"/>
<rect class="pig-slot" x="151" y="62" width="54" height="8" rx="4" fill="${INK}"/>
<rect x="116" y="200" width="38" height="62" rx="16" fill="url(#${id}-leg)"/>
<rect x="242" y="200" width="38" height="62" rx="16" fill="url(#${id}-leg)"/>
<ellipse cx="135" cy="257" rx="15" ry="4.5" ${fill('deep')} opacity="0.28"/>
<ellipse cx="261" cy="257" rx="15" ry="4.5" ${fill('deep')} opacity="0.28"/>
<g class="pig-ear"><path d="M219 92 C216 67 229 46 250 37 C259 54 261 75 254 96 Z" ${fill('base')}/><path d="M227 88 C226 71 235 57 248 50 C253 63 253 77 248 90 Z" ${fill('dark')} opacity="0.5"/></g>
<ellipse class="pig-cheek" cx="263" cy="168" rx="17" ry="10" ${fill('blush')} opacity="0.38"/>
<g class="pig-eye"><g class="pig-eye-open"><ellipse cx="254" cy="128" rx="7.5" ry="9.5" fill="${INK}"/><circle cx="256.6" cy="124.4" r="2.6" fill="${WHITE}"/></g><path class="pig-eye-happy" d="M245 131 Q254 119 263 131" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" opacity="0"/></g>
<g class="pig-snout"><ellipse cx="300" cy="160" rx="27" ry="31" transform="rotate(-8 300 160)" fill="url(#${id}-snout)" ${stroke('dark')} stroke-width="2.5"/><ellipse cx="291" cy="160" rx="4.6" ry="8.2" transform="rotate(-8 291 160)" ${fill('deep')}/><ellipse cx="308" cy="158" rx="4.6" ry="8.2" transform="rotate(-8 308 158)" ${fill('deep')}/></g>
<path class="pig-smile" d="M262 193 Q273 201 285 194" fill="none" ${stroke('deep')} stroke-width="3.2" stroke-linecap="round"/>
<g class="pig-cracks" fill="none" ${stroke('deep')} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1">
<path pathLength="1" d="M178 73 L170 100 L186 118 L171 143 L189 170"/>
<path pathLength="1" d="M186 118 L212 128 L224 152 L246 160"/>
<path pathLength="1" d="M171 143 L142 150 L128 177 L104 184"/>
<path pathLength="1" d="M189 170 L197 202 L185 228"/>
</g>
</svg>`;
}

/* ───────────────────────── guilloche rosette ───────────────────────── */

/** One closed hypo- or epitrochoid, the curve family of banknote engraving. */
function trochoid({ R, r, d, epi, stepsPerTurn }) {
  const turns = r / gcd(R, r);
  const k = epi ? (R + r) / r : (R - r) / r;
  const steps = Math.ceil(stepsPerTurn * turns * (1 + k / 2));
  const big = epi ? R + r : R - r;
  const sign = epi ? -1 : 1;
  let path = '';
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU * turns;
    const x = big * Math.cos(a) + sign * d * Math.cos(k * a);
    const y = big * Math.sin(a) - d * Math.sin(k * a);
    path += `${i ? 'L' : 'M'}${num(x)} ${num(y)}`;
  }
  return `${path}Z`;
}

/** A closed ring whose radius waves `waves` times around: r(a) = radius + amp·sin(waves·a + phase). */
function wavyRing({ radius, amp, waves }, phase, stepsPerWave) {
  const steps = waves * stepsPerWave;
  let path = '';
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const r = radius + amp * Math.sin(waves * a + phase);
    path += `${i ? 'L' : 'M'}${num(r * Math.cos(a))} ${num(r * Math.sin(a))}`;
  }
  return `${path}Z`;
}

export function rosetteMarkup({ view, stroke, stepsPerWave, bands, core }) {
  const half = view / 2;
  const braids = bands.map((band) => {
    const rings = Array.from({ length: band.copies }, (_, i) => `<path d="${wavyRing(band, (i / band.copies) * TAU, stepsPerWave)}"/>`).join('');
    return `<g opacity="${band.opacity}">${rings}</g>`;
  }).join('');
  const star = core ? `<path d="${trochoid(core)}" opacity="${core.opacity}"/>` : '';
  return `<svg class="rosette-art" viewBox="${-half} ${-half} ${view} ${view}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linejoin="round">${braids}${star}</g></svg>`;
}

/* ───────────────────────── money ───────────────────────── */

const GRADIENT = Object.freeze({
  face: (tone) => `money-${tone}-face`,
  rim: (tone) => `money-${tone}-rim`,
});

/** Shared gradients for every money tone; put once in the page (or in an exported file). */
export function moneyDefs(tones) {
  return Object.entries(tones)
    .map(([tone, c]) => `<radialGradient id="${GRADIENT.face(tone)}" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="${c.light}"/><stop offset="0.55" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>`
      + `<linearGradient id="${GRADIENT.rim(tone)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>`)
    .join('');
}

const open = (kind) => `<svg class="money money-${kind}" viewBox="0 0 ${MONEY_VIEW[kind].w} ${MONEY_VIEW[kind].h}" direction="ltr" aria-hidden="true" focusable="false">`;

function coinMarkup({ tone, colors: c, mark }) {
  return `${open(MONEY.COIN)}
<circle cx="50" cy="50" r="48" fill="url(#${GRADIENT.rim(tone)})"/>
<circle cx="50" cy="50" r="42.5" fill="none" stroke="${c.deep}" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="1.2 2.4"/>
<circle cx="50" cy="50" r="38" fill="url(#${GRADIENT.face(tone)})" stroke="${c.dark}" stroke-width="1.4"/>
<text class="money-mark" x="50" y="50" dy="0.36em" text-anchor="middle" fill="${c.deep}">${esc(mark)}</text>
<ellipse cx="36" cy="30" rx="15" ry="6" transform="rotate(-32 36 30)" fill="${WHITE}" opacity="0.5"/>
</svg>`;
}

const wave = (y, amp, length, phase) => {
  let d = '';
  for (let x = 10; x <= 150; x += 2) d += `${x === 10 ? 'M' : 'L'}${x} ${num(y + amp * Math.sin((x / length) * TAU + phase))}`;
  return d;
};

function billMarkup({ colors: c, mark, value }) {
  const lines = [0, 1, 2, 3, 4].map((i) => `<path d="${wave(18 + i * 12, 3, 24, i * 1.3)}"/>`).join('');
  return `${open(MONEY.BILL)}
<rect x="1" y="1" width="158" height="82" rx="6" fill="${c.light}" stroke="${c.dark}" stroke-width="1.6"/>
<rect x="6" y="6" width="148" height="72" rx="3" fill="none" stroke="${c.base}" stroke-width="1.2"/>
<g fill="none" stroke="${c.base}" stroke-width="0.9" opacity="0.85">${lines}</g>
<ellipse cx="108" cy="42" rx="25" ry="29" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/>
<ellipse cx="108" cy="42" rx="20" ry="24" fill="none" stroke="${c.base}" stroke-width="1"/>
<text class="money-mark" x="108" y="42" dy="0.36em" text-anchor="middle" fill="${c.deep}">${esc(mark)}</text>
<text class="money-value" x="14" y="28" fill="${c.deep}">${esc(value)}</text>
<text class="money-value money-value-small" x="146" y="72" text-anchor="end" fill="${c.dark}">${esc(value)}</text>
</svg>`;
}

function barMarkup({ tone, colors: c, mark }) {
  return `${open(MONEY.BAR)}
<polygon points="26,6 114,6 126,24 14,24" fill="url(#${GRADIENT.face(tone)})" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
<polygon points="14,24 126,24 138,70 2,70" fill="url(#${GRADIENT.rim(tone)})" stroke="${c.dark}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M16 26.5 H124" stroke="${WHITE}" stroke-opacity="0.7" stroke-width="1.5"/>
<polygon points="30,8 62,8 56,22 21,22" fill="${WHITE}" opacity="0.35"/>
<text class="money-mark" x="70" y="48" dy="0.36em" text-anchor="middle" fill="${c.deep}">${esc(mark)}</text>
</svg>`;
}

const MONEY_MARKUP = Object.freeze({
  [MONEY.COIN]: coinMarkup,
  [MONEY.BILL]: billMarkup,
  [MONEY.BAR]: barMarkup,
});

/** moneyMarkup(kind, { tone, colors, mark, value }) — a coin, a bill or a gold bar. */
export const moneyMarkup = (kind, look) => MONEY_MARKUP[kind](look);

/* ───────────────────────── hammer ───────────────────────── */

export const hammerMarkup = () => `<svg class="hammer" viewBox="0 0 ${HAMMER_VIEW.w} ${HAMMER_VIEW.h}" aria-hidden="true" focusable="false">
<rect x="54" y="38" width="12" height="80" rx="5" fill="${HAMMER.wood}" stroke="${HAMMER.woodDark}" stroke-width="2"/>
<rect x="18" y="12" width="84" height="34" rx="8" fill="${HAMMER.steel}" stroke="${HAMMER.steelDark}" stroke-width="2.5"/>
<rect x="18" y="12" width="14" height="34" rx="5" fill="${HAMMER.steelDark}" opacity="0.5"/>
<rect x="88" y="12" width="14" height="34" rx="5" fill="${HAMMER.steelDark}" opacity="0.5"/>
<rect x="26" y="16" width="68" height="6" rx="3" fill="${WHITE}" opacity="0.5"/>
</svg>`;
