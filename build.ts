// DATTA static site build. Run: npm run build (or: tsx build.ts --serve --watch)
// Renders React components to static HTML for every locale, copies /public, and writes
// search index, sitemap, robots, RSS. No framework, no client-side rendering.
import { mkdirSync, writeFileSync, cpSync, existsSync, readdirSync, readFileSync, statSync, rmSync, watch } from "node:fs";
import { dirname, join, relative, posix, extname } from "node:path";
import { createServer } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { site, type Locale } from "./src/site.ts";
import { loadSite, isArchived, type Site } from "./src/content/load.ts";
import { loadHome } from "./src/content/home.ts";
import { Ctx, makeCtx, type PageCtx } from "./src/render/context.tsx";
import { Document, type PageMeta } from "./src/render/layout.tsx";
import { HomePage } from "./src/render/pages/home.tsx";
import { EntryPage } from "./src/render/pages/entry.tsx";
import {
  ArchivePage, CivicIndex, ContactPage, DataRoomPage, IndexPage, LabIndex, MarkdownPage, MusicIndex, NotFoundPage, NowPage,
  ProjectsIndex, RandomPage, ResearchIndex, SupportPage, UpdatesPage, WritingIndex,
} from "./src/render/pages/sections.tsx";
import { entryPath, localePath } from "./src/render/urls.ts";
import { t, localized } from "./src/i18n.ts";
import { plainText } from "./src/render/markdown.ts";
import { STATUS_LABEL } from "./src/content/schema.ts";

const args = new Set(process.argv.slice(2));
const ROOT = dirname(new URL(import.meta.url).pathname);
const OUT = args.has("--relative") ? join(ROOT, "dist-preview") : join(ROOT, process.env.OUT_DIR ?? "dist");
const RELATIVE = args.has("--relative");
const PUBLIC = join(ROOT, "public");

