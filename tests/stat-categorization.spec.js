const { test, expect } = require('@playwright/test');
const { checkCondition, categorizeStatsForStatline } = require('../js/stat_categorization.js');

test.describe('checkCondition', () => {
    test.describe('operators', () => {
        const cases = [
            ['greater_equal', 5, 5, true],
            ['greater_equal', 5, 4, false],
            ['less_equal', 5, 5, true],
            ['less_equal', 5, 6, false],
            ['greater', 5, 6, true],
            ['greater', 5, 5, false],
            ['less', 5, 4, true],
            ['less', 5, 5, false],
            ['equal', 5, 5, true],
            ['equal', 5, 4, false],
            ['not_equal', 5, 4, true],
            ['not_equal', 5, 5, false],
        ];
        for (const [operator, value, statValue, expected] of cases) {
            test(`${operator}: ${statValue} vs ${value} -> ${expected}`, () => {
                const condition = { operator, criterion: 'x', value };
                expect(checkCondition(null, condition, { x: statValue })).toBe(expected);
            });
        }

        test('an unrecognized operator returns false', () => {
            const condition = { operator: 'nonsense', criterion: 'x', value: 1 };
            expect(checkCondition(null, condition, { x: 1 })).toBe(false);
        });
    });

    test('a criterion missing from the stats object returns false', () => {
        const condition = { operator: 'greater_equal', criterion: 'missing', value: 1 };
        expect(checkCondition(null, condition, { x: 1 })).toBe(false);
    });

    test('a null stat value returns false even for operators that would otherwise match', () => {
        const condition = { operator: 'equal', criterion: 'x', value: null };
        expect(checkCondition(null, condition, { x: null })).toBe(false);
    });

    test('a plain numeric string value is eval-ed to a number (e.g. "300" from the real config)', () => {
        const condition = { operator: 'less_equal', criterion: 'x', value: '300' };
        expect(checkCondition(null, condition, { x: 300 })).toBe(true);
        expect(checkCondition(null, condition, { x: 301 })).toBe(false);
    });

    test('a $scope-referencing value string (the real quality_starts condition) resolves against the passed-in $scope', () => {
        const condition = {
            operator: 'greater_equal',
            criterion: 'save_pctg',
            value: '$scope.league_data.save_pctg * 100',
        };
        const $scope = { league_data: { save_pctg: 0.9 } };
        expect(checkCondition($scope, condition, { save_pctg: 90 })).toBe(true);
        expect(checkCondition($scope, condition, { save_pctg: 89 })).toBe(false);
    });
});

test.describe('categorizeStatsForStatline', () => {
    test('a single-criterion category increments its counter on a match', () => {
        const filteredStats = {};
        const statsToCategorize = [
            { name: 'big_game', operator: 'greater_equal', criterion: 'goals', value: 2 },
        ];
        categorizeStatsForStatline(statsToCategorize, { goals: 2 }, filteredStats, null);
        expect(filteredStats.big_game).toBe(1);
    });

    test('a single-criterion category does not touch the counter on a non-match', () => {
        const filteredStats = {};
        const statsToCategorize = [
            { name: 'big_game', operator: 'greater_equal', criterion: 'goals', value: 2 },
        ];
        categorizeStatsForStatline(statsToCategorize, { goals: 1 }, filteredStats, null);
        expect(filteredStats.big_game).toBeUndefined();
    });

    test('a matching category accumulates across repeated calls (one per game)', () => {
        const filteredStats = {};
        const statsToCategorize = [
            { name: 'big_game', operator: 'greater_equal', criterion: 'goals', value: 2 },
        ];
        categorizeStatsForStatline(statsToCategorize, { goals: 2 }, filteredStats, null);
        categorizeStatsForStatline(statsToCategorize, { goals: 3 }, filteredStats, null);
        categorizeStatsForStatline(statsToCategorize, { goals: 0 }, filteredStats, null);
        expect(filteredStats.big_game).toBe(2);
    });

    test('a multi-condition category only increments when every condition matches (logical AND)', () => {
        const filteredStats = {};
        const statsToCategorize = [
            {
                name: 'quality_start',
                categories: [
                    { operator: 'greater_equal', criterion: 'save_pctg', value: 90 },
                    { operator: 'equal', criterion: 'games_started', value: 1 },
                ],
            },
        ];
        // only one of the two conditions matches - must not count
        categorizeStatsForStatline(
            statsToCategorize,
            { save_pctg: 95, games_started: 0 },
            filteredStats,
            null,
        );
        expect(filteredStats.quality_start).toBeUndefined();

        // both conditions match - must count
        categorizeStatsForStatline(
            statsToCategorize,
            { save_pctg: 95, games_started: 1 },
            filteredStats,
            null,
        );
        expect(filteredStats.quality_start).toBe(1);
    });

    test('independent categories are tallied independently in the same pass', () => {
        const filteredStats = {};
        const statsToCategorize = [
            { name: 'big_game', operator: 'greater_equal', criterion: 'goals', value: 2 },
            { name: 'shutout', operator: 'equal', criterion: 'goals_against', value: 0 },
        ];
        categorizeStatsForStatline(
            statsToCategorize,
            { goals: 3, goals_against: 0 },
            filteredStats,
            null,
        );
        expect(filteredStats.big_game).toBe(1);
        expect(filteredStats.shutout).toBe(1);
    });
});
