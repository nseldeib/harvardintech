// Site-wide data loaded from editable JSON singletons under the data root.
//
// `settings.json` and `nav.json` are content, not code: the CMS edits them as
// Sveltia "file" collections, and every layout reads them through this module.
// Changing the contact email, a social link, or a menu item is therefore a
// data edit (a commit the CMS makes), never a source change. codeyam's
// `content-collection` seed adapter rewrites these same files per scenario, so
// a scenario can render "site with 3 socials and a chapters dropdown" vs a
// minimal nav without touching markup.
//
// These are read at build/render time via `fs` from `dataRoot()` (rather than a
// static `import` locked to `src/data`) so a codeyam session can redirect them
// to a sandbox copy and seeding never overwrites the committed production JSON.
// Server-only module — imported from `.astro` frontmatter, never a client
// island, so `fs`/`process.env` are always available here.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dataRoot } from './contentRoot';

function readSingleton<T>(name: string): T {
  const file = path.resolve(dataRoot(), name);
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export interface SocialLink {
  label: string;
  url: string;
  icon?: string;
}

export interface SiteSettings {
  siteTitle: string;
  description: string;
  contactEmail: string;
  footerText: string;
  socials: SocialLink[];
  // Integrations & discoverability. All optional so existing/seeded settings
  // without them still parse and default to "off".
  // GA4 Measurement ID (e.g. `G-XXXXXXXXXX`); empty/absent = analytics off.
  googleAnalyticsId?: string;
  // Raw HTML injected verbatim into every page's <head> / before </body>
  // (verification tags, pixels, chat widgets). Power-user escape hatch — the
  // snippet runs on every page, so only trusted markup belongs here.
  customHeadHtml?: string;
  customBodyHtml?: string;
}

export interface NavItem {
  label: string;
  url?: string;
  children?: NavItem[];
}

export interface SiteNav {
  items: NavItem[];
}

export const settings = readSingleton<SiteSettings>('settings.json');
export const nav = readSingleton<SiteNav>('nav.json');
