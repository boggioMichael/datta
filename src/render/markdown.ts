import { Marked, type Tokens } from "marked";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolve, sep } from "node:path";
import sanitizeHtml from "sanitize-html";
import katex from "katex";
import type { Locale } from "../site.ts";
import type { Site } from "../content/load.ts";
import { localized } from "../i18n.ts";
import { entryHref } from "./urls.ts";

export interface RenderCtx {
  locale: Locale;
  site: Site;
  /** Resolve a site-absolute path ("/en/projects/x/") to the href used in this build. */
  href: (path: string) => string;
  /** Resolve a public asset ("/images/x.jpg"). */
  asset: (path: string) => string;
  publicDir: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Parse attributes of a component tag: src="…" alt='…' flag */
function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)')|([a-zA-Z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out[m[1]] = m[3] ?? m[4] ?? "";
    else if (m[5]) out[m[5]] = "true";
  }
  return out;
}

function youtubeEmbed(id: string, title: string): string {
  // youtube-nocookie: no tracking cookies until the visitor plays.
  return `<figure class="media video" data-component="video"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><figcaption>${esc(title)}${title ? " — " : ""}<a href="https://www.youtube.com/watch?v=${esc(id)}" rel="noopener" target="_blank">YouTube ↗</a></figcaption></figure>`;
}

