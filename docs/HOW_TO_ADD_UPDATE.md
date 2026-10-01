# How to add a build-log entry (under a minute)

Open `content/updates.yaml` and add a block anywhere in the list — the build sorts by date:

```yaml
- date: 2026-10-14
  project: projects/rasa              # optional: collection/slug — links the entry to the project page
  title: { en: "Batch 12: first stable water-based texture", he: "אצווה 12: הטקסטורה היציבה הראשונה על מים" }
  text:                               # optional: one or two sentences
    en: "Three tastings in a row within spec."
    he: "שלוש טעימות ברצף בתוך הספק."
  link: https://…                     # optional: a commit, a video, a document
```

Then `npm run build`. The entry appears on `/updates`, in the home-page log (latest four), in the project's "Related" block, in the RSS feed and in the search index.

Rules of the log: only things that happened, dated when they happened. No manufactured history.

# How to update "Currently building" (/now)

Open `content/now.yaml`:

```yaml
asOf: 2026-10-14
items:
  - project: projects/rasa
    title: { en: "Rasa", he: "ראסא" }
    text: { en: "What is being done right now, one sentence.", he: "…" }
```

The home page shows the first four items; `/now` shows all of them with the `asOf` date. Keep it to five or six.
