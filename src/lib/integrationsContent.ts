// Loading the site-wide integration keys from the `siteIntegrations` collection.
//
// The thin `astro:content` edge, matching the other `*Content.ts` loaders. These
// three keys have always been real editable data on `settings.json`, but the CMS
// settings screen renders inputs for five scalar keys plus the socials list and
// round-trips everything else untouched — so they were data with nowhere to edit
// them, and adding a verification tag meant asking a developer.
//
// Read from components rather than routes (`Analytics.astro`, `HeadExtras.astro`,
// and the two shells that inject body HTML), because these belong to every page
// and threading them through every route's props would be the one arrangement
// where a new shell could silently ship without analytics.

import { getCollection } from 'astro:content';
import { mergeIntegrations, type SiteIntegrations } from './pageCopyMerge';
import type { SiteSettings } from './site';

export type { SiteIntegrations };

/** The collection entry's own id. One site, one entry. */
const ENTRY_ID = 'site';

/** The integration keys, merged over `settings.json`. See `mergeIntegrations`
 *  for why a blank field falls back rather than turning analytics off. */
export async function loadIntegrations(fallback: SiteSettings): Promise<SiteIntegrations> {
  const entry = (await getCollection('siteIntegrations')).find((s) => s.id === ENTRY_ID);
  return mergeIntegrations(fallback, entry?.data);
}
