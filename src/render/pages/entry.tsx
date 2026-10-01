import { usePage } from "../context.tsx";
import {
  AudioList,
  BuiltLevels,
  Credits,
  Economics,
  EvidenceList,
  FundingCard,
  Gallery,
  Hero,
  LangNotice,
  Lessons,
  MetaTable,
  Metrics,
  Mono,
  Opportunity,
  Related,
  Songs,
  SponsorList,
  StatusBadge,
  Timeline,
  TypeLabel,
  Videos,
  formatDate,
} from "../components.tsx";
import { RESEARCH_KIND_LABEL, TEXT_LANG_LABEL, WRITING_TYPE_LABEL, type Entry } from "../../content/schema.ts";
import { expandScreenplay, readingMinutes } from "../markdown.ts";
import { localePath } from "../urls.ts";

function bodyFor(entry: Entry, locale: "en" | "he"): { md: string; fallback: boolean } {
  if (locale === "he" && entry.body.he && entry.body.he.trim()) return { md: entry.body.he, fallback: false };
  return { md: entry.body.en, fallback: locale === "he" };
}

export function ProjectPage({ entry }: { entry: Entry }) {
  const { l, md, locale, t, href } = usePage();
  const m = entry.meta;
  const { md: body, fallback } = bodyFor(entry, locale);
  const isCivic = m.collection === "civic";
  return (
    <article className="entry entry-project" style={m.accent ? ({ "--project-accent": m.accent } as React.CSSProperties) : undefined}>
      <header className="entry-head">
        <p className="eyebrow">
          <TypeLabel entry={entry} /> <span className="sep">·</span> {l(m.category)}
        </p>
        <h1 className="entry-title">{l(m.title)}</h1>
        {m.subtitle && <p className="entry-subtitle">{l(m.subtitle)}</p>}
        <p className="entry-lede">{l(m.summary)}</p>
        <div className="entry-status">
          <StatusBadge status={m.status} />
          {m.milestone && (
            <span className="entry-milestone">
              <Mono>{t("label.milestone").toUpperCase()}</Mono> {l(m.milestone)}
            </span>
          )}
        </div>
        {isCivic && (
          <p className="civic-note">
            {locale === "he"
              ? "פרויקט אזרחי. מתועד כאן כעובדה; אינו חלק ממסלול ההשקעה של דאטא."
              : "A civic project. Documented here as a matter of record; not part of Datta's investment funnel."}
          </p>
        )}
      </header>
      <Hero m={m} />
      <div className="entry-grid">
        <aside className="entry-side">
          <MetaTable m={m} />
        </aside>
        <div className="entry-main">
          {fallback && <LangNotice />}
          <BuiltLevels m={m} />
          {body.trim() && <div className="prose" dangerouslySetInnerHTML={{ __html: md(body) }} lang={fallback ? "en" : locale} dir={fallback ? "ltr" : undefined} />}
          <Metrics m={m} />
          <EvidenceList m={m} />
          <Videos m={m} />
          <AudioList m={m} />
          <Gallery m={m} />
          <Timeline m={m} />
          <Economics m={m} />
          <Lessons m={m} />
          {!isCivic && <Opportunity m={m} />}
          {!isCivic && <FundingCard m={m} />}
          {!isCivic && <SponsorList m={m} />}
        </div>
      </div>
      <Related entry={entry} />
    </article>
  );
}

export function MusicPage({ entry }: { entry: Entry }) {
  const { l, md, locale, t } = usePage();
  const m = entry.meta;
  const { md: body, fallback } = bodyFor(entry, locale);
  return (
    <article className="entry entry-music" style={m.accent ? ({ "--project-accent": m.accent } as React.CSSProperties) : undefined}>
      <header className="entry-head">
        <p className="eyebrow">
          <TypeLabel entry={entry} /> <span className="sep">·</span> {l(m.category)}
        </p>
        <h1 className="entry-title">{l(m.title)}</h1>
        {m.subtitle && <p className="entry-subtitle">{l(m.subtitle)}</p>}
        <p className="entry-lede">{l(m.summary)}</p>
        <div className="entry-status">
          <StatusBadge status={m.status} />
          {m.milestone && (
            <span className="entry-milestone">
              <Mono>{t("label.milestone").toUpperCase()}</Mono> {l(m.milestone)}
            </span>
          )}
        </div>
      </header>
      <Hero m={m} />
      <div className="entry-grid">
        <aside className="entry-side">
          <MetaTable m={m} />
          <Credits m={m} />
        </aside>
        <div className="entry-main">
          {fallback && <LangNotice />}
          <Videos m={m} />
          <AudioList m={m} />
          {body.trim() && <div className="prose" dangerouslySetInnerHTML={{ __html: md(body) }} lang={fallback ? "en" : locale} dir={fallback ? "ltr" : undefined} />}
          <Songs m={m} />
          <Gallery m={m} />
          <Timeline m={m} />
          <EvidenceList m={m} />
          <SponsorList m={m} />
          <FundingCard m={m} />
        </div>
      </div>
      <Related entry={entry} />
    </article>
  );
}

