// A public address for a server on a home computer: a Cloudflare quick tunnel (no account needed),
// restarted if it drops. Each new address is published as server.json on its own branch of the
// site's repository, where the page looks for it — so nobody has to copy addresses around.
import { spawn, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { SETTINGS, MESSAGES } from "./settings.mjs";

const GIT = "git";
const NOT_FOUND = "ENOENT";
const FILE_MODE = "100644 blob";

/** cloudflared as configured, then every installed copy that the PATH of this window may not know about. */
export function tunnelCommands({ command, installed } = SETTINGS.tunnel, exists = existsSync) {
  return [command, ...installed.filter((path) => path !== command && exists(path))];
}

export function startTunnel({ port, onUrl, log = console, commands = tunnelCommands() }) {
  const { args, url: pattern, restartMs } = SETTINGS.tunnel;
  let child = null;
  let stopped = false;
  let pick = 0;

  function run() {
    let announced = false;
    child = spawn(commands[pick], args(port), { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const scan = (chunk) => {
      const match = String(chunk).match(pattern);
      if (!match || announced) return;
      announced = true;
      onUrl(match[0]);
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    // A command that can't start emits only "error" (never "exit"): try the next copy, if any.
    child.on("error", (error) => {
      if (stopped) return;
      pick += 1;
      if (pick < commands.length) { run(); return; }
      stopped = true;
      if (error.code === NOT_FOUND) log.warn(MESSAGES.tunnelMissing); else log.error(error);
    });
    child.on("exit", () => {
      if (stopped) return;
      log.warn(MESSAGES.tunnelLost);
      setTimeout(run, restartMs);
    });
  }

  run();
  return { stop() { stopped = true; child?.kill(); } };
}

function git(args, { cwd, input, env }) {
  return new Promise((resolve, reject) => {
    const proc = execFile(GIT, args, { cwd, env: { ...process.env, ...env } }, (error, stdout) => (error ? reject(error) : resolve(String(stdout).trim())));
    if (input != null) proc.stdin.end(input);
  });
}

/** Commit {url, startedAt} as the only file on the pointer branch and force-push it. */
export async function publishPointer(url, { root = SETTINGS.root } = {}) {
  const { remote, branch, file, author } = SETTINGS.pointer;
  const env = {
    GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email,
    GIT_COMMITTER_NAME: author.name, GIT_COMMITTER_EMAIL: author.email,
    GIT_TERMINAL_PROMPT: "0",
  };
  const body = `${JSON.stringify({ url, startedAt: new Date().toISOString() }, null, 2)}\n`;
  const blob = await git(["hash-object", "-w", "--stdin"], { cwd: root, input: body, env });
  const tree = await git(["mktree"], { cwd: root, input: `${FILE_MODE} ${blob}\t${file}\n`, env });
  const commit = await git(["commit-tree", tree, "-m", url], { cwd: root, env });
  await git(["push", "--force", "--quiet", remote, `${commit}:refs/heads/${branch}`], { cwd: root, env });
  return branch;
}
