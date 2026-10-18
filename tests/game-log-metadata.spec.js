const { test, expect } = require('@playwright/test');
const {
    deriveWeekdaysPlayed,
    deriveMonthsPlayed,
    deriveRoundsPlayed,
    deriveRoundSelection,
    normalizedPoRound,
} = require('../js/game_log_metadata.js');

function game(overrides) {
    return Object.assign(
        { weekday: 'Mi', round: 5, season_type: 'RS', game_date: '2025-10-01' },
        overrides,
    );
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

test.describe('normalizedPoRound', () => {
    test('passes through a real stage name unchanged', () => {
        expect(normalizedPoRound('quarter_finals')).toBe('quarter_finals');
    });

    test('treats the literal string "rnd_type" (a known pipeline bug) as absent', () => {
        expect(normalizedPoRound('rnd_type')).toBeNull();
    });

    test('treats null/undefined/empty-string as absent', () => {
        expect(normalizedPoRound(null)).toBeNull();
        expect(normalizedPoRound(undefined)).toBeNull();
        expect(normalizedPoRound('')).toBeNull();
    });
});

test.describe('deriveRoundSelection', () => {
    test('dedupes by composite round + season_type + po_round key, sorted MSC, RS, then PO', () => {
        const games = [
            game({ round: 2, season_type: 'RS' }),
            game({ round: 1, season_type: 'RS' }),
            game({ round: 1, season_type: 'MSC' }),
            game({ round: 1, season_type: 'PO', po_round: 'quarter_finals' }),
        ];
        expect(deriveRoundSelection(games).roundsPlayed).toEqual([
            { round: 1, season_type: 'MSC', po_round: null, key: '1|MSC|' },
            { round: 1, season_type: 'RS', po_round: null, key: '1|RS|' },
            { round: 2, season_type: 'RS', po_round: null, key: '2|RS|' },
            { round: 1, season_type: 'PO', po_round: 'quarter_finals', key: '1|PO|quarter_finals' },
        ]);
    });

    test('an RS round and a PO round sharing a number stay distinct even with no po_round data at all', () => {
        const games = [
            game({ round: 1, season_type: 'RS' }),
            game({ round: 1, season_type: 'PO' }),
        ];
        expect(deriveRoundSelection(games).roundsPlayed).toEqual([
            { round: 1, season_type: 'RS', po_round: null, key: '1|RS|' },
            { round: 1, season_type: 'PO', po_round: null, key: '1|PO|' },
        ]);
    });

    test('playoff stages sort in tournament order (first_round, quarter_finals, semi_finals, finals), not alphabetically', () => {
        const games = [
            game({ round: 1, season_type: 'PO', po_round: 'finals' }),
            game({ round: 1, season_type: 'PO', po_round: 'semi_finals' }),
            game({ round: 1, season_type: 'PO', po_round: 'first_round' }),
            game({ round: 1, season_type: 'PO', po_round: 'quarter_finals' }),
        ];
        expect(deriveRoundSelection(games).roundsPlayed.map((r) => r.po_round)).toEqual([
            'first_round',
            'quarter_finals',
            'semi_finals',
            'finals',
        ]);
    });

    test('an unrecognized po_round value sorts after the known stages instead of crashing', () => {
        const games = [
            game({ round: 1, season_type: 'PO', po_round: 'finals' }),
            game({ round: 1, season_type: 'PO', po_round: 'some_future_stage' }),
        ];
        expect(deriveRoundSelection(games).roundsPlayed.map((r) => r.po_round)).toEqual([
            'finals',
            'some_future_stage',
        ]);
    });

    test('games with a falsy round are excluded', () => {
        const games = [game({ round: 0 }), game({ round: null }), game({ round: 1 })];
        expect(deriveRoundSelection(games).roundsPlayed).toEqual([
            { round: 1, season_type: 'RS', po_round: null, key: '1|RS|' },
        ]);
    });

    test('fromRoundSelect/toRoundSelect fall back to "1|RS|"/"52|RS|" for an empty list', () => {
        const result = deriveRoundSelection([]);
        expect(result.fromRoundSelect).toBe('1|RS|');
        expect(result.toRoundSelect).toBe('52|RS|');
    });

    test('fromRoundSelect/toRoundSelect are the first/last entries in sorted order', () => {
        const games = [
            game({ round: 3, season_type: 'RS' }),
            game({ round: 1, season_type: 'PO', po_round: 'finals' }),
            game({ round: 2, season_type: 'MSC' }),
        ];
        const result = deriveRoundSelection(games);
        expect(result.fromRoundSelect).toBe('2|MSC|');
        expect(result.toRoundSelect).toBe('1|PO|finals');
    });

    test('works on per-shot records too, not just per-game stat lines (only reads round/season_type/po_round)', () => {
        const shots = [
            { round: 1, season_type: 'RS', shot_zone: 'SLOT' },
            { round: 1, season_type: 'RS', shot_zone: 'POINT' },
        ];
        expect(deriveRoundSelection(shots).roundsPlayed).toEqual([
            { round: 1, season_type: 'RS', po_round: null, key: '1|RS|' },
        ]);
    });
});
