// The content model. Every field is optional unless marked; pages never render empty sections.
// Content lives in /content/<collection>/<slug>/meta.yaml + en.md (+ he.md). See docs/HOW_TO_ADD_PROJECT.md.

export type L10n = { en: string; he?: string };
export type L10nList = { en: string[]; he?: string[] };

export type Collection = "projects" | "lab" | "music" | "writing" | "research" | "civic";

export type Status =
  | "live"
  | "product-development"
  | "in-development"
  | "prototype"
  | "research"
  | "recording"
  | "in-production"
  | "writing"
  | "concept"
  | "active"
  | "paused"
  | "complete"
  | "archived"
  | "failed";

export const STATUS_LABEL: Record<Status, L10n> = {
  live: { en: "Live", he: "באוויר" },
  "product-development": { en: "Product development", he: "פיתוח מוצר" },
  "in-development": { en: "In development", he: "בפיתוח" },
  prototype: { en: "Prototype", he: "אב־טיפוס" },
  research: { en: "Research", he: "מחקר" },
  recording: { en: "Recording", he: "בהקלטה" },
  "in-production": { en: "In production", he: "בהפקה" },
  writing: { en: "Writing", he: "בכתיבה" },
  concept: { en: "Concept", he: "רעיון" },
  active: { en: "Active", he: "פעיל" },
  paused: { en: "Paused", he: "מושהה" },
  complete: { en: "Complete", he: "הושלם" },
  archived: { en: "Archived", he: "בארכיון" },
  failed: { en: "Failed experiment", he: "ניסוי שנכשל" },
};

/** Statuses that belong in the Archive rather than the live sections. */
export const ARCHIVE_STATUSES: Status[] = ["paused", "complete", "archived", "failed"];

export type FundingType = "investment" | "sponsorship" | "patronage" | "collaboration" | "grant" | "bootstrapped";

export type ResearchKind =
  | "question"
  | "hypothesis"
  | "speculative-model"
  | "experiment"
  | "prototype"
  | "technical-note"
  | "literature-note";

export const RESEARCH_KIND_LABEL: Record<ResearchKind, L10n> = {
  question: { en: "Question", he: "שאלה" },
  hypothesis: { en: "Hypothesis", he: "השערה" },
  "speculative-model": { en: "Speculative model", he: "מודל ספקולטיבי" },
  experiment: { en: "Experiment", he: "ניסוי" },
  prototype: { en: "Prototype", he: "אב־טיפוס" },
  "technical-note": { en: "Technical note", he: "הערה טכנית" },
  "literature-note": { en: "Literature note", he: "הערת קריאה" },
};

export type WritingType =
  | "essay"
  | "poetry"
  | "lyrics"
  | "fiction"
  | "literary-experiment"
  | "philosophy"
  | "technical-note"
  | "screenplay"
  | "notes";

export const WRITING_TYPE_LABEL: Record<WritingType, L10n> = {
  essay: { en: "Essay", he: "מסה" },
  poetry: { en: "Poetry", he: "שירה" },
  lyrics: { en: "Lyrics", he: "מילים לשיר" },
  fiction: { en: "Fiction", he: "פרוזה" },
  "literary-experiment": { en: "Literary experiment", he: "ניסוי ספרותי" },
  philosophy: { en: "Philosophy", he: "פילוסופיה" },
  "technical-note": { en: "Technical note", he: "הערה טכנית" },
  screenplay: { en: "Screenplay", he: "תסריט" },
  notes: { en: "Notes", he: "הערות" },
};

export type TextLang = "en" | "he" | "es";
export const TEXT_LANG_LABEL: Record<TextLang, L10n> = {
  en: { en: "English", he: "אנגלית" },
  he: { en: "Hebrew", he: "עברית" },
  es: { en: "Spanish", he: "ספרדית" },
};

export interface Link {
  label: L10n | string;
  url: string;
}

export interface Funding {
  type: FundingType;
  stage?: L10n;
  exists?: L10n;
  next?: L10n;
  /** Human-readable amount, e.g. "≈ ₪11,000" or "TODO". Never a fake valuation. */
  ask?: L10n;
  useOfFunds?: L10n;
  unlocks?: L10n;
  target?: L10n;
  status?: L10n;
  /** Show the FundingCard on the project page and in /support. */
  public?: boolean;
}

