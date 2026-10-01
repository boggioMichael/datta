## How it is built

Every page on this site is produced by a few hundred lines of TypeScript: content folders of `meta.yaml` plus `en.md` and `he.md` are loaded, validated and cross-linked; React components render them to static HTML; the build writes the pages, a search index, a sitemap, an RSS feed of the build log, and a report of broken links and leftover placeholders. There is no framework and no database. The only script the browser runs handles the menu, the ⌘K search, the index filter and the contact form.

## Why

- **It should feel instant.** Static HTML, one stylesheet, four subsetted fonts, no hydration.
- **Hebrew is not an afterthought.** Every page exists in both languages with its own direction, its own serif, and copy written rather than translated.
- **Adding work should take minutes.** A project is a folder; an update is three lines in a YAML file.
- **Nothing unfinished leaks.** Placeholder markers are collected into a build report and never rendered.

## What it deliberately does not do

No tracking by default. No cookies. No comments. No newsletter pop-up. Analytics, if enabled, is a single privacy-respecting script that counts page views and the handful of buttons that matter.
