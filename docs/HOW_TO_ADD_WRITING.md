# How to add writing or a research note (≈ 3 minutes)

## Writing

```
content/writing/<slug>/
  meta.yaml
  en.md        the text (or the Hebrew/Spanish text — the file name says which site language shows it, not the text's language)
  he.md        optional
```

```yaml
title: { en: "Si quieres", he: "Si quieres" }
summary: { en: "One line about the piece.", he: "…" }
category: { en: "Poetry", he: "שירה" }
status: writing            # writing | complete | concept | archived …
type: poetry               # essay | poetry | lyrics | fiction | literary-experiment | philosophy | technical-note | screenplay | notes
language: es               # en | he | es — the language the text itself is written in
date: "2026-08"            # publication / writing date
public: false              # false = listed in the "In the drawer" table, title only, no page
excerptOnly: true          # optional: marks the page as an excerpt from a longer work
related:
  - music/well-tempered-clavier
```

**Nothing is published by accident.** A piece with `public: false` has no page and no text on the site — only its title, type, language and status in the drawer. Set `public: true` when it is ready. Links to unpublished pieces resolve to the drawer, never to a missing page.

Which file holds the text? The site has two languages; a Spanish poem goes in `en.md` (shown to English readers) and, if you want, the same poem again in `he.md` (shown to Hebrew readers, perhaps with a Hebrew note). The `language:` field tells the page how to set direction and typography for the text itself.

Typography on writing pages is set for long-form reading: wider leading, narrower measure, larger size. Use `##` sparingly; blank lines separate stanzas.

### Publishing a draft honestly

A work in progress can be published as it stands — the page then says so. Anything whose `status` is not `complete` shows its status next to the title, and `note:` adds one plain line under it:

```yaml
status: in-production
note:
  en: "Working draft, published as it stands. The bar scene is still to be written."
  he: "טיוטת עבודה, מתפרסמת כפי שהיא. סצנת הבר עוד לא נכתבה."
```

Say what is missing and how any recording was made (a synthetic voice is labelled as one). The build log (`content/updates.yaml`) gets a dated entry when a piece is published.

### A reading or narration

Writing entries take the same `audio:` list as music entries; it renders a player above the text, and the writing index shows a NARRATION tag:

```yaml
audio:
  - title: { en: "Full narration, 22½ minutes", he: "הקראה מלאה, 22 וחצי דקות" }
    src: /audio/a-limit-narration.mp3        # file under public/audio/
    public: true                             # false keeps it off the site
    note: { en: "Synthetic voice (ElevenLabs) · September 2026", he: "…" }
```

Keep files small enough to stream from a static host: speech is fine at 64–96 kbps mono MP3 (`ffmpeg -i in.mp3 -ac 1 -b:a 96k out.mp3`). The same `audio:` list on the related project's `meta.yaml` puts the player on the project page too.

### Screenplays

With `type: screenplay`, two shorthands are expanded before markdown:

```
## INT. KITCHEN — NIGHT          a scene heading (plain ## heading, styled as a slugline)
### Scene 2 — The First Paradox   a scene label (### heading)
== A LIMIT ==                    a centred title card

MATHEO (thinking): Where's the car?        a dialogue block: CUE (parenthetical): line
FATHER: ...Grandpa died today.
```

Action lines are ordinary paragraphs. A cue must be upper-case and end with a colon; a continuation line inside the same paragraph that is wrapped in parentheses renders as a parenthetical. A missing scene is marked where it belongs with a `<Callout kind="note" title="Still to be written">…</Callout>` rather than silently skipped.

## Research

```
content/research/<slug>/
  meta.yaml
  en.md
  he.md
```

```yaml
title: { en: "…", he: "…" }
subtitle: { en: "…", he: "…" }
summary: { en: "…", he: "…" }
category: { en: "Philosophy of mind", he: "…" }
status: active
kind: speculative-model    # question | hypothesis | speculative-model | experiment | prototype | technical-note | literature-note
updated: "2026-10-01"
date: "2026-10-01"
references:
  - "Author. Title. Year."
revisions:
  - { date: "2026-10-01", text: { en: "Published.", he: "פורסם." } }
evidence:
  - { label: { en: "Raw data", he: "…" }, url: https://…, kind: data }
related:
  - projects/a-limit
```

Label honestly. The `kind` is printed in a box at the top of the page; the research index sorts by it. A hypothesis is a hypothesis.

Suggested section order for a note (use what applies): Abstract · Question · Background · Model · Assumptions · Mathematics · Experiment · Counterarguments · Open questions. References go in `meta.yaml` so they render in the sidebar with anchors (`#ref-3`); cite in the text as `[3]` or `(Author, year)`.

Formulas: inline markdown is fine for most; for a displayed formula use `<p class="formula">L —[ΔT → 0]→ D</p>` (add `dir="ltr"` in Hebrew files).
