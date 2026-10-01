import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { L10n } from "./schema.ts";

export interface HomeData {
  headline: L10n;
  subline: L10n;
  aboutShort: L10n; // markdown
  supportText: L10n; // markdown
  supportKinds: L10n[];
}

export function loadHome(root: string): HomeData {
  const raw = yaml.load(readFileSync(join(root, "content", "home.yaml"), "utf8"), { schema: yaml.CORE_SCHEMA }) as HomeData;
  return raw;
}
