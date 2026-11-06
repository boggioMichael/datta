/* State: the plans (each one a pig with its own balance and history), the chosen size
 * of "no" per plan, and the settings. Saved to localStorage on every change, validated
 * on every read, so a damaged or hand-edited save can never break the page. */

import { CONFIG } from './config.js';

export const STORE_EVENT = Object.freeze({ CHANGE: 'change', ERROR: 'error' });

/** Why the state changed, so the page can choose how to show it. */
export const REASON = Object.freeze({
  ENTRY_ADDED: 'entry-added',
  ENTRY_REMOVED: 'entry-removed',
  PLAN_CREATED: 'plan-created',
  PLAN_UPDATED: 'plan-updated',
  PLAN_DELETED: 'plan-deleted',
  PLAN_BROKEN: 'plan-broken',
  ACTIVE: 'active',
  SIZE: 'size',
  SETTINGS: 'settings',
  IMPORTED: 'imported',
  EXTERNAL: 'external',
});

export class BackupError extends Error {}

const { limits } = CONFIG;
const SIZE_IDS = CONFIG.sizes.map((s) => s.id);
const GLAZE_IDS = CONFIG.glazes.map((g) => g.id);
const LOCALE_IDS = CONFIG.locales.map((l) => l.id);
const ID_RADIX = 36;
const ID_RANDOM = 6;
const ID_MAX = 48;
const STORAGE_EVENT = 'storage';

const uid = () => Date.now().toString(ID_RADIX) + Math.random().toString(ID_RADIX).slice(2, 2 + ID_RANDOM);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= ID_MAX;
const isTime = (v) => Number.isFinite(v) && v > 0;
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const list = (v) => (Array.isArray(v) ? v.filter(isObject) : []);

export const balanceOf = (plan) => plan.entries.reduce((sum, e) => sum + e.amount, 0);
export const lifetimeOf = (plan) => balanceOf(plan) + plan.rounds.reduce((sum, r) => sum + r.total, 0);
export const sizeById = (id) => CONFIG.sizes.find((s) => s.id === id) ?? CONFIG.sizes.find((s) => s.id === CONFIG.defaultSize);
export const glazeById = (id) => CONFIG.glazes.find((g) => g.id === id) ?? CONFIG.glazes.find((g) => g.id === CONFIG.defaultGlaze);

function sanitizeEntries(raw) {
  const seen = new Set();
  return list(raw)
    .map((e) => ({
      id: isId(e.id) ? e.id : uid(),
      at: isTime(e.at) ? e.at : 0,
      size: oneOf(e.size, SIZE_IDS, null),
      amount: clampInt(e.amount, limits.amountMin, limits.amountMax, 0),
    }))
    .filter((e) => e.at && e.size && e.amount)
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.at - b.at)
    .slice(-limits.entries);
}

function sanitizeRounds(raw) {
  return list(raw)
    .map((r) => ({
      from: isTime(r.from) ? r.from : 0,
      to: isTime(r.to) ? r.to : 0,
      total: clampInt(r.total, 0, Number.MAX_SAFE_INTEGER, 0),
      count: clampInt(r.count, 0, Number.MAX_SAFE_INTEGER, 0),
    }))
    .filter((r) => r.from && r.to && r.total > 0)
    .sort((a, b) => a.to - b.to);
}

function sanitizeAmounts(raw) {
  const source = isObject(raw) ? raw : {};
  return Object.fromEntries(CONFIG.sizes.map((s) => [s.id, clampInt(source[s.id], limits.amountMin, limits.amountMax, s.amount)]));
}

