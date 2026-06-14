#!/usr/bin/env bash
#
# Manually enable GitHub Pages (build type "workflow") for this repo.
#
# You normally do NOT need this: .github/workflows/deploy.yml enables Pages
# automatically on the first push via actions/configure-pages (enablement:
# true). Run this only if that auto-enable is blocked by org/permission policy
# and the first deploy 404s with "Ensure GitHub Pages has been enabled".
#
# Requires the GitHub CLI (`gh`), authenticated: https://cli.github.com/
# Infers owner/repo from the `origin` remote. After it succeeds, re-run the
# deploy workflow:  gh workflow run "Deploy to GitHub Pages" --ref <branch>

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

remote_url="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$remote_url" ]; then
  echo "error: no 'origin' remote found. Add one with: git remote add origin <url>" >&2
  exit 1
fi

# Normalize both SSH (git@github.com:owner/repo.git) and HTTPS
# (https://github.com/owner/repo(.git)) forms to "owner/repo".
slug="$remote_url"
slug="${slug#git@github.com:}"
slug="${slug#https://github.com/}"
slug="${slug#http://github.com/}"
slug="${slug%.git}"

if [ -z "$slug" ] || [ "$slug" = "$remote_url" ]; then
  echo "error: could not parse owner/repo from origin remote: $remote_url" >&2
  exit 1
fi

echo "Enabling GitHub Pages (build type: workflow) for $slug ..."

# Capture both stdout and the exit status so we can treat an
# "already enabled" 4xx as success rather than a hard failure.
if out="$(gh api -X POST "repos/$slug/pages" -f build_type=workflow 2>&1)"; then
  echo "✓ GitHub Pages enabled for $slug."
else
  if echo "$out" | grep -qiE 'already|exists'; then
    echo "✓ GitHub Pages was already enabled for $slug — nothing to do."
  else
    echo "error: failed to enable Pages for $slug:" >&2
    echo "$out" >&2
    exit 1
  fi
fi

echo
echo "Next: re-run the deploy workflow, e.g."
echo "  gh workflow run \"Deploy to GitHub Pages\" --ref \$(git rev-parse --abbrev-ref HEAD)"
