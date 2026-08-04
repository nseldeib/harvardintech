// Loading /sponsor's editable copy and its partnership levels from content.
//
// The thin `astro:content` edge, matching `./volunteerPageContent.ts`: this file
// FETCHES, `./pageCopyMerge.ts` decides. Both of these used to live only in
// `sponsorPage.json` — a singleton the CMS models no editor for — so the whole
// sponsorship pitch, including every partnership level a prospective partner
// reads, was a developer-only edit.
//
// The ordering and the empty-means-`null` rule deliberately live in
// `sponsorLevelsFrom` rather than here, so they are exercised by unit tests
// rather than only by a rendered page.

import { getCollection } from 'astro:content';
import { publishedEntries } from './drafts';
import { INCLUDE_DRAFTS } from './draftVisibility';
import { mergeSponsorCopy, sponsorLevelsFrom } from './pageCopyMerge';
import type { SponsorPageCopy } from './site';

/** The collection entry's own id. One page, one entry. */
const ENTRY_ID = 'sponsor';

type SponsorLevel = NonNullable<SponsorPageCopy['levels']>[number];

/** The published partnership levels, ordered — or `null` when there are none.
 *  See `sponsorLevelsFrom` for why the empty case is `null` and not `[]`. */
export async function loadSponsorLevels(): Promise<SponsorLevel[] | null> {
  return sponsorLevelsFrom(publishedEntries(await getCollection('sponsorLevels'), INCLUDE_DRAFTS));
}

/** The /sponsor copy with its levels re-attached, merged over the committed JSON. */
export async function loadSponsorCopy(fallback: SponsorPageCopy): Promise<SponsorPageCopy> {
  const [entry, levels] = await Promise.all([
    getCollection('sponsorPage').then((pages) => pages.find((page) => page.id === ENTRY_ID)),
    loadSponsorLevels(),
  ]);

  return mergeSponsorCopy(fallback, entry?.data, levels);
}