function sanitizePlan(raw) {
  if (!isObject(raw)) return null;
  return {
    id: isId(raw.id) ? raw.id : uid(),
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, limits.nameLength) : '',
    glaze: oneOf(raw.glaze, GLAZE_IDS, CONFIG.defaultGlaze),
    goal: clampInt(raw.goal, 0, limits.goalMax, 0),
    amounts: sanitizeAmounts(raw.amounts),
    size: oneOf(raw.size, SIZE_IDS, CONFIG.defaultSize),
    entries: sanitizeEntries(raw.entries),
    rounds: sanitizeRounds(raw.rounds),
    createdAt: isTime(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

function sanitizeState(raw) {
  const source = isObject(raw) ? raw : {};
  const settings = isObject(source.settings) ? source.settings : {};
  const seen = new Set();
  const plans = list(source.plans)
    .map(sanitizePlan)
    .filter(Boolean)
    .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
    .slice(0, limits.plans);
  if (!plans.length) plans.push(sanitizePlan({}));
  return {
    schema: CONFIG.storage.schema,
    settings: {
      locale: oneOf(settings.locale, LOCALE_IDS, CONFIG.defaultLocale),
      currency: oneOf(settings.currency, CONFIG.currencies, CONFIG.defaultCurrency),
      sound: typeof settings.sound === 'boolean' ? settings.sound : true,
    },
    activePlanId: plans.some((p) => p.id === source.activePlanId) ? source.activePlanId : plans[0].id,
    plans,
  };
}

export function createStore(storage = globalThis.localStorage) {
  const { key, quarantineKey } = CONFIG.storage;
  const listeners = new Set();
  let state = read();

  function read() {
    let raw = null;
    try { raw = storage.getItem(key); } catch { return sanitizeState(null); }
    if (raw == null) return sanitizeState(null);
    try {
      return sanitizeState(JSON.parse(raw));
    } catch {
      // Keep the unreadable save aside instead of overwriting it.
      try { storage.setItem(quarantineKey, raw); } catch { /* storage unavailable */ }
      return sanitizeState(null);
    }
  }

  function emit(type, detail) { listeners.forEach((fn) => fn(type, detail)); }

  function commit(reason, detail = {}) {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (error) {
      emit(STORE_EVENT.ERROR, { error });
    }
    emit(STORE_EVENT.CHANGE, { reason, ...detail });
  }

  const plan = (id) => state.plans.find((p) => p.id === id) ?? null;
  const active = () => plan(state.activePlanId) ?? state.plans[0];

  function addEntry(planId, sizeId) {
    const target = plan(planId);
    if (!target) return null;
    const size = oneOf(sizeId, SIZE_IDS, target.size);
    const entry = { id: uid(), at: Date.now(), size, amount: target.amounts[size] };
    target.entries.push(entry);
    if (target.entries.length > limits.entries) target.entries.splice(0, target.entries.length - limits.entries);
    commit(REASON.ENTRY_ADDED, { planId, entry });
    return entry;
  }

  function removeEntry(planId, entryId) {
    const target = plan(planId);
    const index = target ? target.entries.findIndex((e) => e.id === entryId) : -1;
    if (index < 0) return null;
    const [entry] = target.entries.splice(index, 1);
    commit(REASON.ENTRY_REMOVED, { planId, entry });
    return entry;
  }

  function createPlan(fields) {
    if (state.plans.length >= limits.plans) return null;
    const created = sanitizePlan({ ...fields, id: uid(), createdAt: Date.now(), entries: [], rounds: [] });
    state.plans.push(created);
    state.activePlanId = created.id;
    commit(REASON.PLAN_CREATED, { planId: created.id });
    return created;
  }

  function updatePlan(planId, fields) {
    const index = state.plans.findIndex((p) => p.id === planId);
    if (index < 0) return null;
    const current = state.plans[index];
    const updated = sanitizePlan({ ...current, ...fields, id: current.id, entries: current.entries, rounds: current.rounds, createdAt: current.createdAt });
    state.plans[index] = updated;
    commit(REASON.PLAN_UPDATED, { planId });
    return updated;
  }

  function deletePlan(planId) {
    const index = state.plans.findIndex((p) => p.id === planId);
    if (index < 0) return null;
    const [removed] = state.plans.splice(index, 1);
    if (!state.plans.length) state.plans.push(sanitizePlan({}));
    if (state.activePlanId === planId) state.activePlanId = state.plans[Math.max(0, index - 1)].id;
    commit(REASON.PLAN_DELETED, { planId, removed });
    return removed;
  }

  /** Empty the pig into a round of history and start it again from zero. */
  function breakPlan(planId) {
    const target = plan(planId);
    if (!target || !target.entries.length) return null;
    const round = { from: target.entries[0].at, to: Date.now(), total: balanceOf(target), count: target.entries.length };
    target.rounds.push(round);
    target.entries = [];
    commit(REASON.PLAN_BROKEN, { planId, round });
    return round;
  }

  function setActive(planId) {
    if (!plan(planId) || state.activePlanId === planId) return;
    const from = state.activePlanId;
    state.activePlanId = planId;
    commit(REASON.ACTIVE, { planId, from });
  }

  function setSize(planId, sizeId) {
    const target = plan(planId);
    if (!target || !SIZE_IDS.includes(sizeId) || target.size === sizeId) return;
    target.size = sizeId;
    commit(REASON.SIZE, { planId });
  }

  function setSettings(patch) {
    state = sanitizeState({ ...state, settings: { ...state.settings, ...patch } });
    commit(REASON.SETTINGS);
  }

  function exportBackup() {
    return JSON.stringify({ mark: CONFIG.backup.mark, schema: CONFIG.storage.schema, exportedAt: Date.now(), state }, null, 2);
  }

  /** Parse and validate a backup file; throws BackupError if it isn't one. */
  function readBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new BackupError(); }
    if (!isObject(data) || data.mark !== CONFIG.backup.mark || !isObject(data.state)) throw new BackupError();
    return sanitizeState(data.state);
  }

  function restore(next) {
    state = sanitizeState(next);
    commit(REASON.IMPORTED);
  }

  // Another tab or the installed app changed the save: take it.
  globalThis.addEventListener?.(STORAGE_EVENT, (event) => {
    if (event.key !== key) return;
    state = read();
    emit(STORE_EVENT.CHANGE, { reason: REASON.EXTERNAL });
  });

  return {
    get state() { return state; },
    plan, active,
    addEntry, removeEntry, createPlan, updatePlan, deletePlan, breakPlan,
    setActive, setSize, setSettings,
    exportBackup, readBackup, restore,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
