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

The CI workflow in `.github/workflows/ci.yml` uses Node.js 22 with pnpm and runs `pnpm check` on every push and pull request. End-to-end tests are run separately to avoid blocking CI if test data is unavailable.
