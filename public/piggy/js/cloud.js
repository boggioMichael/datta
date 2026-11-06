/* Sharing. Every device gets an account by itself: a random key made on first visit and kept
 * in the browser, shown to the server, which opens the account behind it. Your banks are
 * mirrored to the server; other people's shared banks are read from it.
 *
 * Local-first: the bank works the same with no server. Changes wait in an outbox (kept in
 * localStorage) and go up as soon as the server answers. The server is found at the page's
 * own address (when the server serves the page), else through the pointer file it publishes. */

import { CONFIG } from './config.js';
import { STORE_EVENT, REASON } from './store.js';

export const CLOUD = Object.freeze({ CONNECTING: 'connecting', ONLINE: 'online', OFFLINE: 'offline' });

const METHOD = Object.freeze({ get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' });
const HEADER = Object.freeze({ auth: 'Authorization', type: 'Content-Type' });
const BEARER = 'Bearer ';
const JSON_TYPE = 'application/json';
const PATH = Object.freeze({
  health: '/health',
  session: '/session',
  me: '/me',
  bank: (id) => `/me/banks/${encodeURIComponent(id)}`,
  people: '/people',
  person: (id) => `/people/${encodeURIComponent(id)}`,
});
const WORK = Object.freeze({ put: 'put', delete: 'delete' });
const UNAUTHORIZED = 401;
const BASE64 = Object.freeze({ from: /[+/=]/g, map: { '+': '-', '/': '_', '=': '' } });
const MINUTE_MS = 60000;
const PUSH_REASONS = new Set([REASON.ENTRY_ADDED, REASON.ENTRY_REMOVED, REASON.PLAN_CREATED, REASON.PLAN_UPDATED, REASON.PLAN_BROKEN, REASON.SIZE]);

export class CloudError extends Error {
  constructor(status) { super(String(status)); this.status = status; }
}

const keyPattern = new RegExp(CONFIG.cloud.keyPattern);

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(CONFIG.cloud.keyBytes));
  return btoa(String.fromCharCode(...bytes)).replace(BASE64.from, (c) => BASE64.map[c]);
}

export function createCloud({ store, storage = globalThis.localStorage }) {
  const cfg = CONFIG.cloud;
  const listeners = new Set();
  const read = (name, fallback) => { try { return JSON.parse(storage.getItem(name)) ?? fallback; } catch { return fallback; } };
  const write = (name, value) => { try { storage.setItem(name, JSON.stringify(value)); } catch { /* storage full or blocked */ } };

  let identity = read(cfg.keyStorage, null);
  if (!identity || !keyPattern.test(identity.key)) {
    identity = { key: newKey(), id: '', name: '' };
    write(cfg.keyStorage, identity);
  }
  const outbox = new Map(Object.entries(read(cfg.queueStorage, {})));
  let status = CLOUD.CONNECTING;
  let base = null;
  let restoring = false;
  let pushTimer = 0;
  let retryTimer = 0;
  let retryDelay = cfg.retryMs;
  let flushing = false;

  const emit = () => listeners.forEach((fn) => fn());
  const setStatus = (next) => { if (status !== next) { status = next; emit(); } };
  const saveOutbox = () => write(cfg.queueStorage, Object.fromEntries(outbox));

  async function call(method, path, body, origin = base) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const headers = { [HEADER.auth]: BEARER + identity.key };
      if (body !== undefined) headers[HEADER.type] = JSON_TYPE;
      const res = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      if (!res.ok) throw new CloudError(res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ── finding the server ── */

  async function healthy(origin) {
    const answer = await call(METHOD.get, PATH.health, undefined, origin + cfg.api);
    if (!answer?.ok) throw new CloudError(0);
    return origin;
  }

  async function fromPointer() {
    const version = Math.floor(Date.now() / (cfg.pointerCacheMinutes * MINUTE_MS));
    const res = await fetch(`${cfg.pointer}?v=${version}`, { cache: 'no-store' });
    if (!res.ok) throw new CloudError(res.status);
    const { url } = await res.json();
    return healthy(new URL(url).origin);
  }

  async function discover() {
    const cached = read(cfg.serverStorage, null);
    const tries = [healthy(location.origin), fromPointer()];
    if (cached) tries.push(healthy(cached));
    const origin = await Promise.any(tries);
    write(cfg.serverStorage, origin);
    base = origin + cfg.api;
  }

  /* ── keeping banks in step ── */

  function queue(id, work) {
    outbox.set(id, work);
    saveOutbox();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, cfg.pushDelayMs);
  }

  function retryLater() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, cfg.retryMaxMs);
  }

  async function flush() {
    if (status !== CLOUD.ONLINE || flushing) return;
    flushing = true;
    try {
      for (const [id, work] of [...outbox]) {
        const bank = store.plan(id);
        if (work === WORK.put && bank) await call(METHOD.put, PATH.bank(id), bank);
        if (work === WORK.delete || !bank) await call(METHOD.delete, PATH.bank(id));
        if (outbox.get(id) === work) outbox.delete(id);
        saveOutbox();
      }
    } catch (error) {
      if (error instanceof CloudError && error.status === UNAUTHORIZED) connect();
      else { setStatus(CLOUD.OFFLINE); retryLater(); }
    } finally {
      flushing = false;
    }
  }

  async function connect() {
    clearTimeout(retryTimer);
    try {
      if (!base) await discover();
      const session = await call(METHOD.post, PATH.session);
      identity = { ...identity, id: session.id, name: session.name };
      write(cfg.keyStorage, identity);
      if (restoring) {
        restoring = false;
        outbox.clear();
        store.replaceRemote(session.banks);
      } else {
        store.mergeRemote(session.banks);
      }
      const remote = new Map(session.banks.map((bank) => [bank.id, bank.updatedAt]));
      store.state.plans.forEach((plan) => {
        if (!remote.has(plan.id) || plan.updatedAt > remote.get(plan.id)) outbox.set(plan.id, WORK.put);
      });
      saveOutbox();
      retryDelay = cfg.retryMs;
      setStatus(CLOUD.ONLINE);
      emit();
      await flush();
    } catch {
      base = null;
      setStatus(CLOUD.OFFLINE);
      retryLater();
    }
  }

  store.subscribe((type, detail) => {
    if (type !== STORE_EVENT.CHANGE) return;
    if (PUSH_REASONS.has(detail.reason)) queue(detail.planId, WORK.put);
    else if (detail.reason === REASON.PLAN_DELETED) queue(detail.planId, WORK.delete);
    else if (detail.reason === REASON.IMPORTED) store.state.plans.forEach((plan) => queue(plan.id, WORK.put));
  });

  /* ── profile, people ── */

  async function setName(name) {
    const answer = await call(METHOD.patch, PATH.me, { name });
    identity = { ...identity, name: answer.name };
    write(cfg.keyStorage, identity);
    emit();
    return answer.name;
  }

  const people = async () => (await call(METHOD.get, PATH.people)).people;
  const person = (id) => call(METHOD.get, PATH.person(id));

  /** Move this device onto another account: its banks replace the ones here. */
  async function useKey(key) {
    const clean = String(key || '').trim();
    if (!keyPattern.test(clean)) return false;
    identity = { key: clean, id: '', name: '' };
    write(cfg.keyStorage, identity);
    restoring = true;
    await connect();
    return true;
  }

  const isKey = (key) => keyPattern.test(String(key || '').trim());

  return {
    connect, setName, people, person, useKey, isKey,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get status() { return status; },
    get me() { return { id: identity.id, name: identity.name }; },
    get key() { return identity.key; },
    get pending() { return outbox.size; },
  };
}
