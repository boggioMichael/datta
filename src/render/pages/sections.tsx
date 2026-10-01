import { usePage } from "../context.tsx";
import { EntryCard, EntryRow, FundingCard, Mono, Section, StatusBadge, TypeLabel, formatDate } from "../components.tsx";
import { PageHeader } from "../layout.tsx";
import { entryPath, localePath } from "../urls.ts";
import { isArchived } from "../../content/load.ts";
import { RESEARCH_KIND_LABEL, STATUS_LABEL, TEXT_LANG_LABEL, WRITING_TYPE_LABEL, type Entry } from "../../content/schema.ts";
import { site as siteConfig } from "../../site.ts";
import type { Key } from "../../i18n.ts";

const byOrder = (a: Entry, b: Entry) => (a.meta.order ?? 99) - (b.meta.order ?? 99) || a.meta.title.en.localeCompare(b.meta.title.en);

export function ProjectsIndex() {
  const { site, t } = usePage();
  const live = site.entries.filter((e) => e.meta.collection === "projects" && !isArchived(e)).sort(byOrder);
  const flagship = live.filter((e) => e.meta.featured && (e.meta.weight ?? 2) === 1);
  const active = live.filter((e) => !flagship.includes(e) && e.meta.status !== "concept");
  const quiet = live.filter((e) => !flagship.includes(e) && e.meta.status === "concept");
  return (
    <>
      <PageHeader title={t("projects.title")} intro={t("projects.intro")} />
      {flagship.length > 0 && (
        <Section title={t("projects.flagship")}>
          <div className="card-grid">
            {flagship.map((e) => (
              <EntryCard key={e.meta.slug} entry={e} size={1} />
            ))}
          </div>
        </Section>
      )}
      {active.length > 0 && (
        <Section title={t("projects.active")}>
          <div className="card-grid">
            {active.map((e) => (
              <EntryCard key={e.meta.slug} entry={e} size={2} />
            ))}
          </div>
        </Section>
      )}
      {quiet.length > 0 && (
        <Section title={t("projects.quiet")}>
          <ul className="rows">
            {quiet.map((e) => (
              <EntryRow key={e.meta.slug} entry={e} />
            ))}
          </ul>
        </Section>
      )}
      <ArchiveLink />
    </>
  );
}

function ArchiveLink() {
  const { t, href, locale, site } = usePage();
  if (!site.entries.some(isArchived)) return null;
  return (
    <p className="archive-link">
      <a href={href(localePath(locale, "/archive/"))}>{t("archive.title")} {t("ui.arrow")}</a>
    </p>
  );
}

export function LabIndex() {
  const { site, t } = usePage();
  const live = site.entries.filter((e) => e.meta.collection === "lab" && !isArchived(e)).sort(byOrder);
  return (
    <>
      <PageHeader title={t("lab.title")} intro={t("lab.intro")} />
      <ul className="rows rows-lab">
        {live.map((e) => (
          <EntryRow key={e.meta.slug} entry={e} />
        ))}
      </ul>
      <ArchiveLink />
    </>
  );
}

export function CivicIndex() {
  const { site, t } = usePage();
  const list = site.entries.filter((e) => e.meta.collection === "civic").sort(byOrder);
  return (
    <>
      <PageHeader title={t("civic.title")} intro={t("civic.intro")} />
      <div className="card-grid">
        {list.map((e) => (
          <EntryCard key={e.meta.slug} entry={e} size={2} />
        ))}
      </div>
    </>
  );
}

export function MusicIndex() {
  const { site, t } = usePage();
  const list = site.entries.filter((e) => e.meta.collection === "music" && !isArchived(e)).sort(byOrder);
  const big = list.filter((e) => (e.meta.weight ?? 2) <= 2);
  const small = list.filter((e) => (e.meta.weight ?? 2) === 3);
  return (
    <>
      <PageHeader title={t("music.title")} intro={t("music.intro")} />
      <div className="card-grid">
        {big.map((e) => (
          <EntryCard key={e.meta.slug} entry={e} size={e.meta.weight ?? 2} />
        ))}
      </div>
      {small.length > 0 && (
        <ul className="rows">
          {small.map((e) => (
            <EntryRow key={e.meta.slug} entry={e} />
          ))}
        </ul>
      )}
    </>
  );
}

