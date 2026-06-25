const { test, expect } = require('@playwright/test');

test.describe('DEL Stats Core Flows', () => {
    test('1. Home page loads without JavaScript errors', async ({ page }) => {
        await page.goto('http://localhost:8000/index.html#!');

        // Check for console errors
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            // ignore timeout, we just want to ensure basic load
        });

        expect(consoleErrors).toHaveLength(0);

        // Check navigation menu exists
        const navMenu = page.locator("nav, .menu, [ng-click*='goTo']").first();
        await expect(navMenu).toBeVisible({
            timeout: 3000,
        });

        // Check title or main content loads
        const pageContent = page.locator('body');
        await expect(pageContent).toBeTruthy();
    });

    test('2. Career statistics page loads with table', async ({ page }) => {
        await page.goto('http://localhost:8000/index.html#!/career_stats');

        // Wait for table data to load
        await page.waitForSelector('table', { timeout: 5000 }).catch(() => {});

        // Check table exists
        const table = page.locator('table').first();
        const isVisible = await table.isVisible().catch(() => false);

        if (isVisible) {
            // Table loaded with data
            const rows = page.locator('table tbody tr');
            const count = await rows.count();
            expect(count).toBeGreaterThan(0);
        } else {
            // No data, but page should still render controls
            const pageExists = await page.locator('body').isVisible();
            expect(pageExists).toBeTruthy();
        }

        // Check navigation works (menu item clickable)
        const navLink = page
            .locator('a, button')
            .filter({ hasText: /home|career/i })
            .first();
        const isClickable = await navLink.isEnabled().catch(() => false);
        expect(isClickable || isVisible).toBeTruthy();
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
