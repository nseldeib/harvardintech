#!/usr/bin/env python3
"""
PreToolUse hook for editor mode — blocks tool execution outside allowed slugs.

Reads `.codeyam/editor-step.json` for the active slug and
`.codeyam/cache/step-metadata.json` for the per-slug capability
allowlists, then blocks:
- Write/Edit to non-`.codeyam/`, non-`.claude/` files at slugs that
  don't carry the code-change capability.
- Bash `git commit` / `git add` outside slugs in `commitSlugs`.
- Bash `git push` outside slugs in `pushSlugs`.
- Bash test runs (`refresh-tests` / raw runners) at slugs NOT in
  `testRunSlugs` — every phase whose `test_scope` is `none`. Pre-Demo
  slugs are blocked to hold the prototype-speed "no tests before Demo"
  boundary; post-hardening slugs (presentation, journal, sync, commit,
  push) are blocked because a test run is out of scope at a gate. The
  `noTestSlugs` projection says which kind a slug is, so the refusal
  names a recovery that actually exists at that position.
- AskUserQuestion at slugs in `previewRequiredSlugs` unless
  `.codeyam/preview-shown.json` matches the current step.

One rule is deliberately NOT step-scoped: the scripted-source-rewrite
guard. CLAUDE.md's ban on machine-rewriting tracked source holds in
every session, editor mode or not, so that guard runs before the
`CODEYAM_EDITOR_ACTIVE` short-circuit in `main`.

The slug allowlists are projected into the cache by
`crates/codeyam-editor/src/commands/editor/slug_capabilities.rs` (the
single source of truth for per-slug capabilities), so a future
workflow renumbering never silently breaks a gate.

The Plan-tab PTY does not set `CODEYAM_EDITOR_ACTIVE`, so this hook is
silent there by design — Plan-tab commits are always allowed.

Returns exit code 2 to block, 0 to allow. Stderr is fed back to
Claude as feedback.
"""

import json
import os
import re
import subprocess
import sys

# `_step_metadata` lives next to this file; add the hook directory to
# `sys.path` so the import works regardless of the cwd the hook runner
# launches from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _step_metadata import cli_command, load_step_metadata, resolve_mode_table  # noqa: E402

# Plan files live here and are always commitable regardless of current step.
PLAN_PATH_PREFIX = ".codeyam/plans/"


