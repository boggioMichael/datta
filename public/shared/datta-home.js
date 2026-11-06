/* <datta-home> — the way back to the DATTA website, for every sub-site (piggy, omg, lessons, wtc …).
 *
 *   <script type="module" src="../shared/datta-home.js"></script>
 *   <datta-home></datta-home>
 *
 * It links to the site's home page in the page's language and follows <html lang> when a
 * sub-site switches language. The site root is found from this file's own address, so it
 * works at any depth and under any base path. Pages restyle it with --datta-home-* custom
 * properties or plain CSS; the defaults below have zero specificity. */

const ELEMENT = 'datta-home';
const STYLE_ID = 'datta-home-style';
const SITE_ROOT = new URL('../', import.meta.url);
const LOCALES = Object.freeze(['he', 'en']);
const FALLBACK_LOCALE = 'he';
const WORDMARK = 'DATTA';
const LABELS = Object.freeze({
  he: 'חזרה לאתר DATTA',
  en: 'Back to the DATTA website',
});
const TAG = Object.freeze({ a: 'a', span: 'span', style: 'style' });
const ATTR = Object.freeze({ lang: 'lang', label: 'aria-label', title: 'title', hidden: 'aria-hidden' });
const CLASS = Object.freeze({ link: 'datta-home-link', mark: 'datta-home-mark', chevron: 'datta-home-chevron' });
const SVG = Object.freeze({ ns: 'http://www.w3.org/2000/svg', tag: 'svg', path: 'path', viewBox: 'viewBox', box: '0 0 24 24', d: 'd', chevron: 'M15 5l-7 7 7 7' });

const CSS = `
:where(${ELEMENT}) { display: inline-flex; }
:where(${ELEMENT}) :where(.${CLASS.link}) {
  display: inline-flex; align-items: center; gap: .4em;
  min-height: var(--datta-home-height, 40px); padding: 0 var(--datta-home-pad, .7em);
  border-radius: 999px; color: var(--datta-home-color, currentColor); background: var(--datta-home-bg, transparent);
  font: var(--datta-home-font, 600 13px/1 "Newsreader", "Frank Ruhl Libre", Georgia, serif);
  letter-spacing: .16em; text-decoration: none; white-space: nowrap; opacity: var(--datta-home-opacity, .82);
  -webkit-tap-highlight-color: transparent; transition: opacity .2s ease, background-color .2s ease;
}
:where(${ELEMENT}) :where(.${CLASS.link}:hover, .${CLASS.link}:focus-visible) { opacity: 1; }
:where(${ELEMENT}) :where(.${CLASS.chevron}) { width: 1.05em; height: 1.05em; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
:where([dir="rtl"]) :where(${ELEMENT}) :where(.${CLASS.chevron}) { transform: scaleX(-1); }
`;

const localeOf = (lang) => {
  const primary = String(lang || '').toLowerCase().split('-')[0];
  return LOCALES.includes(primary) ? primary : FALLBACK_LOCALE;
};

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement(TAG.style);
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.prepend(style);
}

class DattaHome extends HTMLElement {
  connectedCallback() {
    injectStyle();
    if (!this.link) this.build();
    this.update();
    this.observer = new MutationObserver(() => this.update());
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR.lang] });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  build() {
    this.link = document.createElement(TAG.a);
    this.link.className = CLASS.link;
    const chevron = document.createElementNS(SVG.ns, SVG.tag);
    chevron.setAttribute(SVG.viewBox, SVG.box);
    chevron.setAttribute(ATTR.hidden, String(true));
    chevron.classList.add(CLASS.chevron);
    const path = document.createElementNS(SVG.ns, SVG.path);
    path.setAttribute(SVG.d, SVG.chevron);
    chevron.append(path);
    const mark = document.createElement(TAG.span);
    mark.className = CLASS.mark;
    mark.textContent = WORDMARK;
    this.link.append(chevron, mark);
    this.replaceChildren(this.link);
  }

  update() {
    const locale = localeOf(this.getAttribute(ATTR.lang) || document.documentElement.lang);
    this.link.href = new URL(`${locale}/`, SITE_ROOT).href;
    this.link.setAttribute(ATTR.label, LABELS[locale]);
    this.link.setAttribute(ATTR.title, LABELS[locale]);
  }
}

if (!customElements.get(ELEMENT)) customElements.define(ELEMENT, DattaHome);
