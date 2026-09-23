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

### Regenerating the CI fixture

If the data shape changes (new fields, a renamed file, a new page that reads
a new `data/` file), the fixture can go stale. Regenerate it against your
local, real `data/`:

```bash
pnpm run harvest-fixture
```

This runs the active test suite once, records exactly which `data/` files it
requests, and copies just those into `fixture-out/`. Pack and upload the
result:

```bash
tar -C fixture-out -czf fixture-data.tar.gz data
```

Upload `fixture-data.tar.gz` to the fixture S3 bucket, overwriting the
previous version at the same key the `FIXTURE_DATA_URL` repo secret points
to.
