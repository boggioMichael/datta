import type { ReactNode } from "react";
import { usePage } from "./context.tsx";
import { site, nav, navSecondary, footerLinks } from "../site.ts";
import { localePath, switchLocale } from "./urls.ts";
import type { Key } from "../i18n.ts";

export interface PageMeta {
  title: string;
  description: string;
  /** Site-absolute OG image path, defaults to /og/default.png */
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
  accent?: string;
  bodyClass?: string;
  published?: string;
  modified?: string;
}

export function Document({ meta, children }: { meta: PageMeta; children?: ReactNode }) {
  const { locale, dir, path, href, asset, t, alternate } = usePage();
  const canonical = `${site.url}${site.basePath}${path}`;
  const fullTitle = meta.title === site.name ? `${site.name} — ${locale === "he" ? site.nameHe : "Independent studio"}` : `${meta.title} · ${site.name}`;
  const ogImage = `${site.url}${site.basePath}${meta.image ?? (locale === "he" ? "/og/default-he.png" : "/og/default.png")}`;
  const altPath = alternate ?? switchLocale(path, locale === "en" ? "he" : "en");
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "DATTA",
      alternateName: "דאטא",
      url: `${site.url}${site.basePath}/`,
      founder: { "@type": "Person", name: "Michael Boggio", url: site.founder.github },
      sameAs: [site.founder.github, site.founder.youtube],
    },
    ...(meta.jsonLd ?? []),
  ];
  const style = meta.accent ? ({ "--project-accent": meta.accent } as React.CSSProperties) : undefined;
  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{fullTitle}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={canonical} />
        {meta.noindex && <meta name="robots" content="noindex" />}
        <link rel="alternate" hrefLang="en" href={`${site.url}${site.basePath}${switchLocale(path, "en")}`} />
        <link rel="alternate" hrefLang="he" href={`${site.url}${site.basePath}${switchLocale(path, "he")}`} />
        <link rel="alternate" hrefLang="x-default" href={`${site.url}${site.basePath}${switchLocale(path, "en")}`} />
        <meta property="og:site_name" content="DATTA" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content={meta.type ?? "website"} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content={locale === "he" ? "he_IL" : "en_US"} />
        {meta.published && <meta property="article:published_time" content={meta.published} />}
        {meta.modified && <meta property="article:modified_time" content={meta.modified} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="theme-color" content="#FAFAF7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={asset("/apple-touch-icon.png")} />
        <link rel="preload" href={asset("/fonts/newsreader.woff2")} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={asset(locale === "he" ? "/fonts/frankruhllibre.woff2" : "/fonts/assistant.woff2")} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href={asset("/assets/site.css")} />
        <link rel="stylesheet" href={asset("/assets/partimento.css")} />
        <link rel="stylesheet" href={asset("/assets/katex/katex.min.css")} />
        <link rel="alternate" type="application/rss+xml" title="DATTA build log" href={asset(`/${locale}/updates/feed.xml`)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,'\\u003c') }} />
        {site.analytics.provider === "plausible" && site.analytics.domain && (
          <script defer data-domain={site.analytics.domain} src={site.analytics.src || "https://plausible.io/js/script.tagged-events.js"} />
        )}
        {site.analytics.provider === "umami" && site.analytics.websiteId && <script defer src={site.analytics.src} data-website-id={site.analytics.websiteId} />}
      </head>
      <body className={meta.bodyClass} style={style} data-locale={locale}>
        <a className="skip" href="#main">
          {t("nav.skip")}
        </a>
        <Header altPath={altPath} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <SearchDialog />
        <script src={asset("/assets/site.js")} defer />
        <script type="module" src={asset("/assets/research.js")} />
      </body>
    </html>
  );
}

