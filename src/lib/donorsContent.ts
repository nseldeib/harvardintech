// Loading the recognition wall's donors from the content collection.
//
// Split from `./donors.ts` on the same principle as
// `./momentumSectionsContent.ts`: that module is pure and framework-free so its
// grouping and anonymity rules unit-test without Astro. This one touches
// `astro:content`, so it is the thin, untestable edge — read, draft-filter,
// reshape — and it exists as a module rather than as frontmatter in `/donate`
// because the isolated-component harness needs exactly the same pipeline, and a
// second hand-rolled copy is a copy that drifts.

import { getCollection } from 'astro:content';
import { publishedEntries } from './drafts';
import { INCLUDE_DRAFTS } from './draftVisibility';
import type { DonorLike } from './donors';

/**
 * The published donors, each as `{ slug, ...frontmatter }` — the shape the wall
 * and every rule in `./donors.ts` take.
 *
 * Drafts follow the site-wide rule: visible while authoring and on the review
 * track, omitted from the public build, so an entry stays hidden until the gift
 * clears. Returns an empty array in production today, where the wall renders its
 * invitation state rather than nothing.
 */
export async function loadDonors(): Promise<DonorLike[]> {
  const entries = publishedEntries(await getCollection('donors'), INCLUDE_DRAFTS);
  return entries.map((entry) => ({ slug: entry.id, ...entry.data }));
}
