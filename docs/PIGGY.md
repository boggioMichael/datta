# קופת הלא · The No Bank (`/piggy/`)

A mental savings jar. Tap the pig every time you say no to yourself; the chosen size of
"no" flies into the slot as a coin, a bill or a gold bar, and the register rolls. Several
banks (plans), each its own pig with its own colour, goal, worth per no, history and daily
report. Banks can be shown to everyone; anyone can look at the banks others chose to show.

The page is `public/piggy/` (copied as-is into the build). Its lab page is `content/lab/piggy/`.
The sharing server is `server/piggy/`.

## Files

| File | What it holds |
| --- | --- |
| `js/config.js` | Every tunable: sizes of no and their default worth, money tones, pig glazes, visibility, currencies, limits, timings, motion, sound recipes, the server pointer |
| `js/strings.js` | Every word, in Hebrew and English, and `KEYS`, the keys the scripts use |
| `js/store.js` | The saved state (localStorage key `datta.piggy`), validated on every read; backups; merging banks from the server. `sanitizePlan` is shared with the server |
| `js/cloud.js` | The automatic account, the outbox that mirrors your banks to the server, people and their shared banks |
| `js/report.js` | The daily report: columns per day, summary, tooltip |
| `js/art.js` | Pure SVG builders: the pig, the guilloche rosette, coin, bill, gold bar, hammer |
| `js/stage.js` | Flights into the slot, the pig's reactions, gilding, breaking the pig |
| `js/register.js` | The rolling number wheels |
| `js/fx.js`, `js/sound.js`, `js/haptics.js` | Particles, synthesised sounds, taps you can feel |
| `js/app.js` | The page controller |
| `sw.js` | Offline support (network first, cache as fallback; server answers are never cached). Bump `VERSION` when the file list changes |
| `../shared/datta-home.js` | `<datta-home>`, the way back to the main site, used by every sub-site |

## Sharing, and the server

There is no sign-up. On first visit the page makes a random 32-byte key and keeps it in the
browser (`datta.piggy.device`). It shows the key to the server, which opens an account behind
it and stores only its hash. Settings → Account key copies the key; pasting it on another
device opens the same account there (its banks replace the ones on that device).

Each bank's `visibility` is `private` (default), `public`, or `unnamed` (shown without its name).
The page is local-first: every change is saved on the device at once and queued in an outbox
(`datta.piggy.outbox`) that goes up as soon as the server answers.

The page finds the server at its own address (when the server serves it), else through
`server.json` on the `piggy-server` branch of this repository, which the server publishes
each time it starts (`CONFIG.cloud.pointer`).

### Running the server (Windows, for now)

Once, in PowerShell: Node.js 20+, cloudflared (for the public address) and git, then a copy of
the site (open a new window after the installs, so git is on the path):

```powershell
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Cloudflare.cloudflared
winget install -e --id Git.Git
git clone https://github.com/boggioMichael/datta "$HOME\GitHub\datta"
```

Then double-click `server/piggy/start-piggy-server.cmd` (or run `node server/piggy/server.mjs`).
The launcher first fast-forwards the copy to the latest `main`, so the server always matches the
live page, then starts the server.

It serves the site's `public/` folder at `http://localhost:8787/piggy/`, opens a Cloudflare
quick tunnel (a new `https://….trycloudflare.com` address on every start), and pushes that
address to the `piggy-server` branch with your git credentials, so the live site finds it within
a minute. Close the window to stop it. Accounts live in `server/piggy/data/` (one JSON file per
account, not in git).

Environment: `PIGGY_PORT` (8787), `PIGGY_HOST` (127.0.0.1; `0.0.0.0` for the home network),
`PIGGY_DATA`, `PIGGY_TUNNEL=0` (no tunnel), `PIGGY_POINTER=0` (don't publish the address),
`PIGGY_CLOUDFLARED` (path to cloudflared).

API (`/api/piggy`): `POST /session`, `PATCH /me`, `PUT|DELETE /me/banks/:id`, `GET /people`,
`GET /people/:id`, `GET /health`. Writes need `Authorization: Bearer <device key>`.

Moving it to a permanent host later is the same program on any machine with Node; point
`CONFIG.cloud.pointer` (or the published `server.json`) at it.

## Common changes

- **Add a size of no:** add an entry to `CONFIG.sizes` and a `size.<id>` string in each language.
- **Add a pig colour:** add an entry to `CONFIG.glazes` and a `glaze.<id>` string in each language.
- **Add a language:** add it to `CONFIG.locales` and a full table to `STRINGS`.

`npm test` checks that every key exists in every language, that saves and backups behave,
and the server's accounts, visibility, CORS and file serving.

## Icons

`public/piggy/icons/` is rendered from the same art. After changing the pig:

```sh
python3 -m http.server 4321 --directory public   # or any static server for public/
node tools/piggy-icons.mjs http://localhost:4321
```
