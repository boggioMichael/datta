import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import yaml from "js-yaml";
import {
  ARCHIVE_STATUSES,
  STATUS_LABEL,
  type Collection,
  type Entry,
  type L10n,
  type Meta,
  type NowData,
  type UpdateEntry,
} from "./schema.ts";

export interface Site {
  entries: Entry[];
  byRef: Map<string, Entry>;
  updates: UpdateEntry[];
  now: NowData;
  pages: Map<string, { en: string; he?: string; meta: Record<string, unknown> }>;
  warnings: string[];
  todos: string[];
}

const COLLECTIONS: Collection[] = ["projects", "lab", "music", "writing", "research", "civic"];

function readIf(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function isL10n(v: unknown): v is L10n {
  return !!v && typeof v === "object" && typeof (v as L10n).en === "string";
}

/** Accept either a plain string (English) or {en, he}. */
function l10n(v: unknown, field: string, where: string, warnings: string[], required = false): L10n | undefined {
  if (v === undefined || v === null) {
    if (required) warnings.push(`${where}: missing required field "${field}"`);
    return undefined;
  }
  if (typeof v === "string") return { en: v };
  if (isL10n(v)) return v;
  warnings.push(`${where}: field "${field}" must be a string or {en, he}`);
  return undefined;
}

function normalizeMeta(raw: Record<string, unknown>, collection: Collection, slug: string, warnings: string[]): Meta {
  const where = `${collection}/${slug}`;
  const meta = { ...raw } as unknown as Meta;
  meta.slug = slug;
  meta.collection = collection;
  meta.title = l10n(raw.title, "title", where, warnings, true) ?? { en: slug };
  meta.summary = l10n(raw.summary, "summary", where, warnings, true) ?? { en: "" };
  meta.category = l10n(raw.category, "category", where, warnings, true) ?? { en: "" };
  for (const f of ["subtitle", "tagline", "milestone"] as const) {
    const v = l10n(raw[f], f, where, warnings);
    if (v) (meta as unknown as Record<string, unknown>)[f] = v;
  }
  if (!raw.status || !(raw.status as string in STATUS_LABEL)) {
    warnings.push(`${where}: unknown status "${raw.status}" — using "concept"`);
    meta.status = "concept";
  }
  if (meta.weight && ![1, 2, 3].includes(meta.weight)) warnings.push(`${where}: weight must be 1, 2 or 3`);
  return meta;
}

/** Strip <!-- TODO ... --> markers, collecting them for the build report. */
function extractTodos(md: string, where: string, todos: string[]): string {
  return md.replace(/<!--\s*TODO:?\s*([\s\S]*?)-->/g, (_, text: string) => {
    todos.push(`${where}: ${text.trim()}`);
    return "";
  });
}

export function loadSite(root: string): Site {
  const warnings: string[] = [];
  const todos: string[] = [];
  const entries: Entry[] = [];
  const contentDir = join(root, "content");

  for (const collection of COLLECTIONS) {
    const dir = join(contentDir, collection);
    if (!existsSync(dir)) continue;
    for (const slug of readdirSync(dir).sort()) {
      const entryDir = join(dir, slug);
      if (!statSync(entryDir).isDirectory()) continue;
      const metaPath = join(entryDir, "meta.yaml");
      if (!existsSync(metaPath)) {
        warnings.push(`${collection}/${slug}: no meta.yaml — skipped`);
        continue;
      }
      const raw = (yaml.load(readFileSync(metaPath, "utf8"), { schema: yaml.CORE_SCHEMA }) ?? {}) as Record<string, unknown>;
      const meta = normalizeMeta(raw, collection, slug, warnings);
      const en = readIf(join(entryDir, "en.md"));
      const he = readIf(join(entryDir, "he.md"));
      if (en === undefined) warnings.push(`${collection}/${slug}: missing en.md`);
      if (Array.isArray(meta.todo)) for (const t of meta.todo) todos.push(`${collection}/${slug}: ${t}`);
      entries.push({
        meta,
        body: {
          en: extractTodos(en ?? "", `${collection}/${slug}/en.md`, todos),
          he: he === undefined ? undefined : extractTodos(he, `${collection}/${slug}/he.md`, todos),
        },
        dir: entryDir,
      });
    }
  }

  const byRef = new Map<string, Entry>();
  for (const e of entries) byRef.set(`${e.meta.collection}/${e.meta.slug}`, e);

  // Validate cross references.
  for (const e of entries) {
    for (const ref of e.meta.related ?? []) {
      if (!byRef.has(ref)) warnings.push(`${e.meta.collection}/${e.meta.slug}: related ref "${ref}" does not exist`);
    }
    for (const s of e.meta.songs ?? []) {
      if (s.writing && !byRef.has(`writing/${s.writing}`)) warnings.push(`${e.meta.collection}/${e.meta.slug}: song "${s.title.en}" points to missing writing/${s.writing}`);
    }
  }

  // Updates (build log): a single YAML list, newest first after sorting.
  const updatesRaw = (yaml.load(readIf(join(contentDir, "updates.yaml")) ?? "[]", { schema: yaml.CORE_SCHEMA }) ?? []) as UpdateEntry[];
  const updates = updatesRaw
    .map((u) => ({ ...u, title: typeof u.title === "string" ? { en: u.title } : u.title, text: typeof u.text === "string" ? { en: u.text } : u.text }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const u of updates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(u.date)) warnings.push(`updates: bad date "${u.date}" (use YYYY-MM-DD)`);
    if (u.project && !byRef.has(u.project)) warnings.push(`updates: project ref "${u.project}" does not exist`);
  }

  // Now
  const nowRaw = (yaml.load(readIf(join(contentDir, "now.yaml")) ?? "{}", { schema: yaml.CORE_SCHEMA }) ?? {}) as NowData;
  const now: NowData = {
    asOf: nowRaw.asOf ?? "",
    note: nowRaw.note,
    items: (nowRaw.items ?? []).map((i) => ({
      ...i,
      title: typeof i.title === "string" ? { en: i.title } : i.title,
      text: typeof i.text === "string" ? { en: i.text } : i.text,
    })),
  };
  for (const i of now.items) if (i.project && !byRef.has(i.project)) warnings.push(`now: project ref "${i.project}" does not exist`);

  // Standalone pages: content/pages/<name>.en.md and <name>.he.md with optional front-matter-free body.
  const pages = new Map<string, { en: string; he?: string; meta: Record<string, unknown> }>();
  const pagesDir = join(contentDir, "pages");
  if (existsSync(pagesDir)) {
    for (const f of readdirSync(pagesDir)) {
      const m = /^(.+)\.(en|he)\.md$/.exec(f);
      if (!m) continue;
      const [, name, lang] = m;
      const text = extractTodos(readFileSync(join(pagesDir, f), "utf8"), `pages/${f}`, todos);
      const page = pages.get(name) ?? { en: "", meta: {} };
      if (lang === "en") page.en = text;
      else page.he = text;
      pages.set(name, page);
    }
  }

  return { entries, byRef, updates, now, pages, warnings, todos };
}

export const isArchived = (e: Entry) => ARCHIVE_STATUSES.includes(e.meta.status);
export const refOf = (e: Entry) => `${e.meta.collection}/${e.meta.slug}`;
export const fileName = (p: string) => basename(p);
