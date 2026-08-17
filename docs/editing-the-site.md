# Editing the site

Written for whoever is editing content, not for a developer. No repo knowledge
assumed. Everything below happens in the CMS at **/admin** — see
[nicole-review.md](./nicole-review.md) for the link and how to sign in.

Two questions come up constantly, so they are answered first.

## "How do I hide a section that isn't ready yet?"

Every band of the **homepage** is an entry in **Homepage sections**, and every
band in the middle of the **Momentum Fund page** is one in **Momentum Fund
sections**. Open the entry for the band you mean; it has two switches, and
between them they give three outcomes:

| Both switches off | The section shows normally. This is how every section ships. |
| --- | --- |
| **Show as coming soon** on | The section is replaced by a short "Coming soon" placeholder carrying its heading. The section stays in the menu, so a visitor who clicks the link lands on the placeholder rather than on nothing. |
| **Draft** on | The section goes away entirely — **and its menu link goes with it**, so nothing in the navigation points at a band that is not on the page. |

Use **coming soon** for something the site should admit is on the way (a photo
gallery with no photos yet, a section awaiting copy). Use **Draft** for something
that should not be alluded to at all yet. Neither deletes anything: the entry
keeps its settings and you switch it back whenever you like.

If both are on, Draft wins — a hidden section never advertises itself.

**One thing that surprises people:** on the preview and review sites, a Draft
section is still visible. That is deliberate and applies to everything on this
site, not just sections — the gated sites show drafts so you can look at
something before the world does. Draft means "not on the public site". To see
what the public will actually get, look at the live site after a promote.

## "Can I change the homepage headline, the numbers, or where Donate goes?"

Yes — all of these used to need a developer and no longer do:

| What | Where in /admin |
| --- | --- |
| The rotating headline, kicker, photo and buttons at the top | **Homepage hero slides** — one entry per slide, ordered by the **Order** field |
| The big figures under it (8,000+, 6, 100+, Est. 2013) | **Homepage stats** — one entry per figure |
| The "What we've accomplished so far" cards | **Momentum Fund accomplishments** |
| The "What Your Gift Powers" cards | **Momentum Fund gift pillars** |
| Where every **Give** / **Make a Gift** button points | **Page settings → Momentum Fund page → Donation platform URL** |

The donation URL is the one worth knowing about in advance: leave it blank and
every giving button opens a giving-inquiry email, which is what they do today.
Paste a real platform URL in that single box and **every** button on the site
switches over at once.

## "How do I edit the Momentum Fund page?"

The Momentum Fund page (`/donate`) is made of **sections**. Open **Momentum Fund
sections** in the admin sidebar and you will see one entry per section of the
page, between the big photo header at the top and the "Help power what comes
next" band at the bottom.

There are three kinds of entry, and the difference matters:

**Sections you write here.** An entry whose *Section type* is `narrative` — "Why
Support Harvard Alumni in Tech?" and "And Every Number Represents a Story" — holds its
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

**The fundraising meter.** An entry whose type is `goal-meter` is a third thing
again: you choose where it sits and what it is called, and Givebutter fills in
the progress. See the next question.

## "Can we show how much has been raised?"

Yes — a live progress meter from Givebutter, placed like any other section.

1. In **Momentum Fund sections**, add a section and set *Section type* to
   `goal-meter`.
2. Give it a **Heading** — this one is yours, e.g. "Our progress". `goal-meter`
   is the only non-narrative section that uses the Heading field.
3. Paste the **Goal meter widget ID** from Givebutter: in their dashboard open
   the campaign → **Share** → **Embed**, and copy the `id=` value out of the code
   they show you. Paste just that value, not the whole snippet.
4. Set **Order**. Just above the closing "Help power what comes next" band reads
   best — progress and the Give button land as one moment — but anywhere works.

**If the widget ID is blank the section shows nothing at all.** Not an empty box,
not a placeholder: the page reads as though the section were not there. That is
deliberate, so a half-finished edit never looks broken to a visitor — but it does
mean a meter you thought you added and cannot find is almost always a missing ID.

