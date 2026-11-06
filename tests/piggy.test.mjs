// The No Bank (public/piggy): words, saves and backups.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG, VISIBILITY } from "../public/piggy/js/config.js";
import { STRINGS, KEYS } from "../public/piggy/js/strings.js";
import { createStore, balanceOf, BackupError, REASON } from "../public/piggy/js/store.js";
import { createI18n } from "../public/piggy/js/i18n.js";

const PLURAL = ["one", "two", "other"];
const memory = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};
const languages = Object.keys(STRINGS);
const has = (lang, key) => key in STRINGS[lang] || `${key}.other` in STRINGS[lang];

test("every key the scripts and the markup use exists in every language", () => {
  const html = readFileSync(new URL("../public/piggy/index.html", import.meta.url), "utf8");
  const markup = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(";").map((pair) => pair.split(":")[1])));
  const scripts = Object.entries(KEYS).filter(([name]) => !/(Prefix|Suffix)$/.test(name)).map(([, key]) => key);
  const derived = CONFIG.sizes.map((s) => KEYS.sizePrefix + s.id)
    .concat(CONFIG.glazes.map((g) => KEYS.glazePrefix + g.id))
    .concat(Object.values(VISIBILITY).flatMap((v) => [KEYS.visibilityPrefix + v, KEYS.visibilityPrefix + v + KEYS.hintSuffix]));
  for (const lang of languages) {
    for (const key of [...markup, ...scripts, ...derived]) assert.ok(has(lang, key), `${lang} is missing ${key}`);
  }
});

test("plural keys always have an .other form", () => {
  for (const lang of languages) {
    for (const key of Object.keys(STRINGS[lang])) {
      const [base, form] = [key.slice(0, key.lastIndexOf(".")), key.slice(key.lastIndexOf(".") + 1)];
      if (PLURAL.includes(form)) assert.ok(`${base}.other` in STRINGS[lang], `${lang}: ${base} has no .other`);
    }
  }
});

test("every language the config lists has strings", () => {
  for (const { id } of CONFIG.locales) assert.ok(STRINGS[id], `no strings for ${id}`);
});

test("Hebrew money, plurals and isolates", () => {
  const i18n = createI18n({ strings: STRINGS, fallback: CONFIG.defaultLocale });
  i18n.configure("he", "ILS");
  assert.match(i18n.money(1245), /1,245/);
  assert.equal(i18n.currencyLayout().symbol, "₪");
  assert.equal(i18n.plural(KEYS.todayCount, 2), STRINGS.he["today.count.two"]);
  assert.ok(i18n.plural(KEYS.todayCount, 7).includes("⁨7⁩"));
  i18n.configure("en", "USD");
  assert.equal(i18n.currencyLayout().first, true);
});

test("a fresh store has one pig; an unreadable save is set aside", () => {
  const storage = memory({ [CONFIG.storage.key]: "{not json" });
  const store = createStore(storage);
  assert.equal(store.state.plans.length, 1);
  assert.equal(storage.getItem(CONFIG.storage.quarantineKey), "{not json");
});

test("hostile saves are clamped to valid values", () => {
  const raw = {
    settings: { locale: "xx", currency: "BTC", sound: "yes" },
    plans: [{ id: "a", name: 5, glaze: "neon", goal: -3, amounts: { small: "x", huge: 1e12 }, size: "giant",
      entries: [{ at: "yesterday", size: "small", amount: 1 }, { id: "e", at: 1.7e12, size: "huge", amount: 1e12 }], rounds: "none" }, "junk"],
  };
  const store = createStore(memory({ [CONFIG.storage.key]: JSON.stringify(raw) }));
  const plan = store.active();
  assert.deepEqual(store.state.settings, { locale: CONFIG.defaultLocale, currency: CONFIG.defaultCurrency, sound: true });
  assert.equal(plan.glaze, CONFIG.defaultGlaze);
  assert.equal(plan.goal, 0);
  assert.equal(plan.size, CONFIG.defaultSize);
  assert.equal(plan.amounts.small, CONFIG.sizes.find((s) => s.id === "small").amount);
  assert.equal(plan.amounts.huge, CONFIG.limits.amountMax);
  assert.equal(plan.entries.length, 1);
  assert.equal(balanceOf(plan), CONFIG.limits.amountMax);
});

test("adding, undoing and breaking a pig", () => {
  const storage = memory();
  const store = createStore(storage);
  const reasons = [];
  store.subscribe((_, detail) => reasons.push(detail.reason));
  const plan = store.active();
  const a = store.addEntry(plan.id, "medium");
  store.addEntry(plan.id, "huge");
  assert.equal(balanceOf(store.active()), 105);
  store.removeEntry(plan.id, a.id);
  assert.equal(balanceOf(store.active()), 100);
  const round = store.breakPlan(plan.id);
  assert.equal(round.total, 100);
  assert.equal(store.active().entries.length, 0);
  assert.equal(store.active().rounds.length, 1);
  assert.deepEqual(reasons, [REASON.ENTRY_ADDED, REASON.ENTRY_ADDED, REASON.ENTRY_REMOVED, REASON.PLAN_BROKEN]);
  assert.equal(JSON.parse(storage.getItem(CONFIG.storage.key)).plans[0].rounds[0].total, 100);
});

test("a plan keeps the worth of each no at the time it was said", () => {
  const store = createStore(memory());
  const plan = store.active();
  store.addEntry(plan.id, "small");
  store.updatePlan(plan.id, { amounts: { small: 3 } });
  store.addEntry(plan.id, "small");
  assert.deepEqual(store.active().entries.map((e) => e.amount), [1, 3]);
});

test("plans: create up to the limit, delete the last and get a fresh one", () => {
  const store = createStore(memory());
  for (let i = 1; i < CONFIG.limits.plans; i++) assert.ok(store.createPlan({ name: `p${i}` }));
  assert.equal(store.createPlan({ name: "one too many" }), null);
  for (const plan of [...store.state.plans]) store.deletePlan(plan.id);
  assert.equal(store.state.plans.length, 1);
  assert.equal(store.state.activePlanId, store.state.plans[0].id);
});

test("backups round-trip, and other files are refused", () => {
  const source = createStore(memory());
  source.addEntry(source.active().id, "large");
  const target = createStore(memory());
  target.restore(target.readBackup(source.exportBackup()));
  assert.equal(balanceOf(target.active()), 20);
  assert.throws(() => target.readBackup("{\"hello\": 1}"), BackupError);
  assert.throws(() => target.readBackup("not json"), BackupError);
});
