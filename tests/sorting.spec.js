const { test, expect } = require('./support/test-base');

// Generic, data-driven sorting checks.
//
// Instead of one hand-written test per sortable column, each entry below
// produces ONE test that walks every sortable column of that view's table and
// asserts a handful of invariants that hold regardless of what the column
// actually contains (numbers, dates, "12:28:05", "1-2-12", team names, ...):
//
//   1. clicking a sortable header shows exactly one caret, on that column
//   2. clicking it again flips the caret to the opposite direction
//   3. the set of displayed values is unchanged (no row lost, added or mutated)
//   4. the ascending value sequence is the exact reverse of the descending one
//   5. the order actually changes at all (unless every value is identical)
//
// Invariant 4 is the interesting one: a multiset has exactly one ascending and
// one descending ordering, so this holds even when many rows are tied - no
// parsing of the cell text is needed, and no fixture values are hard-coded.
// It assumes the displayed text is a function of the sort key. For a column
// where it isn't (cell shows a formatted value, sorting happens on a different
// underlying field), list its header in `looseColumns` to fall back to
// invariants 1-3 and 5 only.

const BASE = 'http://localhost:8000';

const VIEWS = [
    {
        name: 'Team stats',
        url: `${BASE}/index.html#!/team_stats/2025`,
        table: '#standings',
        probe: `${BASE}/data/2025/del_player_game_stats_aggregated.json`,
    },
    {
        name: 'Team profile game log',
        url: `${BASE}/index.html#!/team_profile/2025/NIT`,
        table: '#basic_game_by_game',
        probe: `${BASE}/data/2025/del_player_game_stats_aggregated.json`,
    },
    {
        name: 'Player profile game log',
        url: `${BASE}/index.html#!/player_profile/2025/NIT/4`,
        table: '#basic_game_by_game',
        probe: `${BASE}/data/2025/del_player_game_stats_aggregated.json`,
    },
    {
        name: 'Team trivia',
        url: `${BASE}/index.html#!/team_trivia`,
        table: 'table',
        probe: `${BASE}/data/historic_trivia/overtime_games_per_season_pctg.json`,
    },
    {
        name: 'Game trivia',
        url: `${BASE}/index.html#!/game_trivia`,
        table: 'table',
        probe: `${BASE}/data/historic_trivia/blown_leads.json`,
    },
    {
        name: 'Player trivia',
        url: `${BASE}/index.html#!/player_trivia`,
        table: 'table',
        probe: `${BASE}/data/historic_trivia/fastest_first_goal_period_1.json`,
    },
    // career_stats renders thousands of rows; sorting every column there is
    // slow, so it waits for its big data file and only samples a few columns
    {
        name: 'Career stats',
        url: `${BASE}/index.html#!/career_stats`,
        table: 'table',
        probe: `${BASE}/data/2025/del_player_game_stats_aggregated.json`,
        waitForData: /upd_full_career_stats_stripped\.json/,
        maxColumns: 5,
    },
];

async function isAvailable(page, url) {
    try {
        const response = await page.request.head(url, { timeout: 2000 });
        return response.ok();
    } catch {
        return false;
    }
}

// 'down' | 'up' | null - ng-show hides the inactive caret via display:none,
// so visibility is the reliable signal here
async function readCaret(th) {
    if (await th.locator('.fa-caret-down:visible').count()) return 'down';
    if (await th.locator('.fa-caret-up:visible').count()) return 'up';
    return null;
}

// text of one column, top to bottom, addressed positionally so it works for
// tables that mix <td> and <th> in the body
function columnValues(table, columnIndex) {
    return table
        .locator('tbody tr')
        .evaluateAll(
            (trs, idx) => trs.map((tr) => (tr.children[idx]?.textContent || '').trim()),
            columnIndex,
        );
}

for (const view of VIEWS) {
    test(`Sorting invariants: ${view.name}`, async ({ page }) => {
        if (!(await isAvailable(page, view.probe))) {
            test.skip();
        }

        if (view.waitForData) {
            const [response] = await Promise.all([
                page.waitForResponse((res) => view.waitForData.test(res.url()), {
                    timeout: 15000,
                }),
                page.goto(view.url),
            ]);
            expect(response.ok()).toBeTruthy();
        } else {
            await page.goto(view.url);
        }

        const table = page.locator(view.table).first();
        await expect(table).toBeVisible({ timeout: 15000 });

        const rows = table.locator('tbody tr');
        await expect(rows.first()).toBeVisible({ timeout: 15000 });
        const initialRowCount = await rows.count();
        expect(initialRowCount).toBeGreaterThan(0);

        const headers = table.locator('thead th');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);

        // positional column addressing is only valid when the header row and
        // the body rows have the same cell count (no colspans in play)
        const bodyCellCount = await rows.first().locator('> *').count();
        const canReadColumns = bodyCellCount === headerCount;

        // a header is sortable exactly when the shared table_header directive
        // wrapped it in a link
        const sortable = [];
        for (let i = 0; i < headerCount; i++) {
            const th = headers.nth(i);
            if (await th.locator('a').count()) {
                sortable.push({ index: i, label: (await th.innerText()).trim() });
            }
        }
        expect(sortable.length, `${view.name}: no sortable columns found`).toBeGreaterThan(0);

        const columns = view.maxColumns ? sortable.slice(0, view.maxColumns) : sortable;

        for (const column of columns) {
            const th = headers.nth(column.index);
            const where = `${view.name} / column "${column.label}"`;

            // --- first click: establishes a sort direction on this column ---
            await th.locator('a').first().click();
            await expect
                .poll(() => readCaret(th), {
                    message: `${where}: no caret shown after sorting by this column`,
                    timeout: 5000,
                })
                .not.toBeNull();
            const firstCaret = await readCaret(th);

            // the caret is driven by the same sortConfig as the ng-repeat's
            // orderBy, so once it has rendered the rows are in their new order
            const carets = table.locator(
                'thead .fa-caret-down:visible, thead .fa-caret-up:visible',
            );
            expect(await carets.count(), `${where}: more than one caret visible`).toBe(1);

            const firstValues = canReadColumns
                ? await columnValues(table, column.index)
                : await rows.allTextContents();

            // --- second click: must toggle to the opposite direction ---
            await th.locator('a').first().click();
            const expectedCaret = firstCaret === 'down' ? 'up' : 'down';
            await expect
                .poll(() => readCaret(th), {
                    message: `${where}: caret did not toggle to ${expectedCaret}`,
                    timeout: 5000,
                })
                .toBe(expectedCaret);

            const secondValues = canReadColumns
                ? await columnValues(table, column.index)
                : await rows.allTextContents();

            // sorting must never filter, duplicate or alter rows
            expect(secondValues.length, `${where}: row count changed while sorting`).toBe(
                firstValues.length,
            );
            expect([...secondValues].sort(), `${where}: displayed values changed`).toEqual(
                [...firstValues].sort(),
            );

            const allEqual = new Set(firstValues).size <= 1;
            if (allEqual) continue;

            // the column reacts to being sorted at all - catches a header wired
            // to a sort key that does not exist on the data (the row order then
            // silently stays put)
            expect(secondValues, `${where}: sort direction had no effect on the order`).not.toEqual(
                firstValues,
            );

            if (!canReadColumns || (view.looseColumns || []).includes(column.label)) continue;

            // ascending and descending are the two orderings of one multiset,
            // so each must be the exact reverse of the other - true even with
            // ties, and without knowing how the values compare
            expect(
                secondValues,
                `${where}: ascending order is not the reverse of descending`,
            ).toEqual([...firstValues].reverse());
        }
    });
}
