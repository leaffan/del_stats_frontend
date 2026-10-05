const { test, expect } = require('@playwright/test');
const { filterShots, transformShot, computeStats } = require('../js/shot_filters.js');

// Builds one raw shot record (the shape of data/<season>/shots/per_player/<id>.json)
// with sensible defaults, so each test only has to spell out what it cares about.
function shot(overrides) {
    return Object.assign(
        {
            season_type: 'RS',
            situation: 'EV',
            target_type: 'on_goal',
            scored: false,
            period: 1,
            home_road: 'home',
            opp_team: 'KEC',
            goalie: 100,
            shot_zone: 'SLOT',
            ne_shot_zone: 'LSL',
            game_date: '2025-10-01',
            round: 1,
            po_round: null,
            x: 0,
            y: 0,
            time: 0,
            distance: 10,
            plr_situation: '5v5',
        },
        overrides,
    );
}

const noFilters = {
    seasonType: 'all',
    situation: 'all',
    targetType: 'all',
    period: 'all',
    homeRoad: 'all',
    opp: 'all',
    goalie: 'all',
    zoneFilter: 'all',
    edgeZoneGroups: {},
    fromDate: null,
    toDate: null,
    roundsPlayed: [],
    fromRoundKey: '',
    toRoundKey: '',
};

