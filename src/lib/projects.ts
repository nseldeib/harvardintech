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
