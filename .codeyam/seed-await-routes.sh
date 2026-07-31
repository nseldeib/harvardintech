#!/usr/bin/env bash
# Seed-adapter wrapper for scenarios on a DYNAMIC route whose paths come from
# seeded content (e.g. /volunteer/projects/<slug>).
#
# The adapter clears and rewrites the collection directory, and Astro's content
# watcher regenerates the route table asynchronously. Between the clear and the
# rewrite there is a window where a seeded project's route does not exist yet, so
# a capture firing in that window gets a 404 for a page that is about to be
# perfectly valid. This waits for the route to actually answer before returning,
# so the capture races nothing.
#
# A readiness poll, not a fixed sleep: it returns the moment the route is up, and
# gives up after a bounded number of attempts rather than hanging a capture.
#
# Usage (as a scenario `seed.command`; the editor appends the seed file):
#   bash .codeyam/seed-await-routes.sh <url-to-await>
set -euo pipefail

AWAIT_URL="$1"
SEED_FILE="$2"

npx tsx .codeyam/seed-adapter.ts "$SEED_FILE"

code=""
for _ in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$AWAIT_URL" || true)"
  [ "$code" = "200" ] && exit 0
  sleep 0.25
done

echo "seed-await-routes: $AWAIT_URL never became ready (last status ${code:-none})" >&2
exit 1
