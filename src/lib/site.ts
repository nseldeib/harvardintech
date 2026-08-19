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
import { readSingleton } from './contentRoot';

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
  // The homepage stat strip is NOT here any more. `homeStats` lived on this
  // singleton and held the real figures, but the CMS renders inputs for five
  // scalar settings keys and round-trips the rest untouched — so the numbers
  // were editable data with nowhere to edit them. They are now the `stats`
  // content collection, which the editor renders like any other.
  // Integrations & discoverability. All optional so existing/seeded settings
  // without them still parse and default to "off".
  // GA4 Measurement ID (e.g. `G-XXXXXXXXXX`); empty/absent = analytics off.
  googleAnalyticsId?: string;
  // Givebutter account key — the `acct=` value from their embed snippet.
  // Empty/absent = the widgets loader script is not shipped at all, so a site
  // with no Givebutter account emits zero third-party markup. Required before
  // any goal-meter section can render a meter.
  givebutterAccountId?: string;
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

/** Editable copy for the /donate Momentum Fund campaign page. */
/** Editable copy for /sponsor. Same model as VolunteerPageCopy: the pitch, the
 *  partnership levels, and the legal line are all CMS edits, never code changes. */
export interface SponsorPageCopy {
  kicker?: string;
  headline: string;
  intro?: string;
  /** Full-bleed hero background photo. */
  heroImage?: string;
  levelsTitle?: string;
  levelsIntro?: string;
  /** The partnership levels a sponsor chooses between. `id` is what a sponsor's
   *  `tier` matches on, so renaming a level's `name` is safe but changing its
   *  `id` re-homes every sponsor tagged to it. */
  levels?: { id: string; name: string; summary?: string; benefits?: string[] }[];
  wallTitle?: string;
  /** Shown in place of the wall when no sponsors are published — the production
   *  default, so it is the state most visitors will actually see. */
  wallEmptyMessage?: string;
  inquiryTitle?: string;
  inquiryBody?: string;
  /** Third-party form URL (Google Forms, Typeform). Empty renders EmbedForm's
   *  unconfigured fallback, which reads as an obvious placeholder rather than a
   *  broken form. */
  inquiryFormUrl?: string;
  /** The Harvard Alumni Association requires a Shared Interest Group to state
   *  that contributions go to the group and not to Harvard University. Copy, not
   *  markup, so the team can revise the wording without a deploy. */
  disclaimer?: string;
}

export interface DonatePageCopy {
  campaignName: string;
  /** The hero headline itself carries the personalization — "{name}, let's go
   *  further together" — filled from `?name=` in the browser (see
   *  lib/personalize.ts). With no usable name, `heroHeadlineGeneric` is used. */
  heroHeadlineNamed: string;
  heroHeadlineGeneric: string;
  /** The uppercase eyebrow above the hero headline, naming the campaign. The
   *  frame's counterpart to a section's `kicker` — the hero is deliberately not
   *  a section, so it carries its own field rather than borrowing one. */
  heroKicker?: string;
  heroSubhead?: string;
  /** Full-bleed background photo behind the hero. */
  heroImage?: string;
  /** Optional moving backdrop for the hero — a path to a video committed under
   *  `public/videos/`. Blank leaves the hero as `heroImage` renders it. When set,
   *  `heroImage` does not step aside: it becomes the video's poster and remains
   *  the section background, so a 404, a blocked autoplay, or reduced-motion all
   *  fall back to the photo. Deliberately absent from `donatePage.json` — see
   *  `mergeDonateFrame`, which is what lets an editor clear it. */
  heroVideo?: string;
  /** Figures for the stats band. Not seeded as a section today — the campaign
   *  review removed the band from under the hero — but the renderer and this
   *  copy stay, so re-adding a `stats` section in the CMS brings it back with no
   *  code change. */
  stats?: { value: string; label: string }[];
  /** The campaign's track record — what the community has already done. The
   *  campaign asks a reader to fund momentum that is already visible, so the
   *  evidence comes before the ask. */
  accomplishmentsTitle?: string;
  accomplishments?: { value: string; label: string; body?: string; group?: string }[];
  // The narrative sections ("And Every Number Represents a Story", "Why Support
  // Harvard Alumni in Tech?") are NOT here — their heading, photo, layout, and prose
  // live in the `momentumSections` collection so an editor can rewrite and
  // reorder them from the CMS. What remains below is the card data for the
  // bespoke bands, which those sections merely position.
  pillarsTitle?: string;
  pillars?: {
    title: string;
    body: string;
    linkLabel?: string;
    linkUrl?: string;
    /** Which band shows this card. Carried down to the page component, which
     *  selects per section — see `src/lib/sectionGroups.ts`. */
    group?: string;
  }[];
  testimonialsTitle?: string;
  /** Donor recognition wall. `donorTiers` are the giving levels the wall groups
   *  by; each carries the `id` a donor's `tier` matches on, mirroring `levels`
   *  in `sponsorPage.json` — so renaming a level is a copy edit while the `id`
   *  stays the stable key donors are filed under. `donorsEmptyMessage` is what
   *  production shows today: the wall starts with no names, so its empty state
   *  is the default view rather than an edge case. */
  donorsTitle?: string;
  donorsIntro?: string;
  donorsEmptyMessage?: string;
  donorTiers?: { id: string; name: string; description?: string }[];
  /** The Momentum Network band. `networkTitle` is the label in the
   *  visualization's top-left corner and `networkTagline` the line beneath the
   *  heading — both are copy the design direction specifies word for word, so
   *  they live here rather than in the component that draws them.
   *  `shareMessage` is the template a supporter's badge pre-populates its
   *  LinkedIn and Facebook share with; it carries a supporter-message slot and a
   *  donation-link slot, and the supporter-message LINE is dropped outright when
   *  the supporter wrote nothing — see `shareMessage` in `./supporterBadge.ts`,
   *  which owns that rule. */
  networkTitle?: string;
  networkTagline?: string;
  networkSearchTitle?: string;
  shareMessage?: string;
  ctaKicker?: string;
  ctaTitle?: string;
  /** Splits on blank lines into paragraphs, so the closing ask's two sentences
   *  need one field rather than two. */
  ctaBody?: string;
  /** The photo beside the closing copy. Blank collapses the band to copy alone
   *  rather than leaving a hole, so the picture is genuinely optional. */
  ctaImage?: string;
  /** The uppercase sign-off line beneath the closing button. Distinct from
   *  `ctaBody`: this is a phrase, not prose, and is styled as one. */
  ctaTagline?: string;
  ctaLabel?: string;
  /** Empty until a donation platform is chosen; the CTA then falls back to a
   *  giving-inquiry mailto (same model as Sponsorship). */
  donateUrl?: string;
}

export const settings = readSingleton<SiteSettings>('settings.json');
export const nav = readSingleton<SiteNav>('nav.json');
export const volunteerPage = readSingleton<VolunteerPageCopy>('volunteerPage.json');
export const donatePage = readSingleton<DonatePageCopy>('donatePage.json');
export const sponsorPage = readSingleton<SponsorPageCopy>('sponsorPage.json');
