// The piggy server's settings. Everything shared with the page (API path, key format, limits,
// visibility) comes from the page's own config, so the two can never disagree.
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { CONFIG, VISIBILITY } from "../../public/piggy/js/config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;

export { CONFIG, VISIBILITY };

export const SETTINGS = Object.freeze({
  name: "datta-piggy",
  version: 1,
  root: resolve(HERE, "../.."),
  publicDir: resolve(HERE, "../../public"),
  dataDir: env.PIGGY_DATA || join(HERE, "data"),
  host: env.PIGGY_HOST || "127.0.0.1",
  port: Number(env.PIGGY_PORT) || 8787,
  home: "/piggy/",
  api: CONFIG.cloud.api,
  keyPattern: new RegExp(CONFIG.cloud.keyPattern),
  idPattern: /^[A-Za-z0-9_-]{4,48}$/,
  idBytes: 6,
  keyHash: "sha256",
  nameLength: CONFIG.limits.nameLength,
  bodyLimit: 2 * 1024 * 1024,
  writeDelayMs: 400,
  personEntries: 5000,
  peopleLimit: 100,
  rate: { windowMs: 10000, max: 120, accountsPerHour: 30, sweepMs: 60000 },
  origins: ["https://boggiomichael.github.io"],
  localOrigin: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/,
  tunnel: {
    enabled: env.PIGGY_TUNNEL !== "0",
    command: env.PIGGY_CLOUDFLARED || "cloudflared",
    args: (port) => ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`],
    url: /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/,
    restartMs: 10000,
  },
  pointer: {
    enabled: env.PIGGY_POINTER !== "0",
    remote: "origin",
    branch: "piggy-server",
    file: "server.json",
    author: { name: "DATTA piggy server", email: "piggy-server@users.noreply.github.com" },
  },
});

/** Everything the server prints. */
export const MESSAGES = Object.freeze({
  listening: (url) => `piggy server: ${url}${SETTINGS.home}`,
  tunnel: (url) => `public address: ${url}${SETTINGS.home}`,
  tunnelMissing: "cloudflared is not installed, so only this computer can reach the server. Install it with:  winget install --id Cloudflare.cloudflared",
  tunnelLost: "the tunnel stopped; starting it again …",
  pointer: (branch) => `the site now points at this server (branch ${branch})`,
  pointerFailed: (reason) => `could not publish the address for the site (${reason}). Share the public address by hand.`,
  skipped: (file) => `skipped an unreadable account file: ${file}`,
  stopping: "saving and stopping …",
});