function Header({ altPath }: { altPath: string }) {
  const { locale, href, t, path } = usePage();
  const isCurrent = (p: string) => path.startsWith(localePath(locale, p));
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="wordmark" href={href(localePath(locale, "/"))} aria-label={t("nav.home")}>
          <span className="wordmark-latin">DATTA</span>
          <span className="wordmark-hebrew" lang="he">
            דאטא
          </span>
        </a>
        <nav className="nav-primary" aria-label="Primary">
          <ul>
            {nav.map((n) => (
              <li key={n.key}>
                <a href={href(localePath(locale, n.path))} aria-current={isCurrent(n.path) ? "page" : undefined}>
                  {t(`nav.${n.key}` as Key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-secondary">
          {navSecondary.map((n) => (
            <a key={n.key} href={href(localePath(locale, n.path))} aria-current={isCurrent(n.path) ? "page" : undefined} className={n.key === "support" ? "nav-support" : undefined}>
              {t(`nav.${n.key}` as Key)}
            </a>
          ))}
          <button type="button" className="search-button" data-search-open aria-label={t("nav.search")} title={t("search.hint")}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <a className="lang-switch" href={href(altPath)} lang={locale === "en" ? "he" : "en"} hrefLang={locale === "en" ? "he" : "en"}>
            {t("nav.lang")}
          </a>
          <button type="button" className="menu-button" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu">
            <span className="menu-label">{t("nav.menu")}</span>
          </button>
        </div>
      </div>
      <div className="mobile-menu" id="mobile-menu" hidden>
        <nav aria-label="Mobile">
          <ul>
            {[...nav, ...navSecondary, { key: "contact", path: "/contact/" }, { key: "now", path: "/now/" }, { key: "index", path: "/index/" }].map((n) => (
              <li key={n.key}>
                <a href={href(localePath(locale, n.path))}>{t(`nav.${n.key}` as Key)}</a>
              </li>
            ))}
            <li>
              <a href={href(altPath)} lang={locale === "en" ? "he" : "en"}>
                {t("nav.lang")}
              </a>
            </li>
            <li>
              <a href={href(localePath(locale, "/random/"))} className="muted">
                {t("nav.random")} {t("ui.arrow")}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { locale, href, t } = usePage();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="wordmark-latin">DATTA</span>
          <span className="footer-tagline">{t("footer.tagline")}</span>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <ul>
            {footerLinks.map((n) => (
              <li key={n.key}>
                <a href={href(localePath(locale, n.path))}>{t(`nav.${n.key}` as Key)}</a>
              </li>
            ))}
            <li>
              <a href={href(localePath(locale, "/random/"))} data-random>
                {t("nav.random")} {t("ui.arrow")}
              </a>
            </li>
          </ul>
        </nav>
        <div className="footer-social">
          <a href={href(localePath(locale, "/play/"))}>{locale === "he" ? "פרטימנטו · לנגן" : "Partimento · Play"}</a>
          <a href={href("/admin/")}>{locale === "he" ? "סטודיו" : "Studio"}</a>
          <a href={site.founder.github} rel="noopener me" target="_blank">
            GitHub
          </a>
          <a href={site.founder.youtube} rel="noopener me" target="_blank">
            YouTube
          </a>
        </div>
        <p className="footer-built">
          <span className="mono">{t("footer.built")}</span>
        </p>
      </div>
    </footer>
  );
}

function SearchDialog() {
  const { t, asset, locale } = usePage();
  return (
    <dialog className="search" id="search" aria-label={t("nav.search")} data-index={asset(`/${locale}/search.json`)}>
      <form method="dialog" className="search-form">
        <input type="search" className="search-input" placeholder={t("search.placeholder")} autoComplete="off" spellCheck={false} aria-label={t("nav.search")} data-search-input />
        <button type="submit" className="search-close" aria-label={t("nav.close")}>
          esc
        </button>
      </form>
      <ul className="search-results" data-search-results aria-live="polite" />
      <p className="search-empty" data-search-empty hidden>
        {t("search.empty")}
      </p>
    </dialog>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: ReactNode; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {intro && <p className="page-intro">{intro}</p>}
      {children}
    </header>
  );
}
