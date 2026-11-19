# site-gates

[![gates](https://github.com/DavidFgamedev/site-gates/actions/workflows/ci.yml/badge.svg)](https://github.com/DavidFgamedev/site-gates/actions/workflows/ci.yml)

Three pre-commit gates for a static site build: **banned vocabulary**, **WCAG contrast**,
and **mirrored-list drift**. No dependencies, Node built-ins only, driven by one JSON file.

Each one exists because something shipped past the checks that were already in place. The
interesting part is not the checking, it is the failure mode each one closes.

```bash
npx site-gates vocabulary
npx site-gates contrast
npx site-gates mirror
```

Exit `0` clean, `1` a gate failed, `2` the gate could not run. The third code matters:
a missing config must not look like a clean pass.

## The gates

### `vocabulary`, banned terms across a build

Sweeps every file under the configured roots for terms that must never ship: internal
codenames, placeholder copy, profanity, an unreleased product name.

Two properties do the real work.

**It reads file NAMES as well as bodies.** A grep over contents passes a file merely
*called* `projectbluebird-notes.txt`. An asset is as public as the HTML referencing it,
and a name is addressable on its own.

**It sweeps every configured root, not just rendered pages.** Server routes, API handlers
and bundled assets ship too. A page-level sweep cannot see path-addressed content by
construction, so it reports clean about the half of the surface it never looked at.

Terms come in two kinds. `hard` fails on any occurrence. `soft` is a regex for ordinary
English that also appears innocently, and fails only outside `allow`. Allowlist entries
are specific strings, never bare terms: allowing `temp` wholesale would make the sweep
decorative.

Text that must name the banned words in order to forbid them, such as the rule itself,
goes between markers:

```js
/* sweep:allow-start -- a rule must name what it forbids. */
export const FORBIDDEN = ["projectbluebird"];
/* sweep:allow-end */
```

An unterminated `sweep:allow-start` is **reported as a failure and does not widen into an
exemption**: the remainder is swept anyway. A missing end marker costs coverage of
nothing. That behaviour has its own test, because the opposite, silently stopping, is the
failure nobody notices.

### `contrast`, WCAG 2.1 for every text role

Checks colour pairs against 4.5:1 for normal text and 3:1 for large text (24px and up, or
18.66px bold).

The design point: a role is declared against **every** ground it can land on, not just its
usual one, and each combination is measured separately.

```json
{ "role": "meta", "fg": "mid", "on": ["paper", "paperAlt"], "min": 4.5, "size": "14px" }
```

A role that passes on white and fails on a slightly darker panel is the realistic bug, and
checking pairs ad hoc misses it. `#767676` measures 4.54 on `#ffffff` and 4.06 on
`#f2f2f2`: passing, then failing, from nothing but a card moving surface. There is a test
for exactly that, using those measured values.

An unknown token name throws rather than skipping the row, because a typo that removes a
check should be louder than a check that fails.

### `mirror`, a hand-maintained list against the data it mirrors

Any time one file keeps a copy of names that live somewhere else, a guard list, a route
table, a filter, a set of translation keys, the copy goes stale the first time the source
is renamed. Every other check still passes. The rename is correct, the build is correct,
and a hole opens because nothing connects the two lists.

```json
{
  "name": "page titles known to the nav",
  "source": { "file": "src/pages.js", "pattern": "title: \"([^\"]+)\"" },
  "mirror": { "file": "src/nav.js", "pattern": "\"([^\"]+)\"",
              "between": ["const NAV_TITLES = [", "];"] }
}
```

Both files are read **as text**, never imported. The source usually cannot be imported by
a plain Node process because it pulls in assets, JSX or framework globals, and a gate that
cannot run is a gate that gets deleted.

Direction is asymmetric on purpose. A name in the source but missing from the mirror
**fails**: the thing exists and nothing guards it. A name in the mirror but not the source
is only a **note**, since a mirror legitimately covers more than the source lists.

## Pointing it at your own build

1. Copy the example config and edit it:

   ```bash
   cp examples/config.example.json site-gates.config.json
   ```

2. Set `vocabulary.roots` to your build output and anything else that ships, for example
   `["dist", "api"]`.
3. Put your real design tokens and text roles in `contrast`.
4. Add a `mirror.pairs` entry for each list in your project that mirrors data elsewhere.
5. Run them in CI. See `.github/workflows/ci.yml`.

The word lists in `examples/config.example.json` are illustrative. Your real list belongs
in your own repository.

## Tests

```bash
npm test     # node --test test/
```

37 tests. Every gate has a **passing fixture and a failing fixture**, so the suite proves
the gates actually catch what they claim rather than merely running.

Detection is separated from reporting for this reason: each gate is a pure function over a
config returning a result, and the CLI owns printing and exit codes. Tests assert on what
was found without capturing stdout or spawning a process. A separate
[`test/cli.test.mjs`](test/cli.test.mjs) then drives the real binary end to end, because
the exit code reaching the shell is the only thing CI reads.

CI runs three jobs: the suite on Node 18, 20 and 22; the gates against `examples/site`;
and a **self-check that every failing fixture still exits non-zero**. A guard that cannot
fail is not a guard, so a change that quietly defeats one breaks the build instead of
turning the suite green.

## Why these three

They are extracted from the pre-commit gates on a personal site, where each was written
after something got through. The vocabulary sweep replaced a hand-typed `grep` that was
correct against its own narrow question and blind beside it: it read bodies but not names,
and it looked at the built pages but not the server route that also ships. The mirror gate
exists because a list was renamed four separate times while a filter keyed to the old
names kept passing every other check.

The general lesson in all three is the same, and it is why the tests are the point of this
repository rather than the scripts. **Prefer the failure mode that is loud.** A guard
whose broken state looks identical to its clean state will stay broken, because nothing
about a green check invites you to look at it.

## Licence

MIT
