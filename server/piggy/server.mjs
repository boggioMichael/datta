// The No Bank's sharing server. No dependencies: `node server/piggy/server.mjs` and it runs.
//
//   POST   /api/piggy/session            open (or create) the account of the device key in Authorization
//   PATCH  /api/piggy/me                 { name }
//   PUT    /api/piggy/me/banks/:id       a whole bank, as the page keeps it
//   DELETE /api/piggy/me/banks/:id
//   GET    /api/piggy/people             everyone with a shared bank
//   GET    /api/piggy/people/:id         one person's shared banks (unnamed ones without their name)
//   GET    /api/piggy/health
//
// It also serves the site's public/ folder, so the piggy page works at the same address.
// Environment: PIGGY_PORT, PIGGY_HOST, PIGGY_DATA, PIGGY_TUNNEL=0, PIGGY_POINTER=0, PIGGY_CLOUDFLARED.
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { SETTINGS, MESSAGES } from "./settings.mjs";
import { createAccounts } from "./accounts.mjs";
import { startTunnel, publishPointer } from "./tunnel.mjs";

const STATUS = Object.freeze({ ok: 200, created: 201, noContent: 204, moved: 302, bad: 400, unauthorized: 401, notFound: 404, method: 405, tooLarge: 413, conflict: 409, tooMany: 429 });
const METHOD = Object.freeze({ get: "GET", head: "HEAD", post: "POST", put: "PUT", patch: "PATCH", delete: "DELETE", options: "OPTIONS" });
const HEADER = Object.freeze({
  type: "content-type", cache: "cache-control", origin: "origin", auth: "authorization", vary: "vary", location: "location",
  allowOrigin: "access-control-allow-origin", allowMethods: "access-control-allow-methods", allowHeaders: "access-control-allow-headers",
  maxAge: "access-control-max-age", forwarded: "x-forwarded-for", cloudflare: "cf-connecting-ip", nosniff: "x-content-type-options",
});
const JSON_TYPE = "application/json; charset=utf-8";
const NO_STORE = "no-store";
const REVALIDATE = "no-cache";
const LONG_CACHE = "public, max-age=604800";
const BEARER = /^Bearer\s+(\S+)$/i;
const ID = "([A-Za-z0-9_-]{1,48})";
const INDEX = "index.html";
const TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": JSON_TYPE, ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8",
});
const CACHE_LONG = new Set([".woff2", ".png", ".jpg", ".webp", ".mp3", ".mp4"]);
const ERROR = Object.freeze({ key: "key", account: "account", body: "body", bank: "bank", rate: "rate", route: "route" });

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

/* ───────────────────────── small helpers ───────────────────────── */

function clientIp(req) {
  return req.headers[HEADER.cloudflare] || String(req.headers[HEADER.forwarded] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
}

function allowedOrigin(origin) {
  return Boolean(origin) && (SETTINGS.origins.includes(origin) || SETTINGS.localOrigin.test(origin));
}

function cors(req, res) {
  const origin = req.headers[HEADER.origin];
  res.setHeader(HEADER.vary, HEADER.origin);
  if (!allowedOrigin(origin)) return;
  res.setHeader(HEADER.allowOrigin, origin);
  res.setHeader(HEADER.allowMethods, Object.values(METHOD).join(", "));
  res.setHeader(HEADER.allowHeaders, `${HEADER.auth}, ${HEADER.type}`);
  res.setHeader(HEADER.maxAge, "600");
}

function send(res, status, body) {
  res.writeHead(status, { [HEADER.type]: JSON_TYPE, [HEADER.cache]: NO_STORE, [HEADER.nosniff]: "nosniff" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > SETTINGS.bodyLimit) { reject(new HttpError(STATUS.tooLarge, ERROR.body)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(new HttpError(STATUS.bad, ERROR.body)); }
    });
    req.on("error", reject);
  });
}

/** A fixed-window counter per key (an address, or an address per hour for new accounts). */
function createLimiter() {
  const windows = new Map();
  const timer = setInterval(() => {
    const t = Date.now();
    windows.forEach((w, key) => { if (t - w.start > w.span) windows.delete(key); });
  }, SETTINGS.rate.sweepMs);
  timer.unref();
  return (key, max, span) => {
    const t = Date.now();
    const w = windows.get(key);
    if (!w || t - w.start > span) { windows.set(key, { start: t, span, count: 1 }); return true; }
    w.count += 1;
    return w.count <= max;
  };
}

/* ───────────────────────── the server ───────────────────────── */

