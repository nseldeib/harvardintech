# Hero videos

Video files served straight from the static build. A file dropped here at
`public/videos/momentum.mp4` is reachable at `/videos/momentum.mp4`, which is
what an editor pastes into the **Hero video** field on the `/donate` page-copy
entry in `/admin`.

Adding a video is a repo commit, not a CMS upload: the media library only
accepts images (`accept="image/*"`), so there is no upload path for one.

## What a hero video should be

- **H.264 MP4**, which is the format every browser plays.
- **Silent.** It renders muted with no controls — a soundtrack would never be
  heard, and would only add weight.
- **1080p at most**, and **a few megabytes at most**. Every visitor to `/donate`
  downloads the whole file, and the site is served from GitHub Pages.
- **Watchable as a backdrop.** The headline, subhead and Give button sit on top
  of it behind a scrim; slow, wide footage reads well, fast cuts do not.

The hero image stays the video's first frame and its fallback, so a visitor on
`prefers-reduced-motion`, a browser that blocks autoplay, and a path that 404s
all see the photo instead.

## sample-backdrop.mp4

A 10 KB placeholder, NOT campaign footage — a flat crimson gradient generated
with ffmpeg. It exists so the registered scenarios can demonstrate the hero with
a video set without committing a real video before one is shot.

Every frame is identical on purpose: a screenshot taken mid-playback is then the
same image on every run, so the scenario captures are stable rather than
depending on when the capture happened to fire.

Replace it — do not build on it — when real footage arrives.