def staged_paths_are_plans_only(project_dir):
    """True iff `git diff --cached --name-only` is non-empty and every path
    starts with `.codeyam/plans/`. An empty staged set returns False — the
    commit would be a no-op and the existing error path is more useful."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except Exception:
        return False
    if result.returncode != 0:
        return False
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    if not lines:
        return False
    return all(l.startswith(PLAN_PATH_PREFIX) for l in lines)


def git_add_paths_are_plans_only(command):
    """True iff a `git add` command targets only paths under .codeyam/plans/.

    Conservatively rejects any flag-like arg (-A/--all, -p/--patch,
    -i/--interactive, etc.) and a bare "." pathspec, since we cannot infer
    the eventual staged set in those cases."""
    tokens = command.split()
    try:
        add_idx = tokens.index("add")
    except ValueError:
        return False
    args = tokens[add_idx + 1:]
    if not args:
        return False
    for tok in args:
        if tok.startswith("-") or tok == ".":
            return False
    return all(p.startswith(PLAN_PATH_PREFIX) for p in args)


def merge_in_progress(project_dir):
    """True while a rebase, merge, or cherry-pick is paused mid-operation.

    Staging a conflict resolution is not the same act as creating a commit, but
    both spell `git add`. `pre-commit-sync` starts a rebase and, on a
    modify/delete conflict in the regenerated test-cache blobs, prints a
    recovery that ends in `git add -- <path>` — which the commit-slug gate then
    refused, wedging the very step that printed it. The gate was always this
    broad; it only became reachable once the hook's exit code stopped being
    swallowed. `git commit` stays gated regardless, so this cannot land a commit
    outside the commit slug — it only lets an in-flight rebase be finished."""
    git_dir = os.path.join(project_dir, ".git")
    return any(
        os.path.exists(os.path.join(git_dir, marker))
        for marker in ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD")
    )


def _slug_label(state, slug):
    """Human-readable identifier for BLOCKED messages. Slug is the
    primary handle; label is shown alongside when state carries it."""
    label = state.get("label", "") or ""
    if label:
        return f"{label} (slug={slug})"
    return f"slug={slug}"


def _test_run_block_message(state, slug, info):
    """Word the test-run block for `slug` from its phase kind.

    `info` is the slug's `noTestSlugs` entry, or None when the cache
    predates that projection (or dropped the entry as malformed).

    Sixteen phases declare `test_scope: none`, but only five of them —
    plan / confirm / prepare / prototype / demo — are actually pre-Demo. The
    rest (final-presentation, journal, pre-commit-sync, commit, push,
    feature-complete) sit AFTER every test-running phase, so telling an
    agent there that hardening "starts at Deconstruct" and to run tests at
    `*-extract-tdd` names a step it has already passed and cannot reach
    without `editor change`. The block is right at both; only the
    explanation and the named recovery differ."""
    where = _slug_label(state, slug)
    if not info or info.get("kind") != "post-hardening":
        # Pre-Demo, or no projection to judge by. This wording is accurate
        # where it applies, and it is the status-quo degrade where the cache
        # cannot say.
        return (
            f"BLOCKED: test runs are not allowed at {where} "
            f"(pre-Demo, test_scope: none). The Plan→Demo stretch is for building "
            f"fast and getting working functionality in front of the user — "
            f"hardening (tests, extraction, glossary) starts at Deconstruct.\n"
            f"Next valid action: keep building — run tests at "
            f"`ui-extract-tdd` / `backend-extract-tdd`."
        )
    next_slug = info.get("nextTestRunSlug")
    if next_slug:
        recovery = (
            f"advance to `{next_slug}` — the next step in this mode where "
            f"test runs are in scope."
        )
    else:
        recovery = (
            "advance — no test-running step remains in this mode, so there is "
            "nowhere left to re-run this."
        )
    return (
        f"BLOCKED: test runs are not allowed at {where} "
        f"(test_scope: none). The hardening phases already ran the tests; this "
        f"step is a presentation / commit gate, where a test run is out of "
        f"scope.\n"
        f"Next valid action: {recovery}"
    )


def _preview_hint(mode, project_dir):
    """Hint shown when AskUserQuestion is blocked for missing preview.

    Backend mode never has a live preview — point at the results
    panel instead. UI mode points at `editor preview` with the
    user-configured default screen size."""
    cli = cli_command()
    if mode == "backend":
        return f"{cli} editor show-results"
    default_dim = "Desktop"
    editor_config_path = os.path.join(project_dir, ".codeyam", "editor.json")
    try:
        with open(editor_config_path, "r") as f:
            cfg = json.load(f)
        default_dim = cfg.get("defaultScreenSize", "Desktop")
    except Exception:
        pass
    return f'{cli} editor preview \'{{"dimension":"{default_dim}"}}\''


# Stack-agnostic raw test runners, matched as word-boundary regexes so a
# command that merely CONTAINS "test" (`cargo build`, `ls tests/`,
# `git commit -m "add test"`) does NOT trip the gate. `refresh-tests` is
# codeyam's own test command — the one the workflow actually uses — and is
# always a test run.
_TEST_RUN_PATTERNS = [
    r"\brefresh-tests\b",
    r"\bcargo\s+(?:test|nextest)\b",
    r"\bnpx\s+vitest\b",
    r"\bvitest\s+run\b",
    r"\bjest\b",
    r"\bpytest\b",
    r"\bgo\s+test\b",
]


def _configured_test_scripts(project_dir):
    """Project-specific test-runner SCRIPT invocations derived from
    `testRunners[].command` in editor.json — e.g. `bash scripts/run-shell-tests.sh`.

    Lets the gate catch a raw run of the project's OWN test script, not just
    the stack-agnostic runners above, so the gate is config-aware rather than a
    fixed hardcoded list. Only tokens that look like a script path (`scripts/…`
    or ending in `.sh`) are lifted — that deliberately skips a bare interpreter
    like `python3` in `python3 -m pytest`, which the `pytest` regex already
    covers and which would over-block if treated as a runner."""
    cfg_path = os.path.join(project_dir, ".codeyam", "editor.json")
    scripts = []
    try:
        with open(cfg_path) as f:
            cfg = json.load(f)
    except Exception:
        return scripts
    for runner in cfg.get("testRunners", []) or []:
        cmd = runner.get("command", "") if isinstance(runner, dict) else ""
        for tok in cmd.split():
            if tok.startswith("scripts/") or tok.endswith(".sh"):
                scripts.append(tok)
    return scripts


def is_test_run_command(command, project_dir):
    """True iff `command` invokes a test run — `refresh-tests`, a common raw
    runner, or the project's configured test script."""
    for pat in _TEST_RUN_PATTERNS:
        if re.search(pat, command):
            return True
    for script in _configured_test_scripts(project_dir):
        if script in command:
            return True
    return False


