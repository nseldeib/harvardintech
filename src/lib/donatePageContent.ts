// Loading the Momentum Fund page's card bands and its giving destination from
// content collections.
//
// The thin `astro:content` edge, the same split `./momentumSectionsContent.ts`
// and `./donorsContent.ts` already use. It exists because all three of these used
// to live in `donatePage.json` — a file the CMS does not model at all — so the
// accomplishment cards, the gift pillars, and the donation URL were developer-only
// edits. Moving them into collections is what put them in /admin.
//
// The shapes returned here match what `MomentumFundPage` and its children always
// took from `copy.accomplishments` / `copy.pillars` / `copy.donateUrl`, so the
// migration is invisible to every component below the route.

import { getCollection } from 'astro:content';
import { publishedEntries } from './drafts';
import { INCLUDE_DRAFTS } from './draftVisibility';
import { sortByOrder } from './order';
import { resolvePillarIcon } from './pillars';
import type { DonatePageCopy } from './site';

type Accomplishment = NonNullable<DonatePageCopy['accomplishments']>[number];
type Pillar = NonNullable<DonatePageCopy['pillars']>[number];

/**
 * The "What we've accomplished so far" cards in editor order.
 *
 * `description` in the schema becomes `body` here: `body` is a RESERVED field id
 * in the CMS registry (it belongs to the markdown-body machinery, and a custom
 * field claiming it is dropped from the editor without comment), so the
 * frontmatter key had to differ from the prop name the card component already
 * used. This function is where the two names meet.
 */
export async function loadAccomplishments(): Promise<Accomplishment[]> {
  const entries = publishedEntries(await getCollection('accomplishments'), INCLUDE_DRAFTS).map(
    (entry) => entry.data,
  );

  return sortByOrder(entries).map(({ value, label, description }) => ({
    value,
    label,
    body: description,
  }));
}

/**
 * The "What Your Gift Powers" cards in editor order.
 *
 * `icon` is free text for the same reason `kind` and `layout` are — the CMS has
 * no select control — so it passes through `resolvePillarIcon`, which turns
 * whatever an editor typed into one of the three glyphs the badge actually draws.
 */
export async function loadPillars(): Promise<Pillar[]> {
  const entries = publishedEntries(await getCollection('pillars'), INCLUDE_DRAFTS).map(
    (entry) => entry.data,
  );

  return sortByOrder(entries).map(({ title, description, icon, linkLabel, linkUrl }) => ({
    title,
    body: description,
    icon: resolvePillarIcon(icon),
    linkLabel,
    linkUrl,
  }));
}

/**
 * Where every giving button points, from the `pageCopy` entry for /donate.
 *
 * Blank or absent falls back to `fallback` (the value still carried by
 * `donatePage.json`), which is itself empty today — so with nothing set anywhere,
 * `resolveGiveHref` keeps every button on the giving-inquiry mailto. That is the
 * production state, and the single box in /admin is what changes it.
 */
export async function loadDonateUrl(fallback?: string): Promise<string | undefined> {
  const entry = (await getCollection('pageCopy')).find((page) => page.id === 'donate');
  return entry?.data.donateUrl?.trim() || fallback;
}