test.describe('filterShots', () => {
    test('with every filter at "all" and no rounds loaded, returns everything unchanged', () => {
        const shots = [shot({}), shot({ scored: true })];
        const result = filterShots(shots, noFilters);
        expect(result).toEqual(shots);
        expect(result).not.toBe(shots); // slice(), not the same array
    });

    test('does not mutate the input array', () => {
        const shots = [shot({ season_type: 'RS' }), shot({ season_type: 'PO' })];
        filterShots(shots, Object.assign({}, noFilters, { seasonType: 'PO' }));
        expect(shots.length).toBe(2);
    });

    test('seasonType', () => {
        const shots = [shot({ season_type: 'RS' }), shot({ season_type: 'PO' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { seasonType: 'PO' }));
        expect(result.length).toBe(1);
        expect(result[0].season_type).toBe('PO');
    });

    test('situation', () => {
        const shots = [shot({ situation: 'EV' }), shot({ situation: 'PP' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { situation: 'PP' }));
        expect(result.length).toBe(1);
        expect(result[0].situation).toBe('PP');
    });

    test('targetType "goals" filters by the scored flag, not target_type', () => {
        const shots = [
            shot({ scored: true, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'blocked' }),
        ];
        const result = filterShots(shots, Object.assign({}, noFilters, { targetType: 'goals' }));
        expect(result.length).toBe(1);
        expect(result[0].scored).toBe(true);
    });

    test('targetType with a concrete value filters by target_type', () => {
        const shots = [shot({ target_type: 'blocked' }), shot({ target_type: 'missed' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { targetType: 'blocked' }));
        expect(result.length).toBe(1);
        expect(result[0].target_type).toBe('blocked');
    });

    test('period compares loosely, so a numeric filter value matches a numeric field', () => {
        const shots = [shot({ period: 1 }), shot({ period: 2 }), shot({ period: 'OT' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { period: '2' }));
        expect(result.length).toBe(1);
        expect(result[0].period).toBe(2);
    });

    test('homeRoad', () => {
        const shots = [shot({ home_road: 'home' }), shot({ home_road: 'road' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { homeRoad: 'road' }));
        expect(result.length).toBe(1);
        expect(result[0].home_road).toBe('road');
    });

    test('opp', () => {
        const shots = [shot({ opp_team: 'KEC' }), shot({ opp_team: 'RBM' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { opp: 'RBM' }));
        expect(result.length).toBe(1);
        expect(result[0].opp_team).toBe('RBM');
    });

    test('goalie "empty_net" matches a null or undefined goalie', () => {
        const shots = [shot({ goalie: null }), shot({ goalie: undefined }), shot({ goalie: 100 })];
        const result = filterShots(shots, Object.assign({}, noFilters, { goalie: 'empty_net' }));
        expect(result.length).toBe(2);
    });

    test('goalie with a concrete id compares loosely (string filter, numeric field)', () => {
        const shots = [shot({ goalie: 100 }), shot({ goalie: 200 })];
        const result = filterShots(shots, Object.assign({}, noFilters, { goalie: '100' }));
        expect(result.length).toBe(1);
        expect(result[0].goalie).toBe(100);
    });

    test('zoneFilter "es:" matches a single DEL zone', () => {
        const shots = [shot({ shot_zone: 'SLOT' }), shot({ shot_zone: 'LEFT' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { zoneFilter: 'es:SLOT' }));
        expect(result.length).toBe(1);
        expect(result[0].shot_zone).toBe('SLOT');
    });

    test('zoneFilter "edge:" matches every code in that Edge group', () => {
        const shots = [
            shot({ ne_shot_zone: 'LCN' }),
            shot({ ne_shot_zone: 'LOS' }),
            shot({ ne_shot_zone: 'RCN' }),
        ];
        const result = filterShots(
            shots,
            Object.assign({}, noFilters, {
                zoneFilter: 'edge:left',
                edgeZoneGroups: { left: ['LCN', 'LNS', 'LCI', 'LOS'] },
            }),
        );
        expect(result.length).toBe(2);
    });

    test('zoneFilter "ne:" matches a single Edge zone', () => {
        const shots = [shot({ ne_shot_zone: 'LSL' }), shot({ ne_shot_zone: 'HSL' })];
        const result = filterShots(shots, Object.assign({}, noFilters, { zoneFilter: 'ne:LSL' }));
        expect(result.length).toBe(1);
        expect(result[0].ne_shot_zone).toBe('LSL');
    });

    test('date range: fromDate, toDate, and both together are inclusive', () => {
        const shots = [
            shot({ game_date: '2025-10-01' }),
            shot({ game_date: '2025-11-01' }),
            shot({ game_date: '2025-12-01' }),
        ];
        expect(
            filterShots(shots, Object.assign({}, noFilters, { fromDate: '2025-11-01' })).length,
        ).toBe(2);
        expect(
            filterShots(shots, Object.assign({}, noFilters, { toDate: '2025-11-01' })).length,
        ).toBe(2);
        expect(
            filterShots(
                shots,
                Object.assign({}, noFilters, { fromDate: '2025-11-01', toDate: '2025-11-01' }),
            ).length,
        ).toBe(1);
    });

    test('round range narrows to the selected slice of roundsPlayed', () => {
        const roundsPlayed = [
            { round: 1, po_round: null, key: '1|' },
            { round: 2, po_round: null, key: '2|' },
            { round: 3, po_round: null, key: '3|' },
        ];
        const shots = [
            shot({ round: 1, po_round: null }),
            shot({ round: 2, po_round: null }),
            shot({ round: 3, po_round: null }),
        ];
        const result = filterShots(
            shots,
            Object.assign({}, noFilters, {
                roundsPlayed: roundsPlayed,
                fromRoundKey: '2|',
                toRoundKey: '2|',
            }),
        );
        expect(result.length).toBe(1);
        expect(result[0].round).toBe(2);
    });

    test('an unresolvable round key falls back to that end of the full range', () => {
        const roundsPlayed = [
            { round: 1, po_round: null, key: '1|' },
            { round: 2, po_round: null, key: '2|' },
        ];
        const shots = [shot({ round: 1, po_round: null }), shot({ round: 2, po_round: null })];
        const result = filterShots(
            shots,
            Object.assign({}, noFilters, {
                roundsPlayed: roundsPlayed,
                fromRoundKey: 'does-not-exist',
                toRoundKey: 'does-not-exist',
            }),
        );
        expect(result.length).toBe(2);
    });

    test('an empty roundsPlayed list (e.g. season 2017) skips the round filter entirely', () => {
        const shots = [shot({ round: 1 }), shot({ round: 99 })];
        const result = filterShots(
            shots,
            Object.assign({}, noFilters, {
                roundsPlayed: [],
                fromRoundKey: '1|',
                toRoundKey: '1|',
            }),
        );
        expect(result.length).toBe(2);
    });

    test('combines multiple filters (AND, not OR)', () => {
        const shots = [
            shot({ season_type: 'RS', home_road: 'home' }),
            shot({ season_type: 'RS', home_road: 'road' }),
            shot({ season_type: 'PO', home_road: 'home' }),
        ];
        const result = filterShots(
            shots,
            Object.assign({}, noFilters, { seasonType: 'RS', homeRoad: 'home' }),
        );
        expect(result.length).toBe(1);
    });
});

const noContext = {
    goalieShortNameById: {},
    goalieLastNameById: {},
    delZoneLabels: {},
    targetTypeLabels: {},
};

test.describe('transformShot', () => {
    test('mirrors a home shot to attack left, and keeps a road shot as-is', () => {
        const home = transformShot(shot({ home_road: 'home', x: 10, y: 5 }), noContext);
        expect(home.svg_x).toBe(60 - 10 * 2);
        expect(home.svg_y).toBe(30 + 5 * 2);

        const road = transformShot(shot({ home_road: 'road', x: 10, y: 5 }), noContext);
        expect(road.svg_x).toBe(60 + 10 * 2);
        expect(road.svg_y).toBe(30 - 5 * 2);
    });

    test('time_str formats seconds as m:ss, zero-padded', () => {
        expect(transformShot(shot({ time: 65 }), noContext).time_str).toBe('1:05');
        expect(transformShot(shot({ time: 5 }), noContext).time_str).toBe('0:05');
        expect(transformShot(shot({ time: 600 }), noContext).time_str).toBe('10:00');
    });

    test('dotColor: goal, on-goal, blocked, and missed each get their own color', () => {
        expect(transformShot(shot({ scored: true }), noContext).dotColor).toBe('#1a1a1a');
        expect(
            transformShot(shot({ scored: false, target_type: 'on_goal' }), noContext).dotColor,
        ).toBe('#2980b9');
        expect(
            transformShot(shot({ scored: false, target_type: 'blocked' }), noContext).dotColor,
        ).toBe('#f39c12');
        expect(
            transformShot(shot({ scored: false, target_type: 'missed' }), noContext).dotColor,
        ).toBe('transparent');
    });

    test('tooltip: a goal always reads "Tor", regardless of target_type', () => {
        const context = {
            goalieShortNameById: {},
            goalieLastNameById: {},
            delZoneLabels: { SLOT: 'Slot' },
            targetTypeLabels: { on_goal: 'Torschuss', blocked: 'geblockt', missed: 'daneben' },
        };
        const tooltip = transformShot(
            shot({
                scored: true,
                shot_zone: 'SLOT',
                distance: 19.6,
                period: 2,
                situation: 'PP',
                home_road: 'home',
            }),
            context,
        ).tooltip;
        expect(tooltip).toBe('Tor | Slot | 19.6 m | P2 | PP | home');
    });

    test('tooltip: a non-scored shot uses targetTypeLabels', () => {
        const context = {
            goalieShortNameById: {},
            goalieLastNameById: {},
            delZoneLabels: { SLOT: 'Slot' },
            targetTypeLabels: { on_goal: 'Torschuss', blocked: 'geblockt', missed: 'daneben' },
        };
        expect(
            transformShot(
                shot({ scored: false, target_type: 'blocked', shot_zone: 'SLOT' }),
                context,
            ).tooltip,
        ).toContain('geblockt | Slot | ');
    });

    test('tooltip: an unknown shot_zone falls back to the raw code', () => {
        const result = transformShot(shot({ shot_zone: 'NOT_A_REAL_ZONE' }), noContext);
        expect(result.tooltip).toContain('NOT_A_REAL_ZONE');
    });

    test('goalie_name/goalie_last_name: null or undefined goalie means an empty net', () => {
        expect(transformShot(shot({ goalie: null }), noContext).goalie_name).toBe('Leeres Tor');
        expect(transformShot(shot({ goalie: undefined }), noContext).goalie_last_name).toBe(
            'Leeres Tor',
        );
    });

    test('goalie_name/goalie_last_name resolve via the lookup maps when the goalie is known', () => {
        const context = Object.assign({}, noContext, {
            goalieShortNameById: { 100: 'M. Mustermann' },
            goalieLastNameById: { 100: 'Mustermann' },
        });
        const result = transformShot(shot({ goalie: 100 }), context);
        expect(result.goalie_name).toBe('M. Mustermann');
        expect(result.goalie_last_name).toBe('Mustermann');
    });

    test('an unresolvable goalie id falls back to a generic "Torhüter <id>" label', () => {
        const result = transformShot(shot({ goalie: 999 }), noContext);
        expect(result.goalie_name).toBe('Torhüter 999');
        expect(result.goalie_last_name).toBe('Torhüter 999');
    });
});

test.describe('computeStats', () => {
    test('an empty or missing shot list returns null', () => {
        expect(computeStats([])).toBeNull();
        expect(computeStats(null)).toBeNull();
        expect(computeStats(undefined)).toBeNull();
    });

    test('counts goals/on_goal/blocked/missed independently', () => {
        const shots = [
            shot({ scored: true, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'blocked' }),
            shot({ scored: false, target_type: 'blocked' }),
            shot({ scored: false, target_type: 'missed' }),
        ];
        const stats = computeStats(shots);
        expect(stats.total).toBe(5);
        expect(stats.goals).toBe(1);
        expect(stats.on_goal).toBe(2); // includes the goal itself, same as the real data shape
        expect(stats.blocked).toBe(2);
        expect(stats.missed).toBe(1);
    });

    test('shooting_pct is goals over shots-on-goal, not goals over every attempt', () => {
        const shots = [
            shot({ scored: true, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'on_goal' }),
            shot({ scored: false, target_type: 'blocked' }),
            shot({ scored: false, target_type: 'blocked' }),
        ];
        // 1 goal / 2 shots-on-goal = 50%, not 1 / 4 attempts = 25%
        expect(computeStats(shots).shooting_pct).toBe('50.0');
    });

    test('shooting_pct is "0.0", not NaN, when there are no shots on goal at all', () => {
        const shots = [shot({ scored: false, target_type: 'blocked' })];
        expect(computeStats(shots).shooting_pct).toBe('0.0');
    });

    test('avg_distance averages the distance field to one decimal', () => {
        const shots = [shot({ distance: 10 }), shot({ distance: 20 }), shot({ distance: 15 })];
        expect(computeStats(shots).avg_distance).toBe('15.0');
    });
});
