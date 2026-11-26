const { test, expect } = require('@playwright/test');
const { gamePassesCommonFilters } = require('../js/game_filters.js');
const { roundKeyOf } = require('../js/game_log_metadata.js');

// Builds one raw per-game stat-line record (the shape of a row from
// data/<season>/del_player_game_stats.csv or del_team_game_stats.csv) with
// sensible defaults, so each test only has to spell out what it cares about.
function game(overrides) {
    return Object.assign(
        {
            game_date: '2025-10-15',
            home_road: 'home',
            weekday: 'Mi',
            round: 5,
            season_type: 'RS',
            games_back: 3,
        },
        overrides,
    );
}

function noFilters(overrides) {
    return Object.assign(
        {
            fromDate: null,
            toDate: null,
            homeAwaySelect: null,
            weekdaySelect: null,
            validRoundKeys: null,
            gamesBackSelect: null,
        },
        overrides,
    );
}

test.describe('gamePassesCommonFilters', () => {
    test('passes everything when no filter is set', () => {
        expect(gamePassesCommonFilters(game(), noFilters())).toBe(true);
    });

    test.describe('date range', () => {
        test('fromDate/toDate are inclusive on both ends', () => {
            const g = game({ game_date: '2025-10-15' });
            expect(
                gamePassesCommonFilters(
                    g,
                    noFilters({ fromDate: '2025-10-15', toDate: '2025-10-15' }),
                ),
            ).toBe(true);
        });

        test('rejects a game before fromDate', () => {
            const g = game({ game_date: '2025-10-14' });
            expect(gamePassesCommonFilters(g, noFilters({ fromDate: '2025-10-15' }))).toBe(false);
        });

        test('rejects a game after toDate', () => {
            const g = game({ game_date: '2025-10-16' });
            expect(gamePassesCommonFilters(g, noFilters({ toDate: '2025-10-15' }))).toBe(false);
        });
    });

    test.describe('home/away', () => {
        test('matches the selected side', () => {
            expect(
                gamePassesCommonFilters(
                    game({ home_road: 'road' }),
                    noFilters({ homeAwaySelect: 'road' }),
                ),
            ).toBe(true);
        });

        test('rejects the other side', () => {
            expect(
                gamePassesCommonFilters(
                    game({ home_road: 'home' }),
                    noFilters({ homeAwaySelect: 'road' }),
                ),
            ).toBe(false);
        });
    });

    test.describe('weekday', () => {
        test('loose-equality matches a numeric-vs-string weekday selection', () => {
            expect(
                gamePassesCommonFilters(game({ weekday: 3 }), noFilters({ weekdaySelect: '3' })),
            ).toBe(true);
        });

        test('rejects a different weekday', () => {
            expect(
                gamePassesCommonFilters(
                    game({ weekday: 'Mi' }),
                    noFilters({ weekdaySelect: 'Fr' }),
                ),
            ).toBe(false);
        });
    });

    test.describe('round range', () => {
        test('a validRoundKeys Set containing the element round key passes', () => {
            const g = game({ round: 5 });
            const validRoundKeys = new Set([roundKeyOf(g)]);
            expect(gamePassesCommonFilters(g, noFilters({ validRoundKeys: validRoundKeys }))).toBe(
                true,
            );
        });

        test('rejects a round whose key is not in validRoundKeys', () => {
            const validRoundKeys = new Set([roundKeyOf(game({ round: 5 }))]);
            expect(
                gamePassesCommonFilters(
                    game({ round: 4 }),
                    noFilters({ validRoundKeys: validRoundKeys }),
                ),
            ).toBe(false);
        });

        test('a null validRoundKeys skips the round filter entirely (full range selected)', () => {
            expect(
                gamePassesCommonFilters(game({ round: 999 }), noFilters({ validRoundKeys: null })),
            ).toBe(true);
        });

        test('a round sharing a number with a different season_type is rejected unless its own key is included', () => {
            const validRoundKeys = new Set([roundKeyOf(game({ round: 1, season_type: 'RS' }))]);
            expect(
                gamePassesCommonFilters(
                    game({ round: 1, season_type: 'PO' }),
                    noFilters({ validRoundKeys: validRoundKeys }),
                ),
            ).toBe(false);
        });
    });

    test.describe('games back', () => {
        test('gamesBackSelect is inclusive', () => {
            expect(
                gamePassesCommonFilters(game({ games_back: 3 }), noFilters({ gamesBackSelect: 3 })),
            ).toBe(true);
        });

        test('rejects a game further back than gamesBackSelect', () => {
            expect(
                gamePassesCommonFilters(game({ games_back: 4 }), noFilters({ gamesBackSelect: 3 })),
            ).toBe(false);
        });
    });

    test('all criteria are ANDed - one mismatch fails the whole predicate', () => {
        const g = game({ home_road: 'home', round: 5 });
        const validRoundKeys = new Set([roundKeyOf(game({ round: 10 }))]);
        const filters = noFilters({ homeAwaySelect: 'home', validRoundKeys: validRoundKeys });
        expect(gamePassesCommonFilters(g, filters)).toBe(false);
    });
});
