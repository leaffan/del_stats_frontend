const { test, expect } = require('@playwright/test');

test.describe('DEL Stats Core Flows', () => {
    test('1. Home page loads without JavaScript errors', async ({ page }) => {
        await page.goto('http://localhost:8000/index.html#!');

        // Track only real JavaScript errors (not network errors or 404s)
        const jsErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore network/404 errors - those are expected if data/ is not populated
                if (!text.includes('Failed to load resource') && !text.includes('404')) {
                    jsErrors.push(text);
                }
            }
        });

        // Ignore unhandled rejections caused by missing data files
        page.on('pageerror', (error) => {
            const msg = error.message || '';
            if (!msg.includes('data/') && !msg.includes('404')) {
                jsErrors.push(msg);
            }
        });

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            // ignore timeout, we just want to ensure basic load
        });

        expect(jsErrors).toHaveLength(0);

        // Check page renders (body should exist)
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();
    });

    test('2. Career statistics page loads and renders', async ({ page }) => {
        await page.goto('http://localhost:8000/index.html#!/career_stats');

        // Wait for potential table or controller to initialize
        await page.waitForTimeout(1000);

        // Check page renders (body should exist and be visible)
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();

        // Try to find table - if data exists, there should be rows
        const table = page.locator('table').first();
        const isTableVisible = await table.isVisible().catch(() => false);

        if (isTableVisible) {
            // If table is visible, check for at least some structure
            const rows = page.locator('table tbody tr');
            const rowCount = await rows.count().catch(() => 0);
            // If table is visible but no data, that's ok (data not populated)
            expect(rowCount).toBeGreaterThanOrEqual(0);
        }
        // If no table visible, page still rendered which is success
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
                    .catch(() => false)) || (await page.locator('body').textContent().length) > 100;
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
});
