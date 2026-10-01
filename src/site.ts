// Site-wide configuration. Everything a deploy might change lives here.
export type Locale = "en" | "he";

export const site = {
  name: "DATTA",
  nameHe: "דאטא",
  // TODO: set to the real domain before deploying (used for canonical URLs, sitemap, OpenGraph).
  url: process.env.SITE_URL ?? "https://datta.com",
  // Optional base path when hosting under a sub-folder (e.g. GitHub project pages: "/datta").
  basePath: process.env.BASE_PATH ?? "",
  defaultLocale: "en" as Locale,
  locales: ["en", "he"] as Locale[],
  founder: {
    name: { en: "Michael Boggio", he: "מיכאל בוג׳יו" },
    location: { en: "Israel", he: "ישראל" },
    github: "https://github.com/boggioMichael",
    youtube: "https://www.youtube.com/@michaelboggioneoone",
  },
  contact: {
    // Public contact e-mail (shown on /contact and used by the form's mailto: fallback).
    email: process.env.CONTACT_EMAIL ?? "boggio.michael@gmail.com",
    // Form backend. FormSubmit (formsubmit.co) forwards the form to the e-mail with no account;
    // the first submission sends a one-time activation e-mail. After activation, FormSubmit also
    // offers a random alias endpoint that hides the address from the page source.
    formEndpoint: process.env.CONTACT_FORM_ENDPOINT ?? "https://formsubmit.co/ajax/boggio.michael@gmail.com",
  },
  analytics: {
    // Privacy-conscious analytics (Plausible or Umami). Leave empty to disable.
    // Example: { provider: "plausible", domain: "datta.studio", src: "https://plausible.io/js/script.tagged-events.js" }
    provider: (process.env.ANALYTICS_PROVIDER ?? "") as "" | "plausible" | "umami",
    domain: process.env.ANALYTICS_DOMAIN ?? "",
    src: process.env.ANALYTICS_SRC ?? "",
    websiteId: process.env.ANALYTICS_WEBSITE_ID ?? "",
  },
  // The one restrained accent of the Datta shell; project pages may set their own.
  accent: "#C8431F",
  buildDate: new Date().toISOString().slice(0, 10),
};

export const nav = [
  { key: "projects", path: "/projects/" },
  { key: "lab", path: "/lab/" },
  { key: "music", path: "/music/" },
  { key: "writing", path: "/writing/" },
  { key: "research", path: "/research/" },
] as const;

export const navSecondary = [
  { key: "about", path: "/about/" },
  { key: "support", path: "/support/" },
] as const;

export const footerLinks = [
  { key: "projects", path: "/projects/" },
  { key: "research", path: "/research/" },
  { key: "music", path: "/music/" },
  { key: "writing", path: "/writing/" },
  { key: "now", path: "/now/" },
  { key: "updates", path: "/updates/" },
  { key: "index", path: "/index/" },
  { key: "about", path: "/about/" },
  { key: "support", path: "/support/" },
  { key: "contact", path: "/contact/" },
] as const;