# --- Scripted source-rewrite guard -----------------------------------------
#
# CLAUDE.md bans machine-rewriting tracked source ("never a `python`/regex/
# brace-matching find-and-replace … such scripts parse the language with the
# wrong grammar and self-match the code they just generated"). Documentation
# alone did not hold, so this guard turns the guideline into a refusal that
# names the sanctioned alternatives.
#
# The signature is the SHAPE, not the interpreter: a shell command that both
# computes a text transform in-process AND lands it on a git-tracked source
# file. Inspecting JSON state, running a committed script, and writing to a
# temp/untracked path all stay allowed.

# Suffixes whose files a reviewer reads as a diff, and which must therefore be
# edited with the Edit tool rather than machine-rewritten. Deliberately broad
# and additive across stacks: a language absent from this list is simply not
# guarded, so an unlisted extension degrades to "allow", never to a spurious
# block. `.json` is omitted on purpose — rewriting JSON through a parser is
# structurally sound and is how config edits are legitimately scripted.
SOURCE_SUFFIXES = (
    ".rs", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go",
    ".java", ".kt", ".swift", ".m", ".mm", ".c", ".h", ".cc", ".cpp", ".hpp",
    ".cs", ".php", ".ex", ".exs", ".sh", ".bash", ".zsh", ".ps1", ".sql",
    ".svelte", ".vue", ".astro", ".css", ".scss", ".html", ".md", ".toml",
    ".yaml", ".yml",
)

# Bound the git query so a pathological command cannot spawn a huge argv.
_MAX_PATH_CANDIDATES = 40

# A pathspec we are willing to hand to `git ls-files`. Excludes whitespace and
# `:` (git's pathspec-magic prefix) so an odd token cannot change git's parse.
_PATHSPEC_SAFE = re.compile(r"^[A-Za-z0-9_./*+-]+$")

_OPEN_CALL = re.compile(r"\bopen\s*\(")
# `Path("x").write_text(` yields its literal; a bare `p.write_text(` does not.
_WRITE_TEXT = re.compile(
    r"""(?:Path\s*\(\s*(?P<q>['"])(?P<path>[^'"]+)(?P=q)\s*\)\s*)?\.write_(?:text|bytes)\s*\("""
)
_NODE_WRITE = re.compile(
    r"""writeFile(?:Sync)?\s*\(\s*(?:(?P<q>['"`])(?P<path>[^'"`]+)(?P=q))?"""
)
# `> path` / `>> path`, but not the fd forms (`2>&1`, `>&2`).
_SHELL_REDIRECT = re.compile(r"""(?<![0-9&])>>?\s*(?P<path>[^\s;|&<>()'"]+)""")
# Anything shaped like a path with an extension, wherever it appears. Matching
# the shape directly rather than tokenizing by quotes or whitespace is what
# makes the fallback survive nested quoting — a one-liner like
# `python3 -c "p = 'src/lib.rs'; …"` yields no clean quoted or whitespace token,
# because the inner quotes interleave with the outer ones.
_PATHLIKE = re.compile(r"/?[A-Za-z0-9_][A-Za-z0-9_./*+-]*\.[A-Za-z0-9]+")
# An in-place flag for sed/perl: `-i`, `-i.bak`, `-pi`, `--in-place`. The
# pre-`i` letter class excludes `e`/`E`/`I` so perl's `-Ilib` (a library path,
# not an in-place edit) does not false-match.
_INPLACE_FLAG = re.compile(r"^(?:--in-place(?:=.*)?|-[a-df-hj-zA-DF-HJ-Z0-9]*i.*)$")


def _string_literal(expr):
    """The inner text of `expr` when it is a single quoted string literal."""
    expr = expr.strip()
    if len(expr) >= 2 and expr[0] == expr[-1] and expr[0] in "'\"`":
        inner = expr[1:-1]
        if expr[0] not in inner:
            return inner
    return None


