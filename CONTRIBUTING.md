# Contributing

## Goal

This repository is a public subset of `del_stats_frontend_ext`. Changes should therefore be made in a way that makes them easy to understand and, if needed, port to the private repository.

## Ground rules

1. Keep changes small and limited to a single topic.
2. Preserve existing paths, file names, and template structures whenever possible.
3. Avoid unnecessary renames or large-scale moves.
4. Document which files are affected and why the change is needed.

## Practical guidance

- Prefer targeted changes over broad restructurings.
- Only change existing AngularJS patterns when there is a clear benefit.
- For public changes, always consider whether the same adjustment is needed in the private superset.
- If a change would be difficult to port, simplify the approach first.

## Validation

This repository has a small standardized tooling baseline with `pnpm install --frozen-lockfile` and `pnpm check`.

### Local checks

A pre-commit hook automatically formats staged files with Prettier before each commit (via `husky` and `lint-staged`). This ensures consistent formatting without manual steps.

Run validation locally:

```bash
pnpm check
```

This runs:

- `format:check` — Prettier formatting validation
- `validate:routes` — Verifies that all defined routes have corresponding template files
- `verify:vendor` — Verifies that `vendor/` matches the installed runtime libraries (see below)

### Third-party runtime libraries

The libraries the browser loads (AngularJS, Bootstrap, Font Awesome, moment, d3, ...) are not loaded from CDNs. They are served from `vendor/`, which is committed because the site is deployed with a plain `git pull` and has no build step.

- Each library is an exactly pinned entry (no `^` or `~`) under `dependencies` in `package.json`.
- `scripts/vendor.js` lists which files of each package are copied, and to which path below `vendor/<package>/`. Each folder also gets the package's licence file.
- Paths under `vendor/` contain no version numbers, so an update does not touch `index.html`.
- Never edit files under `vendor/` by hand. Prettier, ESLint, and git line-ending conversion are disabled for that folder (`.prettierignore`, `eslint.config.js`, `.gitattributes`) so the files stay byte-identical to their npm package.

To update or add a library:

```bash
# 1. change the version in package.json (or add the package and its files to scripts/vendor.js)
pnpm install
pnpm run vendor
pnpm check
# 2. commit package.json, pnpm-lock.yaml, and vendor/ together
```

Dependabot proposes runtime updates as a separate `runtime` group. Its pull requests only change `package.json` and `pnpm-lock.yaml`, so `verify:vendor` fails on them until `pnpm run vendor` has been run and committed on the branch.

### End-to-End Tests

Critical user flows can be tested with Playwright. Tests verify that pages load correctly, navigation works, and configuration files are accessible.

**Run tests locally:**

```bash
pnpm test
```

This starts a local HTTP server (requires `data/` directory populated) and runs all tests in `tests/`.

**Interactive test development:**

```bash
pnpm test:ui      # Opens Playwright Inspector for debugging
pnpm test:debug   # Run with verbose output
```

**Test results:**

- HTML report: `playwright-report/index.html` (open in browser after test run)
- Test files located in `tests/` directory
- Add new flows to `tests/core-flows.spec.js` or create new test files

### CI workflow

The CI workflow in `.github/workflows/ci.yml` uses Node.js 22 with pnpm and runs `pnpm check` on every push and pull request. The end-to-end tests run against a test fixture that CI downloads using the `FIXTURE_DATA_URL` repository secret, and a missing fixture file fails the run instead of skipping the test. GitHub does not expose repository secrets to pull requests from forks, so the end-to-end job is expected to fail there; maintainers re-run those changes from a branch in this repository.
