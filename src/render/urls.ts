import type { Locale } from "../site.ts";
import type { Entry, Collection } from "../content/schema.ts";

export const collectionBase: Record<Collection, string> = {
  projects: "projects",
  lab: "lab",
  music: "music",
  writing: "writing",
  research: "research",
  civic: "civic",
};

/** Site-absolute path of an entry, e.g. "/en/projects/rasa/". */
export function entryPath(e: Entry, locale: Locale): string {
  return `/${locale}/${collectionBase[e.meta.collection]}/${e.meta.slug}/`;
}

/** True when the entry has a page of its own (unpublished writing lives only in the drawer list). */
export function hasPage(e: Entry): boolean {
  return !(e.meta.collection === "writing" && !e.meta.public);
}

/** Path to link to for an entry: its page, or the writing drawer for unpublished texts. */
export function entryHref(e: Entry, locale: Locale): string {
  return hasPage(e) ? entryPath(e, locale) : `/${locale}/writing/#drawer`;
}

/** Site-absolute path of a section/page, e.g. localePath("he", "/about/") -> "/he/about/". */
export function localePath(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}

/** Swap the locale prefix of a site-absolute path. */
export function switchLocale(path: string, to: Locale): string {
  return path.replace(/^\/(en|he)(\/|$)/, `/${to}/`);
}
