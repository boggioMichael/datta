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
  - music/neshikot-batzintzenet
```

**Nothing is published by accident.** A piece with `public: false` has no page and no text on the site — only its title, type, language and status in the drawer. Set `public: true` when it is ready. Links to unpublished pieces resolve to the drawer, never to a missing page.

Which file holds the text? The site has two languages; a Spanish poem goes in `en.md` (shown to English readers) and, if you want, the same poem again in `he.md` (shown to Hebrew readers, perhaps with a Hebrew note). The `language:` field tells the page how to set direction and typography for the text itself.

Typography on writing pages is set for long-form reading: wider leading, narrower measure, larger size. Use `##` sparingly; blank lines separate stanzas.

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
