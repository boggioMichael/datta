/* Every sound is synthesised on the spot with Web Audio from a recipe in config.js:
 * metal partials for coins, filtered noise for paper, bells for the goal. No files. */

import { FILTER, WAVE } from './config.js';

const RUNNING = 'running';
const START_OFFSET = 0.005;
const TAIL = 0.05;
const UNLOCK_RATE = 22050;

export function createSound(config) {
  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  let ctx = null;
  let out = null;
  let noise = null;
  let enabled = true;
  let unlocked = false;

  function ensure() {
    if (ctx || !AudioCtx) return ctx;
    ctx = new AudioCtx();
    const limiter = ctx.createDynamicsCompressor();
    Object.entries(config.limiter).forEach(([param, value]) => { limiter[param].value = value; });
    out = ctx.createGain();
    out.gain.value = config.master;
    out.connect(limiter);
    limiter.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * config.noiseSeconds);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /** Must run inside a tap: iOS only lets audio start from a user gesture. */
  function unlock() {
    if (!enabled || !ensure()) return;
    if (ctx.state !== RUNNING) ctx.resume().catch(() => {});
    if (unlocked) return;
    unlocked = true;
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, UNLOCK_RATE);
    blip.connect(ctx.destination);
    blip.start(0);
  }

  function envelope(gain, t, peak, decay) {
    gain.setValueAtTime(config.silence, t);
    gain.linearRampToValueAtTime(Math.max(config.silence, peak), t + config.attack);
    gain.exponentialRampToValueAtTime(config.silence, t + config.attack + decay);
  }

  function tone(t, frequency, peak, decay, type = WAVE.SINE) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    envelope(amp.gain, t, peak, decay);
    osc.connect(amp);
    amp.connect(out);
    osc.start(t);
    osc.stop(t + config.attack + decay + TAIL);
  }

  function sweep(t, { from, to, g, d, type }, level) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + d);
    envelope(amp.gain, t, g * level, d);
    osc.connect(amp);
    amp.connect(out);
    osc.start(t);
    osc.stop(t + d + TAIL);
  }

  function hiss(t, { from, to, q, g, d, type }, level) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = noise;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + d);
    envelope(amp.gain, t, g * level, d);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(out);
    const offset = Math.random() * Math.max(0, noise.duration - d - TAIL);
    src.start(t, offset);
    src.stop(t + d + TAIL);
  }

  function strike(t, recipe, { gain, pitch }, level) {
    const tune = pitch * (1 + (Math.random() * 2 - 1) * (recipe.detune || 0));
    recipe.partials.forEach((p) => tone(t, p.f * tune, p.g * gain * level, p.d));
    if (recipe.click) {
      const c = recipe.click;
      hiss(t, { from: c.f, to: c.f, q: c.q, g: c.g * gain, d: c.d, type: FILTER.BANDPASS }, level);
    }
  }

  function bells(t, { at, notes, gap, g, d }, level) {
    notes.forEach((f, i) => config.bellRatios.forEach((b) => tone(t + at + i * gap, f * b.r, g * b.g * level, d * b.d)));
  }

  function scatter(t, { count, span, from, to, g, d }, level) {
    for (let i = 0; i < count; i++) tone(t + Math.random() * span, from + Math.random() * (to - from), g * level, d);
  }

  /** play(id, { level }) — level scales the whole recipe (quieter shower coins, say). */
  function play(id, { level = 1 } = {}) {
    const recipe = config.recipes[id];
    if (!enabled || !recipe || !ensure()) return;
    if (ctx.state !== RUNNING) ctx.resume().catch(() => {});
    const t = ctx.currentTime + START_OFFSET;
    recipe.strikes?.forEach((s) => strike(t + s.at, recipe, s, level));
    recipe.noise?.forEach((n) => hiss(t + n.at, n, level));
    recipe.sweeps?.forEach((s) => sweep(t + s.at, s, level));
    if (recipe.bells) bells(t, recipe.bells, level);
    if (recipe.scatter) scatter(t, recipe.scatter, level);
  }

  return {
    unlock,
    play,
    setEnabled(on) { enabled = Boolean(on); },
    get enabled() { return enabled; },
  };
}
