# DATTA / דאטא — studio website

The public website of Datta, Michael Boggio's independent studio. Bilingual (English + Hebrew, real RTL), static, content-driven.

- **No framework.** React components are rendered to static HTML at build time by `build.ts` (a few hundred lines). The browser runs one small script (menu, ⌘K search, index filter, contact form).
- **Everything is a file.** Projects, lab entries, music, writing, research and civic pages live in `content/<collection>/<slug>/` as `meta.yaml` + `en.md` + `he.md`. The build log is `content/updates.yaml`; the "currently building" strip is `content/now.yaml`.
- **Nothing unfinished leaks.** `<!-- TODO … -->` markers and `todo:` lists are collected into the build report and never rendered. The build fails links that go nowhere and flags the word "TODO" in any page.

## Quick start

```sh
npm install          # react, react-dom, marked, js-yaml, tsx, typescript (+ optional playwright, sharp)
npm run dev          # build, serve at http://localhost:4321, rebuild on change
npm run build        # production build → dist/
npm run validate     # build and exit non-zero on broken links / leaked TODOs
npm run check        # TypeScript type-check
```

Node 20 or newer. The output in `dist/` is plain files; host it anywhere (see `docs/DEPLOY.md`).

## Layout

```
build.ts                 the whole build (render, copy, sitemap, robots, RSS, search index, link check)
src/site.ts              site config: name, URL, locales, contact, analytics
src/i18n.ts              UI strings in both languages
src/content/schema.ts    the content model (all fields optional unless noted)
src/content/load.ts      loader + validation
src/render/              React components, layout, pages, markdown pipeline
src/assets/site.css      the design system (tokens, typography, layout, RTL)
src/assets/site.js       the only client-side script
content/                 all content (see docs/)
public/                  static files: fonts, images, diagrams, OG images, media
tools/                   font conversion, screenshots, OG image generation
docs/                    how to add things, how to deploy
```

## Editing

- Add a project: `docs/HOW_TO_ADD_PROJECT.md`
- Add writing or research: `docs/HOW_TO_ADD_WRITING.md`
- Add a build-log entry or update "Now": `docs/HOW_TO_ADD_UPDATE.md`
- Deploy: `docs/DEPLOY.md`

## Conventions

- Hebrew is written, not translated. If `he.md` is missing, the English body is shown with a one-line notice; the metadata still renders in Hebrew.
- Status vocabulary is fixed (`src/content/schema.ts`). Paused, complete, archived and failed entries move to `/archive` automatically.
- Numbers on the site are measured or verified. Visions are labelled as visions. Keep it that way.
- Private material (cost plans, drafts, family details) does not go into `content/` — the repository may become public. The `economics` block exists for business-level figures you are willing to publish; flip `public: true` when you are.

Fonts: Newsreader, Frank Ruhl Libre, Assistant, IBM Plex Mono — all under the SIL Open Font License (licences in `public/fonts/`). Map image on the civic page © OpenStreetMap contributors.
