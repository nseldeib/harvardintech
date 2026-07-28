import { describe, it, expect } from 'vitest';
import { openProjects } from './projects';

describe('openProjects', () => {
  // Absent `active` means open (see filterActiveBoardMembers) — a project whose
  // editor never touched the toggle must stay visible, not silently vanish.
  it('keeps a project whose active flag is absent', () => {
    expect(openProjects([{ title: 'Newsletter editor' }]).map((p) => p.title)).toEqual([
      'Newsletter editor',
    ]);
  });

  // An explicit active: true is kept, same as the absent case.
  it('keeps a project explicitly marked active', () => {
    expect(openProjects([{ title: 'Speaker outreach', active: true }])).toHaveLength(1);
  });

  // active: false is the one value that retires a project from the page.
  it('removes a project explicitly marked inactive', () => {
    expect(openProjects([{ title: 'Retired project', active: false }])).toEqual([]);
  });

  // Open projects come back in the editor-chosen order.
  it('orders open projects by their order field', () => {
    const result = openProjects([
      { title: 'third', order: 3 },
      { title: 'first', order: 1 },
      { title: 'second', order: 2 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['first', 'second', 'third']);
  });

  // An un-numbered project sorts after the numbered ones, never ahead of #1.
  it('places unordered projects after ordered ones', () => {
    const result = openProjects([
      { title: 'unordered' },
      { title: 'ordered', order: 1 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['ordered', 'unordered']);
  });

  // The closed-filter and the ordering compose in one pass.
  it('filters and orders together', () => {
    const result = openProjects([
      { title: 'closed', order: 1, active: false },
      { title: 'open-b', order: 3 },
      { title: 'open-a', order: 2 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['open-a', 'open-b']);
  });

  // All-closed yields [] — the production default that drives /volunteer's
  // empty state, which must be an empty array rather than a crash.
  it('returns an empty array when every project is closed', () => {
    expect(
      openProjects([
        { title: 'a', active: false },
        { title: 'b', active: false },
      ]),
    ).toEqual([]);
  });

  // No projects at all also yields [], the day-one production state.
  it('returns an empty array for no projects', () => {
    expect(openProjects([])).toEqual([]);
  });

  // Selection is non-mutating, so the caller's collection is untouched.
  it('does not mutate the input array', () => {
    const source = [
      { title: 'b', order: 2 },
      { title: 'a', order: 1 },
    ];
    openProjects(source);
    expect(source.map((p) => p.title)).toEqual(['b', 'a']);
  });
});