/** Replace <Figure/>, <Video/>, <Audio/>, <Pdf/>, <Diagram/>, <Repo/>, <Callout>…</Callout> with HTML. */
export function expandComponents(md: string, ctx: RenderCtx): string {
  let out = md;
  out = out.replace(/<Figure\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    const src = ctx.asset(p.src ?? "");
    const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : "";
    return `<figure class="media figure${p.wide ? " wide" : ""}"><img src="${esc(src)}" alt="${esc(p.alt ?? "")}" loading="lazy" decoding="async"${p.width ? ` width="${esc(p.width)}"` : ""}${p.height ? ` height="${esc(p.height)}"` : ""}>${cap}</figure>`;
  });
  out = out.replace(/<Video\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    if (p.youtube) return youtubeEmbed(p.youtube, p.title ?? "");
    const src = ctx.asset(p.src ?? "");
    const poster = p.poster ? ` poster="${esc(ctx.asset(p.poster))}"` : "";
    const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : "";
    return `<figure class="media video"><video src="${esc(src)}"${poster} controls preload="metadata" playsinline${p.muted ? " muted" : ""}${p.loop ? " loop" : ""}>${p.title ? esc(p.title) : ""}</video>${cap}</figure>`;
  });
  out = out.replace(/<Audio\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    const src = ctx.asset(p.src ?? "");
    return `<figure class="media audio" data-component="audio"><div class="audio-head"><span class="audio-title">${esc(p.title ?? "")}</span>${p.note ? `<span class="audio-note">${esc(p.note)}</span>` : ""}</div><audio src="${esc(src)}" controls preload="none"></audio></figure>`;
  });
  out = out.replace(/<Pdf\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    const src = ctx.asset(p.src ?? "");
    return `<p class="media pdf"><a class="pdf-link" href="${esc(src)}" rel="noopener"><span class="mono">PDF</span> ${esc(p.title ?? src)}</a></p>`;
  });
  out = out.replace(/<Diagram\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    const file = resolve(ctx.publicDir, (p.src ?? "").replace(/^\/+/, ""));
    if (!file.startsWith(resolve(ctx.publicDir) + sep) || !file.endsWith('.svg')) return '';
    let svg = "";
    // Collapse whitespace so the inlined SVG stays one HTML block for the markdown parser.
    if (p.src && existsSync(file)) svg = readFileSync(file, "utf8").replace(/<\?xml[^>]*>/, "").replace(/\s*\n\s*/g, " ").trim();
    else svg = `<div class="todo-box">Diagram missing: ${esc(p.src ?? "")}</div>`;
    const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : "";
    return `<figure class="media diagram${p.wide ? " wide" : ""}" role="img" aria-label="${esc(p.alt ?? p.caption ?? "Diagram")}">${svg}${cap}</figure>`;
  });
  out = out.replace(/<Repo\s+((?:"[^"]*"|'[^']*'|[^>])*?)\/>/g, (_, a: string) => {
    const p = attrs(a);
    const url = p.url ?? "";
    const name = p.name ?? url.replace(/^https?:\/\/(www\.)?github\.com\//, "");
    return `<p class="repo-card"><a href="${esc(url)}" rel="noopener" target="_blank"><span class="mono">GITHUB</span><span class="repo-name">${esc(name)}</span>${p.note ? `<span class="repo-note">${esc(p.note)}</span>` : ""}</a></p>`;
  });
  out = out.replace(/<Callout(\s+(?:"[^"]*"|'[^']*'|[^>])*)?>([\s\S]*?)<\/Callout>/g, (_, a: string, inner: string) => {
    const p = attrs(a ?? "");
    const kind = p.kind ?? "note";
    const title = p.title ? `<strong class="callout-title">${esc(p.title)}</strong>` : "";
    return `<aside class="callout callout-${esc(kind)}">${title}\n\n${inner.trim()}\n\n</aside>`;
  });
  // Wiki links: [[projects/rasa]] or [[projects/rasa|custom label]]
  out = out.replace(/\[\[([a-z]+\/[a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, ref: string, label?: string) => {
    const e = ctx.site.byRef.get(ref);
    if (!e) return label ?? ref;
    const text = label ?? localized(e.meta.title, ctx.locale);
    // Site-absolute; the link renderer resolves it exactly once (base path or relative mode).
    return `[${text}](${entryHref(e, ctx.locale)})`;
  });
  return out;
}

/**
 * Screenplay sugar for `type: screenplay` entries. A paragraph that starts with a cue —
 * `MATHEO: For me?` or `MATHEO (thinking): Where's the car?` — becomes a dialogue block;
 * a line of the form `== A LIMIT ==` becomes a title card. Everything else is ordinary markdown.
 */
export function expandScreenplay(md: string): string {
  const cue = /^([A-Z][A-Z0-9 .'’\-]{0,40}?)(?:\s*\(([^)]*)\))?:\s+([\s\S]+)$/;
  return md
    .split(/\n{2,}/)
    .map((para) => {
      const p = para.trim();
      const card = p.match(/^==\s*(.+?)\s*==$/);
      if (card) return `<p class="title-card">${esc(card[1])}</p>`;
      const m = p.match(cue);
      if (!m) return para;
      const lines = m[3]
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith("(") && s.endsWith(")") ? `<span class="paren">${esc(s)}</span>` : esc(s)))
        .join("<br>");
      const paren = m[2] ? ` <span class="paren">(${esc(m[2])})</span>` : "";
      return `<div class="dialogue"><p class="cue">${esc(m[1])}${paren}</p><p class="line">${lines}</p></div>`;
    })
    .join("\n\n");
}

export function createMarked(ctx: RenderCtx): Marked {
  const marked = new Marked({ gfm: true, breaks: false });
  const usedIds = new Map<string, number>();
  marked.use({
    renderer: {
      code({text,lang}: Tokens.Code) {
        if(lang==='mermaid')return `<pre class="mermaid">${esc(text)}</pre>`;
        if(lang==='math'||lang==='latex')return `<div class="math-block">${katex.renderToString(text,{displayMode:true,throwOnError:false,trust:false})}</div>`;
        return `<pre><code${lang?` class="language-${esc(lang)}"`:''}>${esc(text)}</code></pre>`;
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens);
        let id = slugify(text) || `section-${depth}`;
        const n = usedIds.get(id) ?? 0;
        usedIds.set(id, n + 1);
        if (n) id = `${id}-${n + 1}`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${text}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        const t = title ? ` title="${esc(title)}"` : "";
        if (external) return `<a href="${esc(href)}"${t} rel="noopener" target="_blank">${text}</a>`;
        const resolved = href.startsWith("/") ? ctx.href(href) : href;
        return `<a href="${esc(resolved)}"${t}>${text}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        const src = href.startsWith("/") ? ctx.asset(href) : href;
        const t = title ? `<figcaption>${esc(title)}</figcaption>` : "";
        return `<figure class="media figure"><img src="${esc(src)}" alt="${esc(text)}" loading="lazy" decoding="async">${t}</figure>`;
      },
      table({ header, rows }: Tokens.Table) {
        const cell = (c: Tokens.TableCell, tag: "th" | "td") => {
          const align = c.align ? ` style="text-align:${c.align}"` : "";
          return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        };
        const thead = `<thead><tr>${header.map((c) => cell(c, "th")).join("")}</tr></thead>`;
        const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => cell(c, "td")).join("")}</tr>`).join("")}</tbody>`;
        return `<div class="table-wrap"><table>${thead}${tbody}</table></div>\n`;
      },
    },
  });
  return marked;
}

export function renderMarkdown(md: string, ctx: RenderCtx): string {
  const marked = createMarked(ctx);
  const expanded = expandComponents(md, ctx);
  const html=marked.parse(expanded) as string;
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags,'img','figure','figcaption','video','audio','source','iframe','svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','marker','title','desc','math','semantics','mrow','mi','mo','mn','mfrac','msup','msub','annotation','mtext','mspace','msqrt','mtable','mtr','mtd'],
    allowedAttributes: {'*':['class','id','role','aria-label','aria-hidden','tabindex','dir','lang','style'],a:['href','target','rel','title'],img:['src','alt','width','height','loading','decoding'],iframe:['src','title','loading','allow','allowfullscreen','referrerpolicy'],video:['src','poster','controls','preload','playsinline','muted','loop'],audio:['src','controls','preload'],source:['src','type'],svg:['viewBox','width','height','xmlns','fill','stroke'],g:['transform','fill','stroke','stroke-width'],path:['d','fill','stroke','stroke-width','marker-end','stroke-dasharray'],rect:['x','y','width','height','rx','fill','stroke'],circle:['cx','cy','r','fill','stroke'],line:['x1','x2','y1','y2','stroke','stroke-width','marker-end'],text:['x','y','fill','font-size','font-family','text-anchor'],marker:['id','viewBox','refX','refY','markerWidth','markerHeight','orient'],math:['xmlns','display'],annotation:['encoding']},
    allowedIframeHostnames:['www.youtube-nocookie.com'],allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,
    parser:{lowerCaseAttributeNames:false},
    allowedStyles:{'*':{'text-align':[/^(left|right|center)$/], 'height':[/^[\d.]+em$/], 'width':[/^[\d.]+em$/], 'vertical-align':[/^-?[\d.]+em$/], 'top':[/^-?[\d.]+em$/], 'margin-right':[/^-?[\d.]+em$/], 'margin-left':[/^-?[\d.]+em$/], 'position':[/^relative$/]}}
  });
}

export function readingMinutes(md: string): number {
  const words = md.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Plain-text excerpt for search/OG descriptions. */
export function plainText(md: string, max = 200): string {
  const text = md
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}
