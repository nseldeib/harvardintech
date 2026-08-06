// Formatting for the cutover runbook's attribution lines.
//
// Its own module rather than a corner of `cutoverProgress.ts` because both React
// islands import it and `cutoverProgress.ts` reads the filesystem at module
// scope — pulling `node:fs` into a client bundle to format a date is exactly the
// server-import leak the extraction step warns about.

/**
 * An ISO timestamp as a short "8 Aug", for the line that sits inline beside a
 * GitHub login.
 *
 * Day and month only. The year is deliberately absent: every tick on this page
 * happens inside one migration window, so a year adds width to a caption that
 * sits in a cramped row and tells the reader nothing they don't know.
 *
 * An unparseable value yields an empty string rather than "Invalid Date". The
 * timestamps come from a committed JSON file that a human can hand-edit, and a
 * mangled one should cost the reader a missing date, not a broken-looking page —
 * the name beside it still carries the useful half of the attribution.
 */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
