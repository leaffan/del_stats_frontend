# End-to-End Tests

This directory contains Playwright tests for critical user flows in the DEL Stats frontend.

## Quick Start

```bash
# Install Playwright browsers (one time)
npx playwright install

# Run all tests
pnpm test

# Run tests with UI inspector (interactive)
pnpm test:ui

# Run tests with verbose output
pnpm test:debug

# List all available tests
pnpm test -- --list
```

## Test Structure

- **core-flows.spec.js** — Tests for critical user flows:
    1. Home page loads without errors
    2. Career statistics loads with data
    3. Player career details navigation
    4. Player game stats (season view)
    5. Navigation hash updates
    6. Configuration files load correctly
    7. **Teams with valid_periods appear/disappear correctly** (KEV relegation/promotion)
    8. **Team profile navigation respects valid_periods** (navigation blocked during absent years)

## Test Results

After tests run, view the HTML report:

```bash
# Open the report in your browser
playwright-report/index.html
```

## Adding Tests

To add a new test flow:

1. Open `tests/core-flows.spec.js` or create a new `tests/*.spec.js` file
2. Use Playwright Test API (see `@playwright/test` documentation)
3. Follow existing test patterns for consistency
4. Run tests locally before committing

### Example

```javascript
test('My new flow', async ({ page }) => {
    await page.goto('http://localhost:8000/index.html#!/my_route');
    const element = page.locator('h1');
    await expect(element).toBeVisible();
});
```

## Test Data

Every data-dependent test first checks (via a HEAD request) that the one file
its view actually loads is present, using the probe helpers at the top of
`tests/core-flows.spec.js`.

- **Locally:** a missing file skips the test, so the suite stays usable
  without a populated `data/`.
- **In CI** (`REQUIRE_FIXTURE=1`): a missing file fails the test with
  `Fixture-Datei fehlt: <path>`. A run without fixture data must not go green
  just because every test skipped itself.

Locally, `data/` is populated by the `del_stats_backend` pipeline (see the
repo README), so tests exercise real rendering. In CI, `data/` is fetched
from a small fixture archive (see `docs/ROADMAP.md` for how that's wired up)
rather than left empty, so the suite exercises the same real assertions
there too.

### The fixture manifest

`fixture-manifest.json` (committed) lists every `data/` file the end-to-end
tests need, with its sha256, and names the archive that holds them:
`fixture-<hash>.tar.gz`. The name is derived from the file list, so a manifest
always points at exactly the data it was harvested with. CI downloads that
archive from `$FIXTURE_DATA_URL/<archive>` (the secret is the bucket base URL,
without a file name), extracts it and runs `node scripts/verify-fixture.js`,
which fails on any missing, changed or extra file.

Each branch has its own manifest, because the app code differs between them
and so does the set of files it loads.

### Regenerating the CI fixture

If the data shape changes (new fields, a renamed file, a new page that reads
a new `data/` file), the fixture goes stale. Regenerate it against your
local, real `data/`:

```bash
pnpm run harvest-fixture
```

This runs the active test suite once, records exactly which `data/` files it
requests, copies just those into `fixture-out/`, rewrites
`fixture-manifest.json` and packs `fixture-out/fixture-<hash>.tar.gz`. Then:

1. Upload that archive to the fixture S3 bucket, under exactly the name the
   script printed. Never overwrite an existing archive: older commits still
   point at theirs.
2. Commit the new `fixture-manifest.json`.

Archives that no manifest needs any more can be listed with
`node scripts/prune-fixtures.js s3://<bucket>`; it prints `aws s3 rm` commands
for archives no branch tip and no commit from the last 90 days refers to, and
deletes nothing itself.

`pnpm run verify:fixture` checks `data/` against the manifest. It is meant for
a clean extraction of the archive; against a real, locally populated `data/`
it reports the backend's newer files as changed or extra.
