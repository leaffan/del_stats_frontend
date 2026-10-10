const { test, expect } = require('@playwright/test');
const {
    deriveWeekdaysPlayed,
    deriveRoundsPlayed,
    deriveMaxRoundPlayed,
} = require('../js/game_log_metadata.js');

function game(overrides) {
    return Object.assign({ weekday: 'Mi', round: 5 }, overrides);
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
});

test.describe('deriveMaxRoundPlayed', () => {
    test('returns the maximum raw round value as a string', () => {
        const games = [game({ round: 5 }), game({ round: 12 }), game({ round: 3 })];
        expect(deriveMaxRoundPlayed(games)).toBe('12');
    });

    test('works with a single game', () => {
        expect(deriveMaxRoundPlayed([game({ round: 7 })])).toBe('7');
    });
});