The meter itself is drawn by Givebutter, not by us, so the figure in it comes
from your campaign and updates on its own. If Givebutter is slow to load, or a
visitor has JavaScript switched off, the band quietly disappears rather than
leaving a heading stranded over an empty space.

One part only the team can do: the **Givebutter account ID** under **Settings →
Analytics & embeds** has to be filled in before any meter can appear. It already
is, so you should not need to touch it — but if every meter on the site vanishes
at once, that box is the first place to look.

## "Can the big photo at the top of the Momentum Fund page be a video?"

Yes. **Page settings → Momentum Fund page → Hero video.**

Leave it blank and the page looks exactly as it does today — the photo. Put a
path in it, like `/videos/momentum.mp4`, and that video plays behind the
headline instead.

**Getting the file there is the one part you cannot do yourself.** The media
library only accepts images, so a video has to be added to the site by the team.
Send it to them, they will add it, and they will tell you the path to paste into
the box. After that it is yours — you can swap it, or clear the box to go back to
the photo, without asking anyone.

What to expect once it is set:

- **It is a backdrop, not a video player.** No play button, no progress bar, and
  **no sound, ever** — it plays silently on a loop. The headline, the text under
  it, and the **Make a Gift** button stay exactly where they sit now.
- **The hero image is still doing work — do not clear it.** It is the first frame
  shown while the video loads, and it is what appears if the video cannot play.
  Clearing the photo would leave those moments blank.
- **Some visitors will see the photo instead, by design.** Anyone whose device is
  set to reduce motion — a common accessibility setting — gets the still photo.
  Nothing is broken and nothing needs fixing; they are simply not shown moving
  backgrounds. Expect the photo to carry the page for those readers.
- **If the path is wrong, the page still looks right.** A typo, or a file that was
  never added, shows the photo. There is no broken-video icon and no black gap.
  That is deliberate, but it means a mistake here is *quiet* — so check the video
  by looking at the page, not by trusting that the field saved.

**Keep it small.** Every visitor to the page downloads the whole file, so a heavy
video makes the page slow to appear for exactly the people you most want to
reach. A few megabytes is fine. Ask the team for something silent, no larger than
1080p, and a few megabytes at most.

## "Can I move sections up or down?"

Yes. Every section has an **Order** field. **Lower numbers appear higher on the
page.** To move a section up, give it a smaller number than the one above it.

Today the page is ordered:

| Order | Section |
|---|---|
| 1 | Why Support Harvard Alumni in Tech? |
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

- **Video files.** The media library only accepts images, so a hero video has to
  be added by the team before you can point the **Hero video** field at it. Once
  it is there, setting, swapping and clearing it are yours.
- The **sponsorship** and **volunteer** page copy.
- Anything about the site's colors, fonts, or layout.

**The photo header and the closing band are no longer on this list.** Their
*words and images* are yours, in **Page settings → Momentum Fund page**: the two
headlines, the text beneath them, the hero image, the hero video, and the
"Help power what comes next" heading, body and button label. What stays fixed is
their **position** — unlike the sections between them, they cannot be reordered
or hidden, because they are the frame those sections sit inside.

The accomplishment cards, the gift-pillar cards, the homepage hero and the
homepage figures used to be on this list. They are now collections in /admin —
see the table above.

**The analytics and embed settings are no longer on this list either.** The
Google Analytics ID, the Givebutter account ID, and the custom `<head>` /
`<body>` HTML boxes for verification tags and pixels all have their own screen at
**Settings → Analytics & embeds**. Treat the two HTML boxes with care: whatever
you paste runs on every page of the site, so only paste markup you trust and got
from a service you recognise. The two ID boxes are the safe ones — they take a
key, not code.

## A note on timing

An edit is not instant. After you save, the site rebuilds and republishes — give
it a minute or two, then refresh. If you do not see your change after a few
minutes, check whether the entry's Draft toggle is switched on.
