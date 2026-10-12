const { test, expect } = require('@playwright/test');
const {
    deriveWeekdaysPlayed,
    deriveMonthsPlayed,
    deriveRoundsPlayed,
} = require('../js/game_log_metadata.js');

function game(overrides) {
    return Object.assign({ weekday: 'Mi', round: 5, game_date: '2025-10-01' }, overrides);
}

test.describe('deriveWeekdaysPlayed', () => {
    test('dedupes and sorts weekdays', () => {
        const games = [game({ weekday: 'Fr' }), game({ weekday: 'Mi' }), game({ weekday: 'Fr' })];
        expect(deriveWeekdaysPlayed(games)).toEqual(['Fr', 'Mi']);
    });

    test('returns an empty array for no games', () => {
        expect(deriveWeekdaysPlayed([])).toEqual([]);
    });
});

test.describe('deriveMonthsPlayed', () => {
    test('dedupes 0-indexed calendar months, in first-seen order (not sorted)', () => {
        const games = [
            game({ game_date: '2025-11-05' }),
            game({ game_date: '2025-10-20' }),
            game({ game_date: '2025-11-01' }),
        ];
        expect(deriveMonthsPlayed(games)).toEqual([10, 9]);
    });

    test('returns an empty array for no games', () => {
        expect(deriveMonthsPlayed([])).toEqual([]);
    });
});

test.describe('deriveRoundsPlayed', () => {
    test('dedupes, numerically sorts rounds, and reports the max as a string', () => {
        const games = [game({ round: '10' }), game({ round: '2' }), game({ round: '10' })];
        const result = deriveRoundsPlayed(games);
        expect(result.roundsPlayed).toEqual([2, 10]);
        expect(result.toRoundSelect).toBe('10');
    });

    test('sorts numerically, not lexicographically (10 after 2, not before)', () => {
        const games = [game({ round: '2' }), game({ round: '10' })];
        expect(deriveRoundsPlayed(games).roundsPlayed).toEqual([2, 10]);
    });

    test('maxRoundPlayed is the same value as toRoundSelect (the merged deriveMaxRoundPlayed)', () => {
        const games = [game({ round: 5 }), game({ round: 12 }), game({ round: 3 })];
        const result = deriveRoundsPlayed(games);
        expect(result.maxRoundPlayed).toBe('12');
        expect(result.maxRoundPlayed).toBe(result.toRoundSelect);
    });

    test('works with a single game', () => {
        const result = deriveRoundsPlayed([game({ round: 7 })]);
        expect(result.maxRoundPlayed).toBe('7');
        expect(result.roundsPlayed).toEqual([7]);
    });
});
