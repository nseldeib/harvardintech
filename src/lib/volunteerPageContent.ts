// Loading /volunteer's editable copy from the `volunteerPage` collection.
//
// The thin `astro:content` edge, the same split `./momentumSectionsContent.ts`
// and `./donatePageContent.ts` already use: this file fetches, and
// `./pageCopyMerge.ts` decides. It exists because this copy used to live only in
// `volunteerPage.json` — a singleton the CMS models no editor for — so rewriting
// the volunteer pitch was a developer's job.
//
// The shape returned is exactly what `VolunteerPage` and its children always
// took, so the migration is invisible to every component below the route.

import { getCollection } from 'astro:content';
import { mergeVolunteerCopy } from './pageCopyMerge';
import type { VolunteerPageCopy } from './site';

/** The collection entry's own id. One page, one entry. */
const ENTRY_ID = 'volunteer';

/** The /volunteer copy, merged over the committed JSON. See `mergeVolunteerCopy`
 *  for why the fallback is field-by-field rather than whole-object. */
export async function loadVolunteerCopy(fallback: VolunteerPageCopy): Promise<VolunteerPageCopy> {
  const entry = (await getCollection('volunteerPage')).find((page) => page.id === ENTRY_ID);
  return mergeVolunteerCopy(fallback, entry?.data);
}
