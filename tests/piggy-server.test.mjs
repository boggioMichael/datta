// The No Bank's sharing server (server/piggy): accounts, banks, visibility, CORS and files.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPiggyServer } from "../server/piggy/server.mjs";
import { CONFIG, VISIBILITY } from "../public/piggy/js/config.js";

const KEY_A = "a".repeat(43);
const KEY_B = "b".repeat(43);
const SITE = "https://boggiomichael.github.io";
const quiet = { log() {}, warn() {}, error() {} };

async function boot(dir) {
  const { server, accounts } = await createPiggyServer({ dataDir: dir, log: quiet });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { key, body, origin } = {}) => {
    const headers = {};
    if (key) headers.authorization = `Bearer ${key}`;
    if (body) headers["content-type"] = "application/json";
    if (origin) headers.origin = origin;
    const res = await fetch(base + CONFIG.cloud.api + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
  };
  const close = async () => { await accounts.flush(); await new Promise((resolve) => server.close(resolve)); };
  return { base, call, close };
}

const bank = (id, extra = {}) => ({
  id, name: `bank ${id}`, glaze: "sky", goal: 100, updatedAt: Date.now(),
  entries: [{ id: `${id}-1`, at: Date.now(), size: "medium", amount: 5 }, { id: `${id}-2`, at: Date.now(), size: "huge", amount: 100 }],
  ...extra,
});

test("accounts open by themselves, banks stay private until shared", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "piggy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { call, close } = await boot(dir);
  try {
    assert.equal((await call("GET", "/health")).json.ok, true);
    assert.equal((await call("POST", "/session")).status, 401);
    assert.equal((await call("POST", "/session", { key: "short" })).status, 401);

    const first = await call("POST", "/session", { key: KEY_A });
    assert.equal(first.status, 200);
    assert.deepEqual(first.json.banks, []);
    assert.equal((await call("POST", "/session", { key: KEY_A })).json.id, first.json.id, "same key, same account");

    assert.equal((await call("PATCH", "/me", { key: KEY_A, body: { name: "  Michael\u0000 " } })).json.name, "Michael");
    assert.equal((await call("PUT", "/me/banks/shown", { key: KEY_A, body: bank("shown") })).status, 200);
    assert.deepEqual((await call("GET", "/people")).json.people, [], "private banks are not listed");
    assert.equal((await call("GET", `/people/${first.json.id}`)).status, 404);

    await call("PUT", "/me/banks/shown", { key: KEY_A, body: bank("shown", { visibility: VISIBILITY.PUBLIC }) });
    await call("PUT", "/me/banks/secret", { key: KEY_A, body: bank("secret", { visibility: VISIBILITY.UNNAMED }) });
    await call("PUT", "/me/banks/mine", { key: KEY_A, body: bank("mine") });
    const [person] = (await call("GET", "/people")).json.people;
    assert.equal(person.name, "Michael");
    assert.equal(person.banks, 2);
    assert.equal(person.total, 210);

    const view = (await call("GET", `/people/${first.json.id}`)).json;
    assert.deepEqual(view.banks.map((b) => b.id).sort(), ["secret", "shown"]);
    assert.equal(view.banks.find((b) => b.id === "secret").name, "", "an unnamed bank hides its name");
    assert.equal(view.banks.find((b) => b.id === "shown").name, "bank shown");

    // another device has its own account and cannot touch this one
    const other = await call("POST", "/session", { key: KEY_B });
    assert.notEqual(other.json.id, first.json.id);
    await call("DELETE", "/me/banks/shown", { key: KEY_B });
    assert.equal((await call("GET", `/people/${first.json.id}`)).json.banks.length, 2);
    assert.equal((await call("PUT", "/me/banks/x", { key: "c".repeat(43), body: bank("x") })).status, 401, "writes need an opened account");

    assert.equal((await call("DELETE", "/me/banks/shown", { key: KEY_A })).json.deleted, true);
    assert.equal((await call("GET", `/people/${first.json.id}`)).json.banks.length, 1);
  } finally {
    await close();
  }

  // everything is still there after a restart
  const again = await boot(dir);
  try {
    const session = await again.call("POST", "/session", { key: KEY_A });
    assert.deepEqual(session.json.banks.map((b) => b.id).sort(), ["mine", "secret"]);
    assert.equal(session.json.name, "Michael");
  } finally {
    await again.close();
  }
});

test("only the site and local pages get CORS; files are served without escaping public/", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "piggy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { base, call, close } = await boot(dir);
  try {
    assert.equal((await call("GET", "/health", { origin: SITE })).headers.get("access-control-allow-origin"), SITE);
    assert.equal((await call("GET", "/health", { origin: "https://evil.example" })).headers.get("access-control-allow-origin"), null);
    assert.equal((await fetch(`${base}${CONFIG.cloud.api}/session`, { method: "OPTIONS", headers: { origin: SITE } })).status, 204);

    const page = await fetch(`${base}/piggy/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /js\/app\.js/);
    assert.equal((await fetch(`${base}/piggy/..%2f..%2fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/`, { redirect: "manual" })).headers.get("location"), "/piggy/");
  } finally {
    await close();
  }
});

test("a bank that isn't valid is cleaned before it is stored", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "piggy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { call, close } = await boot(dir);
  try {
    await call("POST", "/session", { key: KEY_A });
    await call("PUT", "/me/banks/odd", { key: KEY_A, body: { glaze: "neon", visibility: "everyone", entries: [{ at: "now", size: "giant", amount: 9 }], goal: -1 } });
    const [stored] = (await call("POST", "/session", { key: KEY_A })).json.banks;
    assert.equal(stored.id, "odd");
    assert.equal(stored.glaze, CONFIG.defaultGlaze);
    assert.equal(stored.visibility, CONFIG.defaultVisibility);
    assert.equal(stored.entries.length, 0);
    assert.equal(stored.goal, 0);
  } finally {
    await close();
  }
});
