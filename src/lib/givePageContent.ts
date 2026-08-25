// The /give page's copy.
//
// A JSON singleton read through `readSingleton`, the same seam `settings.json`
// and `donatePage.json` use — so a codeyam scenario can seed this page's copy by
// pointing `CODEYAM_DATA_ROOT` at its sandbox, exactly like every other
// singleton. Reading it with a bare `readFileSync` would work in production and
// silently ignore the sandbox, which is the bug `contentRoot.ts` exists to
// prevent.
//
// NOT a content collection, and not in the CMS yet. `donatePage.json` sat in the
// same position until the `pageCopy` collection was added to reach it, and this
// page's copy deserves the same treatment before an editor is expected to own
// it — see the note in `src/data/givePage.json`'s section of README/CMS_SETUP if
// that migration happens. Until then every string here is a developer edit,
// which is worth knowing before promising an editor they can reword the FAQ.
import { readSingleton } from './contentRoot';

export interface GiveFaqItem {
  question: string;
  answer: string;
}

export interface GivePageCopy {
  metaTitle: string;
  metaDescription: string;

  heroKicker?: string;
  heroTitle: string;
  heroSubhead?: string;
  /** Blank renders no photo band at all rather than an empty strip. */
  heroImage?: string;

  /** The campaign target, free text — see `GoalMeter`'s note on why not a number. */
  goal?: string;
  /** How full the card's bar is drawn, 0–100. */
  goalPercent?: number;
  processor?: string;
  selectedAmount?: string;
  ctaLabel?: string;
  /** The line under the giving button. It is what tells a visitor the amount
   *  controls above it are illustrative, so it is not optional in practice. */
  cardNote?: string;

  ecosystemKicker?: string;
  ecosystemTitle?: string;
  ecosystemBody?: string;

  prioritiesKicker?: string;
  prioritiesTitle?: string;

  momentumKicker?: string;
  momentumTitle?: string;

  recognitionKicker?: string;
  recognitionTitle?: string;
  recognitionBody?: string;

  monthlyKicker?: string;
  monthlyTitle?: string;
  monthlyBody?: string;

  faqKicker?: string;
  faqTitle?: string;
  faq: GiveFaqItem[];

  /** Photos for the collage above the closing band. Empty renders nothing. */
  collage: string[];

  closeKicker?: string;
  closeTitle?: string;
}

const raw = readSingleton<Partial<GivePageCopy>>('givePage.json');

/**
 * The page's copy, with the two LIST fields defaulted.
 *
 * Only those two are defaulted, and only because the page maps over them: a
 * missing `faq` or `collage` would throw on `.map`, where a missing string just
 * renders nothing. Defaulting every field would hide a missing file behind a
 * page that looks half-written rather than one that fails visibly.
 */
export const givePage: GivePageCopy = {
  ...(raw as GivePageCopy),
  faq: raw.faq ?? [],
  collage: raw.collage ?? [],
};
