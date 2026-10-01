import { createContext, useContext } from "react";
import type { Locale } from "../site.ts";
import type { Site } from "../content/load.ts";
import type { L10n } from "../content/schema.ts";
import { t as translate, localized, type Key } from "../i18n.ts";
import { renderMarkdown, type RenderCtx } from "./markdown.ts";

export interface PageCtx {
  locale: Locale;
  dir: "ltr" | "rtl";
  site: Site;
  /** Current site-absolute path, e.g. "/en/projects/rasa/". */
  path: string;
  href: (path: string) => string;
  asset: (path: string) => string;
  publicDir: string;
  t: (key: Key) => string;
  l: (v: L10n | string | undefined) => string;
  md: (markdown: string) => string;
  /** Alternate-language path for this page, if it exists. */
  alternate?: string;
}

export function makeCtx(base: Omit<PageCtx, "t" | "l" | "md" | "dir">): PageCtx {
  const ctx: PageCtx = {
    ...base,
    dir: base.locale === "he" ? "rtl" : "ltr",
    t: (key) => translate(base.locale, key),
    l: (v) => (v === undefined ? "" : localized(v as L10n, base.locale)),
    md: (markdown) => renderMarkdown(markdown, ctx as unknown as RenderCtx),
  };
  return ctx;
}

export const Ctx = createContext<PageCtx | null>(null);

export function usePage(): PageCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PageCtx missing");
  return ctx;
}
