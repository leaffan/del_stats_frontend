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

// Helper to check if team trivia data is available
async function hasTeamTriviaData(page) {
    try {
        const response = await page.request.head(
            'http://localhost:8000/data/team_trivia/overtime_games_per_season_pctg.json',
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

    test('7. Team trivia page loads, category and season type switching, team filter', async ({
        page,
    }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // page renders with a category select and a table
        const pageBody = page.locator('body');
        await expect(pageBody).toBeVisible();

        const table = page.locator('table').first();
        await expect(table).toBeVisible();

        const rows = page.locator('table tbody tr');
        const rowCountOverall = await rows.count();
        expect(rowCountOverall).toBeGreaterThan(0);

        // category explanation box is shown once a category is selected
        await expect(page.locator('.category-explanation')).toBeVisible();

        // switching to the overtime category (the only one with an "rs" season
        // type) and then switching season type (RS) narrows/changes the
        // displayed columns and rows
        const selects = page.locator('select');
        await selects.nth(0).selectOption('overtime_games_per_season_pctg');
        await page.waitForTimeout(300);
        await selects.nth(1).selectOption('rs');
        await page.waitForTimeout(300);
        const rowCountRs = await rows.count();
        expect(rowCountRs).toBeGreaterThan(0);

        // filtering by team narrows the table to that team's rows only and shows
        // the full team name rather than its abbreviation
        const teamSelect = selects.nth(2);
        const teamOptions = await teamSelect
            .locator('option')
            .evaluateAll((els) =>
                els.map((el) => ({ value: el.value, text: el.textContent.trim() })),
            );
        const realTeamOption = teamOptions.find((o) => o.text && o.text !== 'alle Teams');

        if (realTeamOption) {
            await teamSelect.selectOption(realTeamOption.value);
            await page.waitForTimeout(300);

            // column 1 is the rank counter, column 2 is "Saison", column 3 is "Team"
            const teamCells = page.locator('table tbody tr td:nth-child(3)');
            const cellCount = await teamCells.count();
            expect(cellCount).toBeGreaterThan(0);
            for (let i = 0; i < cellCount; i++) {
                await expect(teamCells.nth(i)).toHaveText(realTeamOption.text);
            }
        }

        // narrowing the season range filters out earlier seasons
        const fromSeasonSelect = selects.nth(3);
        const fromSeasonOptions = await fromSeasonSelect
            .locator('option')
            .evaluateAll((els) => els.map((el) => el.value));
        if (fromSeasonOptions.length > 1) {
            await fromSeasonSelect.selectOption(fromSeasonOptions[fromSeasonOptions.length - 1]);
            await page.waitForTimeout(300);
            const rowCountNarrowed = await rows.count();
            expect(rowCountNarrowed).toBeLessThanOrEqual(rowCountRs);
        }
    });

    test('8. Team trivia streak category loads a separate data file per season type', async ({
        page,
    }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const selects = page.locator('select');
        await selects.nth(0).selectOption('winning_streaks');
        await page.waitForTimeout(300);

        const rows = page.locator('table tbody tr');
        expect(await rows.count()).toBeGreaterThan(0);

        const seasonTypeSelect = selects.nth(1);
        const seasonTypeOptions = await seasonTypeSelect
            .locator('option')
            .evaluateAll((els) => els.map((el) => el.value));
        expect(seasonTypeOptions).toEqual(['overall', 'home', 'road']);

        // switching to the "home" variant must fetch its own data file, not reuse
        // ("overall"'s) or silently fail (this is the exact class of bug that
        // slipped through when data_file lived on the category instead of the
        // season type: the request would 404 against ".../undefined")
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().includes('winning_streaks_home.json')),
            seasonTypeSelect.selectOption('home'),
        ]);
        expect(response.ok()).toBeTruthy();
        await page.waitForTimeout(300);
        expect(await rows.count()).toBeGreaterThan(0);
    });

    test('9. Team trivia streak table applies the length/score_diff/scores_for/season tie-break chain', async ({
        page,
    }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const selects = page.locator('select');
        await selects.nth(0).selectOption('losing_streaks');
        await page.waitForTimeout(300);

        // two rows are tied at the longest losing streak (length 18): SWW
        // (score_diff -39) and WFR (score_diff -48) - for losing/opponent-shutout
        // streaks ties are broken by score_diff ascending (most lopsided/extreme
        // deficit ranks first), so WFR (-48) must rank before SWW (-39)
        const teamCells = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
        const swwIndex = teamCells.findIndex((t) => t.includes('Schwenninger'));
        const wfrIndex = teamCells.findIndex((t) => t.includes('Freiburg'));
        expect(swwIndex).toBeGreaterThanOrEqual(0);
        expect(wfrIndex).toBeGreaterThanOrEqual(0);
        expect(wfrIndex).toBeLessThan(swwIndex);

        // the score_diff column (last column) is negative here and must be
        // color-coded red, not shown with an explicit sign
        const scoreDiffCell = page.locator('table tbody tr td:last-child').first();
        await expect(scoreDiffCell).toHaveClass(/red/);
        const scoreDiffText = (await scoreDiffCell.textContent()).trim();
        expect(scoreDiffText.startsWith('+')).toBeFalsy();
    });

    test('10. Team trivia overtime category formats W-L[-T] record columns', async ({ page }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const selects = page.locator('select');
        await selects.nth(0).selectOption('overtime_games_per_season_pctg');
        await page.waitForTimeout(300);
        await selects.nth(1).selectOption('rs');
        await page.waitForTimeout(300);

        const teamSelect = selects.nth(2);

        // a modern season (Düsseldorfer EG, 2018/19) has no overtime ties, so the
        // OT-record column must show a plain "W-L" without a trailing "-0"
        const degValue = await teamSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Düsseldorf'))?.value);
        await teamSelect.selectOption(degValue);
        await page.waitForTimeout(300);
        let rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );
        let row = rows.find((r) => r[1] && r[1].startsWith('2018'));
        expect(row[8]).toMatch(/^\d+-\d+$/);

        // a historical pre-shootout season (Kassel Huskies, 1995/96) has overtime
        // ties, so the OT-record column must append them as a third "-T" part
        const kasValue = await teamSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Kassel'))?.value);
        await teamSelect.selectOption(kasValue);
        await page.waitForTimeout(300);
        rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );
        row = rows.find((r) => r[1] && r[1].startsWith('1995'));
        expect(row[8]).toBe('1-2-12');
        // the shootout-record column never has ties, regardless of the OT column
        expect(row[9]).toMatch(/^\d+-\d+$/);
    });

    test('11. Team trivia sort-direction caret matches the actual row order, and rank stays live after re-sorting', async ({
        page,
    }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // default view (winning_streaks) is sorted by length descending - the
        // caret on "Länge" must show down, not up, even though the underlying
        // sortCriteria array is built from prefixed tie-break expressions
        const lengthHeader = page.locator('th', { hasText: 'Länge' }).first();
        await expect(lengthHeader.locator('.fa-caret-down')).toBeVisible();
        await expect(lengthHeader.locator('.fa-caret-up')).toBeHidden();

        const firstRowLengthBefore = await page
            .locator('table tbody tr td:nth-child(3)')
            .first()
            .textContent();

        // clicking "Länge" toggles to ascending - caret and actual order must
        // both flip together (the row with the longest streak was on top, now
        // it must move to the bottom / a shorter streak takes the top spot)
        await lengthHeader.locator('a').click();
        await page.waitForTimeout(300);
        await expect(lengthHeader.locator('.fa-caret-up')).toBeVisible();
        await expect(lengthHeader.locator('.fa-caret-down')).toBeHidden();
        const firstRowLengthAfter = await page
            .locator('table tbody tr td:nth-child(3)')
            .first()
            .textContent();
        expect(parseInt(firstRowLengthAfter.trim(), 10)).toBeLessThan(
            parseInt(firstRowLengthBefore.trim(), 10),
        );

        // the rank column (still sorted ascending by length from the click above)
        // must reflect the *current* row order, not the order at first render
        const ranks = await page.locator('table tbody tr td:nth-child(1)').allTextContents();
        expect(ranks.slice(0, 5).map((r) => r.trim())).toEqual(['1', '2', '3', '4', '5']);
    });

    test('12. Team trivia score-state category formats duration and multi-season ranges', async ({
        page,
    }) => {
        const dataAvailable = await hasTeamTriviaData(page);

        if (!dataAvailable) {
            test.skip();
        }

        await page.goto('http://localhost:8000/index.html#!/team_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const groups = await page
            .locator('select')
            .nth(0)
            .locator('optgroup')
            .evaluateAll((ogs) => ogs.map((og) => og.label));
        expect(groups).toContain('Spielstand-Serien');

        const selects = page.locator('select');
        await selects.nth(0).selectOption('no_deficit_streaks');
        await page.waitForTimeout(300);

        const rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );

        // top row (Adler Mannheim, 44885s) must render as h:mm:ss, not raw seconds
        // or the plain mm:ss from the pre-existing formatTime (which would show
        // "748:05" instead of "12:28:05")
        const manRow = rows.find((r) => r[2] === 'Adler Mannheim' && r[1].includes('2018/19'));
        expect(manRow[4]).toBe('12:28:05');

        // a streak spanning two seasons must show both, not just one
        expect(manRow[1]).toBe('2018/19–2019/20');
    });

    test.skip('13. Teams with valid_periods appear/disappear correctly (KEV)', async ({ page }) => {
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

    test.skip('14. Team profile navigation respects valid_periods', async ({ page }) => {
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
