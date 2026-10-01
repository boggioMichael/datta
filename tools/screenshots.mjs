// Screenshots of the built site for review. Requires Playwright (optional dependency) and a server:
//   npm run preview   (in another terminal)   then   node tools/screenshots.mjs [baseUrl] [outDir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:4321";
const out = process.argv[3] ?? "screenshots";
mkdirSync(out, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const pages = (process.env.PAGES ?? "/en/,/he/,/en/projects/,/en/projects/rasa/,/he/projects/rasa/,/en/projects/maplesyrup/,/en/projects/doggystyle/,/en/music/,/en/music/neshikot-batzintzenet/,/he/music/neshikot-batzintzenet/,/en/writing/,/en/research/,/en/research/the-limit-of-experience/,/he/research/the-limit-of-experience/,/en/support/,/he/support/,/en/contact/,/en/index/,/en/now/,/en/updates/,/en/about/,/he/about/,/en/lab/,/en/civic/chchchainges/,/en/invest/data-room/,/en/work/").split(",");
const viewports = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await chromium.launch();
for (const [name, vp] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const p of pages) {
    const file = join(out, `${name}${p.replace(/\//g, "_").replace(/_$/, "") || "_root"}.png`);
    const res = await page.goto(base + p, { waitUntil: "networkidle" });
    if (!res || res.status() >= 400) { console.error(`✗ ${p} → ${res?.status()}`); continue; }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, fullPage: process.env.FULL !== "0" });
    console.log(`✓ ${name} ${p}`);
  }
  if (errors.length) console.error(`console errors (${name}):\n  ` + errors.join("\n  "));
  await context.close();
}
await browser.close();
