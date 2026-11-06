// Renders the No Bank's icons and share image (public/piggy/icons/) from the page's own art,
// so a change to the pig in public/piggy/js/art.js shows up everywhere.
// Needs Playwright. Serve public/ first (fonts load from there for the share image):
//   python3 -m http.server 4321 --directory public   then   node tools/piggy-icons.mjs http://localhost:4321
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "../public/piggy/js/config.js";
import { STRINGS } from "../public/piggy/js/strings.js";
import { pigMarkup, rosetteMarkup, moneyMarkup, moneyDefs, palettePaint, PIG_VIEW, MONEY_VIEW } from "../public/piggy/js/art.js";
import { MONEY } from "../public/piggy/js/config.js";

const base = process.argv[2] ?? "http://localhost:4321";
const OUT = new URL("../public/piggy/icons/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PAPER = { vault: "#0E3B33", light: "#1A5E4F", deep: "#082822", engrave: "#3E8B76", cream: "#F2EAD8", brass: "#F2D37C" };
const glaze = CONFIG.glazes.find((g) => g.id === CONFIG.defaultGlaze);
const coin = CONFIG.sizes.find((s) => s.money === MONEY.COIN && s.id === CONFIG.defaultSize) ?? CONFIG.sizes[0];
const place = (svg, x, y, w, h) => svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);

/** The square icon: pig on banknote green inside one braided band, a coin above the slot. */
function iconSvg({ size = 512, scale = 1, mark = "", rounded = 0, ring = true, withCoin = true }) {
  const u = size / 512;
  const k = scale * u;
  const pigW = 372 * k;
  const pigH = (pigW * PIG_VIEW.h) / PIG_VIEW.w;
  const cx = size / 2;
  const cy = size / 2 + 26 * k;
  const pigX = cx - pigW / 2;
  const pigY = cy - pigH / 2;
  const slotX = pigX + (178 / PIG_VIEW.w) * pigW;
  const slotY = pigY + (60 / PIG_VIEW.h) * pigH;
  const coinW = 84 * k;
  const band = { ...CONFIG.rosette, bands: CONFIG.rosette.bands.slice(0, 2), core: null };
  const ringW = 500 * k;
  const pig = place(pigMarkup({ paint: palettePaint(glaze), id: `icon${size}` }), pigX, pigY, pigW, pigH);
  const rosette = ring ? `<g color="${PAPER.engrave}">${place(rosetteMarkup(band), cx - ringW / 2, cy - ringW / 2, ringW, ringW)}</g>` : "";
  const money = withCoin
    ? place(moneyMarkup(coin.money, { tone: coin.tone, colors: CONFIG.tones[coin.tone], mark, value: "" }), slotX - coinW / 2, slotY - coinW * 1.02, coinW, (coinW * MONEY_VIEW[coin.money].h) / MONEY_VIEW[coin.money].w)
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<defs><radialGradient id="bg${size}" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="${PAPER.light}"/><stop offset="0.6" stop-color="${PAPER.vault}"/><stop offset="1" stop-color="${PAPER.deep}"/></radialGradient>${moneyDefs(CONFIG.tones)}</defs>
<rect width="${size}" height="${size}" rx="${rounded * u}" fill="url(#bg${size})"/>
${rosette}${pig}${money}
</svg>`;
}

const fontCss = `
@font-face{font-family:"Frank Ruhl Libre";src:url("${base}/fonts/frankruhllibre.woff2") format("woff2");font-weight:300 900}
@font-face{font-family:"Newsreader";src:url("${base}/fonts/newsreader.woff2") format("woff2");font-weight:200 800}
@font-face{font-family:"Assistant";src:url("${base}/fonts/assistant.woff2") format("woff2");font-weight:200 800}
html,body{margin:0;background:${PAPER.deep}}
svg{display:block}
.money-mark{font-family:"Frank Ruhl Libre";font-weight:700;font-size:30px}`;

const page = (body, width, height) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>${fontCss}
.card{width:${width}px;height:${height}px;position:relative;overflow:hidden;background:radial-gradient(90% 120% at 30% 50%, ${PAPER.light} 0%, ${PAPER.vault} 55%, ${PAPER.deep} 100%);color:${PAPER.cream}}
.art{position:absolute;inset:0}
.words{position:absolute;inset-inline-start:84px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:560px}
h1{margin:0;font-family:"Frank Ruhl Libre";font-weight:700;font-size:112px;line-height:1}
.en{margin:14px 0 0;font-family:"Newsreader";font-size:46px;color:${PAPER.brass};direction:ltr;text-align:right}
.tag{margin:34px 0 0;font-family:"Assistant";font-size:31px;line-height:1.35;color:rgba(242,234,216,.8)}
</style></head><body>${body}</body></html>`;

const he = STRINGS.he;
const en = STRINGS.en;
const square = (opts) => page(iconSvg(opts), opts.size, opts.size);
const share = () => {
  const art = iconSvg({ size: 630, mark: he["coin.mark"], ring: true }).replace(/<rect [^>]*\/>/, "");
  return page(`<div class="card"><div class="art" style="inset-inline-start:auto;inset-inline-end:40px;width:630px">${art}</div>
<div class="words"><h1>${he["app.title"]}</h1><p class="en">${en["app.title"]}</p><p class="tag">${he["app.description"]}</p></div></div>`, 1200, 630);
};

writeFileSync(join(OUT, "icon.svg"), iconSvg({ size: 512, rounded: 112, ring: false, withCoin: false }));

let chromium;
try { ({ chromium } = await import("playwright")); } catch { console.error("Playwright is not installed; wrote icon.svg only."); process.exit(0); }
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const tab = await browser.newPage();
const jobs = [
  { file: "icon-512.png", w: 512, h: 512, html: square({ size: 512, mark: he["coin.mark"] }) },
  { file: "icon-192.png", w: 192, h: 192, html: square({ size: 192, mark: he["coin.mark"] }) },
  { file: "apple-touch-icon.png", w: 180, h: 180, html: square({ size: 180, mark: he["coin.mark"] }) },
  { file: "maskable-512.png", w: 512, h: 512, html: square({ size: 512, scale: 0.78, mark: he["coin.mark"] }) },
  { file: "og.png", w: 1200, h: 630, html: share() },
];
let sharp = null;
try { ({ default: sharp } = await import("sharp")); } catch { /* optional: PNGs stay as rendered */ }
for (const job of jobs) {
  await tab.setViewportSize({ width: job.w, height: job.h });
  await tab.setContent(job.html, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const png = await tab.screenshot({ clip: { x: 0, y: 0, width: job.w, height: job.h } });
  const out = sharp ? await sharp(png).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toBuffer() : png;
  writeFileSync(join(OUT, job.file), out);
  console.log("wrote", job.file, `${Math.round(out.length / 1024)} KB`);
}
await browser.close();