export async function createPiggyServer({ dataDir = SETTINGS.dataDir, publicDir = SETTINGS.publicDir, log = console } = {}) {
  const accounts = createAccounts({ dir: dataDir, log });
  await accounts.load();
  const allow = createLimiter();
  const HOUR = 3600000;

  function keyOf(req) {
    const match = String(req.headers[HEADER.auth] || "").match(BEARER);
    if (!match || !SETTINGS.keyPattern.test(match[1])) throw new HttpError(STATUS.unauthorized, ERROR.key);
    return match[1];
  }

  function me(req) {
    const account = accounts.find(keyOf(req));
    if (!account) throw new HttpError(STATUS.unauthorized, ERROR.account);
    return account;
  }

  const routes = [
    [METHOD.get, /^\/health$/, () => ({ ok: true, name: SETTINGS.name, version: SETTINGS.version })],
    [METHOD.post, /^\/session$/, (req) => {
      const key = keyOf(req);
      if (!accounts.find(key) && !allow(`new:${clientIp(req)}`, SETTINGS.rate.accountsPerHour, HOUR)) throw new HttpError(STATUS.tooMany, ERROR.rate);
      return accounts.own(accounts.open(key).account);
    }],
    [METHOD.patch, /^\/me$/, async (req) => {
      const account = me(req);
      const body = await readJson(req);
      return { name: accounts.setName(account, body.name) };
    }],
    [METHOD.put, new RegExp(`^/me/banks/${ID}$`), async (req, [id]) => {
      const account = me(req);
      const bank = accounts.putBank(account, await readJson(req), id);
      if (!bank) throw new HttpError(STATUS.conflict, ERROR.bank);
      return { id: bank.id, updatedAt: bank.updatedAt };
    }],
    [METHOD.delete, new RegExp(`^/me/banks/${ID}$`), (req, [id]) => ({ deleted: accounts.deleteBank(me(req), id) })],
    [METHOD.get, /^\/people$/, () => ({ people: accounts.people() })],
    [METHOD.get, new RegExp(`^/people/${ID}$`), (req, [id]) => {
      const person = accounts.person(id);
      if (!person) throw new HttpError(STATUS.notFound, ERROR.account);
      return person;
    }],
  ];

  async function api(req, res, path) {
    cors(req, res);
    if (req.method === METHOD.options) { res.writeHead(STATUS.noContent); res.end(); return; }
    if (!allow(`ip:${clientIp(req)}`, SETTINGS.rate.max, SETTINGS.rate.windowMs)) throw new HttpError(STATUS.tooMany, ERROR.rate);
    for (const [method, pattern, handler] of routes) {
      const match = path.match(pattern);
      if (!match) continue;
      if (req.method !== method) continue;
      send(res, STATUS.ok, await handler(req, match.slice(1)));
      return;
    }
    throw new HttpError(STATUS.notFound, ERROR.route);
  }

  async function file(req, res, path) {
    if (req.method !== METHOD.get && req.method !== METHOD.head) throw new HttpError(STATUS.method, ERROR.route);
    if (path === "/") { res.writeHead(STATUS.moved, { [HEADER.location]: SETTINGS.home }); res.end(); return; }
    let decoded;
    try { decoded = decodeURIComponent(path); } catch { throw new HttpError(STATUS.bad, ERROR.route); }
    const target = normalize(join(publicDir, decoded));
    if (target !== publicDir && !target.startsWith(publicDir + sep)) throw new HttpError(STATUS.notFound, ERROR.route);
    let full = target;
    let info = await stat(full).catch(() => null);
    if (info?.isDirectory()) {
      if (!path.endsWith("/")) { res.writeHead(STATUS.moved, { [HEADER.location]: `${path}/` }); res.end(); return; }
      full = join(full, INDEX);
      info = await stat(full).catch(() => null);
    }
    if (!info?.isFile()) throw new HttpError(STATUS.notFound, ERROR.route);
    const ext = extname(full).toLowerCase();
    res.writeHead(STATUS.ok, {
      [HEADER.type]: TYPES[ext] || "application/octet-stream",
      [HEADER.cache]: CACHE_LONG.has(ext) ? LONG_CACHE : REVALIDATE,
      [HEADER.nosniff]: "nosniff",
    });
    if (req.method === METHOD.head) { res.end(); return; }
    createReadStream(full).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, "http://piggy").pathname;
    try {
      if (path === SETTINGS.api || path.startsWith(`${SETTINGS.api}/`)) await api(req, res, path.slice(SETTINGS.api.length) || "/");
      else await file(req, res, path);
    } catch (error) {
      if (!(error instanceof HttpError)) log.error(error);
      if (!res.headersSent) send(res, error.status || 500, { error: error.code || ERROR.route });
      else res.end();
    }
  });

  return { server, accounts };
}

/* ───────────────────────── run ───────────────────────── */

async function main() {
  const { server, accounts } = await createPiggyServer();
  let tunnel = null;
  server.listen(SETTINGS.port, SETTINGS.host, () => {
    console.log(MESSAGES.listening(`http://localhost:${SETTINGS.port}`));
    if (!SETTINGS.tunnel.enabled) return;
    tunnel = startTunnel({
      port: SETTINGS.port,
      onUrl: (url) => {
        console.log(MESSAGES.tunnel(url));
        if (!SETTINGS.pointer.enabled) return;
        publishPointer(url)
          .then((branch) => console.log(MESSAGES.pointer(branch)))
          .catch((error) => console.warn(MESSAGES.pointerFailed(String(error.message || error).split("\n")[0])));
      },
    });
  });
  const stop = async () => {
    console.log(MESSAGES.stopping);
    tunnel?.stop();
    await accounts.flush();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
