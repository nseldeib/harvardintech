# Editing the site

Written for whoever is editing content, not for a developer. No repo knowledge
assumed. Everything below happens in the CMS at **/admin** — see
[nicole-review.md](./nicole-review.md) for the link and how to sign in.

Two questions come up constantly, so they are answered first.

## "How do I edit the Momentum Fund page?"

The Momentum Fund page (`/donate`) is made of **sections**. Open **Momentum Fund
sections** in the admin sidebar and you will see one entry per section of the
page, between the big photo header at the top and the "Help power what comes
next" band at the bottom.

There are two kinds of entry, and the difference matters:

**Sections you write here.** An entry whose *Section type* is `narrative` — "Why
Support Harvard in Tech?" and "And Every Number Represents a Story" — holds its
own heading, photo, layout, and text. Open it, edit it, save it. The words in the
big text box at the bottom are the words on the page.

**Sections that only get positioned here.** An entry whose type is
`accomplishments`, `pillars`, `testimonials`, or `stats` is a placeholder for a
band whose content is stored elsewhere. Editing its text box changes nothing on
the page — those entries exist so you can move the band up or down, or hide it.
Where their content actually lives:

| Band | Its content is edited in |
|---|---|
| "What we've accomplished so far" | the Momentum Fund page copy (ask the team — see *Still code-only* below) |
| "What Your Gift Powers" cards | the same |
| The numbers band (`stats`) | the same |
| The member quotes | the **Testimonials** collection in the sidebar |

## "Can I move sections up or down?"

Yes. Every section has an **Order** field. **Lower numbers appear higher on the
page.** To move a section up, give it a smaller number than the one above it.

Today the page is ordered:

| Order | Section |
|---|---|
| 1 | Why Support Harvard in Tech? |
| 2 | What we've accomplished so far |
| 3 | And Every Number Represents a Story |
| 4 | What Your Gift Powers |
| 5 | From our community (quotes) |

So to move the quotes above the gift cards, change the quotes entry from `5` to
`3` — or change the gift cards to `6`. Either works; only the relative order
matters. Leaving Order blank puts that section last.

**To hide a section without deleting it,** switch on the **Draft** toggle. The
section stays in the CMS with all its text intact and simply stops appearing on
the public site. This is the safe way to take something off the page — a deleted
entry is gone.

**To bring back the numbers band under the header** (100+ events, 8,000+ members,
and so on — it was removed from the page in the July review), add a new section,
set *Section type* to `stats`, and give it Order `1`. The band still exists in the
code; nothing needs to be rebuilt.

### The narrative fields

On a `narrative` section:

- **Heading** — the big title above the text.
- **Layout** — type one of `image-left`, `image-right`, or `text-only`.
  `image-left` puts the photo on the left and the words on the right;
  `image-right` is the mirror. `text-only` runs the words full width. Anything
  else you type, and a blank, both fall back to `text-only` — so a typo makes the
  section plain, never broken.
- **Image** — pick from the media library. On a phone the photo always sits above
  the text, whichever layout you chose. **If you leave the image blank, the
  section runs full width** regardless of the layout, so there is never an empty
  space where a photo would be.
- The text box at the bottom — the section's prose. A line starting with `###`
  becomes a bold sub-heading, and a line starting with `>` becomes a large pull
  quote with the crimson bar beside it.

## Still code-only

These are not in the CMS. Ask the team to change them:

- The **photo header** at the top of the Momentum Fund page and the **"Help power
  what comes next"** band at the bottom. These are deliberately fixed — they are
  the frame the reorderable sections sit inside.
- The **card content** for "What we've accomplished so far", "What Your Gift
  Powers", and the numbers band. You can move and hide those bands from the CMS,
  but their figures and card text are edited in the page's copy file.
- The **Google Analytics ID**.
- Anything about the site's colors, fonts, or layout.

## A note on timing

An edit is not instant. After you save, the site rebuilds and republishes — give
it a minute or two, then refresh. If you do not see your change after a few
minutes, check whether the entry's Draft toggle is switched on.
