import { describe, it, expect } from 'vitest';
import { PILLAR_ICONS, resolvePillarIcon } from './pillars';

describe('resolvePillarIcon', () => {
  // The three supported icons round-trip unchanged — the whole point of the field.
  it('keeps every glyph the component draws', () => {
    for (const icon of PILLAR_ICONS) {
      expect(resolvePillarIcon(icon)).toBe(icon);
    }
  });

  // A free-text field collects human typing; trailing spaces and capitals are
  // normal input, not mistakes worth punishing.
  it('accepts a value an editor typed with stray case or spacing', () => {
    expect(resolvePillarIcon('  Globe ')).toBe('globe');
  });

  // The reason this is free text at all: the CMS has no select control, so a
  // typo is a normal editing mistake. It costs the icon, never the build.
  it('falls back to people for a mistyped icon', () => {
    expect(resolvePillarIcon('gobe')).toBe('people');
  });

  // A card with no icon chosen still gets a badge rather than an empty circle.
  it('falls back to people for a blank or absent icon', () => {
    expect(resolvePillarIcon('')).toBe('people');
    expect(resolvePillarIcon(undefined)).toBe('people');
  });
});
