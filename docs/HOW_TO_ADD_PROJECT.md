# How to add a project (≈ 5 minutes)

A project is a folder. Lab entries, music, civic pages work exactly the same way — only the collection folder changes.

```
content/projects/<slug>/
  meta.yaml     metadata (required)
  en.md         English body (required; sections are free-form markdown)
  he.md         Hebrew body (optional; English is shown with a notice if missing)
```

The slug becomes the URL: `content/projects/rasa/` → `/en/projects/rasa/` and `/he/projects/rasa/`.

Collections and where they appear:

| folder | section | notes |
| --- | --- | --- |
| `content/projects/` | Projects | ventures and products; `featured: true` + `weight: 1` makes it a flagship |
| `content/lab/` | Lab | experiments, libraries, ideas |
| `content/music/` | Music | album/identity/performance pages; supports `songs`, `credits`, `audio`, `videos` |
| `content/research/` | Research | notes; set `kind:` (question, hypothesis, speculative-model, experiment, prototype, technical-note, literature-note) |
| `content/writing/` | Writing | see HOW_TO_ADD_WRITING.md |
| `content/civic/` | Civic | kept out of the investment funnel automatically |

## 1. The minimum `meta.yaml`

```yaml
title: { en: "Rasa", he: "ראסא" }
summary:
  en: "One sentence. What it is and where it stands."
  he: "משפט אחד. מה זה ואיפה זה עומד."
category: { en: "Food · product R&D", he: "אוכל · מו״פ מוצר" }
status: product-development
```

Any field that accepts `{ en, he }` also accepts a plain string (treated as English).

`status` must be one of: `live`, `product-development`, `in-development`, `prototype`, `research`, `recording`, `in-production`, `writing`, `concept`, `active`, `paused`, `complete`, `archived`, `failed`. The last four move the entry to the Archive.

## 2. Everything else is optional

Sections only render when the field is present — never add placeholders.

```yaml
subtitle: { en: "One line under the title.", he: "…" }
started: "2026-07"          # YYYY or YYYY-MM
updated: "2026-09-27"       # YYYY-MM-DD (shown; also used for sitemap lastmod)
featured: true              # show on the home page and the top of /projects
weight: 1                   # 1 = large card, 2 = medium, 3 = small (home page + section pages)
order: 1                    # sort order within its section (lower first)
accent: "#7E9A5A"           # the project's own colour (card rule, status dot, funding card)
milestone: { en: "Current milestone, one line", he: "…" }
github: https://github.com/…
website: https://…
demo: https://…
links:                      # extra links in the metadata table
  - { label: { en: "Evidence branch", he: "ענף הראיות" }, url: https://… }
languages: ["Rust"]         # programming or human languages, free text
collaborators:
  - { name: { en: "Name", he: "שם" }, role: { en: "producer", he: "מפיק" }, url: https://… }

hero:                       # image or video at the top
  src: /images/<project>/hero.webp
  alt: { en: "…", he: "…" }
  caption: { en: "…", he: "…" }
  # video: /media/x.mp4   poster: /images/x.webp
gallery:
  - { src: /images/<project>/1.webp, alt: { en: "…", he: "…" }, caption: { en: "…", he: "…" } }

builtLevels:                # the BUILT / PROTOTYPED / RESEARCHING / VISION grid
  built:        { en: ["…", "…"], he: ["…", "…"] }
  prototyped:   { en: ["…"], he: ["…"] }
  researching:  { en: ["…"], he: ["…"] }
  vision:       { en: ["…"], he: ["…"] }

metrics:                    # numbers, each tagged with its evidence class
  - { label: { en: "mean perception per frame", he: "…" }, value: "43.2 ms", kind: measured }   # measured | verified | designed | planned
evidence:
  - { label: { en: "Source code", he: "קוד" }, url: https://…, kind: code }   # code | demo | recording | document | screenshot | data | performance | release
timeline:
  - { date: "2026-09", text: { en: "…", he: "…" } }
milestones:
  - { text: { en: "…", he: "…" }, done: true, date: "2026-09" }
lessons: { en: ["What we learned …"], he: ["…"] }     # shown on archived entries and in /archive

economics:                  # rendered only when public: true
  public: false
  costToDate: { en: "…" }
  revenue: { en: "…" }
  monthlyBurn: { en: "…" }
  unitEconomics: { en: "…" }
  target: { en: "…" }
  nextMilestone: { en: "…" }
  note: { en: "…" }

funding:                    # the <FundingCard>; appears on the page and under /support
  type: investment          # investment | sponsorship | patronage | collaboration | grant | bootstrapped
  public: true
  stage: { en: "…", he: "…" }
  exists: { en: "…", he: "…" }
  next: { en: "…", he: "…" }
  ask: { en: "≈ ₪11,000 — …", he: "…" }     # a real number or nothing; never a valuation
  useOfFunds: { en: "…", he: "…" }
  unlocks: { en: "…", he: "…" }
  status: { en: "…", he: "…" }

opportunity:                # the investor "Opportunity" block
  what: { en: "…", he: "…" }
  why: { en: "…", he: "…" }
  exists: { en: "…", he: "…" }
  next: { en: "…", he: "…" }
  support: { en: "…", he: "…" }

sponsor:                    # "Become part of the work" — concrete, fundable pieces
  - { title: { en: "A recording session", he: "…" }, detail: { en: "…", he: "…" }, amount: { en: "₪…", he: "…" } }

related:                    # cross-links (reverse links are added automatically)
  - lab/syrup
  - research/pixel-only-perception-measured

todo:                       # your private notes; shown only in the build report
  - "Add photos when they exist."
```

Music-only fields: `credits`, `instrumentation`, `songs` (each `{ title, note, status, writing, audio, public }`), `audio` (each `{ title, src, public, note }`), `videos` (each `{ title, youtube }` or `{ title, src }`).

Research-only fields: `kind`, `references` (list of strings), `revisions` (`{ date, text }`).

## 3. The body (`en.md` / `he.md`)

Plain markdown. Use `##` headings for sections (Problem, Idea, Approach, What exists, Roadmap … whatever the project needs). A few components are available:

```md
<Figure src="/images/x.webp" alt="…" caption="…" wide/>
<Video src="/media/x.mp4" poster="/images/x.webp" caption="…"/>
<Video youtube="VIDEO_ID" title="…"/>
<Audio src="/audio/x.mp3" title="…" note="…"/>
<Pdf src="/docs/x.pdf" title="…"/>
<Diagram src="/diagrams/x.svg" caption="…" alt="…" wide/>      <!-- inlined SVG; uses currentColor, so it works in dark mode -->
<Repo url="https://github.com/…" note="Rust · MIT"/>
<Callout kind="note" title="…">markdown inside</Callout>       <!-- kind: note | todo | warning -->
[[projects/rasa]] or [[projects/rasa|custom label]]             <!-- link to another entry by reference -->
<!-- TODO: anything here is collected in the build report and never rendered -->
```

Images: put them in `public/images/<project>/`, prefer WebP, keep each under ~200 KB. Video: `public/media/`. Audio: `public/audio/`.

## 4. Build and check

```sh
npm run build
```

The report lists content warnings (missing fields, bad references), problems (broken links, leaked TODOs) and your TODO notes. Fix the first two; the third is for you.
