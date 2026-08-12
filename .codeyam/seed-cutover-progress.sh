#!/usr/bin/env bash
# Seed-adapter wrapper for the cutover runbook's progress SINGLETON.
#
# `register` validates every seed table as an array of row objects — the
# DB-backed shape — but the runbook's state is a single JSON object at
# `src/data/cutoverProgress.json` with two nested lists. Both facts are correct
# and they disagree, so this is the documented `seed.command` file-override that
# reconciles them: scenarios declare the state as two flat row arrays that pass
# validation, and this folds them into the singleton the adapter writes.
#
# The fold is here rather than in the adapter because the adapter is codeyam's
# and already handles object-valued keys correctly; what it cannot do is satisfy
# a validator that runs before it. Keeping the transform in one wrapper means the
# six scenarios stay readable as data rather than each carrying an escape hatch.
#
# Usage (as a scenario `seed.command`; the editor appends the seed file):
#   bash .codeyam/seed-cutover-progress.sh
set -euo pipefail

SEED_FILE="$1"
FOLDED="$(mktemp -t cutover-seed-XXXXXX.json)"
trap 'rm -f "$FOLDED"' EXIT

python3 - "$SEED_FILE" "$FOLDED" <<'PY'
import json, sys

src, dest = sys.argv[1], sys.argv[2]
payload = json.load(open(src))

# The editor may hand over either the canonical {"seed": {...}} wire shape or the
# legacy flat map; accept both rather than guessing which one this version emits.
tables = payload.get("seed", payload)

folded = {
    "cutoverProgress": {
        "steps": tables.get("cutoverSteps", []),
        "decisions": tables.get("cutoverDecisions", []),
    }
}

# Everything else passes through untouched, so a scenario can still seed real
# collections alongside the runbook's state.
for key, value in tables.items():
    if key not in ("cutoverSteps", "cutoverDecisions"):
        folded[key] = value

json.dump({"seed": folded}, open(dest, "w"))
PY

npx tsx .codeyam/seed-adapter.ts "$FOLDED"
