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
import { mergeDonateFrame } from './pageCopyMerge';
import { selectGroup } from './sectionGroups';
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
export async function loadAccomplishments(group?: string): Promise<Accomplishment[]> {
  const entries = publishedEntries(await getCollection('accomplishments'), INCLUDE_DRAFTS).map(
    (entry) => entry.data,
  );

  return sortByOrder(selectGroup(entries, group)).map(
    ({ value, label, description, group: cardGroup }) => ({
      value,
      label,
      body: description,
      group: cardGroup,
    }),
  );
}

/**
 * The "What Your Gift Powers" cards in editor order.
 *
 * The cards carry no icon field. The campaign design numbers them `01` / `02` /
 * `03` from their position in the band instead, and that ordinal is derived by
 * `GiftPillars` at render time rather than stored — so there is nothing here to
 * resolve, and no editor control that silently draws nothing.
 */
export async function loadPillars(group?: string): Promise<Pillar[]> {
  const entries = publishedEntries(await getCollection('pillars'), INCLUDE_DRAFTS).map(
    (entry) => entry.data,
  );

  return sortByOrder(selectGroup(entries, group)).map(
    ({ title, description, linkLabel, linkUrl, amount, group: cardGroup }) => ({
      title,
      body: description,
      linkLabel,
      linkUrl,
      amount,
      group: cardGroup,
    }),
  );
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
  const entry = await donateEntry();
  return entry?.data.donateUrl?.trim() || fallback;
}

/** The `pageCopy` entry for /donate. One page, one entry. */
function donateEntry() {
  return getCollection('pageCopy').then((pages) => pages.find((page) => page.id === 'donate'));
}

/** The campaign page's FRAME — the hero above the reorderable sections and the
 *  closing ask below them — merged over `donatePage.json`. See
 *  `mergeDonateFrame` for why the frame is editable copy and still not a
 *  section, and why the fallback is field-by-field. */
export async function loadDonateFrame(
  fallback: DonatePageCopy,
): Promise<Partial<DonatePageCopy>> {
  const entry = await donateEntry();
  return mergeDonateFrame(fallback, entry?.data);
}
