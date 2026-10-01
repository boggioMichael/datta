// Generates OpenGraph images (1200×630) with Playwright: default EN/HE cards and one per entry.
// Run after a build with the preview server up:  node tools/og.mjs http://localhost:4321
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const base = process.argv[2] ?? "http://localhost:4321";
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "public", "og");
mkdirSync(OUT, { recursive: true });
let chromium;
try { ({ chromium } = await import("playwright")); } catch { console.error("Playwright is not installed; skipping OG images."); process.exit(0); }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function card({ eyebrow, title, sub, locale }) {
  const rtl = locale === "he";
  return `<!doctype html><html lang="${locale}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${base}/assets/site.css">
<style>
html,body{margin:0;background:#fafaf7;color:#141413}
.og{width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;font-family:var(--font-serif)}
.top{display:flex;justify-content:space-between;align-items:baseline}
.wm{font-size:34px;font-weight:600;letter-spacing:.14em}
.wm small{font-family:"Frank Ruhl Libre";font-size:24px;color:#76756f;margin-inline-start:14px;letter-spacing:0}
.eyebrow{font-family:var(--font-mono);font-size:18px;letter-spacing:.1em;text-transform:uppercase;color:#76756f}
h1{font-size:${title.length > 40 ? 64 : 84}px;line-height:1.02;letter-spacing:-.02em;margin:0;max-width:1040px;font-weight:500}
[dir=rtl] h1{letter-spacing:0;font-weight:600;line-height:1.1}
.sub{font-size:28px;line-height:1.3;color:#4a4a46;max-width:980px;margin-top:22px}
.rule{height:2px;background:#141413;width:120px;margin-bottom:18px}
.dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:#c8431f;margin-inline-end:12px;vertical-align:middle}
</style></head><body><div class="og">
<div class="top"><div class="wm">DATTA<small>דאטא</small></div><div class="eyebrow">${esc(eyebrow)}</div></div>
<div><div class="rule"></div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
<div class="eyebrow"><span class="dot"></span>${rtl ? "סטודיו עצמאי · ישראל" : "Independent studio · Israel"}</div>
</div></body></html>`;
}

const jobs = [
  { file: "default.png", html: card({ eyebrow: "studio", title: "Curiosity, turned into things that exist.", sub: "Software and AI research, music, writing and a pistachio obsession.", locale: "en" }) },
  { file: "default-he.png", html: card({ eyebrow: "סטודיו", title: "סקרנות שהופכת לדברים שקיימים.", sub: "תוכנה ומחקר בינה מלאכותית, מוזיקה, כתיבה ואובססיה לפיסטוק.", locale: "he" }) },
];
const content = join(ROOT, "content");
for (const col of ["projects", "lab", "music", "writing", "research", "civic"]) {
  const dir = join(content, col);
  if (!existsSync(dir)) continue;
  for (const slug of readdirSync(dir)) {
    const metaPath = join(dir, slug, "meta.yaml");
    if (!existsSync(metaPath)) continue;
    const m = yaml.load(readFileSync(metaPath, "utf8"), { schema: yaml.CORE_SCHEMA });
    if (col === "writing" && !m.public) continue;
    for (const locale of ["en", "he"]) {
      const L = (v) => (v && typeof v === "object" ? (locale === "he" && v.he ? v.he : v.en) : v ?? "");
      jobs.push({ file: `${col}-${slug}-${locale}.png`, html: card({ eyebrow: L(m.category), title: L(m.title), sub: L(m.subtitle) || L(m.summary), locale }) });
    }
  }
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const j of jobs) {
  await page.setContent(j.html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, j.file), type: "png" });
}
await browser.close();
console.log(`${jobs.length} OG images → public/og/`);
