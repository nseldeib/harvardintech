// Pure, framework-free validation for the "What Your Gift Powers" cards. No
// `fs`, no Astro imports, so it unit-tests directly.
//
// The `icon` field is free text for the same reason `kind` and `layout` are: the
// CMS has no select control, so an editor types the value. This module is the
// boundary that turns whatever they typed into one of the three glyphs
// `PillarIcon.astro` actually draws — mirroring `resolveLayout` in
// `./momentumSections.ts`.

import type { PillarIcon } from './site';

/** The glyphs `PillarIcon.astro` implements. */
export const PILLAR_ICONS = ['people', 'book', 'globe'] as const;

/**
 * Normalize an `icon` value to one of the drawn glyphs.
 *
 * Anything unrecognized — a typo, a blank field, an absent key — becomes
 * `people`, matching the fallback the component has always applied to an unset
 * prop. So a mistyped icon costs an editor the icon they wanted and never leaves
 * an empty circle or fails the build.
 */
export function resolvePillarIcon(value?: string): PillarIcon {
  const icons = PILLAR_ICONS as readonly string[];
  const normalized = value?.trim().toLowerCase() ?? '';
  return icons.includes(normalized) ? (normalized as PillarIcon) : 'people';
}
