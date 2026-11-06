/* קופת הלא · The No Bank — every tunable lives here.
 * Sizes of "no", pig glazes, money tones, currencies, limits, timings, motion and
 * sound recipes are data. The logic reads them and never spells any of them out. */

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/** What a "no" can be minted as. */
export const MONEY = deepFreeze({ COIN: 'coin', BILL: 'bill', BAR: 'bar' });

/** Sound recipe ids; the recipes themselves are in CONFIG.audio.recipes. */
export const SOUND = deepFreeze({
  TINK: 'tink',
  CLINK: 'clink',
  RUSTLE: 'rustle',
  THUD: 'thud',
  GOAL: 'goal',
  UNDO: 'undo',
  SHATTER: 'shatter',
  TICK: 'tick',
});

/** Web Audio node types the recipes use (API enum values). */
export const WAVE = deepFreeze({ SINE: 'sine', TRIANGLE: 'triangle' });
export const FILTER = deepFreeze({ BANDPASS: 'bandpass', LOWPASS: 'lowpass', HIGHPASS: 'highpass' });

export const CONFIG = deepFreeze({
  storage: {
    key: 'datta.piggy',
    quarantineKey: 'datta.piggy.unreadable',
    schema: 1,
  },
  backup: {
    mark: 'datta.piggy.backup',
    fileName: 'piggy-backup-{date}.json',
    mime: 'application/json',
  },
  site: { home: '../{locale}/', title: '{app} · DATTA' },
  serviceWorker: './sw.js',
  media: { reducedMotion: '(prefers-reduced-motion: reduce)' },

  locales: [
    { id: 'he', dir: 'rtl' },
    { id: 'en', dir: 'ltr' },
  ],
  defaultLocale: 'he',
  currencies: ['ILS', 'USD', 'EUR'],
  defaultCurrency: 'ILS',

  /* Sizes of "no", smallest first. `amount` is the default worth; every plan can change it.
   * icon / flight: on-screen width in px in the size picker and in the air.
   * squash / hop / turn: how hard the pig and the rosette react. shower: extra coins. */
  sizes: [
    { id: 'small', amount: 1, money: MONEY.COIN, tone: 'nickel', icon: 30, flight: 46, sound: SOUND.TINK, haptic: [6], sparks: 8, squash: 0.05, hop: 6, turn: 3, shower: 0 },
    { id: 'medium', amount: 5, money: MONEY.COIN, tone: 'brass', icon: 40, flight: 56, sound: SOUND.CLINK, haptic: [12], sparks: 14, squash: 0.08, hop: 12, turn: 6, shower: 0 },
    { id: 'large', amount: 20, money: MONEY.BILL, tone: 'coral', icon: 58, flight: 112, sound: SOUND.RUSTLE, haptic: [10, 40, 16], sparks: 22, squash: 0.11, hop: 18, turn: 10, shower: 0 },
    { id: 'huge', amount: 100, money: MONEY.BAR, tone: 'gold', icon: 54, flight: 108, sound: SOUND.THUD, haptic: [24, 40, 24, 40, 60], sparks: 42, squash: 0.17, hop: 30, turn: 18, shower: 6 },
  ],
  defaultSize: 'medium',

  /** Metal and paper tones for the money (light → deep). */
  tones: {
    nickel: { light: '#FBFBFC', base: '#C9CED4', dark: '#8C939A', deep: '#4F555C' },
    brass: { light: '#FFEBAE', base: '#E2B24B', dark: '#A8791F', deep: '#6A4C0D' },
    coral: { light: '#FFE6DC', base: '#F2A28A', dark: '#C35F45', deep: '#7A3322' },
    gold: { light: '#FFF4BF', base: '#F1C24C', dark: '#B9861B', deep: '#6E4F0A' },
  },
  showerTone: 'brass',

  /** Glazes a plan's pig can wear, and the gold every pig turns once it reaches its goal. */
  glazes: [
    { id: 'rose', light: '#FFD6E1', base: '#F39CB4', dark: '#D06A88', deep: '#8E3B56', blush: '#FF5C88' },
    { id: 'cherry', light: '#FFC4CE', base: '#EC7088', dark: '#C3455F', deep: '#7A2134', blush: '#FF3D6E' },
    { id: 'peach', light: '#FFE3CE', base: '#F7AE84', dark: '#D7825A', deep: '#8A4A2A', blush: '#FF6F5E' },
    { id: 'lilac', light: '#EFE4FF', base: '#C6A9F3', dark: '#9A79D3', deep: '#5A3C92', blush: '#FF7FBF' },
    { id: 'sky', light: '#DDF1FF', base: '#9FCCF3', dark: '#6C9FD1', deep: '#38628F', blush: '#FF8AAE' },
    { id: 'porcelain', light: '#FFFFFF', base: '#EFEAE2', dark: '#C8C0B3', deep: '#7F7565', blush: '#FF94AE' },
  ],
  defaultGlaze: 'rose',
  gilded: { light: '#FFF6C8', base: '#EFC556', dark: '#BE8E22', deep: '#6F500B', blush: '#FF8C5A' },

  limits: {
    plans: 24,
    nameLength: 40,
    amountMin: 1,
    amountMax: 1000000,
    goalMax: 1000000000,
    entries: 100000,
    historyPage: 80,
  },

  register: { minWheels: 5, group: 3, rollMs: 650, rollPerDigitMs: 220, rollMaxMs: 1500, rollCap: 120 },

  timing: { toastMs: 4500, toastFadeMs: 280, happyMs: 750, blinkMinMs: 2400, blinkMaxMs: 6800, sheetCloseMs: 260 },

  motion: {
    pigReactMs: 560,
    coin: { rise: 66, jitter: 5, popMs: 160, fallMs: 470, spins: 3 },
    bill: { rise: 220, fallMs: 1050, sway: 30, tilt: 16, waves: 2.5, steps: 12 },
    bar: { rise: 300, fallMs: 660, squeezeAt: 0.82 },
    shower: { rise: 250, gapMs: 90, fallMs: 520, spread: 0.3, scale: 0.68, delayMs: 140, width: 38 },
    float: { rise: 70, ms: 1000 },
    fat: { x: 0.14, y: 0.07, softScale: 800 },
    rosette: { turnMs: 950 },
    smash: { swingMs: 360, crackMs: 320, holdMs: 950, rebornMs: 720, shards: 30, coinsMin: 12, coinsMax: 70, coinsPerDecade: 14 },
    gild: { confetti: 70 },
    switchHop: 0.04,
  },

  particles: { gravity: 0.0018, drag: 0.0016, max: 600 },

  /* Banknote guilloche behind the pig: braided bands of phase-shifted wavy rings,
   * and a trochoid star at the centre. */
  rosette: {
    view: 380,
    stroke: 0.6,
    stepsPerWave: 10,
    bands: [
      { radius: 176, amp: 6, waves: 44, copies: 4, opacity: 0.55 },
      { radius: 152, amp: 11, waves: 32, copies: 6, opacity: 0.45 },
      { radius: 122, amp: 16, waves: 24, copies: 8, opacity: 0.34 },
    ],
    core: { R: 70, r: 26, d: 40, epi: false, opacity: 0.3, stepsPerTurn: 64 },
  },

  audio: {
    master: 1.1,
    limiter: { threshold: -8, knee: 6, ratio: 12, attack: 0.002, release: 0.15 },
    noiseSeconds: 1,
    attack: 0.002,
    silence: 0.0001,
    recipes: {
      [SOUND.TINK]: {
        detune: 0.04,
        strikes: [{ at: 0, gain: 1, pitch: 1 }],
        partials: [{ f: 3200, g: 0.32, d: 0.16 }, { f: 4710, g: 0.18, d: 0.11 }, { f: 6680, g: 0.08, d: 0.07 }],
        click: { g: 0.08, d: 0.012, f: 7500, q: 0.9 },
      },
      [SOUND.CLINK]: {
        detune: 0.03,
        strikes: [{ at: 0, gain: 1, pitch: 1 }, { at: 0.07, gain: 0.42, pitch: 1.015 }],
        partials: [{ f: 2380, g: 0.22, d: 0.3 }, { f: 3510, g: 0.12, d: 0.2 }, { f: 4980, g: 0.07, d: 0.13 }, { f: 6150, g: 0.035, d: 0.08 }],
        click: { g: 0.1, d: 0.014, f: 6500, q: 0.9 },
      },
      [SOUND.RUSTLE]: {
        detune: 0.02,
        noise: [
          { at: 0, from: 900, to: 4200, q: 1.1, g: 0.22, d: 0.26, type: FILTER.BANDPASS },
          { at: 0.12, from: 1600, to: 5200, q: 1.5, g: 0.14, d: 0.22, type: FILTER.BANDPASS },
        ],
        strikes: [{ at: 0.3, gain: 0.45, pitch: 0.82 }],
        partials: [{ f: 2380, g: 0.22, d: 0.28 }, { f: 3510, g: 0.12, d: 0.18 }],
      },
      [SOUND.THUD]: {
        detune: 0.02,
        sweeps: [{ at: 0, from: 150, to: 44, g: 0.6, d: 0.32, type: WAVE.SINE }],
        strikes: [{ at: 0, gain: 0.8, pitch: 0.6 }],
        partials: [{ f: 2380, g: 0.22, d: 0.34 }, { f: 3510, g: 0.12, d: 0.22 }, { f: 4980, g: 0.06, d: 0.14 }],
        bells: { at: 0.13, notes: [1318.5, 1760], gap: 0.085, g: 0.14, d: 1.1 },
      },
      [SOUND.GOAL]: { bells: { at: 0, notes: [1046.5, 1318.5, 1568, 2093], gap: 0.11, g: 0.15, d: 1.4 } },
      [SOUND.UNDO]: { sweeps: [{ at: 0, from: 880, to: 360, g: 0.2, d: 0.18, type: WAVE.TRIANGLE }] },
      [SOUND.SHATTER]: {
        noise: [
          { at: 0, from: 3200, to: 500, q: 0.7, g: 0.5, d: 0.42, type: FILTER.LOWPASS },
          { at: 0.02, from: 5200, to: 2600, q: 0.6, g: 0.18, d: 0.2, type: FILTER.HIGHPASS },
        ],
        sweeps: [{ at: 0, from: 130, to: 40, g: 0.5, d: 0.35, type: WAVE.SINE }],
        scatter: { count: 11, span: 0.6, from: 1900, to: 4200, g: 0.09, d: 0.2 },
      },
      [SOUND.TICK]: {
        detune: 0,
        strikes: [{ at: 0, gain: 1, pitch: 1 }],
        partials: [{ f: 1900, g: 0.09, d: 0.03 }],
      },
    },
    bellRatios: [{ r: 1, g: 1, d: 1 }, { r: 2.01, g: 0.35, d: 0.6 }, { r: 3.99, g: 0.12, d: 0.3 }],
  },

  haptics: { undo: [8], goal: [30, 60, 30, 60, 90], shatter: [60, 30, 90], select: [4] },
});
