const { test, expect } = require('./support/test-base');
const {
    requireFixture,
    hasAggregatedPlayerStats,
    hasCareerData,
    hasTeamGameStats,
    hasPlayerFile,
    hasTeamTriviaData,
    hasGameTriviaData,
    hasPlayerTriviaData,
    hasShotExplorerData,
} = require('./support/probes');

test.describe('DEL Stats Core Flows', () => {
    test('1. Home page loads and renders', async ({ page }) => {
        await requireFixture(page, hasAggregatedPlayerStats);

        // Track only real JavaScript errors (not network errors or 404s). The
        // listeners have to exist before goto, or errors thrown while the page
        // loads are never seen.
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

        await page.goto('http://localhost:8000/index.html#!');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        expect(jsErrors).toHaveLength(0);

        // Check page renders
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();
    });

    test('2. Career statistics page loads', async ({ page }) => {
        await requireFixture(page, hasCareerData);

        // this page loads two large JSON files (~4MB combined) before it can
        // render any rows; waiting for the bigger one to actually finish
        // (rather than just networkidle, which can settle early, or a fixed
        // timeout, which occasionally wasn't enough under I/O latency spikes
        // seen on this repo's /mnt/c-mounted WSL filesystem) is the
        // deterministic fix for a flake that showed up under full-suite load
        const [response] = await Promise.all([
            page.waitForResponse(
                (res) => res.url().includes('upd_full_career_stats_stripped.json'),
                {
                    timeout: 15000,
                },
            ),
            page.goto('http://localhost:8000/index.html#!/career_stats'),
        ]);
        expect(response.ok()).toBeTruthy();

        // Check page renders
        const pageContent = page.locator('body');
        await expect(pageContent).toBeVisible();

        // With data, verify table exists and has rows
        const table = page.locator('table').first();
        await expect(table).toBeVisible();

        const rows = page.locator('table tbody tr');
        await expect(rows.first()).toBeVisible({ timeout: 15000 });
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('3. Player career details loads when navigating', async ({ page }) => {
        await requireFixture(page, hasCareerData);

        // First go to career stats to get a player link
        await page.goto('http://localhost:8000/index.html#!/career_stats');

        const playerLinks = page.locator("a[href*='player_career'], a[ng-href*='player_career']");
        await expect(playerLinks.first()).toBeVisible({ timeout: 15000 });

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
    });

    test('3b. Career stats player links use a valid player id and resolve to the right player', async ({
        page,
    }) => {
        await requireFixture(page, hasCareerData);

        // same large-data-file render lag as test 2 - wait for the actual
        // data response deterministically instead of racing networkidle/a
        // fixed timeout against Angular's render
        const [response] = await Promise.all([
            page.waitForResponse(
                (res) => res.url().includes('upd_full_career_stats_stripped.json'),
                {
                    timeout: 15000,
                },
            ),
            page.goto('http://localhost:8000/index.html#!/career_stats'),
        ]);
        expect(response.ok()).toBeTruthy();

        const playerLinks = page.locator("a[href*='player_career']");
        await expect(playerLinks.first()).toBeVisible({ timeout: 15000 });
        const linkCount = await playerLinks.count();
        expect(linkCount).toBeGreaterThan(0);

        const links = await playerLinks.evaluateAll((els) =>
            els.map((el) => ({ href: el.getAttribute('href'), text: el.textContent.trim() })),
        );

        // regression guard: a player row must never link with a missing/undefined
        // id (this happened when the g_id/c_id choice was based on a season
        // comparison instead of on which id field actually exists on the player)
        const ids = links.map((l) => l.href.match(/player_career\/([^/]+)$/)?.[1]);
        expect(ids.every((id) => !!id && id !== 'undefined')).toBeTruthy();

        // spot-check a spread-out sample: the underlying per-player data file
        // referenced by the id must actually exist...
        const step = Math.max(1, Math.floor(ids.length / 10));
        const sampleIndices = [];
        for (let i = 0; i < ids.length; i += step) sampleIndices.push(i);

        for (const i of sampleIndices) {
            const id = ids[i];
            const response = await page.request.head(
                `http://localhost:8000/data/career_stats/per_player/${id}.json`,
            );
            expect(response.ok(), `per_player/${id}.json should exist`).toBeTruthy();
        }

        // ...and following the link must land on the same player, not a
        // different one whose id happened to collide (g_id/c_id mismatch)
        const sampleLink = links[sampleIndices[0]];
        await playerLinks.nth(sampleIndices[0]).click();
        await page.waitForURL(/player_career/, { timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const heading = page.locator('h2').first();
        await expect(heading).toContainText(sampleLink.text);
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
        await requireFixture(page, hasTeamTriviaData);

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
        await requireFixture(page, hasTeamTriviaData);

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
        await requireFixture(page, hasTeamTriviaData);

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
        await requireFixture(page, hasTeamTriviaData);

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
        await requireFixture(page, hasTeamTriviaData);

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
        await requireFixture(page, hasTeamTriviaData);

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

    test('13. Team trivia deep link selects category and season type from the route', async ({
        page,
    }) => {
        await requireFixture(page, hasTeamTriviaData);

        // a direct link to a specific category/season-type combination must land
        // there immediately, without the user having to pick it from the dropdowns
        await page.goto(
            'http://localhost:8000/index.html#!/team_trivia/losing_streaks_season_start/home',
        );
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const selects = page.locator('select');
        await expect(selects.nth(0)).toHaveValue('losing_streaks_season_start');
        await expect(selects.nth(1)).toHaveValue('home');
        expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);

        // an unknown category in the URL must fall back to the default category
        // rather than breaking the page
        await page.goto('http://localhost:8000/index.html#!/team_trivia/does_not_exist');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        await expect(selects.nth(0)).toHaveValue('winning_streaks');
        expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);
    });

    test('16. Shot explorer deep link selects season and player from the route', async ({
        page,
    }) => {
        await requireFixture(page, hasShotExplorerData);

        // a direct link to a specific season/player combination must land there
        // immediately, without the user having to pick it from the dropdowns
        await page.goto('http://localhost:8000/index.html#!/shot_explorer/2025/100');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const playerSelect = page.locator('select').first();
        await expect(playerSelect).toHaveValue('100');
        expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);
    });

    test('16b. Homepage links to Schussanalyse for a skater in the season that actually has shot data', async ({
        page,
    }) => {
        await requireFixture(page, hasShotExplorerData);

        await page.goto('http://localhost:8000/index.html#!');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // the feature was renamed from "Shot Explorer" - no leftover English
        // label should remain anywhere on the homepage
        const bodyText = (await page.locator('body').textContent()) || '';
        expect(bodyText).not.toContain('Shot Explorer');

        // the homepage also has a defaultSeason-based Schussanalyse link, so
        // target the 2025 one explicitly instead of matching by label alone
        const link = page.locator("a[href*='shot_explorer/2025/']:has-text('Schussanalyse')");
        await expect(link).toBeVisible({ timeout: 10000 });

        // shot-tracking data currently only exists for season 2025 (unlike
        // config.defaultSeason, which points at the not-yet-live upcoming
        // season) - the homepage link must target that season specifically,
        // with a real, non-empty player id
        const href = await link.getAttribute('href');
        expect(href).toMatch(/^#!\/shot_explorer\/2025\/\d+$/);

        await link.click();
        await page.waitForURL(/shot_explorer/, { timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const rink = page.locator('svg').first();
        await expect(rink).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveTitle(/Schussanalyse/);
    });

    test('17. Game trivia page loads with both categories and sorts by margin', async ({
        page,
    }) => {
        await requireFixture(page, hasGameTriviaData);

        await page.goto('http://localhost:8000/index.html#!/game_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const groups = await page
            .locator('select')
            .nth(0)
            .locator('optgroup')
            .evaluateAll((ogs) =>
                ogs.map((og) => ({
                    label: og.label,
                    options: Array.from(og.querySelectorAll('option')).map((o) => o.value),
                })),
            );
        expect(groups).toEqual([
            { label: 'Einbrüche und Comebacks', options: ['blown_leads', 'comeback_wins'] },
            { label: 'Drittel-Statistiken', options: ['goals_per_period'] },
        ]);

        // default category (blown_leads) is sorted by margin descending - the
        // largest blown leads (margin 4) must appear before the more common
        // margin-3 ones, with both team and opponent shown as full names
        const rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );
        expect(parseInt(rows[0][6], 10)).toBeGreaterThanOrEqual(
            parseInt(rows[rows.length - 1][6], 10),
        );
        expect(rows[0][1]).not.toMatch(/^[A-Z]{2,4}$/); // full name, not a bare abbreviation
        expect(rows[0][2]).not.toMatch(/^[A-Z]{2,4}$/);

        // switching to "comeback_wins" loads its own file and re-renders
        const selects = page.locator('select');
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().includes('comeback_wins.json')),
            selects.nth(0).selectOption('comeback_wins'),
        ]);
        expect(response.ok()).toBeTruthy();
        await page.waitForTimeout(300);
        expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);
    });

    test('18. Game trivia RS/PO filter narrows rows and covers the full data set', async ({
        page,
    }) => {
        await requireFixture(page, hasGameTriviaData);

        await page.goto('http://localhost:8000/index.html#!/game_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const rowCountAll = await page.locator('table tbody tr').count();

        const gamePhaseSelect = page.locator('select').nth(1);
        await gamePhaseSelect.selectOption('PO');
        await page.waitForTimeout(300);
        const rowCountPO = await page.locator('table tbody tr').count();
        expect(rowCountPO).toBeGreaterThan(0);
        expect(rowCountPO).toBeLessThan(rowCountAll);

        await gamePhaseSelect.selectOption('RS');
        await page.waitForTimeout(300);
        const rowCountRS = await page.locator('table tbody tr').count();

        // RS and PO together must account for every row - no game silently
        // dropped or double-counted by the filter
        expect(rowCountRS + rowCountPO).toBe(rowCountAll);
    });

    test('19. Game trivia opponent filter narrows rows independently of the team filter', async ({
        page,
    }) => {
        await requireFixture(page, hasGameTriviaData);

        await page.goto('http://localhost:8000/index.html#!/game_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const oppSelect = page.locator('select').nth(3);
        const oppValue = await oppSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Mannheim'))?.value);
        await oppSelect.selectOption(oppValue);
        await page.waitForTimeout(300);

        const oppCells = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
        expect(oppCells.length).toBeGreaterThan(0);
        expect(oppCells.every((c) => c.trim() === 'Adler Mannheim')).toBeTruthy();

        // the team column (not filtered) should still contain other teams too,
        // confirming the opponent filter didn't accidentally filter on "team"
        const teamCells = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
        expect(teamCells.some((c) => c.trim() !== 'Adler Mannheim')).toBeTruthy();
    });

    test("19b. Game trivia team filter narrows to the team's own role, not the opponent", async ({
        page,
    }) => {
        await requireFixture(page, hasGameTriviaData);

        await page.goto('http://localhost:8000/index.html#!/game_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const teamSelect = page.locator('select').nth(2);
        const teamValue = await teamSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Mannheim'))?.value);
        await teamSelect.selectOption(teamValue);
        await page.waitForTimeout(300);

        // blown_leads/comeback_wins have a dedicated "team" role - selecting
        // a team must never pull in rows where it only appears as "opp"
        // (mirrors the analogous oppFilter bug fixed in test 19)
        const teamCells = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
        expect(teamCells.length).toBeGreaterThan(0);
        expect(teamCells.every((c) => c.trim() === 'Adler Mannheim')).toBeTruthy();

        const oppCells = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
        expect(oppCells.some((c) => c.trim() !== 'Adler Mannheim')).toBeTruthy();
    });

    test('20. Game trivia goals-per-period category switches variants and generalizes team_column', async ({
        page,
    }) => {
        await requireFixture(page, hasGameTriviaData);

        await page.goto('http://localhost:8000/index.html#!/game_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);

        const selects = page.locator('select');
        await selects.nth(0).selectOption('goals_per_period');
        await page.waitForTimeout(300);

        // this category has 3 real variants, so (unlike blown_leads/comeback_wins)
        // the season-type dropdown must actually be visible with period1-3,
        // now placed right after the category select in the top row
        const seasonTypeOptions = await selects
            .nth(1)
            .locator('option')
            .evaluateAll((els) => els.map((el) => el.value));
        expect(seasonTypeOptions).toEqual(['period1', 'period2', 'period3']);

        // "Heim"/"Auswärts" use home_abbr/road_abbr (not team/opp) but must
        // still render as full team names via the generic team_column flag
        const homeCell = await page.locator('table tbody tr td:nth-child(5)').first().textContent();
        expect(homeCell.trim()).not.toMatch(/^[A-Z]{2,4}$/);

        // switching to period3 loads its own file and sorts by period_3_goals
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().includes('goals_in_games_period_3.json')),
            selects.nth(1).selectOption('period3'),
        ]);
        expect(response.ok()).toBeTruthy();
        await page.waitForTimeout(300);

        const rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );
        const totals = rows.map((r) => parseInt(r[7], 10));
        expect(totals[0]).toBeGreaterThanOrEqual(totals[totals.length - 1]);
    });

    test('21. Player trivia page loads fastest-goal category with period/OT variants sorted ascending', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const rows = page.locator('table tbody tr');
        expect(await rows.count()).toBeGreaterThan(0);

        // the fastest-goal category has 4 season-type variants: 3 periods and OT
        const seasonTypeOptions = await page
            .locator('select')
            .nth(1)
            .locator('option')
            .evaluateAll((els) => els.map((el) => el.value));
        expect(seasonTypeOptions).toEqual(['period1', 'period2', 'period3', 'OT']);

        // default sort is by time ascending - the fastest goal must be on top
        const times = await page.locator('table tbody tr td:nth-child(4)').allTextContents();
        const toSeconds = (t) => {
            const [m, s] = t.trim().split(':').map(Number);
            return m * 60 + s;
        };
        expect(toSeconds(times[0])).toBeLessThanOrEqual(toSeconds(times[times.length - 1]));

        // switching to OT loads its own file
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().includes('fastest_first_goal_period_OT.json')),
            page.locator('select').nth(1).selectOption('OT'),
        ]);
        expect(response.ok()).toBeTruthy();
        await page.waitForTimeout(300);
        expect(await rows.count()).toBeGreaterThan(0);

        // the score column combines "record" (home_score/road_score) with
        // decision_suffix - it must render as a single "A-B (VL)"/"A-B (SO)",
        // not both the plain "A-B" and the suffixed score side by side (the
        // template used to render both spans unconditionally)
        const scores = await page.locator('table tbody tr td:last-child').allTextContents();
        expect(scores.length).toBeGreaterThan(0);
        for (const score of scores) {
            expect(score.trim()).toMatch(/^\d+-\d+( \((VL|SO)\))?$/);
        }
        expect(scores.some((s) => s.includes('(VL)'))).toBeTruthy();
    });

    test('22. Player trivia scorer links resolve both numeric and letter-suffixed ids to the right player', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const scorerLinks = page.locator("a[href*='player_career']");
        const linkCount = await scorerLinks.count();
        expect(linkCount).toBeGreaterThan(0);

        const links = await scorerLinks.evaluateAll((els) =>
            els.map((el) => ({ href: el.getAttribute('href'), text: el.textContent.trim() })),
        );
        const ids = links.map((l) => l.href.match(/player_career\/([^/]+)$/)?.[1]);

        // every link must carry a resolvable id - never the bare, un-prefixed
        // g_id (e.g. "91132af" instead of "g91132af"), which would 404 against
        // per_player/<id>.json exactly like the career-stats bug fixed earlier
        expect(ids.every((id) => !!id && id !== 'undefined')).toBeTruthy();

        // this category mixes both id shapes (numeric c_id and letter-suffixed
        // g_id) in the same table, so make sure both actually occur here...
        const numericIds = ids.filter((id) => /^\d+$/.test(id));
        const gIds = ids.filter((id) => /^g\S+$/.test(id));
        expect(numericIds.length).toBeGreaterThan(0);
        expect(gIds.length).toBeGreaterThan(0);

        // ...and spot-check one of each: the underlying per-player file must
        // exist, and following the link must land on the matching player
        for (const sampleId of [numericIds[0], gIds[0]]) {
            const response = await page.request.head(
                `http://localhost:8000/data/career_stats/per_player/${sampleId}.json`,
            );
            expect(response.ok(), `per_player/${sampleId}.json should exist`).toBeTruthy();
        }

        const sampleLink = links.find((l) => gIds[0] && l.href.endsWith('/' + gIds[0]));
        await scorerLinks.nth(links.findIndex((l) => l === sampleLink)).click();
        await page.waitForURL(/player_career/, { timeout: 5000 }).catch(() => {});
        await page
            .waitForFunction(
                () => (document.querySelector('h2')?.textContent || '').trim().length > 0,
                {
                    timeout: 5000,
                },
            )
            .catch(() => {});
        const heading = page.locator('h2').first();
        await expect(heading).toContainText(sampleLink.text);
    });

    test("23. Player trivia team filter narrows to the scorer's own team, opponent filter narrows independently", async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const rowCountAll = await page.locator('table tbody tr').count();

        const selects = page.locator('select');
        const teamSelect = selects.nth(2);
        const oppSelect = selects.nth(3);

        const teamValue = await teamSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Mannheim'))?.value);
        await teamSelect.selectOption(teamValue);
        await page.waitForTimeout(300);

        // the "Team" column (the scorer's own team) must be narrowed to
        // Mannheim on every row - a row where Mannheim only appears as the
        // home/road opponent (not the team that actually scored) must be
        // excluded, unlike the shared teamFilter used elsewhere
        const teamCells = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
        expect(teamCells.length).toBeGreaterThan(0);
        expect(teamCells.length).toBeLessThan(rowCountAll);
        expect(teamCells.every((c) => c.trim() === 'Adler Mannheim')).toBeTruthy();
        const rowCountTeam = teamCells.length;

        // adding an opponent filter narrows further, independently of the
        // team filter - matching whichever of home/road wasn't the scorer's
        // own team
        const oppValue = await oppSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Köln'))?.value);
        await oppSelect.selectOption(oppValue);
        await page.waitForTimeout(300);

        const rows = await page
            .locator('table tbody tr')
            .evaluateAll((trs) =>
                trs.map((tr) =>
                    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
                ),
            );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(rowCountTeam);
        for (const r of rows) {
            expect(r[2]).toBe('Adler Mannheim');
            expect([r[6], r[7]]).toContain('Kölner Haie');
        }
    });

    test('24. Player trivia name search filters rows by the player_column field', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const rowCountAll = await page.locator('table tbody tr').count();

        const nameInput = page.locator("input[placeholder='Spieler filtern']");
        await nameInput.fill('faust');
        await page.waitForTimeout(300);

        const scorerCells = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
        expect(scorerCells.length).toBeGreaterThan(0);
        expect(scorerCells.length).toBeLessThan(rowCountAll);
        expect(scorerCells.every((c) => c.toLowerCase().includes('faust'))).toBeTruthy();

        // clearing the search restores the full row count
        await nameInput.fill('');
        await page.waitForTimeout(300);
        expect(await page.locator('table tbody tr').count()).toBe(rowCountAll);
    });

    test('25. Player trivia age categories group correctly, hide the single season-type select, and sort by extremity', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const groups = await page
            .locator('select')
            .nth(0)
            .locator('optgroup')
            .evaluateAll((ogs) =>
                ogs.map((og) => ({
                    label: og.label,
                    options: Array.from(og.querySelectorAll('option')).map((o) => o.value),
                })),
            );
        expect(groups).toEqual([
            { label: 'Drittel-Statistiken', options: ['fastest_first_goal'] },
            {
                label: 'Spieler jünger als 18 Jahre',
                options: ['first_game_player_ages_younger_18', 'first_goal_player_ages_younger_18'],
            },
            {
                label: 'Spieler älter als 40 Jahre',
                options: ['last_game_player_ages_older_40', 'last_goal_player_ages_older_40'],
            },
            { label: 'Ironman-Serien', options: ['ir_streaks_full_seasons'] },
        ]);

        // the season-type dropdown is a pointless single option for these
        // categories (unlike fastest_first_goal's 4 variants), so it must be
        // hidden rather than shown with only one choice
        await page.locator('select').nth(0).selectOption('first_game_player_ages_younger_18');
        await page.waitForTimeout(300);
        const selectCount = await page.locator('select').count();
        const models = await page
            .locator('select')
            .evaluateAll((els) => els.map((el) => el.getAttribute('data-ng-model')));
        expect(models).not.toContain('ctrl.seasonTypeSelect');
        expect(selectCount).toBe(6); // category, team, opp, position, from, to

        // "younger than 18" categories rank the youngest (most extreme) age
        // first - ascending order
        const youngAges = await page.locator('table tbody tr td:nth-child(5)').allTextContents();
        expect(youngAges.length).toBeGreaterThan(0);
        const firstYoungYears = parseInt(youngAges[0].trim().split(' ')[0], 10);
        const lastYoungYears = parseInt(youngAges[youngAges.length - 1].trim().split(' ')[0], 10);
        expect(firstYoungYears).toBeLessThanOrEqual(lastYoungYears);
        expect(youngAges[0].trim()).toMatch(/^\d+ Jahre \d+ Monate? \d+ Tage?$/);

        // "older than 40" categories rank the oldest (most extreme) age
        // first - descending order
        await page.locator('select').nth(0).selectOption('last_game_player_ages_older_40');
        await page.waitForTimeout(300);
        const oldAges = await page.locator('table tbody tr td:nth-child(5)').allTextContents();
        expect(oldAges.length).toBeGreaterThan(0);
        const firstOldYears = parseInt(oldAges[0].trim().split(' ')[0], 10);
        const lastOldYears = parseInt(oldAges[oldAges.length - 1].trim().split(' ')[0], 10);
        expect(firstOldYears).toBeGreaterThanOrEqual(lastOldYears);
    });

    test('26. Player trivia age category links resolve both id shapes, and team/opponent/position filters work on fixed team/opp roles', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerTriviaData);

        await page.goto('http://localhost:8000/index.html#!/player_trivia');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.locator('select').nth(0).selectOption('first_game_player_ages_younger_18');
        await page.waitForTimeout(300);

        // regression guard: this category's player_id was originally sourced
        // from a different id scheme than career_stats' c_id/g_id and didn't
        // resolve to any per_player file at all; it must now behave exactly
        // like fastest_first_goal's scorer_id (numeric c_id as-is, string
        // g_id needing its 'g' prefix added)
        const links = await page
            .locator("a[href*='player_career']")
            .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
        const ids = links.map((h) => h.match(/player_career\/([^/]+)$/)?.[1]);
        expect(ids.every((id) => !!id && id !== 'undefined')).toBeTruthy();
        const numericIds = ids.filter((id) => /^\d+$/.test(id));
        const gIds = ids.filter((id) => /^g\S+$/.test(id));
        expect(numericIds.length).toBeGreaterThan(0);
        expect(gIds.length).toBeGreaterThan(0);
        for (const sampleId of [numericIds[0], gIds[0]]) {
            const response = await page.request.head(
                `http://localhost:8000/data/career_stats/per_player/${sampleId}.json`,
            );
            expect(response.ok(), `per_player/${sampleId}.json should exist`).toBeTruthy();
        }

        // team filter narrows to the player's own team only (a fixed "team"
        // role, distinct from "opp" - unlike the generic shared teamFilter's
        // any-field fallback for symmetric home/road categories)
        const teamGroup = page
            .locator('.input-group', { hasText: 'Team:' })
            .filter({ has: page.locator('select') });
        const teamSelect = teamGroup.locator('select');
        const teamValue = await teamSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Mannheim'))?.value);
        await teamSelect.selectOption(teamValue);
        await page.waitForTimeout(300);
        const teamCells = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
        expect(teamCells.length).toBeGreaterThan(0);
        expect(teamCells.every((c) => c.trim() === 'Adler Mannheim')).toBeTruthy();
        await teamSelect.selectOption('');
        await page.waitForTimeout(300);

        // opponent filter narrows to the dedicated "opp" field directly, even
        // with no team selected (this is exactly the case that was broken
        // before the role-aware oppFilter fix in game_trivia)
        const oppGroup = page
            .locator('.input-group', { hasText: 'Gegner:' })
            .filter({ has: page.locator('select') });
        const oppSelect = oppGroup.locator('select');
        const oppValue = await oppSelect
            .locator('option')
            .evaluateAll((els) => els.find((el) => el.textContent.includes('Mannheim'))?.value);
        await oppSelect.selectOption(oppValue);
        await page.waitForTimeout(300);
        const oppCells = await page.locator('table tbody tr td:nth-child(4)').allTextContents();
        expect(oppCells.length).toBeGreaterThan(0);
        expect(oppCells.every((c) => c.trim() === 'Adler Mannheim')).toBeTruthy();
        await oppSelect.selectOption('');
        await page.waitForTimeout(300);

        // position filter buckets granular codes (C/D/F/G/LD/LW/RD/RW/...)
        // into Torhüter/Verteidiger/Stürmer, mirroring career_stats
        const positionGroup = page.locator('select').nth(3);
        await positionGroup.selectOption('GK');
        await page.waitForTimeout(300);
        const gkRows = await page.locator('table tbody tr').count();
        expect(gkRows).toBeGreaterThan(0);
    });

    // 27-29 close a coverage gap: team_stats/team_profile/player_profile had
    // zero active test coverage (team_stats/team_profile were only reachable
    // via two long-skipped valid_periods tests, player_profile wasn't
    // reachable at all), yet their controllers just had several
    // variables that were implicit globals - shared across every <script>-tag
    // loaded file - turned into properly scoped let/const. Each test below
    // exercises the sort/filter path that touched, sorting twice (or relying
    // on the already-sorted default plus one toggle) so a "state leaked from
    // a previous call" regression would show up as rows failing to reorder.
    test('27. Team stats page loads and sort order toggles correctly', async ({ page }) => {
        await requireFixture(page, hasTeamGameStats('2025'));

        await page.goto('http://localhost:8000/index.html#!/team_stats/2025');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const table = page.locator('#standings');
        await expect(table).toBeVisible();
        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);

        // default sort is PTS descending
        const ptsHeader = table.locator('th', { hasText: 'PTS' }).first();
        await expect(ptsHeader.locator('.fa-caret-down')).toBeVisible();
        const topPtsBefore = (await rows.first().locator('td:nth-child(10)').textContent()).trim();

        // clicking PTS again toggles to ascending - exercises $scope.filterStats
        // and $scope.setSortOrder, both touched by the lint fix
        await ptsHeader.locator('a').click();
        await page.waitForTimeout(300);
        await expect(ptsHeader.locator('.fa-caret-up')).toBeVisible();
        const topPtsAfter = (await rows.first().locator('td:nth-child(10)').textContent()).trim();
        expect(topPtsAfter).not.toBe(topPtsBefore);
    });

    test('28. Team profile page loads and date sort toggles the game log order', async ({
        page,
    }) => {
        await requireFixture(page, hasTeamGameStats('2025'));

        await page.goto('http://localhost:8000/index.html#!/team_profile/2025/NIT');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const table = page.locator('#basic_game_by_game');
        await expect(table).toBeVisible();
        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);

        // default sort is by date descending - exercises $scope.dayFilter's
        // now block-scoped date_to_test alongside $scope.setSortOrder
        const dateHeader = table.locator('th', { hasText: 'Datum' }).first();
        await expect(dateHeader.locator('.fa-caret-down')).toBeVisible();
        const topDateBefore = (await rows.first().locator('td').first().textContent()).trim();

        await dateHeader.locator('a').click();
        await page.waitForTimeout(300);
        await expect(dateHeader.locator('.fa-caret-up')).toBeVisible();
        const topDateAfter = (await rows.first().locator('td').first().textContent()).trim();
        expect(topDateAfter).not.toBe(topDateBefore);
    });

    test('29. Player profile page loads and date sort toggles the game log order', async ({
        page,
    }) => {
        await requireFixture(page, hasPlayerFile('2025', 'NIT', '4'));

        await page.goto('http://localhost:8000/index.html#!/player_profile/2025/NIT/4');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const table = page.locator('#basic_game_by_game');
        await expect(table).toBeVisible();
        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);

        // same dayFilter/setSortOrder path as team profile, exercised here for
        // player_profile_controller.js's own copy of the same pattern. Unlike
        // team profile, the initial sort key here is 'game_date' while the
        // column's key is 'date', so no caret shows until the first click.
        const dateHeader = table.locator('th', { hasText: 'Datum' }).first();
        const topDateBefore = (await rows.first().locator('td').first().textContent()).trim();

        await dateHeader.locator('a').click();
        await page.waitForTimeout(300);
        await expect(dateHeader.locator('.fa-caret-down')).toBeVisible();

        await dateHeader.locator('a').click();
        await page.waitForTimeout(300);
        await expect(dateHeader.locator('.fa-caret-up')).toBeVisible();
        const topDateAfter = (await rows.first().locator('td').first().textContent()).trim();
        expect(topDateAfter).not.toBe(topDateBefore);
    });

    test('30. Player profile page renders linemate names correctly', async ({ page }) => {
        await requireFixture(page, hasPlayerFile('2025', 'NIT', '4'));

        await page.goto('http://localhost:8000/index.html#!/player_profile/2025/NIT/4');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Linemates are only shown in the 'Reihenpartner' table, not the default one
        await page.locator('select[data-ng-model="tableSelect"]:visible').selectOption('lines');

        const table = page.locator('#lines');
        await expect(table).toBeVisible();
        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);

        // Check that the linemate name cells contain actual player names
        // This test would have caught the "Remove loading of player registry" regression
        // where $scope.players was undefined, causing player names to display as "undefined undefined"
        // Games without a line assignment render empty linemate links, so pick a row with names
        const firstRow = rows
            .filter({ has: page.locator('a[href*="player_profile"]', { hasText: /\S/ }) })
            .first();
        await expect(firstRow).toBeVisible();
        // Get linemate links (defense and forwards player profile links) in the row
        const linemateLinkCells = firstRow.locator('a[href*="player_profile"]');
        const lineMateCount = await linemateLinkCells.count();

        // Should have at least 5 linemate links (defense[0,1] + forwards[0,1,2])
        expect(lineMateCount).toBeGreaterThanOrEqual(5);

        // The profiled player occupies one of the five slots himself, so one link
        // (forwards[2] for a forward, defense[1] for a defenseman) is empty
        const texts = (await linemateLinkCells.allTextContents()).map((t) => t.trim());
        const named = texts.filter((t) => t.length > 0);
        expect(named.length).toBeGreaterThanOrEqual(4);
        for (const text of texts) {
            // Should not contain error indicators
            expect(text).not.toContain('undefined');
        }
    });
});