def _call_args(text, paren_index):
    """Top-level, comma-separated argument expressions of the call whose `(`
    sits at `paren_index`. Quote-aware so a comma or paren inside a string
    literal does not split an argument. Returns [] if the parens never close."""
    depth = 0
    quote = ""
    args = []
    current = []
    for i in range(paren_index, len(text)):
        ch = text[i]
        if quote:
            if ch == quote:
                quote = ""
            current.append(ch)
            continue
        if ch in "'\"`":
            quote = ch
            current.append(ch)
            continue
        if ch in "([{":
            depth += 1
            if depth == 1:
                continue
        elif ch in ")]}":
            depth -= 1
            if depth == 0:
                args.append("".join(current))
                return args
        if depth == 1 and ch == ",":
            args.append("".join(current))
            current = []
        else:
            current.append(ch)
    return []


def _has_inplace_editor(command):
    """True iff the command invokes `sed`/`perl` with an in-place flag."""
    seen_editor = False
    for tok in command.split():
        base = tok.rsplit("/", 1)[-1]
        if base in ("sed", "perl"):
            seen_editor = True
        elif seen_editor and _INPLACE_FLAG.match(tok):
            return True
    return False


def write_targets(command):
    """Parse `command` for in-process file-write constructs.

    Returns `(explicit, opaque)`: `explicit` lists the literal paths the
    command writes to; `opaque` is True when at least one write construct
    targets a path that cannot be resolved statically — a variable
    (`open(p, "w")`), or an in-place `sed`/`perl` whose file argument is
    positional."""
    explicit = []
    opaque = False

    for match in _OPEN_CALL.finditer(command):
        args = _call_args(command, match.end() - 1)
        if len(args) < 2:
            continue
        mode = _string_literal(args[1])
        if mode is None or not set(mode) & set("wax+"):
            continue
        literal = _string_literal(args[0])
        if literal:
            explicit.append(literal)
        else:
            opaque = True

    for pattern in (_WRITE_TEXT, _NODE_WRITE):
        for match in pattern.finditer(command):
            if match.group("path"):
                explicit.append(match.group("path"))
            else:
                opaque = True

    for match in _SHELL_REDIRECT.finditer(command):
        explicit.append(match.group("path"))

    if _has_inplace_editor(command):
        opaque = True

    return explicit, opaque


def _repo_relative(path, project_dir):
    """`path` expressed relative to `project_dir`, or None when it escapes the
    repo (an absolute path elsewhere, `~`, or a `../` climb)."""
    if not path or path.startswith("~"):
        return None
    if os.path.isabs(path):
        try:
            rel = os.path.relpath(path, project_dir)
        except ValueError:
            return None
    else:
        rel = path
    while rel.startswith("./"):
        rel = rel[2:]
    if not rel or rel.startswith(".."):
        return None
    return rel


def eligible_pathspecs(paths, project_dir):
    """The repo-relative, source-suffixed, pathspec-safe subset of `paths`,
    de-duplicated and capped at `_MAX_PATH_CANDIDATES`.

    Pure — no git, no filesystem. Split from `tracked_source_paths` so the
    normalize-and-filter half is testable without a git repository."""
    candidates = []
    for path in paths:
        rel = _repo_relative(path, project_dir)
        if not rel or not rel.lower().endswith(SOURCE_SUFFIXES):
            continue
        if not _PATHSPEC_SAFE.match(rel) or rel in candidates:
            continue
        candidates.append(rel)
        if len(candidates) >= _MAX_PATH_CANDIDATES:
            break
    return candidates