export interface Opportunity {
  what?: L10n;
  why?: L10n;
  exists?: L10n;
  next?: L10n;
  support?: L10n;
}

export interface SponsorItem {
  title: L10n;
  detail?: L10n;
  amount?: L10n;
}

export interface Economics {
  /** Only rendered when `public` is true. Keep real numbers here; flip when you want them seen. */
  public: boolean;
  costToDate?: L10n;
  revenue?: L10n;
  monthlyBurn?: L10n;
  unitEconomics?: L10n;
  target?: L10n;
  nextMilestone?: L10n;
  note?: L10n;
}

export interface TimelineItem {
  date: string; // YYYY-MM or YYYY-MM-DD
  text: L10n;
}

export interface Milestone {
  text: L10n;
  done?: boolean;
  date?: string;
}

export interface Metric {
  label: L10n;
  value: string;
  /** MEASURED | DESIGNED | PLANNED — the evidence class, shown next to the number. */
  kind?: "measured" | "designed" | "planned" | "verified";
  source?: string;
}

export interface Evidence {
  label: L10n;
  url?: string;
  kind?: "code" | "demo" | "recording" | "document" | "screenshot" | "data" | "performance" | "release";
}

export interface Song {
  title: L10n;
  note?: L10n;
  status?: Status;
  /** Path under /public (e.g. /audio/x.mp3). Only rendered when `public` is true. */
  audio?: string;
  public?: boolean;
  writing?: string; // slug of the lyrics in /writing
}

export interface BuiltLevels {
  built?: L10nList;
  prototyped?: L10nList;
  researching?: L10nList;
  vision?: L10nList;
}

export interface Meta {
  // identity
  slug: string; // derived from folder name
  collection: Collection; // derived from folder
  title: L10n;
  subtitle?: L10n;
  summary: L10n; // one sentence
  category: L10n; // free text, e.g. "Food · product R&D"
  status: Status;
  started?: string; // YYYY or YYYY-MM
  updated?: string; // YYYY-MM-DD
  featured?: boolean;
  /** Visual weight on the home page: 1 = large, 2 = medium, 3 = small card. */
  weight?: 1 | 2 | 3;
  order?: number;
  accent?: string; // project accent colour
  tagline?: L10n;
  // media
  hero?: { src: string; alt: L10n; caption?: L10n; video?: string; poster?: string };
  gallery?: { src: string; alt: L10n; caption?: L10n }[];
  // links
  github?: string;
  website?: string;
  demo?: string;
  links?: Link[];
  languages?: string[]; // programming languages or human languages
  collaborators?: { name: L10n; role?: L10n; url?: string }[];
  // substance
  milestone?: L10n; // current milestone (shown on cards)
  builtLevels?: BuiltLevels;
  timeline?: TimelineItem[];
  milestones?: Milestone[];
  metrics?: Metric[];
  evidence?: Evidence[];
  economics?: Economics;
  funding?: Funding;
  opportunity?: Opportunity;
  sponsor?: SponsorItem[];
  lessons?: L10nList; // "what we learned" (archive)
  related?: string[]; // "collection/slug" refs
  // research
  kind?: ResearchKind;
  references?: string[];
  revisions?: { date: string; text: L10n }[];
  // writing
  type?: WritingType;
  language?: TextLang;
  public?: boolean; // writing: false = listed in the drawer without text
  date?: string;
  excerptOnly?: boolean;
  // music
  songs?: Song[];
  instrumentation?: L10nList;
  credits?: { role: L10n; name: L10n }[];
  audio?: { title: L10n; src: string; public?: boolean; note?: L10n }[];
  videos?: { title: L10n; youtube?: string; src?: string; note?: L10n }[];
  // civic
  noFunnel?: boolean;
  // internal
  todo?: string[]; // content TODOs — rendered only in the build report, never on the site
}

export interface Entry {
  meta: Meta;
  body: { en: string; he?: string }; // markdown
  dir: string;
}

export interface UpdateEntry {
  date: string; // YYYY-MM-DD
  project?: string; // "collection/slug"
  title: L10n;
  text?: L10n;
  link?: string;
}

export interface NowItem {
  project?: string;
  title: L10n;
  text: L10n;
}

export interface NowData {
  asOf: string;
  items: NowItem[];
  note?: L10n;
}
