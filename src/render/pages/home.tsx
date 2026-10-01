import { usePage } from "../context.tsx";
import { EntryCard, EntryRow, Mono, Section, formatDate, StatusBadge, TypeLabel } from "../components.tsx";
import { entryPath, localePath } from "../urls.ts";
import { isArchived } from "../../content/load.ts";
import type { Entry } from "../../content/schema.ts";
import type { HomeData } from "../../content/home.ts";

export function HomePage({ home }: { home: HomeData }) {
  const { site, locale, l, t, href, md } = usePage();
  const live = site.entries.filter((e) => !isArchived(e));
  const featured = live
    .filter((e) => e.meta.featured && ["projects", "music"].includes(e.meta.collection))
    .sort((a, b) => (a.meta.weight ?? 2) - (b.meta.weight ?? 2) || (a.meta.order ?? 99) - (b.meta.order ?? 99));
  const lab = live.filter((e) => e.meta.collection === "lab").sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99)).slice(0, 5);
  const notes = [
    ...live.filter((e) => e.meta.collection === "research"),
    ...live.filter((e) => e.meta.collection === "writing" && e.meta.public),
  ]
    .sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99))
    .slice(0, 3);
  const now = site.now.items.slice(0, 4);
  const latest = site.updates.slice(0, 4);

  return (
    <>
      <section className="hero">
        <h1 className="hero-title">{l(home.headline)}</h1>
        <p className="hero-sub">{l(home.subline)}</p>
        <div className="hero-ctas">
          <a className="button" href={href(localePath(locale, "/projects/"))} data-track="cta-explore">
            {t("home.explore")}
          </a>
          <a className="button button-secondary" href={href(localePath(locale, "/support/"))} data-track="cta-invest-home">
            {t("home.invest")}
          </a>
        </div>
      </section>

      {now.length > 0 && (
        <section className="now-strip" aria-labelledby="now-title">
          <div className="now-head">
            <h2 id="now-title" className="now-title">
              <span className="live-dot" aria-hidden="true" />
              {t("home.currently")}
            </h2>
            <a className="section-action" href={href(localePath(locale, "/now/"))}>
              {t("home.seeNow")} {t("ui.arrow")}
            </a>
          </div>
          <ul className="now-list">
            {now.map((n, i) => {
              const e = n.project ? site.byRef.get(n.project) : undefined;
              const inner = (
                <>
                  <span className="now-name">{l(n.title)}</span>
                  <span className="now-text">{l(n.text)}</span>
                </>
              );
              return <li key={i}>{e ? <a href={href(entryPath(e, locale))}>{inner}</a> : <span>{inner}</span>}</li>;
            })}
          </ul>
        </section>
      )}

      <Section title={t("home.selected")} action={{ href: localePath(locale, "/projects/"), label: t("home.allProjects") }} className="selected">
        <div className="card-grid">
          {featured.map((e) => (
            <EntryCard key={e.meta.slug} entry={e} size={e.meta.weight ?? 2} />
          ))}
        </div>
      </Section>

      {lab.length > 0 && (
        <Section title={t("home.lab")} sub={t("home.labSub")} action={{ href: localePath(locale, "/lab/"), label: t("home.allLab") }} className="lab-feed">
          <ul className="rows">
            {lab.map((e) => (
              <EntryRow key={e.meta.slug} entry={e} />
            ))}
          </ul>
        </Section>
      )}

      {notes.length > 0 && (
        <Section title={t("home.notes")} action={{ href: localePath(locale, "/research/"), label: t("home.allResearch") }} className="notes">
          <ul className="note-list">
            {notes.map((e: Entry) => (
              <li key={e.meta.slug}>
                <a href={href(entryPath(e, locale))}>
                  <TypeLabel entry={e} />
                  <span className="note-title">{l(e.meta.title)}</span>
                  <span className="note-summary">{l(e.meta.summary)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("home.about")} action={{ href: localePath(locale, "/about/"), label: t("home.moreAbout") }} className="about-short">
        <div className="prose prose-lead" dangerouslySetInnerHTML={{ __html: md(l(home.aboutShort)) }} />
      </Section>

      {latest.length > 0 && (
        <Section title={t("home.buildLog")} action={{ href: localePath(locale, "/updates/"), label: t("updates.title") }} className="log-short">
          <ul className="log">
            {latest.map((u, i) => {
              const e = u.project ? site.byRef.get(u.project) : undefined;
              return (
                <li key={i}>
                  <Mono className="log-date">{formatDate(u.date, locale)}</Mono>
                  <span className="log-text">
                    {e && (
                      <a href={href(entryPath(e, locale))} className="log-project">
                        {l(e.meta.title)}
                      </a>
                    )}
                    {e && " — "}
                    {l(u.title)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <section className="support-strip" aria-labelledby="support-strip-title">
        <h2 id="support-strip-title" className="section-title">
          {t("home.support")}
        </h2>
        <div className="prose" dangerouslySetInnerHTML={{ __html: md(l(home.supportText)) }} />
        <ul className="support-kinds">
          {home.supportKinds.map((k, i) => (
            <li key={i}>{l(k)}</li>
          ))}
        </ul>
        <div className="hero-ctas">
          <a className="button" href={href(localePath(locale, "/support/"))} data-track="cta-support-home">
            {t("nav.support")} {t("ui.arrow")}
          </a>
          <a className="button button-secondary" href={href(localePath(locale, "/contact/"))}>
            {t("nav.contact")}
          </a>
        </div>
      </section>
    </>
  );
}

export function statusLine(e: Entry) {
  return (
    <>
      <StatusBadge status={e.meta.status} />
    </>
  );
}