function write(path: string, content: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** href resolver for a given page path. */
function resolvers(pagePath: string) {
  const base = site.basePath;
  const href = (path: string): string => {
    if (/^(https?:|mailto:|#)/.test(path)) return path;
    if (!RELATIVE) return `${base}${path}`;
    const [p, query] = path.split("?");
    const [pathOnly, hash] = p.split("#");
    const target = pathOnly.endsWith("/") ? `${pathOnly}index.html` : pathOnly;
    const rel = posix.relative(posix.dirname(pagePath + "index.html"), target) || "index.html";
    return rel + (query ? "?" + query : "") + (hash ? "#" + hash : "");
  };
  const asset = (path: string): string => {
    if (/^(https?:|data:)/.test(path)) return path;
    if (!RELATIVE) return `${base}${path}`;
    return posix.relative(posix.dirname(pagePath + "index.html"), path) || path;
  };
  return { href, asset };
}

/** Path stored in the search index: site-absolute normally; relative to /<locale>/search.json in preview bundles. */
function searchPath(path: string, locale: Locale): string {
  if (!RELATIVE) return `${site.basePath}${path}`;
  const target = path.endsWith("/") ? `${path}index.html` : path;
  return posix.relative(`/${locale}`, target);
}

function renderPage(siteData: Site, locale: Locale, path: string, meta: PageMeta, element: React.ReactElement, alternate?: string): string {
  const { href, asset } = resolvers(path);
  const ctx: PageCtx = makeCtx({ locale, site: siteData, path, href, asset, publicDir: PUBLIC, alternate });
  const html = renderToStaticMarkup(createElement(Ctx.Provider, { value: ctx }, createElement(Document, { meta }, element)));
  return "<!doctype html>\n" + html;
}

interface Built {
  path: string; // site-absolute
  html: string;
  lastmod?: string;
  priority?: number;
  noindex?: boolean;
}

function buildLocale(siteData: Site, locale: Locale, pagesOut: Built[], searchRows: Record<string, unknown>[]) {
  const home = loadHome(ROOT);
  const L = (v: { en: string; he?: string } | string | undefined) => (v === undefined ? "" : localized(v as { en: string; he?: string }, locale));
  const page = (path: string, meta: PageMeta, el: React.ReactElement, extra: Partial<Built> = {}, alternate?: string) => {
    pagesOut.push({ path, html: renderPage(siteData, locale, path, meta, el, alternate), ...extra });
  };

  // Home
  page(localePath(locale, "/"), { title: site.name, description: L(home.subline), accent: undefined }, createElement(HomePage, { home }), { priority: 1.0 });

  // Sections
  page(localePath(locale, "/projects/"), { title: t(locale, "projects.title"), description: t(locale, "projects.intro") }, createElement(ProjectsIndex), { priority: 0.9 });
  page(localePath(locale, "/lab/"), { title: t(locale, "lab.title"), description: t(locale, "lab.intro") }, createElement(LabIndex));
  page(localePath(locale, "/music/"), { title: t(locale, "music.title"), description: t(locale, "music.intro") }, createElement(MusicIndex), { priority: 0.8 });
  page(localePath(locale, "/writing/"), { title: t(locale, "writing.title"), description: t(locale, "writing.intro") }, createElement(WritingIndex));
  page(localePath(locale, "/research/"), { title: t(locale, "research.title"), description: t(locale, "research.intro") }, createElement(ResearchIndex));
  page(localePath(locale, "/civic/"), { title: t(locale, "civic.title"), description: t(locale, "civic.intro") }, createElement(CivicIndex));
  page(localePath(locale, "/archive/"), { title: t(locale, "archive.title"), description: t(locale, "archive.intro") }, createElement(ArchivePage));
  page(localePath(locale, "/index/"), { title: t(locale, "index.title"), description: t(locale, "index.intro") }, createElement(IndexPage));
  page(localePath(locale, "/now/"), { title: t(locale, "now.title"), description: t(locale, "now.intro") }, createElement(NowPage), { lastmod: siteData.now.asOf });
  page(localePath(locale, "/updates/"), { title: t(locale, "updates.title"), description: t(locale, "updates.intro") }, createElement(UpdatesPage), { lastmod: siteData.updates[0]?.date });

  // Standalone markdown pages
  const about = siteData.pages.get("about");
  if (about) page(localePath(locale, "/about/"), { title: t(locale, "about.title"), description: plainText(locale === "he" && about.he ? about.he : about.en, 160) }, createElement(MarkdownPage, { title: t(locale, "about.title"), body: locale === "he" && about.he ? about.he : about.en }), { priority: 0.9 });
  const work = siteData.pages.get("work");
  if (work) page(localePath(locale, "/work/"), { title: t(locale, "work.title"), description: plainText(locale === "he" && work.he ? work.he : work.en, 160) }, createElement(MarkdownPage, { title: t(locale, "work.title"), body: locale === "he" && work.he ? work.he : work.en, eyebrow: locale === "he" ? "הנדסה" : "ENGINEERING" }));
  const teaching = siteData.pages.get("teaching");
  if (teaching) page(localePath(locale, "/music/teaching/"), { title: locale === "he" ? "הוראת פסנתר" : "Piano teaching", description: plainText(locale === "he" && teaching.he ? teaching.he : teaching.en, 160) }, createElement(MarkdownPage, { title: locale === "he" ? "הוראת פסנתר" : "Piano teaching", body: locale === "he" && teaching.he ? teaching.he : teaching.en, eyebrow: t(locale, "music.title") }));
  const supportBody = siteData.pages.get("support");
  page(localePath(locale, "/support/"), { title: t(locale, "support.title"), description: t(locale, "support.intro") }, createElement(SupportPage, { body: (locale === "he" ? supportBody?.he : supportBody?.en) ?? supportBody?.en ?? "" }), { priority: 0.9 });
  page(localePath(locale, "/contact/"), { title: t(locale, "contact.title"), description: t(locale, "contact.intro") }, createElement(ContactPage), { priority: 0.8 });
  page(localePath(locale, "/invest/data-room/"), { title: t(locale, "dataroom.title"), description: t(locale, "dataroom.intro") }, createElement(DataRoomPage));
  page(localePath(locale, "/random/"), { title: t(locale, "random.title"), description: t(locale, "random.body"), noindex: true }, createElement(RandomPage), { noindex: true });

  // Entries
  for (const e of siteData.entries) {
    if (e.meta.collection === "writing" && !e.meta.public) continue; // drawer items have no page
    const path = entryPath(e, locale);
    const title = L(e.meta.title);
    const desc = L(e.meta.summary) || plainText(e.body.en, 160);
    const ogPath = `/og/${e.meta.collection}-${e.meta.slug}-${locale}.png`;
    const hasOg = existsSync(join(PUBLIC, ogPath));
    const jsonLd: Record<string, unknown>[] = [];
    if (e.meta.collection === "research" || e.meta.collection === "writing") {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": e.meta.collection === "research" ? "ScholarlyArticle" : "CreativeWork",
        headline: title,
        description: desc,
        inLanguage: e.meta.language ?? locale,
        author: { "@type": "Person", name: "Michael Boggio" },
        datePublished: e.meta.date ?? e.meta.updated,
        dateModified: e.meta.updated,
      });
    } else {
      jsonLd.push({ "@context": "https://schema.org", "@type": e.meta.collection === "music" ? "MusicGroup" : "CreativeWork", name: title, description: desc, url: `${site.url}${site.basePath}${path}` });
    }
    page(path, { title, description: desc, image: hasOg ? ogPath : undefined, type: "article", jsonLd, accent: e.meta.accent, modified: e.meta.updated, published: e.meta.date ?? e.meta.started }, createElement(EntryPage, { entry: e }), {
      lastmod: e.meta.updated,
      priority: e.meta.featured ? 0.9 : isArchived(e) ? 0.3 : 0.7,
    });
    searchRows.push({
      type: e.meta.collection,
      title,
      summary: L(e.meta.summary),
      category: L(e.meta.category),
      status: L(STATUS_LABEL[e.meta.status]),
      path: searchPath(path, locale),
      text: plainText(locale === "he" && e.body.he ? e.body.he : e.body.en, 400).toLowerCase(),
    });
  }
  // Updates in search
  for (const u of siteData.updates.slice(0, 60)) {
    searchRows.push({ type: "update", title: L(u.title), summary: u.date, category: u.project ?? "", status: "", path: searchPath(localePath(locale, "/updates/"), locale), text: (L(u.text) ?? "").toLowerCase() });
  }
  // Static pages in search
  const staticPages: [string, string][] = [["/about/", t(locale, "about.title")], ["/support/", t(locale, "support.title")], ["/contact/", t(locale, "contact.title")], ["/now/", t(locale, "now.title")], ["/index/", t(locale, "index.title")], ["/work/", t(locale, "work.title")], ["/invest/data-room/", t(locale, "dataroom.title")]];
  for (const [p, title] of staticPages) searchRows.push({ type: "page", title, summary: "", category: "", status: "", path: searchPath(localePath(locale, p), locale), text: "" });

  // 404 per locale (also copied to root)
  page(localePath(locale, "/404/"), { title: t(locale, "notFound.title"), description: t(locale, "notFound.body"), noindex: true }, createElement(NotFoundPage), { noindex: true });
}

function rootRedirect(): string {
  const en = `${site.basePath}/en/`;
  const he = `${site.basePath}/he/`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DATTA</title>
<meta name="robots" content="noindex">
<link rel="alternate" hreflang="en" href="${site.url}${en}"><link rel="alternate" hreflang="he" href="${site.url}${he}">
<meta http-equiv="refresh" content="0; url=${RELATIVE ? "en/index.html" : en}">
<script>(function(){var l=(navigator.languages||[navigator.language||""]).join(",").toLowerCase();var he=/(^|,)he/.test(l);location.replace(he?${JSON.stringify(RELATIVE ? "he/index.html" : he)}:${JSON.stringify(RELATIVE ? "en/index.html" : en)});})()</script>
</head><body><p><a href="${RELATIVE ? "en/index.html" : en}">English</a> · <a href="${RELATIVE ? "he/index.html" : he}" lang="he">עברית</a></p></body></html>`;
}

function rss(siteData: Site, locale: Locale): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = siteData.updates.slice(0, 40).map((u) => {
    const e = u.project ? siteData.byRef.get(u.project) : undefined;
    const title = `${e ? localized(e.meta.title, locale) + " — " : ""}${localized(u.title, locale)}`;
    const link = e ? `${site.url}${site.basePath}${entryPath(e, locale)}` : `${site.url}${site.basePath}${localePath(locale, "/updates/")}`;
    return `<item><title>${esc(title)}</title><link>${link}</link><guid isPermaLink="false">${u.date}-${esc(localized(u.title, "en")).slice(0, 40)}</guid><pubDate>${new Date(u.date).toUTCString()}</pubDate>${u.text ? `<description>${esc(localized(u.text, locale) ?? "")}</description>` : ""}</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>DATTA — ${esc(t(locale, "updates.title"))}</title><link>${site.url}${site.basePath}${localePath(locale, "/updates/")}</link><description>${esc(t(locale, "updates.intro"))}</description><language>${locale}</language>${items.join("")}</channel></rss>`;
}

function checkLinks(outDir: string, pages: Built[]): string[] {
  const problems: string[] = [];
  const existsOut = (p: string) => {
    const [clean] = p.split(/[?#]/);
    const full = join(outDir, clean);
    if (!existsSync(full)) return false;
    if (statSync(full).isDirectory()) return existsSync(join(full, "index.html"));
    return true;
  };
  for (const p of pages) {
    const re = /(?:href|src)="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.html))) {
      const url = m[1];
      if (/^(https?:|mailto:|#|data:|javascript:)/.test(url)) continue;
      let target = url;
      if (RELATIVE) target = posix.resolve(posix.dirname(p.path + "index.html"), url);
      else target = url.replace(new RegExp("^" + site.basePath), "");
      if (!existsOut(target)) problems.push(`${p.path} → ${url}`);
    }
  }
  return problems;
}

export function build(): { warnings: string[]; todos: string[]; problems: string[]; pages: number } {
  const siteData = loadSite(ROOT);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  // Static assets
  if (existsSync(PUBLIC)) cpSync(PUBLIC, OUT, { recursive: true });
  cpSync(join(ROOT, "src", "assets"), join(OUT, "assets"), { recursive: true });

  const pages: Built[] = [];
  for (const locale of site.locales) {
    const searchRows: Record<string, unknown>[] = [];
    buildLocale(siteData, locale, pages, searchRows);
    write(join(OUT, locale, "search.json"), JSON.stringify(searchRows));
    write(join(OUT, locale, "updates", "feed.xml"), rss(siteData, locale));
  }
  for (const p of pages) write(join(OUT, p.path, "index.html"), p.html);
  if (RELATIVE) {
    // Preview bundles open from a plain file listing: make the root page the English home, with relative links.
    const home = loadHome(ROOT);
    const rootHtml = renderPage(siteData, "en", "/", { title: site.name, description: localized(home.subline, "en") }, createElement(HomePage, { home }), "/he/");
    pages.push({ path: "/", html: rootHtml, noindex: true });
    // The preview host wraps the entry page in its own document skeleton, so the root file is a body fragment:
    // title first, then the head links and the page content, without doctype/html/head/body wrappers.
    const fragment = rootHtml
      .replace(/^<!doctype html>\s*/i, "")
      .replace(/<html[^>]*>|<\/html>|<head>|<\/head>|<body[^>]*>|<\/body>/g, "")
      .replace(/<meta charSet="utf-8"\/>|<meta name="viewport"[^>]*\/>/g, "")
      .replace(/<title>[^<]*<\/title>/, "<title>DATTA</title>");
    write(join(OUT, "index.html"), fragment);
  } else {
    write(join(OUT, "index.html"), rootRedirect());
  }
  write(join(OUT, "404.html"), pages.find((p) => p.path === `/${site.defaultLocale}/404/`)!.html);

  // Sitemap + robots
  const urls = pages
    .filter((p) => !p.noindex)
    .map((p) => `<url><loc>${site.url}${site.basePath}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}<priority>${(p.priority ?? 0.6).toFixed(1)}</priority></url>`);
  write(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  write(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /invest/data-room/private/\nSitemap: ${site.url}${site.basePath}/sitemap.xml\n`);

  const problems = checkLinks(OUT, pages);
  // Unfinished-copy guard: flag "TODO" that leaked into rendered pages.
  for (const p of pages) if (/\bTODO\b/.test(p.html.replace(/<script[\s\S]*?<\/script>/g, ""))) problems.push(`${p.path}: contains the word TODO`);
  return { warnings: siteData.warnings, todos: siteData.todos, problems, pages: pages.length };
}

