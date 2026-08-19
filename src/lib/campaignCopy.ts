// Pure, framework-free rules for shaping the Momentum Fund campaign page's
// EDITOR-WRITTEN COPY into the pieces its components render. No `fs`, no Astro
// imports, so they unit-test directly — the same split `./momentumSections.ts`
// uses against `./momentumSectionsContent.ts`.
//
// Separate from `./momentumSections.ts` because that module is about SECTIONS —
// their kinds, order, layout, and per-band fields. These two are about strings
// an editor typed, and they apply to the page's fixed FRAME (the hero and the
// closing ask) as much as to the reorderable middle. `splitRole` in `./team.ts`
// is the closest existing precedent: a string-to-display-pieces rule living
// beside the surface that consumes it, rather than inline in the component.

/** A heading split around its emphasized clause. `accent` and `tail` are absent
 *  when the heading carries no emphasis. */
export interface EmphasizedHeading {
  head: string;
  accent?: string;
  tail?: string;
}

/**
 * Split a heading around a single `*emphasized*` clause.
 *
 * The campaign design accents the tail of the mission band's sentence —
 * "Helping exceptional people *go further together.*" — in crimson. Doing that
 * with markdown emphasis rather than a hardcoded `<span>` is what makes the
 * accent an AUTHORING choice: an editor moves it, shortens it, or drops it
 * without anyone touching the template.
 *
 * The title arrives as plain frontmatter text, not rendered markdown, so the
 * marker is parsed here rather than slotted through `render()`. Only the FIRST
 * `*…*` pair is honoured, and `*` is the only marker — this is one deliberate
 * affordance, not a second markdown implementation.
 *
 * Every degenerate input yields a plain heading rather than a visible asterisk:
 * no marker, an unclosed marker, and an empty `**` all return the whole string
 * as `head`. That floor matters more than the feature — a stray `*` on a
 * campaign page's largest sentence is worse than no accent at all.
 */
export function emphasizedHeading(title?: string): EmphasizedHeading | undefined {
  if (!title) return undefined;
  // `[^*]+` requires at least one character between the markers, so `**`
  // falls through to the plain-heading branch instead of emitting an empty
  // accent element.
  const match = title.match(/^(.*?)\*([^*]+)\*(.*)$/);
  if (!match) return { head: title };
  return { head: match[1], accent: match[2], tail: match[3] };
}

/**
 * Split a body of copy into paragraphs on blank lines.
 *
 * The closing ask carries two sentences the campaign design sets as separate
 * paragraphs. This is what lets that be ONE `ctaBody` field rather than
 * `ctaBody` and `ctaBody2`: an editor writing a third paragraph needs no schema
 * change, and there is no second box that can be left half-filled.
 *
 * Blank-line separated, then trimmed, then emptied entries dropped — so the
 * trailing newline a textarea leaves behind, or a double blank line between
 * paragraphs, cannot render an empty `<p>` that shows up as a mysterious gap.
 * A body with no blank line at all is a single paragraph, which is exactly what
 * this band rendered before the field could hold two.
 */
export function splitParagraphs(body?: string): string[] {
  return (
    body
      ?.split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean) ?? []
  );
}