export function WritingPage({ entry }: { entry: Entry }) {
  const { l, md, locale, t } = usePage();
  const m = entry.meta;
  const { md: body, fallback } = bodyFor(entry, locale);
  const textLang = m.language ?? "en";
  const bodyLang = fallback ? "en" : locale === "he" ? "he" : textLang;
  const bodyDir = bodyLang === "he" ? "rtl" : "ltr";
  const isScreenplay = m.type === "screenplay";
  const text = isScreenplay ? expandScreenplay(body) : body;
  // A published draft says so: anything not complete carries its status next to the title.
  const showStatus = m.status !== "complete";
  return (
    <article className="entry entry-writing">
      <header className="entry-head writing-head">
        <p className="eyebrow">
          {m.type && <Mono className="kind">{l(WRITING_TYPE_LABEL[m.type]).toUpperCase()}</Mono>}
          {m.language && (
            <>
              <span className="sep">·</span> {l(TEXT_LANG_LABEL[m.language])}
            </>
          )}
          {m.date && (
            <>
              <span className="sep">·</span> <Mono>{formatDate(m.date, locale)}</Mono>
            </>
          )}
          <span className="sep">·</span> <Mono>{readingMinutes(body)} {t("label.readingTime")}</Mono>
        </p>
        <h1 className="entry-title writing-title" lang={textLang}>
          {l(m.title)}
        </h1>
        {m.subtitle && <p className="entry-subtitle">{l(m.subtitle)}</p>}
        {(showStatus || m.note) && (
          <div className="entry-status writing-status">
            {showStatus && <StatusBadge status={m.status} />}
            {m.note && <p className="writing-note">{l(m.note)}</p>}
          </div>
        )}
      </header>
      {fallback && <LangNotice />}
      <AudioList m={m} />
      <div
        className={`prose prose-literary${m.excerptOnly ? " excerpt" : ""}${isScreenplay ? " prose-screenplay" : ""}`}
        dangerouslySetInnerHTML={{ __html: md(text) }}
        lang={bodyLang}
        dir={bodyDir}
      />
      {m.excerptOnly && <p className="excerpt-note">{locale === "he" ? "קטע מתוך עבודה בתהליך." : "An excerpt from a work in progress."}</p>}
      <Related entry={entry} />
    </article>
  );
}

export function ResearchPage({ entry }: { entry: Entry }) {
  const { l, md, locale, t } = usePage();
  const m = entry.meta;
  const { md: body, fallback } = bodyFor(entry, locale);
  return (
    <article className="entry entry-research">
      <header className="entry-head research-head">
        <p className="eyebrow">
          {m.kind && <Mono className="kind kind-strong">{l(RESEARCH_KIND_LABEL[m.kind]).toUpperCase()}</Mono>}
          <span className="sep">·</span> {l(m.category)}
          {m.updated && (
            <>
              <span className="sep">·</span> <Mono>{formatDate(m.updated, locale)}</Mono>
            </>
          )}
        </p>
        <h1 className="entry-title">{l(m.title)}</h1>
        {m.subtitle && <p className="entry-subtitle">{l(m.subtitle)}</p>}
        <p className="research-disclaimer mono">{t("research.disclaimer")}</p>
      </header>
      {fallback && <LangNotice />}
      <div className="research-grid">
        <div className="prose prose-research" dangerouslySetInnerHTML={{ __html: md(body) }} lang={fallback ? "en" : locale} dir={fallback ? "ltr" : undefined} />
        <aside className="research-side">
          <MetaTable m={m} />
          {m.references?.length ? (
            <div className="references">
              <h2 className="block-title">{t("label.references")}</h2>
              <ol className="reference-list">
                {m.references.map((r, i) => (
                  <li key={i} id={`ref-${i + 1}`} dir="auto">
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {m.revisions?.length ? (
            <div className="revisions">
              <h2 className="block-title">{t("label.revisionHistory")}</h2>
              <ul className="log compact">
                {m.revisions.map((r, i) => (
                  <li key={i}>
                    <Mono>{formatDate(r.date, locale)}</Mono>
                    <span>{l(r.text)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
      <EvidenceList m={m} />
      <Related entry={entry} />
    </article>
  );
}

export function EntryPage({ entry }: { entry: Entry }) {
  switch (entry.meta.collection) {
    case "music":
      return <MusicPage entry={entry} />;
    case "writing":
      return <WritingPage entry={entry} />;
    case "research":
      return <ResearchPage entry={entry} />;
    default:
      return <ProjectPage entry={entry} />;
  }
}

export function backLink(collection: Entry["meta"]["collection"], locale: "en" | "he") {
  return localePath(locale, `/${collection}/`);
}
