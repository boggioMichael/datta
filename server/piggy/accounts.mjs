// Accounts and their banks, one JSON file per account, written atomically shortly after a change.
// An account is opened automatically the first time a device shows its key; the key itself is
// never stored, only its hash. Banks are validated with the page's own sanitiser.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sanitizePlan, balanceOf } from "../../public/piggy/js/store.js";
import { SETTINGS, CONFIG, VISIBILITY, MESSAGES } from "./settings.mjs";

const JSON_FILE = /\.json$/;
const TEMP = ".tmp";
const CONTROL = /[\u0000-\u001f\u007f]/g;

const now = () => Date.now();
const cleanName = (name) => (typeof name === "string" ? name.replace(CONTROL, "").trim().slice(0, SETTINGS.nameLength) : "");
const lastActivity = (bank) => Math.max(bank.updatedAt || 0, bank.entries.length ? bank.entries[bank.entries.length - 1].at : 0);
const isShared = (bank) => bank.visibility !== VISIBILITY.PRIVATE;

export function createAccounts({ dir = SETTINGS.dataDir, log = console } = {}) {
  const byKey = new Map();
  const byId = new Map();
  const timers = new Map();

  const hashOf = (key) => createHash(SETTINGS.keyHash).update(key).digest("hex");
  const fileOf = (account) => join(dir, `${account.id}.json`);

  function index(account) {
    byKey.set(account.keyHash, account);
    byId.set(account.id, account);
  }

  function normalize(raw) {
    const banks = {};
    Object.values(raw.banks || {}).map(sanitizePlan).filter(Boolean).slice(0, CONFIG.limits.plans)
      .forEach((bank) => { banks[bank.id] = bank; });
    return { id: raw.id, keyHash: raw.keyHash, name: cleanName(raw.name), createdAt: raw.createdAt || now(), updatedAt: raw.updatedAt || now(), banks };
  }

  async function load() {
    await mkdir(dir, { recursive: true });
    for (const file of (await readdir(dir)).filter((f) => JSON_FILE.test(f))) {
      try {
        const account = normalize(JSON.parse(await readFile(join(dir, file), "utf8")));
        if (SETTINGS.idPattern.test(account.id) && account.keyHash) index(account);
      } catch {
        log.warn(MESSAGES.skipped(file));
      }
    }
    return byId.size;
  }

  async function write(account) {
    timers.delete(account.id);
    const file = fileOf(account);
    await writeFile(file + TEMP, JSON.stringify(account));
    await rename(file + TEMP, file);
  }

  function save(account) {
    account.updatedAt = now();
    clearTimeout(timers.get(account.id));
    timers.set(account.id, setTimeout(() => write(account).catch((error) => log.error(error)), SETTINGS.writeDelayMs));
  }

  async function flush() {
    const pending = [...timers.keys()].map((id) => byId.get(id)).filter(Boolean);
    timers.forEach(clearTimeout);
    await Promise.all(pending.map(write));
  }

  function newId() {
    let id;
    do id = randomBytes(SETTINGS.idBytes).toString("base64url"); while (byId.has(id));
    return id;
  }

  /** The account for a device key, opened on first contact. */
  function open(key) {
    const keyHash = hashOf(key);
    const existing = byKey.get(keyHash);
    if (existing) return { account: existing, created: false };
    const account = { id: newId(), keyHash, name: "", createdAt: now(), updatedAt: now(), banks: {} };
    index(account);
    save(account);
    return { account, created: true };
  }

  const find = (key) => byKey.get(hashOf(key)) ?? null;

  function setName(account, name) {
    account.name = cleanName(name);
    save(account);
    return account.name;
  }

  /** Store a bank as sent, if it is valid and the account has room. Returns the stored bank or null. */
  function putBank(account, raw, id) {
    const bank = sanitizePlan({ ...raw, id });
    if (!bank) return null;
    if (!(bank.id in account.banks) && Object.keys(account.banks).length >= CONFIG.limits.plans) return null;
    account.banks[bank.id] = bank;
    save(account);
    return bank;
  }

  function deleteBank(account, id) {
    if (!(id in account.banks)) return false;
    delete account.banks[id];
    save(account);
    return true;
  }

  const own = (account) => ({ id: account.id, name: account.name, banks: Object.values(account.banks) });

  /** What everyone may see of a bank: an unnamed bank keeps its name to itself. */
  const shared = (bank) => ({
    ...bank,
    name: bank.visibility === VISIBILITY.UNNAMED ? "" : bank.name,
    entries: bank.entries.slice(-SETTINGS.personEntries),
  });

  /** Everyone with at least one shared bank, most recently active first. */
  function people() {
    return [...byId.values()]
      .map((account) => {
        const banks = Object.values(account.banks).filter(isShared);
        if (!banks.length) return null;
        return {
          id: account.id,
          name: account.name,
          banks: banks.length,
          total: banks.reduce((sum, bank) => sum + balanceOf(bank), 0),
          count: banks.reduce((sum, bank) => sum + bank.entries.length, 0),
          lastAt: Math.max(...banks.map(lastActivity)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, SETTINGS.peopleLimit);
  }

  function person(id) {
    const account = byId.get(id);
    if (!account) return null;
    const banks = Object.values(account.banks).filter(isShared).map(shared);
    return banks.length ? { id: account.id, name: account.name, banks } : null;
  }

  return { load, flush, open, find, setName, putBank, deleteBank, own, people, person, get size() { return byId.size; } };
}
