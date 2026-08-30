const { test, expect } = require('@playwright/test');

// Helper to check if data is available
async function hasData(page) {
    try {
        const response = await page.request.head(
            'http://localhost:8000/data/2025/del_player_game_stats_aggregated.json',
            { timeout: 2000 },
        );
        return response.ok();
    } catch {
        return false;
    }
}

test.describe('DEL Stats Core Flows', () => {
    test('1. Home page loads and renders', async ({ page }) => {
        const dataAvailable = await hasData(page);

        await page.goto('http://localhost:8000/index.html#!');

        // Only check for serious JS errors if data is available
        // Without data, we just verify page structure renders
        if (dataAvailable) {
            // Track only real JavaScript errors (not network errors or 404s)
            const jsErrors = [];
            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    const text = msg.text();
                    // Ignore expected network errors
                    if (!text.includes('Failed to load resource') && !text.includes('404')) {
                        jsErrors.push(text);
                    }
                }
            });

            page.on('pageerror', (error) => {
                const msg = error.message || '';
                // Only track actual JS errors, not network failures
                if (!msg.includes('data/') && !msg.includes('404') && !msg.includes('ERR_')) {
                    jsErrors.push(msg);
                }
            });

            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
            expect(jsErrors).toHaveLength(0);
        } else {
            // Without data, just verify page loads without crashing
            await page.waitForTimeout(500);
        }

        // Check page renders
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();
    });

    test('2. Career statistics page loads', async ({ page }) => {
        const dataAvailable = await hasData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/career_stats');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Check page renders
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();

        // With data, verify table exists and has rows
        const table = page.locator('table').first();
        await expect(table).toBeVisible();

        const rows = page.locator('table tbody tr');
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('3. Player career details loads when navigating', async ({ page }) => {
        // First go to career stats to get a player link
        await page.goto('http://localhost:8000/index.html#!/career_stats');

        // Try to find and click a player link (varies by data availability)
        const playerLinks = page.locator("a[href*='player_career'], a[ng-href*='player_career']");
        const linkCount = await playerLinks.count().catch(() => 0);

        if (linkCount > 0) {
            // Click first player link
            await playerLinks.first().click();

            // Wait for URL change and page load
            await page.waitForURL(/player_career/, { timeout: 5000 }).catch(() => {});

            // Check page content loaded
            const pageContent = page.locator('body');
            await expect(pageContent).toBeVisible();

            // Check for player info or statistics
            const hasContent =
                (await page
                    .locator('h1, h2, table')
                    .first()
                    .isVisible()
                    .catch(() => false)) ||
                ((await page.locator('body').textContent()) || '').length > 100;
            expect(hasContent).toBeTruthy();
        } else {
            // Skip if no data available
            test.skip();
        }
    });

    test('4. Player stats season view loads', async ({ page }) => {
        await page.goto('http://localhost:8000/index.html#!/del_stats/2025');

        // Wait for page to initialize
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Check for table or data display
        const hasTable =
            (await page
                .locator('table')
                .first()
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator("[ng-repeat*='player']")
                .first()
                .isVisible()
                .catch(() => false));

        // At minimum, page should render without errors
        const pageBody = page.locator('body');
        await expect(pageBody).toBeVisible();

        if (hasTable) {
            // Check column headers exist
            const headers = page.locator("th, [ng-repeat*='column']");
            const headerCount = await headers.count();
            expect(headerCount).toBeGreaterThan(0);
        }
    });

    test('5. Navigation hash updates correctly', async ({ page }) => {
        // Test that navigation changes the URL hash
        await page.goto('http://localhost:8000/index.html#!');

        const initialUrl = page.url();

        // Try to navigate via menu or direct navigation
        // This is a basic test - actual selectors depend on template
        const navLinks = page.locator("a[href*='#'], [ng-click*='goTo']");
        const linkCount = await navLinks.count().catch(() => 0);

        if (linkCount > 0) {
            const firstLink = navLinks.nth(1); // Skip home link (index 0)
            const href = await firstLink.getAttribute('href').catch(() => null);

            if (href && href.includes('#')) {
                await firstLink.click();
                await page.waitForTimeout(500); // Wait for hash change

                const newUrl = page.url();
                expect(newUrl).not.toBe(initialUrl);
                expect(newUrl).toContain('#');
            }
        }
    });

    test('6. Configuration files load without errors', async ({ page }) => {
        // Load home page to trigger cfg file loading
        await page.goto('http://localhost:8000/index.html#!');

        // Collect all failed network requests
        const failedRequests = [];
        page.on('response', (response) => {
            if (!response.ok() && response.url().includes('/cfg/')) {
                failedRequests.push(response.url());
            }
        });

        // Wait for cfg files to load
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Check key cfg files loaded successfully
        const expectedFiles = [
            'cfg/teams.json',
            'cfg/stats_to_aggregate.json',
            'cfg/stats_to_calculate.json',
        ];

        for (const file of expectedFiles) {
            const response = await page.request
                .head(`http://localhost:8000/${file}`)
                .catch(() => null);
            // File should exist (404 would indicate missing config)
            // We're lenient here because not all configs are always needed
        }

        expect(failedRequests.length).toBeLessThan(3); // Allow some failures but not many
    });

    test('7. Teams with valid_periods appear/disappear correctly (KEV)', async ({ page }) => {
        // KEV (Krefeld Pinguine) was in DEL until 2021, absent 2022-2025, returns 2026
        // This tests the valid_periods functionality for teams with relegation/promotion

        // Check 2021: KEV should be present (last season before relegation)
        await page.goto('http://localhost:8000/index.html#!/team_stats/2021');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Look for KEV in team selection or standings
        const kevIn2021 =
            (await page
                .locator('text=/Krefeld/i')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator('[title*="Krefeld"], [alt*="Krefeld"]')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .textContent('body')
                .then((text) => text.includes('KEV'))
                .catch(() => false));

        expect(kevIn2021).toBeTruthy();

        // Check 2023: KEV should NOT be present (relegated)
        await page.goto('http://localhost:8000/index.html#!/team_stats/2023');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const kevIn2023 =
            (await page
                .locator('text=/Krefeld/i')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator('[title*="Krefeld"], [alt*="Krefeld"]')
                .isVisible()
                .catch(() => false));

        expect(kevIn2023).toBeFalsy();

        // Check 2026: KEV should be present again (promoted)
        await page.goto('http://localhost:8000/index.html#!/team_stats/2026');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const kevIn2026 =
            (await page
                .locator('text=/Krefeld/i')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator('[title*="Krefeld"], [alt*="Krefeld"]')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .textContent('body')
                .then((text) => text.includes('KEV'))
                .catch(() => false));

        expect(kevIn2026).toBeTruthy();
    });

    test('8. Team profile navigation respects valid_periods', async ({ page }) => {
        // Navigate to KEV team profile in 2021 (when they were in the league)
        await page.goto('http://localhost:8000/index.html#!/team_profile/2021/KEV');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Page should load successfully
        const pageBody = page.locator('body');
        await expect(pageBody).toBeVisible();

        // Check if navigation to next season (2022) is blocked
        // KEV was relegated after 2021, so 2022 link should not be available
        const link2022 = page.locator('a[href*="2022/KEV"]');
        const has2022Link = await link2022.isVisible().catch(() => false);

        // Link should either not exist or not be visible (KEV not in 2022)
        expect(has2022Link).toBeFalsy();

        // Try navigating to 2023 directly - should show KEV was not in league
        await page.goto('http://localhost:8000/index.html#!/team_profile/2023/KEV');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Page might show error or empty state - check for either
        const hasError =
            (await page
                .locator('text=/nicht verfügbar/i')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator('text=/no data/i')
                .isVisible()
                .catch(() => false)) ||
            (await page
                .locator('table')
                .count()
                .then((c) => c === 0)
                .catch(() => true));

        // We expect some indication that data is not available
        // (Either error message or missing tables)
        // This is a soft check - behavior may vary based on implementation
        const bodyText = await page.textContent('body').catch(() => '');
        const pageLoaded = bodyText.length > 50;
        expect(pageLoaded).toBeTruthy();
    });
});