function report(r: ReturnType<typeof build>) {
  console.log(`\nDATTA build → ${relative(ROOT, OUT)}/ (${r.pages} pages${RELATIVE ? ", relative links" : ""})`);
  if (r.warnings.length) console.log(`\n⚠ content warnings (${r.warnings.length}):\n  - ` + r.warnings.join("\n  - "));
  if (r.problems.length) console.log(`\n✗ problems (${r.problems.length}):\n  - ` + r.problems.join("\n  - "));
  if (r.todos.length) console.log(`\n□ content TODOs (${r.todos.length}, not shown on the site):\n  - ` + r.todos.join("\n  - "));
  if (!r.warnings.length && !r.problems.length) console.log("✓ no warnings, no broken links");
}

function serve(dir: string, port: number) {
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".gif": "image/gif", ".pdf": "application/pdf", ".ico": "image/x-icon" };
  createServer((req, res) => {
    let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (site.basePath && path.startsWith(site.basePath)) path = path.slice(site.basePath.length) || "/";
    let file = join(dir, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(readFileSync(join(dir, "404.html")));
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`\n→ http://localhost:${port}${site.basePath}/`));
}

const isMain = process.argv[1] && (process.argv[1].endsWith("build.ts") || process.argv[1].endsWith("build.js"));
if (isMain) {
  const r = build();
  report(r);
  if (args.has("--validate")) process.exit(r.problems.length ? 1 : 0);
  if (args.has("--strict") && (r.problems.length || r.warnings.length)) process.exit(1);
  if (args.has("--watch")) {
    let timer: NodeJS.Timeout | undefined;
    for (const d of ["content", "src", "public"]) {
      if (!existsSync(join(ROOT, d))) continue;
      watch(join(ROOT, d), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            report(build());
          } catch (err) {
            console.error(err);
          }
        }, 150);
      });
    }
    console.log("watching content/, src/, public/ …");
  }
  if (args.has("--serve")) serve(OUT, Number(process.env.PORT ?? 4321));
}

export const outDir = OUT;
export const listOut = () => readdirSync(OUT);