export function WritingIndex() {
  const { site, t, l, href, locale } = usePage();
  const all = site.entries.filter((e) => e.meta.collection === "writing").sort((a, b) => (b.meta.date ?? "").localeCompare(a.meta.date ?? "") || byOrder(a, b));
  const published = all.filter((e) => e.meta.public);
  const drawer = all.filter((e) => !e.meta.public);
  const research = site.entries.filter((e) => e.meta.collection === "research" && (e.meta.kind === "speculative-model" || e.meta.kind === "hypothesis")).sort(byOrder);
  return (
    <>
      <PageHeader title={t("writing.title")} intro={t("writing.intro")} />
      {published.length > 0 && (
        <Section title={t("writing.published")}>
          <ul className="text-list">
            {published.map((e) => (
              <li key={e.meta.slug}>
                <a href={href(entryPath(e, locale))}>
                  <span className="text-title" lang={e.meta.language}>
                    {l(e.meta.title)}
                  </span>
                  <span className="text-meta">
                    {e.meta.type && <Mono>{l(WRITING_TYPE_LABEL[e.meta.type]).toUpperCase()}</Mono>}
                    {e.meta.language && <span>{l(TEXT_LANG_LABEL[e.meta.language])}</span>}
                    {e.meta.date && <Mono>{formatDate(e.meta.date, locale)}</Mono>}
                    {e.meta.audio?.some((a) => a.public) && <Mono className="has-audio">{t("label.narration").toUpperCase()}</Mono>}
                    {e.meta.status !== "complete" && <StatusBadge status={e.meta.status} />}
                  </span>
                  <span className="text-summary">{l(e.meta.summary)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {research.length > 0 && (
        <Section title={t("writing.fromResearch")} action={{ href: localePath(locale, "/research/"), label: t("home.allResearch") }}>
          <ul className="text-list">
            {research.map((e) => (
              <li key={e.meta.slug}>
                <a href={href(entryPath(e, locale))}>
                  <span className="text-title">{l(e.meta.title)}</span>
                  <span className="text-meta">
                    <TypeLabel entry={e} />
                  </span>
                  <span className="text-summary">{l(e.meta.summary)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {drawer.length > 0 && (
        <Section id="drawer" title={t("writing.drawer")} sub={t("writing.drawerSub")} className="drawer">
          <table className="drawer-table">
            <thead>
              <tr>
                <th>{t("label.name")}</th>
                <th>{t("label.type")}</th>
                <th>{t("label.language")}</th>
                <th>{t("label.status")}</th>
              </tr>
            </thead>
            <tbody>
              {drawer.map((e) => (
                <tr key={e.meta.slug}>
                  <td lang={e.meta.language}>
                    {l(e.meta.title)}
                    {e.meta.summary.en && <span className="drawer-summary">{l(e.meta.summary)}</span>}
                  </td>
                  <td>{e.meta.type ? l(WRITING_TYPE_LABEL[e.meta.type]) : ""}</td>
                  <td>{e.meta.language ? l(TEXT_LANG_LABEL[e.meta.language]) : ""}</td>
                  <td>
                    <StatusBadge status={e.meta.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

export function ResearchIndex() {
  const { site, t, l, href, locale } = usePage();
  const list = site.entries.filter((e) => e.meta.collection === "research").sort(byOrder);
  return (
    <>
      <PageHeader title={t("research.title")} intro={t("research.intro")}>
        <p className="research-disclaimer mono">{t("research.disclaimer")}</p>
      </PageHeader>
      <ul className="research-list">
        {list.map((e) => (
          <li key={e.meta.slug} className="research-item">
            <a href={href(entryPath(e, locale))}>
              <span className="research-kind mono">{e.meta.kind ? l(RESEARCH_KIND_LABEL[e.meta.kind]).toUpperCase() : ""}</span>
              <span className="research-title">{l(e.meta.title)}</span>
              <span className="research-summary">{l(e.meta.summary)}</span>
              <span className="research-meta">
                {l(e.meta.category)}
                {e.meta.updated && <Mono> · {formatDate(e.meta.updated, locale)}</Mono>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ArchivePage() {
  const { site, t, l, href, locale } = usePage();
  const list = site.entries.filter(isArchived).sort(byOrder);
  return (
    <>
      <PageHeader title={t("archive.title")} intro={t("archive.intro")} />
      {list.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        <ul className="rows">
          {list.map((e) => (
            <li className="row" key={e.meta.slug}>
              <a href={href(entryPath(e, locale))} className="row-link">
                <span className="row-title">{l(e.meta.title)}</span>
                <span className="row-meta">
                  <TypeLabel entry={e} />
                  <StatusBadge status={e.meta.status} />
                </span>
              </a>
              <p className="row-summary">{l(e.meta.summary)}</p>
              {e.meta.lessons && (
                <p className="row-lesson">
                  <Mono>{t("label.whatWeLearned").toUpperCase()}</Mono> {(locale === "he" && e.meta.lessons.he?.length ? e.meta.lessons.he : e.meta.lessons.en)[0]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function IndexPage() {
  const { site, t, l, href, locale } = usePage();
  const rows: { type: string; name: string; year: string; status: string; path: string; lang?: string }[] = [];
  for (const e of site.entries) {
    rows.push({
      type: t(`type.${e.meta.collection === "projects" ? "project" : e.meta.collection}` as Key),
      name: l(e.meta.title),
      year: (e.meta.started ?? e.meta.date ?? e.meta.updated ?? "").slice(0, 4),
      status: l(STATUS_LABEL[e.meta.status]),
      path: e.meta.collection === "writing" && !e.meta.public ? "" : entryPath(e, locale),
      lang: e.meta.language,
    });
  }
  rows.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title={t("index.title")} intro={t("index.intro")}>
        <p className="index-tools">
          <input type="search" className="index-filter" placeholder={t("index.filter")} aria-label={t("index.filter")} data-index-filter />
          <span className="mono index-count">
            <span data-index-count>{rows.length}</span> {t("index.count")}
          </span>
        </p>
      </PageHeader>
      <table className="index-table" data-index-table>
        <thead>
          <tr>
            <th>{t("label.type")}</th>
            <th>{t("label.name")}</th>
            <th>{t("label.year")}</th>
            <th>{t("label.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <Mono>{r.type.toUpperCase()}</Mono>
              </td>
              <td lang={r.lang}>{r.path ? <a href={href(r.path)}>{r.name}</a> : r.name}</td>
              <td>
                <Mono>{r.year}</Mono>
              </td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function NowPage() {
  const { site, t, l, href, locale, md } = usePage();
  return (
    <>
      <PageHeader title={t("now.title")} intro={t("now.intro")}>
        {site.now.asOf && (
          <p className="mono muted">
            {t("now.asOf")} {formatDate(site.now.asOf, locale)}
          </p>
        )}
      </PageHeader>
      <ul className="now-page-list">
        {site.now.items.map((n, i) => {
          const e = n.project ? site.byRef.get(n.project) : undefined;
          return (
            <li key={i}>
              <h2 className="now-page-title">{e ? <a href={href(entryPath(e, locale))}>{l(n.title)}</a> : l(n.title)}</h2>
              <p>{l(n.text)}</p>
            </li>
          );
        })}
      </ul>
      {site.now.note && <div className="prose" dangerouslySetInnerHTML={{ __html: md(l(site.now.note)) }} />}
    </>
  );
}

export function UpdatesPage() {
  const { site, t, l, href, locale } = usePage();
  const groups = new Map<string, typeof site.updates>();
  for (const u of site.updates) {
    const k = u.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  return (
    <>
      <PageHeader title={t("updates.title")} intro={t("updates.intro")} />
      {[...groups.entries()].map(([month, list]) => (
        <section className="log-month" key={month}>
          <h2 className="log-month-title mono">{formatDate(month, locale)}</h2>
          <ul className="log">
            {list.map((u, i) => {
              const e = u.project ? site.byRef.get(u.project) : undefined;
              return (
                <li key={i}>
                  <Mono className="log-date">{formatDate(u.date, locale)}</Mono>
                  <div className="log-body">
                    <span className="log-text">
                      {e && (
                        <a href={href(entryPath(e, locale))} className="log-project">
                          {l(e.meta.title)}
                        </a>
                      )}
                      {e && " — "}
                      {l(u.title)}
                    </span>
                    {u.text && <span className="log-detail">{l(u.text)}</span>}
                    {u.link && (
                      <a className="log-link" href={u.link} rel="noopener" target="_blank">
                        {u.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

export function MarkdownPage({ title, body, eyebrow, intro, wide = false }: { title: string; body: string; eyebrow?: string; intro?: string; wide?: boolean }) {
  const { md } = usePage();
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} intro={intro} />
      <div className={`prose${wide ? "" : " prose-narrow"}`} dangerouslySetInnerHTML={{ __html: md(body) }} />
    </>
  );
}

export function SupportPage({ body }: { body: string }) {
  const { site, t, l, href, locale, md } = usePage();
  const investable = site.entries.filter((e) => e.meta.funding?.public && (e.meta.funding.type === "investment" || e.meta.funding.type === "grant" || e.meta.funding.type === "bootstrapped") && !e.meta.noFunnel).sort(byOrder);
  const sponsorable = site.entries.filter((e) => (e.meta.sponsor?.length || (e.meta.funding?.public && e.meta.funding.type === "sponsorship")) && !e.meta.noFunnel).sort(byOrder);
  return (
    <>
      <PageHeader title={t("support.title")} intro={t("support.intro")} />
      {body.trim() && <div className="prose prose-narrow" dangerouslySetInnerHTML={{ __html: md(body) }} />}

      <Section id="invest" title={t("support.invest")} sub={t("support.investSub")}>
        <p className="mono muted small">{t("support.noPromises")}</p>
        <div className="funding-grid">
          {investable.map((e) => (
            <FundingCard key={e.meta.slug} m={e.meta} compact />
          ))}
        </div>
        <p>
          <a className="button" href={href(localePath(locale, "/contact/?intent=invest"))} data-track="cta-invest">
            {t("support.ctaInvest")}
          </a>{" "}
          <a className="button button-secondary" href={href(localePath(locale, "/invest/data-room/"))}>
            {t("support.dataRoom")} {t("ui.arrow")}
          </a>
        </p>
      </Section>

      <Section id="sponsor" title={t("support.sponsor")} sub={t("support.sponsorSub")}>
        <ul className="sponsor-projects">
          {sponsorable.map((e) => (
            <li key={e.meta.slug}>
              <a href={href(entryPath(e, locale))} className="sponsor-project">
                <TypeLabel entry={e} />
                <span className="sponsor-project-name">{l(e.meta.title)}</span>
                <span className="sponsor-project-summary">{l(e.meta.summary)}</span>
              </a>
              {e.meta.sponsor && (
                <ul className="sponsor-list compact">
                  {e.meta.sponsor.map((s, i) => (
                    <li key={i}>
                      <span className="sponsor-item">{l(s.title)}</span>
                      {s.detail && <span className="sponsor-detail">{l(s.detail)}</span>}
                      {s.amount && <Mono className="sponsor-amount">{l(s.amount)}</Mono>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p>
          <a className="button" href={href(localePath(locale, "/contact/?intent=sponsor"))} data-track="cta-sponsor">
            {t("support.ctaSponsor")}
          </a>
        </p>
      </Section>

      <Section id="patron" title={t("support.patron")} sub={t("support.patronSub")}>
        <p className="prose-narrow">{t("support.patronBody")}</p>
        <p>
          <a className="button button-secondary" href={href(localePath(locale, "/contact/?intent=support"))} data-track="cta-patron">
            {t("support.ctaPatron")}
          </a>
        </p>
      </Section>

      <Section id="collaborate" title={t("support.collab")} sub={t("support.collabSub")}>
        <p>
          <a className="button" href={href(localePath(locale, "/contact/?intent=collaborate"))} data-track="cta-collaborate">
            {t("support.ctaCollab")}
          </a>{" "}
          <a className="button button-secondary" href={href(localePath(locale, "/work/"))}>
            {t("support.ctaHire")} {t("ui.arrow")}
          </a>
        </p>
      </Section>
    </>
  );
}

export function ContactPage() {
  const { t, href, locale } = usePage();
  const intents: [string, Key][] = [
    ["invest", "contact.invest"],
    ["sponsor", "contact.sponsor"],
    ["collaborate", "contact.collaborate"],
    ["hire", "contact.hire"],
    ["perform", "contact.perform"],
    ["research", "contact.research"],
    ["other", "contact.other"],
  ];
  const endpoint = siteConfig.contact.formEndpoint;
  const email = siteConfig.contact.email;
  return (
    <>
      <PageHeader title={t("contact.title")} intro={t("contact.intro")} />
      <form className="contact-form" method="post" action={endpoint || undefined} data-contact-form data-endpoint={endpoint} data-email={email} data-sent={t("contact.sent")} data-failed={t("contact.failed")} data-sending={t("contact.sending")} data-notconnected={t("contact.notConfigured")} acceptCharset="UTF-8">
        <fieldset className="intent">
          <legend>{t("contact.iwant")}</legend>
          <div className="intent-options">
            {intents.map(([v, k], i) => (
              <label key={v} className="intent-option">
                <input type="radio" name="intent" value={v} defaultChecked={i === 0} />
                <span>{t(k)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-grid">
          <label>
            <span>{t("contact.name")}</span>
            <input name="name" type="text" required autoComplete="name" />
          </label>
          <label>
            <span>{t("contact.email")}</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            <span>{t("contact.org")}</span>
            <input name="organization" type="text" autoComplete="organization" />
          </label>
          <label>
            <span>{t("contact.topic")}</span>
            <input name="topic" type="text" data-topic />
          </label>
        </div>
        <label className="field-message">
          <span>{t("contact.message")}</span>
          <textarea name="message" rows={7} required />
        </label>
        {/* Spam protection: honeypot (FormSubmit's _honey) + time-to-submit check, handled in site.js */}
        <div className="hp" aria-hidden="true">
          <label>
            Website <input name="_honey" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <input type="hidden" name="_template" value="table" />
        <input type="hidden" name="_captcha" value="false" />
        <input type="hidden" name="_started" value="" data-started />
        <input type="hidden" name="_lang" value={locale} />
        <p className="form-actions">
          <button type="submit" className="button">
            {t("contact.send")}
          </button>
          <span className="mono muted small">{t("contact.privacy")}</span>
        </p>
        {!endpoint && <p className="form-notice mono small">{t("contact.notConfigured")}</p>}
      </form>
      <section className="contact-direct">
        <h2 className="block-title">{t("contact.direct")}</h2>
        <ul className="direct-list">
          {email && (
            <li>
              <a href={`mailto:${email}`} data-email-link>
                {email}
              </a>
            </li>
          )}
          <li>
            <a href={siteConfig.founder.github} rel="noopener me" target="_blank">
              github.com/boggioMichael
            </a>
          </li>
          <li>
            <a href={siteConfig.founder.youtube} rel="noopener me" target="_blank">
              YouTube — Michael Boggio
            </a>
          </li>
          <li>
            <a href={href(localePath(locale, "/invest/data-room/"))}>{t("dataroom.title")} {t("ui.arrow")}</a>
          </li>
        </ul>
      </section>
    </>
  );
}

export function DataRoomPage() {
  const { t, href, locale, site, l } = usePage();
  const projects = site.entries.filter((e) => e.meta.funding?.public && !e.meta.noFunnel).sort(byOrder);
  const materials = locale === "he" ? ["מצגות", "תקציבים", "מודלים פיננסיים", "תוכניות אבני דרך", "טבלאות הון", "תוכניות עסקיות", "מחקרי שוק"] : ["Pitch decks", "Budgets", "Financial models", "Milestone plans", "Cap tables", "Business plans", "Market research"];
  return (
    <>
      <PageHeader eyebrow="INVEST" title={t("dataroom.title")} intro={t("dataroom.intro")} />
      <div className="dataroom">
        <ul className="dataroom-materials">
          {materials.map((m) => (
            <li key={m}>
              <Mono>{m}</Mono>
            </li>
          ))}
        </ul>
        {projects.length > 0 && (
          <ul className="dataroom-projects">
            {projects.map((e) => (
              <li key={e.meta.slug}>
                <a href={href(entryPath(e, locale))}>{l(e.meta.title)}</a> <span className="muted">— {l(e.meta.summary)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mono muted small">{t("dataroom.note")}</p>
        <p>
          <a className="button" href={href(localePath(locale, "/contact/?intent=invest&topic=data-room"))} data-track="cta-dataroom">
            {t("dataroom.request")}
          </a>
        </p>
      </div>
    </>
  );
}

export function RandomPage() {
  const { t, href, locale, site } = usePage();
  const candidates = site.entries.filter((e) => !(e.meta.collection === "writing" && !e.meta.public)).map((e) => href(entryPath(e, locale)));
  return (
    <>
      <PageHeader title={t("random.title")} intro={t("random.body")} />
      <noscript>
        <ul className="rows">
          {candidates.slice(0, 8).map((c) => (
            <li key={c}>
              <a href={c}>{c}</a>
            </li>
          ))}
        </ul>
      </noscript>
      <script dangerouslySetInnerHTML={{ __html: `var c=${JSON.stringify(candidates)};location.replace(c[Math.floor(Math.random()*c.length)]);` }} />
    </>
  );
}

export function NotFoundPage() {
  const { t, href, locale } = usePage();
  return (
    <>
      <PageHeader eyebrow="404" title={t("notFound.title")} intro={t("notFound.body")} />
      <p>
        <a className="button" href={href(localePath(locale, "/index/"))}>
          {t("index.title")} {t("ui.arrow")}
        </a>
      </p>
    </>
  );
}
