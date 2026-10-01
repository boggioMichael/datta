# Deploying

`npm run build` produces `dist/` — plain HTML, CSS, fonts and images. Host it on anything that serves static files.

## Before the first deploy

1. **Domain.** Set `SITE_URL` (used for canonical URLs, hreflang, sitemap, OpenGraph) — as an environment variable at build time, or edit the default in `src/site.ts`.
2. **Contact.** Set `CONTACT_EMAIL` and, if you use a form backend, `CONTACT_FORM_ENDPOINT` (Formspree, Basin, Netlify Forms, your own function). Without an endpoint the form falls back to a `mailto:` link using `CONTACT_EMAIL`; without either it shows a notice and the direct links.
3. **Analytics (optional).** `ANALYTICS_PROVIDER=plausible ANALYTICS_DOMAIN=your.domain` or `ANALYTICS_PROVIDER=umami ANALYTICS_SRC=… ANALYTICS_WEBSITE_ID=…`. Buttons carry `data-track` names (`cta-invest`, `cta-sponsor`, `cta-collaborate`, `contact-submit`, `search-open`, …) and fire as custom events. No cookies, no fingerprinting.
4. **Hosting under a sub-path** (GitHub project pages): set `BASE_PATH=/repo-name`.

## GitHub Pages

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to Pages. In the repository settings → Pages, choose "GitHub Actions" as the source. While the site lives at `boggiomichael.github.io/datta`, the repository variables are `BASE_PATH=/datta` and `SITE_URL=https://boggiomichael.github.io/datta`. For a custom domain: set it in Settings → Pages (no `CNAME` file is needed with the Actions deployment), then set `SITE_URL` to the domain and `BASE_PATH` to empty.

## Vercel / Netlify / Cloudflare Pages / Render

- Build command: `npm run build`
- Output directory: `dist`
- Node: 20+
- Environment variables: as above.

`vercel.json` and `netlify.toml` are included with sensible headers (long cache for `/fonts`, `/assets`, `/images`; `X-Content-Type-Options`, `Referrer-Policy`) and a 404 rule.

## Checks before you push

```sh
npm run validate   # fails on broken links or a leaked TODO
npm run check      # TypeScript
```

Optional: `npm run preview` then `node tools/screenshots.mjs` for a desktop + iPhone screenshot pass, and `node tools/og.mjs http://localhost:4321` to regenerate OpenGraph images after adding entries.

## The investor data room

`/invest/data-room/` is a request-access page only. Nothing private is in this repository. When you want to share decks, budgets or models, do it through a private folder (Drive, Notion, a password-protected page on the host) and send the link by hand after the first conversation.
