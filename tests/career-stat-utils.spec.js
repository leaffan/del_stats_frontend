const { test, expect } = require('@playwright/test');
const { prepareSingleSeasonStatline, sumIntoTarget } = require('../js/career_stat_utils.js');

function preparedPlayer(overrides) {
    return Object.assign(
        {
            player_id: 100,
            first_name: 'Max',
            last_name: 'Mustermann',
            position: 'DE',
            country: ['GER'],
            first_season: 2018,
            last_season: 2026,
        },
        overrides,
    );
}

test.describe('prepareSingleSeasonStatline', () => {
    test('fills in season, age, and team info from the first season entry', () => {
        const stats = [
            { season: 2025, season_type: 'RS', age: 25.5, team: 'KEV' },
            { season: 2025, season_type: 'RS', age: 25.5, team: 'KEV' },
        ];
        const result = prepareSingleSeasonStatline(preparedPlayer(), stats, 0);
        expect(result.season).toBe(2025);
        expect(result.season_type).toBe('RS');
        expect(result.age).toBe(25.5);
        expect(result.teams).toEqual(['KEV']);
        expect(result.teams_cnt).toBe(1);
    });

    test('dedupes multiple teams played for in the same season', () => {
        const stats = [
            { season: 2025, season_type: 'RS', age: 25, team: 'KEV' },
            { season: 2025, season_type: 'RS', age: 25, team: 'KEV' },
            { season: 2025, season_type: 'RS', age: 25, team: 'EBB' },
        ];
        const result = prepareSingleSeasonStatline(preparedPlayer(), stats, 0);
        expect(result.teams.sort()).toEqual(['EBB', 'KEV']);
        expect(result.teams_cnt).toBe(2);
    });

    test('championships is a 0/1 flag, not the raw count', () => {
        const stats = [{ season: 2025, season_type: 'RS', age: 25, team: 'KEV' }];
        expect(prepareSingleSeasonStatline(preparedPlayer(), stats, 0).championships).toBe(0);
        expect(prepareSingleSeasonStatline(preparedPlayer(), stats, 1).championships).toBe(1);
        expect(prepareSingleSeasonStatline(preparedPlayer(), stats, 2).championships).toBe(1);
    });

    test('season_type is "ALL" when combined is true, regardless of the underlying entries', () => {
        const stats = [
            { season: 2025, season_type: 'RS', age: 25, team: 'KEV' },
            { season: 2025, season_type: 'PO', age: 25, team: 'KEV' },
        ];
        const result = prepareSingleSeasonStatline(preparedPlayer(), stats, 0, true);
        expect(result.season_type).toBe('ALL');
    });

    test('mutates and returns the same object it was given (callers must pass a fresh preparePlayer() result per call)', () => {
        const player = preparedPlayer();
        const stats = [{ season: 2025, season_type: 'RS', age: 25, team: 'KEV' }];
        const result = prepareSingleSeasonStatline(player, stats, 0);
        expect(result).toBe(player);
    });
});

test.describe('sumIntoTarget', () => {
    test('sums numeric fields from every object in the array into the target', () => {
        const target = {};
        sumIntoTarget(
            [
                { goals: 10, assists: 20 },
                { goals: 5, assists: 3 },
            ],
            target,
            [],
        );
        expect(target.goals).toBe(15);
        expect(target.assists).toBe(23);
    });

    test('adds onto a target that already has values (accumulates, does not overwrite)', () => {
        const target = { goals: 100 };
        sumIntoTarget([{ goals: 10 }], target, []);
        expect(target.goals).toBe(110);
    });

    test('skips keys named in attrsToIgnore', () => {
        const target = {};
        sumIntoTarget([{ goals: 10, season: 2025 }], target, ['season']);
        expect(target.goals).toBe(10);
        expect(target.season).toBeUndefined();
    });

    test('skips non-numeric fields entirely, ignored or not', () => {
        const target = {};
        sumIntoTarget([{ goals: 10, team: 'KEV', teams: ['KEV'] }], target, []);
        expect(target.goals).toBe(10);
        expect(target.team).toBeUndefined();
        expect(target.teams).toBeUndefined();
    });

    test('an empty array leaves the target untouched', () => {
        const target = { goals: 5 };
        sumIntoTarget([], target, []);
        expect(target).toEqual({ goals: 5 });
    });
});
