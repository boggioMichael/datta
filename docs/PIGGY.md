# קופת הלא · The No Bank (`/piggy/`)

A mental savings jar. Tap the pig every time you say no to yourself; the chosen size of
"no" flies into the slot as a coin, a bill or a gold bar, and the register rolls. Several
banks (plans), each its own pig with its own colour, goal, worth per no and history.

It is a standalone page in `public/piggy/`, copied as-is into the build. It is not linked
from the site's menus and carries `noindex`.

## Files

| File | What it holds |
| --- | --- |
| `js/config.js` | Every tunable: sizes of no and their default worth, money tones, pig glazes, currencies, limits, timings, motion, sound recipes, haptic patterns |
| `js/strings.js` | Every word, in Hebrew and English, and `KEYS`, the keys the scripts use |
| `js/store.js` | The saved state (localStorage key `datta.piggy`), validated on every read; backups |
| `js/art.js` | Pure SVG builders: the pig, the guilloche rosette, coin, bill, gold bar, hammer |
| `js/stage.js` | Flights into the slot, the pig's reactions, gilding, breaking the pig |
| `js/register.js` | The rolling number wheels |
| `js/fx.js`, `js/sound.js`, `js/haptics.js` | Particles, synthesised sounds, taps you can feel |
| `js/app.js` | The page controller |
| `sw.js` | Offline support (network first, cache as fallback). Bump `VERSION` when the file list changes |

## Common changes

- **Add a size of no:** add an entry to `CONFIG.sizes` and a `size.<id>` string in each language.
- **Add a pig colour:** add an entry to `CONFIG.glazes` and a `glaze.<id>` string in each language.
- **Add a language:** add it to `CONFIG.locales` and a full table to `STRINGS`.

`npm test` checks that every key exists in every language and that saves and backups behave.

## Icons

`public/piggy/icons/` is rendered from the same art. After changing the pig:

```sh
python3 -m http.server 4321 --directory public   # or any static server for public/
node tools/piggy-icons.mjs http://localhost:4321
```

## Data

Everything stays in the browser that made it. An iPhone home-screen app keeps its own storage,
separate from Safari, so moving between them (or to another device) goes through
Settings → backup and restore.
