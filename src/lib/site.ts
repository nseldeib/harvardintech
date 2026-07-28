// Site-wide data loaded from editable JSON singletons under the data root.
//
// `settings.json` and `nav.json` are content, not code: the CMS edits them
// through its settings and nav editors, and every layout reads them through
// this module.
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
  // Figures in the homepage stat strip under the hero (Stats.astro). Optional so
  // existing/seeded settings without them fall back to the component's built-in
  // defaults; present here so the team edits the numbers in the CMS, not code.
  homeStats?: { value: string; label: string }[];
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

/** Editable copy for /volunteer. The prose, the four "Why Volunteer" blocks,
 *  and the projects-section framing are data so the team can rewrite the pitch
 *  in the CMS without a code change. */
export interface VolunteerPageCopy {
  kicker?: string;
  /** Full-bleed hero background photo. */
  heroImage?: string;
  headline: string;
  intro: string;
  benefitsTitle?: string;
  benefits: { title: string; body: string }[];
  projectsTitle?: string;
  projectsIntro?: string;
  /** Shown in place of the grid when no projects are open — the production
   *  default, so it is the state most visitors will actually see. */
  projectsEmptyMessage?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

/** Icon badge on a "What Your Gift Powers" card. Matches the campaign mockup;
 *  drawn as inline SVG so there is no image request per card. */
export type PillarIcon = 'people' | 'book' | 'globe';

/** Editable copy for the /donate Momentum Fund campaign page. */
export interface DonatePageCopy {
  campaignName: string;
  /** The hero headline itself carries the personalization — "{name}, let's go
   *  further together" — filled from `?name=` in the browser (see
   *  lib/personalize.ts). With no usable name, `heroHeadlineGeneric` is used. */
  heroHeadlineNamed: string;
  heroHeadlineGeneric: string;
  heroSubhead?: string;
  /** Full-bleed background photo behind the hero. */
  heroImage?: string;
  /** Figures in the band under the hero. The story section's title ("And Every
   *  Number Represents a Story") refers to these, so removing them leaves that
   *  heading dangling. */
  stats?: { value: string; label: string }[];
  storyTitle?: string;
  storyLede?: string;
  storyPullQuote?: string;
  storyBody?: string[];
  whyTitle?: string;
  whyBody?: { title: string; paragraphs: string[] }[];
  pillarsTitle?: string;
  pillars?: {
    icon?: PillarIcon;
    title: string;
    body: string;
    linkLabel?: string;
    linkUrl?: string;
  }[];
  testimonialsTitle?: string;
  ctaTitle?: string;
  ctaBody?: string;
  ctaLabel?: string;
  /** Empty until a donation platform is chosen; the CTA then falls back to a
   *  giving-inquiry mailto (same model as Sponsorship). */
  donateUrl?: string;
}

export const settings = readSingleton<SiteSettings>('settings.json');
export const nav = readSingleton<SiteNav>('nav.json');
export const volunteerPage = readSingleton<VolunteerPageCopy>('volunteerPage.json');
export const donatePage = readSingleton<DonatePageCopy>('donatePage.json');
