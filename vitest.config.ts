import { defineConfig } from 'vitest/config';

// Component unit tests run under jsdom so React islands can render into a DOM
// without a browser. Astro `.astro` files are not imported here — they are
// exercised through captured scenarios in the live preview, not vitest.
export default defineConfig({
  // Resolve @codeyam/cms to its SOURCE rather than its published `dist/` —
  // required from 0.13.0; see the long note in `tsconfig.json`.
  //
  // This matters most HERE: the guard suites (`cmsOrderControls.test.ts`,
  // `duplicateEntry.test.ts`, `mediaCommitGuard.test.ts`) exist to fail when an
  // upgrade drops what the patch adds. Pointed at `dist/` they would test stock
  // upstream and pass while the patched build was broken — a green canary for a
  // dead bird.
  resolve: {
    conditions: ['codeyam-source'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
