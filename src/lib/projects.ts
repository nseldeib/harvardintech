// Volunteer-project selection for /volunteer.
//
// The `projects` collection holds every project the org has ever posted; the
// page shows only the ones currently open, in the order an editor chose. Kept
// out of the `.astro` component so it is unit-testable without rendering.
import { sortByOrder, type Ordered } from './order';

export interface ProjectLike extends Ordered {
  title: string;
  /** Absent means OPEN. An editor who never touches the toggle should still
   *  see their project on the page — only an explicit `false` retires it. */
  active?: boolean;
}

/**
 * The projects to render: currently-open ones, ordered. Non-mutating.
 */
export function openProjects<T extends ProjectLike>(projects: readonly T[]): T[] {
  return sortByOrder(projects.filter((p) => p.active !== false));
}

/**
 * Where one project's detail page lives. The route and the card that links to it
 * both derive their URL from here, so the two cannot drift apart — the bug that
 * made a thumbnail look clickable while pointing nowhere.
 *
 * Site-root-relative on purpose: callers wrap it in `withBase` so it resolves
 * under both deploy bases, exactly as every other internal link does.
 */
export function projectPath(slug: string): string {
  return `/volunteer/projects/${slug}`;
}

/** The call-to-action a project detail page should render, or `null` for none. */
export interface ProjectCta {
  href: string;
  label: string;
}

/**
 * Which sign-up link a project's detail page offers.
 *
 * A project's own `applyUrl` wins. When it has none the page falls back to the
 * site-wide volunteer CTA, because a project posted before its sign-up form
 * exists still needs a way in — a page that just ends after the description
 * leaves a willing reader with nowhere to go. Only when neither exists does the
 * page render no ask at all, rather than a dead button.
 *
 * Pure so the fallback rule is testable without rendering; the caller wraps
 * `href` in `withBase` like every other internal link.
 */
export function projectCta(
  applyUrl?: string,
  ctaLabel?: string,
  ctaUrl?: string,
): ProjectCta | null {
  if (applyUrl) return { href: applyUrl, label: 'Get involved' };
  if (ctaUrl) return { href: ctaUrl, label: ctaLabel || 'Volunteer with us' };
  return null;
}
