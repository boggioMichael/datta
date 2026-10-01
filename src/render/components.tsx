import type { ReactNode } from "react";
import { usePage } from "./context.tsx";
import {
  STATUS_LABEL,
  RESEARCH_KIND_LABEL,
  WRITING_TYPE_LABEL,
  TEXT_LANG_LABEL,
  type Entry,
  type Funding,
  type L10n,
  type Meta,
  type Status,
} from "../content/schema.ts";
import { entryPath, entryHref, localePath } from "./urls.ts";
import { isArchived } from "../content/load.ts";
import type { Key } from "../i18n.ts";

/* ---------- small atoms ---------- */

const STATUS_TONE: Record<Status, "live" | "active" | "quiet" | "archive"> = {
  live: "live",
  "product-development": "active",
  "in-development": "active",
  prototype: "active",
  research: "active",
  recording: "active",
  "in-production": "active",
  writing: "active",
  active: "active",
  concept: "quiet",
  paused: "archive",
  complete: "archive",
  archived: "archive",
  failed: "archive",
};

export function StatusBadge({ status }: { status: Status }) {
  const { l } = usePage();
  return (
    <span className={`status status-${STATUS_TONE[status]}`} data-status={status}>
      <span className="status-dot" aria-hidden="true" />
      {l(STATUS_LABEL[status])}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`mono${className ? " " + className : ""}`}>{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function TypeLabel({ entry }: { entry: Entry }) {
  const { l, t } = usePage();
  const m = entry.meta;
  if (m.collection === "research" && m.kind) return <Mono className="kind">{l(RESEARCH_KIND_LABEL[m.kind]).toUpperCase()}</Mono>;
  if (m.collection === "writing" && m.type) return <Mono className="kind">{l(WRITING_TYPE_LABEL[m.type]).toUpperCase()}</Mono>;
  return <Mono className="kind">{t(`type.${m.collection === "projects" ? "project" : m.collection}` as Key).toUpperCase()}</Mono>;
}

export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={`prose${className ? " " + className : ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Section({
  id,
  title,
  sub,
  children,
  action,
  className,
}: {
  id?: string;
  title?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  const { href, t } = usePage();
  return (
    <section id={id} className={`section${className ? " " + className : ""}`}>
      {title && (
        <header className="section-head">
          <div>
            <h2 className="section-title">{title}</h2>
            {sub && <p className="section-sub">{sub}</p>}
          </div>
          {action && (
            <a className="section-action" href={href(action.href)}>
              {action.label} <span aria-hidden="true">{t("ui.arrow")}</span>
            </a>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function LangNotice() {
  const { locale, t } = usePage();
  if (locale !== "he") return null;
  return (
    <p className="lang-notice" lang="he">
      {t("label.inEnglishOnly")}
    </p>
  );
}

export function TodoNote({ children }: { children?: ReactNode }) {
  const { t } = usePage();
  return <p className="todo-note">{children ?? t("label.todo")}</p>;
}

/* ---------- cards ---------- */

export function EntryCard({ entry, size = 2, showSummary = true }: { entry: Entry; size?: 1 | 2 | 3; showSummary?: boolean }) {
  const { locale, l, href, t } = usePage();
  const m = entry.meta;
  const style = m.accent ? ({ "--project-accent": m.accent } as React.CSSProperties) : undefined;
  return (
    <article className={`card card-${size}${m.accent ? " has-accent" : ""}`} style={style}>
      <a className="card-link" href={href(entryPath(entry, locale))}>
        <div className="card-top">
          <TypeLabel entry={entry} />
          <StatusBadge status={m.status} />
        </div>
        <h3 className="card-title">
          {l(m.title)}
          {m.subtitle && size === 1 && <span className="card-subtitle"> — {l(m.subtitle)}</span>}
        </h3>
        <p className="card-category">{l(m.category)}</p>
        {showSummary && <p className="card-summary">{l(m.summary)}</p>}
        {m.milestone && (
          <p className="card-milestone">
            <Mono>{t("label.milestone").toUpperCase()}</Mono> {l(m.milestone)}
          </p>
        )}
      </a>
    </article>
  );
}

export function EntryRow({ entry }: { entry: Entry }) {
  const { locale, l, href } = usePage();
  const m = entry.meta;
  return (
    <li className="row">
      <a href={href(entryPath(entry, locale))} className="row-link">
        <span className="row-title">{l(m.title)}</span>
        <span className="row-meta">
          <span className="row-category">{l(m.category)}</span>
          <StatusBadge status={m.status} />
        </span>
      </a>
      <p className="row-summary">{l(m.summary)}</p>
    </li>
  );
}

export function Related({ entry }: { entry: Entry }) {
  const { site, t, locale, href, l } = usePage();
  const refs = new Set<string>(entry.meta.related ?? []);
  // Reverse links: anything that points at this entry.
  const self = `${entry.meta.collection}/${entry.meta.slug}`;
  for (const e of site.entries) if ((e.meta.related ?? []).includes(self)) refs.add(`${e.meta.collection}/${e.meta.slug}`);
  refs.delete(self);
  const list = [...refs].map((r) => site.byRef.get(r)).filter((e): e is Entry => !!e);
  const updates = site.updates.filter((u) => u.project === self).slice(0, 6);
  if (!list.length && !updates.length) return null;
  return (
    <aside className="related" aria-labelledby="related-title">
      <h2 id="related-title" className="related-title">
        {t("label.related")}
      </h2>
      {list.length > 0 && (
        <ul className="related-list">
          {list.map((e) => (
            <li key={e.meta.slug}>
              <a href={href(entryHref(e, locale))}>
                <TypeLabel entry={e} />
                <span className="related-name">{l(e.meta.title)}</span>
                <span className="related-summary">{l(e.meta.summary)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {updates.length > 0 && (
        <div className="related-updates">
          <h3 className="related-sub">{t("label.updatesFor")}</h3>
          <ul className="log compact">
            {updates.map((u, i) => (
              <li key={i}>
                <Mono>{formatDate(u.date, locale)}</Mono>
                <span>{l(u.title)}</span>
              </li>
            ))}
          </ul>
          <a className="section-action" href={href(localePath(locale, "/updates/"))}>
            {t("updates.title")} {t("ui.arrow")}
          </a>
        </div>
      )}
    </aside>
  );
}

export function formatDate(date: string, locale: "en" | "he"): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  const months = {
    en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    he: ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"],
  }[locale];
  if (!m) return y;
  const mon = months[parseInt(m, 10) - 1] ?? m;
  return d ? `${d} ${mon} ${y}` : `${mon} ${y}`;
}

/* ---------- project substance blocks ---------- */

/** Display form of a URL: no protocol, no www, GitHub shortened to owner/repo/…. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/^github\.com\//, "").replace(/\/$/, "");
}

export function MetaTable({ m }: { m: Meta }) {
  const { t, l, locale } = usePage();
  const rows: { k: string; v: ReactNode }[] = [];
  rows.push({ k: t("label.status"), v: <StatusBadge status={m.status} /> });
  rows.push({ k: t("label.category"), v: l(m.category) });
  if (m.started) rows.push({ k: t("label.started"), v: <Mono>{m.started}</Mono> });
  if (m.updated) rows.push({ k: t("label.updated"), v: <Mono>{formatDate(m.updated, locale)}</Mono> });
  if (m.languages?.length) rows.push({ k: t("label.languages"), v: m.languages.join(" · ") });
  if (m.github) rows.push({ k: t("label.repository"), v: <a href={m.github} rel="noopener" target="_blank">{shortUrl(m.github)}</a> });
  if (m.website) rows.push({ k: t("label.website"), v: <a href={m.website} rel="noopener" target="_blank">{shortUrl(m.website)}</a> });
  if (m.demo) rows.push({ k: t("label.demo"), v: <a href={m.demo} rel="noopener" target="_blank">{shortUrl(m.demo)}</a> });
  for (const link of m.links ?? []) rows.push({ k: typeof link.label === "string" ? link.label : l(link.label), v: <a href={link.url} rel="noopener" target="_blank">{shortUrl(link.url)}</a> });
  if (m.collaborators?.length)
    rows.push({
      k: t("label.collaborators"),
      v: m.collaborators.map((c, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {c.url ? <a href={c.url} rel="noopener" target="_blank">{l(c.name)}</a> : l(c.name)}
          {c.role && <span className="muted"> — {l(c.role)}</span>}
        </span>
      )),
    });
  if (m.funding?.public && m.funding.type) rows.push({ k: t("label.funding"), v: l(fundingTypeLabel(m.funding.type)) });
  return (
    <dl className="meta-table">
      {rows.map((r, i) => (
        <div className="meta-row" key={i}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function fundingTypeLabel(type: Funding["type"]): L10n {
  const map: Record<Funding["type"], L10n> = {
    investment: { en: "Investment", he: "השקעה" },
    sponsorship: { en: "Sponsorship", he: "חסות" },
    patronage: { en: "Patronage", he: "פטרונות" },
    collaboration: { en: "Collaboration", he: "שיתוף פעולה" },
    grant: { en: "Grant", he: "מענק" },
    bootstrapped: { en: "Bootstrapped", he: "מימון עצמי" },
  };
  return map[type];
}

export function BuiltLevels({ m }: { m: Meta }) {
  const { t, locale } = usePage();
  const b = m.builtLevels;
  if (!b) return null;
  const cols = (["built", "prototyped", "researching", "vision"] as const).filter((k) => b[k]?.en?.length);
  if (!cols.length) return null;
  return (
    <div className="levels" aria-label={t("label.builtLevels")}>
      <h2 className="block-title">{t("label.builtLevels")}</h2>
      <div className="levels-grid">
        {cols.map((k) => {
          const list = locale === "he" && b[k]?.he?.length ? b[k]!.he! : b[k]!.en;
          return (
            <div className={`level level-${k}`} key={k}>
              <h3 className="mono level-name">{t(`level.${k}` as Key).toUpperCase()}</h3>
              <ul>
                {list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Metrics({ m }: { m: Meta }) {
  const { t, l } = usePage();
  if (!m.metrics?.length) return null;
  const kindLabel = { measured: "MEASURED", verified: "VERIFIED", designed: "DESIGNED", planned: "PLANNED" };
  return (
    <div className="metrics">
      <h2 className="block-title">{t("label.metrics")}</h2>
      <dl className="metrics-grid">
        {m.metrics.map((x, i) => (
          <div className={`metric metric-${x.kind ?? "measured"}`} key={i}>
            <dd className="metric-value">{x.value}</dd>
            <dt className="metric-label">{l(x.label)}</dt>
            {x.kind && <span className="mono metric-kind">{kindLabel[x.kind]}</span>}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EvidenceList({ m }: { m: Meta }) {
  const { t, l } = usePage();
  if (!m.evidence?.length) return null;
  return (
    <div className="evidence">
      <h2 className="block-title">{t("label.evidence")}</h2>
      <ul className="evidence-list">
        {m.evidence.map((e, i) => (
          <li key={i}>
            <Mono className="evidence-kind">{(e.kind ?? "artifact").toUpperCase()}</Mono>
            {e.url ? (
              <a href={e.url} rel="noopener" target="_blank">
                {l(e.label)}
              </a>
            ) : (
              <span>{l(e.label)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Timeline({ m }: { m: Meta }) {
  const { t, l, locale } = usePage();
  const hasTimeline = !!m.timeline?.length;
  const hasMilestones = !!m.milestones?.length;
  if (!hasTimeline && !hasMilestones) return null;
  return (
    <div className="timeline-block">
      {hasTimeline && (
        <>
          <h2 className="block-title">{t("label.timeline")}</h2>
          <ol className="timeline">
            {m.timeline!.map((x, i) => (
              <li key={i}>
                <Mono className="timeline-date">{formatDate(x.date, locale)}</Mono>
                <span>{l(x.text)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {hasMilestones && (
        <>
          <h2 className="block-title">{t("label.milestones")}</h2>
          <ul className="milestones">
            {m.milestones!.map((x, i) => (
              <li key={i} className={x.done ? "done" : "open"}>
                <span className="milestone-mark" aria-hidden="true">
                  {x.done ? "●" : "○"}
                </span>
                <span>
                  {l(x.text)}
                  {x.date && <Mono className="muted"> · {formatDate(x.date, locale)}</Mono>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Economics({ m }: { m: Meta }) {
  const { t, l } = usePage();
  const e = m.economics;
  if (!e || !e.public) return null;
  const rows: [string, L10n | undefined][] = [
    ["Cost to date", e.costToDate],
    ["Revenue", e.revenue],
    ["Monthly burn", e.monthlyBurn],
    ["Unit economics", e.unitEconomics],
    ["Target", e.target],
    ["Next milestone", e.nextMilestone],
  ];
  const labelsHe: Record<string, string> = {
    "Cost to date": "עלות עד היום",
    Revenue: "הכנסות",
    "Monthly burn": "הוצאה חודשית",
    "Unit economics": "כלכלת יחידה",
    Target: "יעד",
    "Next milestone": "אבן הדרך הבאה",
  };
  const { locale } = usePage();
  return (
    <div className="economics">
      <h2 className="block-title">{t("label.economics")}</h2>
      <dl className="econ-grid">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div className="econ-row" key={k}>
              <dt>{locale === "he" ? labelsHe[k] : k}</dt>
              <dd>{l(v)}</dd>
            </div>
          ))}
      </dl>
      {e.note && <p className="econ-note">{l(e.note)}</p>}
    </div>
  );
}

export function FundingCard({ m, compact = false }: { m: Meta; compact?: boolean }) {
  const { t, l, href, locale } = usePage();
  const f = m.funding;
  if (!f || !f.public) return null;
  const rows: [string, L10n | undefined][] = [
    [t("funding.stage"), f.stage],
    [t("funding.exists"), f.exists],
    [t("funding.next"), f.next],
    [t("funding.ask"), f.ask],
    [t("funding.use"), f.useOfFunds],
    [t("funding.unlocks"), f.unlocks],
    [t("funding.target"), f.target],
    [t("funding.status"), f.status],
  ];
  const intent = f.type === "investment" ? "invest" : f.type === "sponsorship" || f.type === "patronage" ? "sponsor" : "collaborate";
  return (
    <aside className={`funding-card${compact ? " compact" : ""}`} aria-label={`${t("label.funding")}: ${l(m.title)}`}>
      <div className="funding-head">
        <Mono className="funding-type">{l(fundingTypeLabel(f.type)).toUpperCase()}</Mono>
        {compact && (
          <a className="funding-project" href={href(entryPath({ meta: m } as Entry, locale))}>
            {l(m.title)}
          </a>
        )}
      </div>
      <dl className="funding-rows">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div className="funding-row" key={k}>
              <dt>{k}</dt>
              <dd>{l(v)}</dd>
            </div>
          ))}
      </dl>
      <a className="button" href={href(localePath(locale, `/contact/?intent=${intent}&project=${encodeURIComponent(m.slug)}`))} data-track={`cta-${intent}`} data-project={m.slug}>
        {t("funding.discuss")}
      </a>
    </aside>
  );
}

export function Opportunity({ m }: { m: Meta }) {
  const { t, l, href, locale } = usePage();
  const o = m.opportunity;
  if (!o) return null;
  const rows: [string, L10n | undefined][] = [
    [t("opportunity.what"), o.what],
    [t("opportunity.why"), o.why],
    [t("opportunity.exists"), o.exists],
    [t("opportunity.next"), o.next],
    [t("opportunity.support"), o.support],
  ];
  return (
    <section className="opportunity" aria-labelledby="opp-title">
      <h2 id="opp-title" className="block-title">
        {t("opportunity.title")}
      </h2>
      <dl className="opp-rows">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div className="opp-row" key={k}>
              <dt>{k}</dt>
              <dd>{l(v)}</dd>
            </div>
          ))}
      </dl>
      <p className="opp-cta">
        <a className="button" href={href(localePath(locale, `/contact/?intent=invest&project=${encodeURIComponent(m.slug)}`))} data-track="cta-invest" data-project={m.slug}>
          {t("funding.discuss")}
        </a>
      </p>
    </section>
  );
}

export function SponsorList({ m }: { m: Meta }) {
  const { t, l, href, locale } = usePage();
  if (!m.sponsor?.length) return null;
  return (
    <section className="sponsor" aria-labelledby="sponsor-title">
      <h2 id="sponsor-title" className="block-title">
        {t("sponsor.title")}
      </h2>
      <p className="sponsor-lead">{t("sponsor.fund")}:</p>
      <ul className="sponsor-list">
        {m.sponsor.map((s, i) => (
          <li key={i}>
            <span className="sponsor-item">{l(s.title)}</span>
            {s.detail && <span className="sponsor-detail">{l(s.detail)}</span>}
            {s.amount && <Mono className="sponsor-amount">{l(s.amount)}</Mono>}
          </li>
        ))}
      </ul>
      <a className="button" href={href(localePath(locale, `/contact/?intent=sponsor&project=${encodeURIComponent(m.slug)}`))} data-track="cta-sponsor" data-project={m.slug}>
        {t("support.ctaSponsor")}
      </a>
    </section>
  );
}

export function Lessons({ m }: { m: Meta }) {
  const { t, locale } = usePage();
  if (!m.lessons) return null;
  const list = locale === "he" && m.lessons.he?.length ? m.lessons.he : m.lessons.en;
  return (
    <div className="lessons">
      <h2 className="block-title">{t("label.whatWeLearned")}</h2>
      <ul>
        {list.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export function Gallery({ m }: { m: Meta }) {
  const { t, l, asset } = usePage();
  if (!m.gallery?.length) return null;
  return (
    <div className="gallery">
      <h2 className="block-title">{t("label.gallery")}</h2>
      <div className="gallery-grid">
        {m.gallery.map((g, i) => (
          <figure key={i}>
            <img src={asset(g.src)} alt={l(g.alt)} loading="lazy" decoding="async" />
            {g.caption && <figcaption>{l(g.caption)}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function Hero({ m }: { m: Meta }) {
  const { l, asset } = usePage();
  const h = m.hero;
  if (!h) return null;
  if (h.video) {
    return (
      <figure className="hero-media">
        <video src={asset(h.video)} poster={h.poster ? asset(h.poster) : undefined} controls preload="metadata" playsInline muted loop>
          {l(h.alt)}
        </video>
        {h.caption && <figcaption>{l(h.caption)}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className="hero-media">
      <img src={asset(h.src)} alt={l(h.alt)} decoding="async" />
      {h.caption && <figcaption>{l(h.caption)}</figcaption>}
    </figure>
  );
}

export function Videos({ m }: { m: Meta }) {
  const { l, asset } = usePage();
  if (!m.videos?.length) return null;
  return (
    <div className="videos">
      {m.videos.map((v, i) => (
        <figure className="media video" key={i}>
          {v.youtube ? (
            <div className="video-frame">
              <iframe src={`https://www.youtube-nocookie.com/embed/${v.youtube}`} title={l(v.title)} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : (
            <video src={asset(v.src!)} controls preload="metadata" playsInline />
          )}
          <figcaption>
            {l(v.title)}
            {v.note && <span className="muted"> — {l(v.note)}</span>}
            {v.youtube && (
              <>
                {" "}
                <a href={`https://www.youtube.com/watch?v=${v.youtube}`} rel="noopener" target="_blank">
                  YouTube ↗
                </a>
              </>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function AudioList({ m }: { m: Meta }) {
  const { l, asset, t } = usePage();
  const items = (m.audio ?? []).filter((a) => a.public);
  if (!items.length) return null;
  return (
    <div className="audio-list">
      <h2 className="block-title">{t("label.listen")}</h2>
      {items.map((a, i) => (
        <figure className="media audio" key={i} data-component="audio">
          <div className="audio-head">
            <span className="audio-title">{l(a.title)}</span>
            {a.note && <span className="audio-note">{l(a.note)}</span>}
          </div>
          <audio src={asset(a.src)} controls preload="none" />
        </figure>
      ))}
    </div>
  );
}

export function Songs({ m }: { m: Meta }) {
  const { l, t, asset, site, href, locale } = usePage();
  if (!m.songs?.length) return null;
  return (
    <div className="songs">
      <h2 className="block-title">{t("label.songs")}</h2>
      <ol className="song-list">
        {m.songs.map((s, i) => {
          const lyrics = s.writing ? site.byRef.get(`writing/${s.writing}`) : undefined;
          return (
            <li key={i} className="song">
              <span className="song-no mono">{String(i + 1).padStart(2, "0")}</span>
              <div className="song-body">
                <span className="song-title">{l(s.title)}</span>
                {s.note && <span className="song-note">{l(s.note)}</span>}
                {s.status && <StatusBadge status={s.status} />}
                {lyrics && lyrics.meta.public && (
                  <a className="song-lyrics" href={href(entryPath(lyrics, locale))}>
                    {t("label.lyricsBy")} {t("ui.arrow")}
                  </a>
                )}
                {s.audio && s.public && <audio src={asset(s.audio)} controls preload="none" />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Credits({ m }: { m: Meta }) {
  const { l, t, locale } = usePage();
  if (!m.credits?.length && !m.instrumentation) return null;
  const inst = m.instrumentation ? (locale === "he" && m.instrumentation.he?.length ? m.instrumentation.he : m.instrumentation.en) : [];
  return (
    <dl className="credits">
      {m.credits?.map((c, i) => (
        <div className="credit" key={i}>
          <dt>{l(c.role)}</dt>
          <dd>{l(c.name)}</dd>
        </div>
      ))}
      {inst.length > 0 && (
        <div className="credit">
          <dt>{t("label.instrumentation")}</dt>
          <dd>{inst.join(" · ")}</dd>
        </div>
      )}
    </dl>
  );
}

export function ArchiveNote({ entry }: { entry: Entry }) {
  if (!isArchived(entry)) return null;
  return <Lessons m={entry.meta} />;
}
