// Loading the Momentum Fund sections from the content collection.
//
// Split from `./momentumSections.ts` on purpose: that module is pure and
// framework-free so its ordering and validation rules unit-test without Astro.
// This one touches `astro:content`, so it is the thin, untestable edge — read,
// draft-filter, order, render the narrative bodies. It exists as a module rather
// than as frontmatter in `/donate` because the isolated-component harness needs
// exactly the same sections, and a second hand-rolled copy of this pipeline is a
// copy that drifts.

import { getCollection, render } from 'astro:content';
import { publishedEntries } from './drafts';
import { INCLUDE_DRAFTS } from './draftVisibility';
import { orderedSections, unknownSectionKinds, type SectionLike } from './momentumSections';

/** One section ready to render: its frontmatter plus, for a narrative, the
 *  component `render()` produced for its markdown body. */
export interface LoadedSection extends SectionLike {
  slug: string;
  Content?: unknown;
}

/**
 * The published sections in editor order, plus any `kind` values that matched no
 * renderer so the caller can warn about them. Drafts follow the site-wide rule:
 * visible while authoring and on the review track, omitted from the public build.
 */
export async function loadMomentumSections(): Promise<{
  sections: LoadedSection[];
  unknownKinds: string[];
}> {
  const entries = publishedEntries(await getCollection('momentumSections'), INCLUDE_DRAFTS);
  const unknownKinds = unknownSectionKinds(entries.map((entry) => entry.data));

  const ordered = orderedSections(
    entries.map((entry) => ({ slug: entry.id, entry, ...entry.data })),
  );

  const sections = await Promise.all(
    ordered.map(async ({ entry, ...section }) => ({
      ...section,
      // Only narrative sections have a body worth rendering; the slot bands draw
      // their content from `donatePage.json` and the testimonials collection.
      Content: section.kind === 'narrative' ? (await render(entry)).Content : undefined,
    })),
  );

  return { sections, unknownKinds };
}
