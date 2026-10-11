const { test, expect } = require('@playwright/test');
const { gamePassesCommonFilters } = require('../js/game_filters.js');

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
            fromRoundSelect: null,
            toRoundSelect: null,
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
        test('fromRoundSelect/toRoundSelect are inclusive on both ends', () => {
            expect(
                gamePassesCommonFilters(
                    game({ round: 5 }),
                    noFilters({ fromRoundSelect: '5', toRoundSelect: '5' }),
                ),
            ).toBe(true);
        });

        test('rejects a round before fromRoundSelect', () => {
            expect(
                gamePassesCommonFilters(game({ round: 4 }), noFilters({ fromRoundSelect: '5' })),
            ).toBe(false);
        });

        test('rejects a round after toRoundSelect', () => {
            expect(
                gamePassesCommonFilters(game({ round: 6 }), noFilters({ toRoundSelect: '5' })),
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
        const filters = noFilters({ homeAwaySelect: 'home', fromRoundSelect: '10' });
        expect(gamePassesCommonFilters(g, filters)).toBe(false);
    });
});