def tracked_source_paths(paths, project_dir):
    """The subset of `paths` that git tracks and that carries a source suffix.

    Untracked files, temp/scratchpad paths, and generated artifacts all fall
    out here — they are not tracked, so they are never blocked."""
    candidates = eligible_pathspecs(paths, project_dir)
    if not candidates:
        return []
    try:
        result = subprocess.run(
            ["git", "ls-files", "-z", "--"] + candidates,
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return []
    if result.returncode != 0:
        return []
    return sorted(p for p in result.stdout.split("\0") if p)


def _path_tokens(command):
    """Every path-shaped substring in `command` that could name a file.
    Suffix and tracked-ness filtering happen in `tracked_source_paths`."""
    return [m.group(0) for m in _PATHLIKE.finditer(command)]


def scripted_source_rewrite_target(command, project_dir):
    """The git-tracked source file a scripted in-process rewrite would clobber,
    or None when `command` is not one.

    A command qualifies only when it BOTH carries a write construct AND that
    write lands on tracked source. When every write target is a literal path,
    only those paths are judged. When a target is opaque, it falls back to
    every tracked source path the command mentions — which is the shape the
    real incidents took (`p = "…/opencode.rs"` … `open(p, "w")`)."""
    explicit, opaque = write_targets(command)
    if not explicit and not opaque:
        return None
    candidates = _path_tokens(command) if opaque else explicit
    tracked = tracked_source_paths(candidates, project_dir)
    return tracked[0] if tracked else None


def scripted_rewrite_refusal(path):
    """The BLOCKED message for a refused scripted rewrite. Names the path that
    matched and the three sanctioned alternatives — batching is the reason
    agents reach for a script, so the refusal has to answer it."""
    return (
        f"BLOCKED: this command machine-rewrites the tracked source file `{path}`. "
        f"A scripted in-process rewrite (`open(p, 'w')`, `.write_text(`, `sed -i`, "
        f"`perl -pi`) computes its diff at runtime, so the change never appears in "
        f"the transcript a reviewer reads; it parses the language with the wrong "
        f"grammar and self-matches the code it just generated; and it bypasses the "
        f"file-state tracking that lets Edit refuse a file that changed underneath "
        f"it.\n"
        f"Next valid action: use the Edit tool. Batching is not a reason to script — "
        f"several Edit calls in ONE message run in parallel. For a genuine "
        f"replace-every-occurrence pass use Edit with `replace_all: true`; to rename "
        f"an identifier across source + glossary + registry run "
        f"`{cli_command()} editor rename-symbol`. Writing to an untracked file, to "
        f"/tmp, or to the scratchpad is unaffected."
    )


def read_event():
    """The PreToolUse event from stdin, or None when it is absent or
    unparseable — in which case the hook allows rather than blocks."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return None
        return json.loads(raw)
    except Exception:
        return None


# Internal `.codeyam/` state stores that have a purpose-built inspector,
# mapped to the command that answers questions about them. Ordered
# most-specific-path first so `.codeyam/test-cache/blobs/…` matches the
# cache inspector rather than a broader prefix.
#
# These are stores whose on-disk shape is INTERNAL and undocumented at the
# read site: a hand-rolled walk has to guess whether a field is a string
# or a list, and the observed failures were exactly that guess going wrong
# (`'list' object has no attribute 'split'`, `JSONDecodeError` on a
# blob file that had been externalized). The inspectors interpret the
# store instead, so the question is answerable without knowing the schema.
_INSPECTOR_BY_STORE = [
    (".codeyam/logs/audit-history.jsonl", "audit-history"),
    (".codeyam/state/finalize-debt.json", "finalize-debt"),
    (".codeyam/dependency-graph.json", "deps-imports / deps-imported-by"),
    (".codeyam/test-registry.json", "registry-query"),
    (".codeyam/editor.local.json", "config-show --source"),
    (".codeyam/scenarios/_shared", "shared-data"),
    (".codeyam/editor-step.json", "step"),
    (".codeyam/glossary.json", "glossary-find / glossary-list"),
    (".codeyam/editor.json", "config-show"),
    (".codeyam/scenarios", "scenarios / scenario-explain"),
    (".codeyam/test-cache", "test-cache-query"),
    (".codeyam/journal", "journal-find"),
    (".codeyam/plans", "plans / plan-show"),
]

# A path under `.codeyam/` naming something more specific than the
# directory itself. Used only for the no-inspector case, so `ls .codeyam/`
# — an ordinary first look around — stays quiet while a probe of a
# particular state file is answered.
_CODEYAM_STATE_PATH = re.compile(r"\.codeyam/[A-Za-z0-9_.][A-Za-z0-9_./+-]*")

# Read-shaped commands, matched in COMMAND POSITION — at the start of the
# string or just after a shell separator, allowing leading `VAR=value`
# assignments and transparent prefixes. Position is what distinguishes a
# probe from an incidental mention: `git ls-files .codeyam/glossary.json`
# and `git add .codeyam/test-registry.json` both name a store without
# reading it the way this nudge is about, and neither matches here.
#
# The verb set is the python forms the nudge has always covered plus the
# shell reads agents actually reach for. The rationale in
# `inspector_nudge`'s docstring was never python-specific: `ls` on a
# guessed path re-derives a store's layout exactly the way a python walk
# re-derives its schema, and fails the same way.
_READ_VERB = re.compile(
    r"""(?:\A|[\n;|&`(]|\$\()\s*
        (?:[A-Za-z_][A-Za-z_0-9]*=\S*\s+)*
        (?:(?:sudo|command|time|xargs)\s+)*
        (?:python3?|ls|cat|head|tail|wc|jq|grep|find)\b
    """,
    re.VERBOSE,
)

# A `codeyam-editor editor …` invocation, under either the canonical name
# or the local-dev branding.
_INSPECTOR_INVOCATION = re.compile(r"\bcodeyam-editor(?:-dev)?\s+editor\b")


def is_read_shaped_command(command):
    """True when `command` READS something in command position — a python
    invocation or a shell read verb.

    Pure and side-effect free so the predicate can be tested directly,
    separately from the store mapping it gates."""
    return bool(_READ_VERB.search(command))


def is_inspector_invocation(command):
    """True when `command` runs a `codeyam-editor editor …` subcommand.

    An inspector necessarily names the store it inspects, so nudging one
    would point the agent at the command it is already running."""
    if _INSPECTOR_INVOCATION.search(command):
        return True
    return f"{cli_command()} editor " in command


def matching_inspector(command):
    """The `(store, inspector)` pair `command` touches, or None.

    Separated from the message that reports it so the
    longest-path-first ordering of `_INSPECTOR_BY_STORE` — which is what
    keeps `.codeyam/scenarios/_shared/…` from resolving to the broader
    scenarios entry — is assertable without going through message text."""
    for store, inspector in _INSPECTOR_BY_STORE:
        if store in command:
            return (store, inspector)
    return None


def probed_state_path(command):
    """The `.codeyam/` state path `command` names, or None.

    A bare `.codeyam/` is deliberately not a match: listing the
    directory is an ordinary first look around, not a probe of a
    particular store, and nudging it would be noise."""
    match = _CODEYAM_STATE_PATH.search(command)
    return match.group(0) if match else None


def inspector_nudge(command):
    """Return a pointer to the matching inspector when `command` reads a
    `.codeyam/` state store, else None. When the probed store has no
    inspector, say so rather than staying silent — the absence is a fact
    worth reporting, since silence reads as "no such command found".

    Pure and side-effect free so the mapping can be tested directly.

    This is a NUDGE, never a block. Reading internal state by hand is
    wasteful, not incorrect — the reader re-derives a shape that a
    command already knows, and gets it wrong often enough to cost a turn
    plus a re-read. That asymmetry is what makes a pointer the right
    instrument and a refusal the wrong one: a block would strand an agent
    whose question genuinely has no inspector. It matters more under the
    wider trigger, not less — a broader net means more false positives,
    which is an argument for keeping the instrument soft."""
    if is_inspector_invocation(command):
        return None
    if not is_read_shaped_command(command):
        return None
    matched = matching_inspector(command)
    if matched:
        store, inspector = matched
        return (
            f"NOTE: this reads {store} — an internal codeyam state store. "
            f"`{cli_command()} editor {inspector}` answers questions about it directly, "
            f"and interprets the store rather than dumping it, so the field shapes are "
            f"named instead of guessed. Not blocking; your command still runs."
        )
    probed = probed_state_path(command)
    if probed:
        return (
            f"NOTE: this reads {probed} — internal codeyam state with no "
            f"read-only inspector. No `{cli_command()} editor` verb interprets it, so "
            f"reading the file is the only option here; the absence is real, not "
            f"something you missed. Not blocking; your command still runs."
        )
    return None


def main():
    """Claude Code PreToolUse hook entry point: read the current
    editor step from `.codeyam/editor-step.json` and either allow or
    block the in-flight tool call based on the active step's rules."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

    # Read the tool use event from stdin
    event = read_event()
    if event is None:
        sys.exit(0)

    tool_name = event.get("tool_name", "")
    tool_input = event.get("tool_input", {})

    # Scripted-source-rewrite guard. Unlike every other rule here this one is
    # neither step-scoped nor editor-mode-scoped — the ban on machine-rewriting
    # tracked source holds in every session — so it fires before the
    # `CODEYAM_EDITOR_ACTIVE` short-circuit below.
    if tool_name == "Bash":
        rewrite_target = scripted_source_rewrite_target(
            tool_input.get("command", ""), project_dir
        )
        if rewrite_target:
            print(scripted_rewrite_refusal(rewrite_target), file=sys.stderr)
            sys.exit(2)

    # Every remaining rule is a workflow-step gate — only enforce in editor mode
    if not os.environ.get("CODEYAM_EDITOR_ACTIVE"):
        sys.exit(0)

    state_path = os.path.join(project_dir, ".codeyam", "editor-step.json")

    # No state file = not in editor mode, allow everything
    if not os.path.exists(state_path):
        sys.exit(0)

    try:
        with open(state_path, "r") as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError):
        sys.exit(0)  # Can't read state, don't block

    step = state.get("step", 0)
    slug = state.get("slug") or ""

    if not step:
        sys.exit(0)

    metadata = load_step_metadata(project_dir)
    mode, mode_table = resolve_mode_table(state, metadata)

    code_change_slugs = set(mode_table.get("codeChangeSlugs", []))
    commit_slugs = set(mode_table.get("commitSlugs", []))
    push_slugs = set(mode_table.get("pushSlugs", []))
    preview_required_slugs = set(mode_table.get("previewRequiredSlugs", []))
    test_run_slugs = set(mode_table.get("testRunSlugs", []))
    no_test_slugs = mode_table.get("noTestSlugs", {}) or {}

    # Always allow codeyam-editor commands. Match both the canonical
    # name and the local-dev wrapper so saved sessions emitted under
    # either spelling keep working after the canonical-name rollout.
    if tool_name == "Bash":
        command = tool_input.get("command", "")

        # Test-run gate. `testRunSlugs` is the per-mode set of slugs whose
        # phase declares a non-None test_scope — a slug NOT in it may not run
        # tests. This must fire BEFORE the "always allow codeyam-editor editor"
        # short-circuit below, because `codeyam-editor editor refresh-tests` is
        # itself a test run. Empty `testRunSlugs` (a stale v1/v2 cache) => no
        # gating, mirroring the `and commit_slugs` / `and push_slugs`
        # short-circuits below — a cache skew degrades to "allow", never "block
        # every test run".
        #
        # The MEMBERSHIP test is one line; wording the refusal is not, because
        # a blocked slug can be pre-Demo or post-hardening and the two need
        # opposite advice. `_test_run_block_message` reads that from the
        # `noTestSlugs` projection.
        if (
            slug
            and test_run_slugs
            and slug not in test_run_slugs
            and is_test_run_command(command, project_dir)
        ):
            print(
                _test_run_block_message(state, slug, no_test_slugs.get(slug)),
                file=sys.stderr,
            )
            sys.exit(2)

        # Inspector nudge. Emitted on stderr and then FALLEN THROUGH from
        # — never `sys.exit`ed on — so the command still runs and every
        # gate below still applies. stderr is the channel every other
        # message in this hook uses; pairing it with a 0 exit is what
        # makes this a pointer rather than a refusal.
        nudge = inspector_nudge(command)
        if nudge:
            print(nudge, file=sys.stderr)

        if (
            "codeyam-editor editor" in command
            or "codeyam-editor:editor" in command
            or "codeyam-editor-dev editor" in command
            or "codeyam-editor-dev:editor" in command
        ):
            sys.exit(0)

    # Always allow reading
    if tool_name in ("Read", "Glob", "Grep", "WebFetch", "WebSearch", "Agent"):
        sys.exit(0)

    # Always allow task management
    if tool_name in ("TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "Skill", "ToolSearch"):
        sys.exit(0)

    # Gate AskUserQuestion at preview-required slugs — require preview marker first
    if tool_name == "AskUserQuestion":
        if slug and slug in preview_required_slugs:
            marker_path = os.path.join(project_dir, ".codeyam", "preview-shown.json")
            preview_ok = False
            if os.path.exists(marker_path):
                try:
                    with open(marker_path, "r") as f:
                        marker = json.load(f)
                    if marker.get("step") == step:
                        preview_ok = True
                except Exception:
                    pass

            if not preview_ok:
                hint = _preview_hint(mode, project_dir)
                print(
                    f"BLOCKED: This step ({_slug_label(state, slug)}) requires showing "
                    f"the live preview before asking the user for confirmation.\n"
                    f"Run `{hint}` first, then call AskUserQuestion.",
                    file=sys.stderr,
                )
                sys.exit(2)

        sys.exit(0)

    # Check Write/Edit to non-.codeyam files
    if tool_name in ("Write", "Edit"):
        file_path = tool_input.get("file_path", "")

        # `@import url(...)` in CSS is render-blocking and bypasses Next.js's
        # font pipeline. Webfonts belong in layout.tsx via next/font or a
        # <link rel="preconnect"> + <link href> — check BEFORE the .codeyam/
        # short-circuit so authored CSS is gated regardless of step.
        if file_path.endswith(".css"):
            content_str = tool_input.get("content", "") or tool_input.get("new_string", "")
            if "@import url" in content_str:
                print(
                    "BLOCKED: `@import url(...)` in CSS is render-blocking and "
                    "hurts LCP. Load webfonts via next/font in layout.tsx (or "
                    "a <link rel=\"preconnect\"> + <link href> pair) rather than "
                    "from the stylesheet.",
                    file=sys.stderr,
                )
                sys.exit(2)

        # Always allow .codeyam/ and .claude/ files (editor state)
        if "/.codeyam/" in file_path or "/.claude/" in file_path:
            sys.exit(0)
        # Empty allowlist means the cache is missing/stale (e.g. a v1
        # cache after a binary downgrade) — degrade to "allow" rather
        # than brick the session. An empty `slug` means the state file
        # predates the slug field; the next `editor step` invocation
        # will migrate it, so degrade to "allow" rather than block on
        # an unmatchable allowlist.
        if slug and code_change_slugs and slug not in code_change_slugs:
            allowed = ", ".join(sorted(code_change_slugs))
            print(
                f"BLOCKED: This step ({_slug_label(state, slug)}) does not allow code changes. "
                f"Code changes are only allowed at slugs: {allowed}. "
                f"If you need to make changes after a final-presentation gate, run "
                f"`{cli_command()} editor change` first.",
                file=sys.stderr,
            )
            sys.exit(2)

    # Check Bash commands for git commit/push
    if tool_name == "Bash":
        command = tool_input.get("command", "")

        # BSD grep on macOS lacks -P (PCRE). Fail loud so Claude switches to
        # the Grep tool (ripgrep-backed, PCRE-compatible) instead of seeing
        # a cryptic "grep: invalid option" at runtime.
        if re.search(r"\bgrep\s+-[A-Za-z]*P\b", command):
            print(
                "BLOCKED: `grep -P` is unsupported on macOS (BSD grep). "
                "Use the Grep tool instead — it wraps ripgrep and honors "
                "PCRE syntax portably.",
                file=sys.stderr,
            )
            sys.exit(2)

        if "git commit" in command:
            if slug and commit_slugs and slug not in commit_slugs and not staged_paths_are_plans_only(project_dir):
                allowed = ", ".join(sorted(commit_slugs))
                print(
                    f"BLOCKED: git commit/add is only allowed at slug(s): {allowed}. "
                    f"You are at {_slug_label(state, slug)}. "
                    f"Plan-file commits (.codeyam/plans/*.md) are allowed at any step. "
                    f"Follow the workflow — commits happen at the `commit` slug.",
                    file=sys.stderr,
                )
                sys.exit(2)
        elif "git add" in command:
            if (
                slug
                and commit_slugs
                and slug not in commit_slugs
                and not git_add_paths_are_plans_only(command)
                and not merge_in_progress(project_dir)
            ):
                allowed = ", ".join(sorted(commit_slugs))
                print(
                    f"BLOCKED: git commit/add is only allowed at slug(s): {allowed}. "
                    f"You are at {_slug_label(state, slug)}. "
                    f"Plan-file commits (.codeyam/plans/*.md) are allowed at any step. "
                    f"Follow the workflow — commits happen at the `commit` slug.",
                    file=sys.stderr,
                )
                sys.exit(2)

        if "git push" in command:
            if slug and push_slugs and slug not in push_slugs:
                allowed = ", ".join(sorted(push_slugs))
                print(
                    f"BLOCKED: git push is only allowed at slug(s): {allowed}. "
                    f"You are at {_slug_label(state, slug)}.",
                    file=sys.stderr,
                )
                sys.exit(2)

    # Allow everything else
    sys.exit(0)


if __name__ == "__main__":
    main()
