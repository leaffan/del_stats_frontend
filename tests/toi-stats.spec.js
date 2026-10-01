const { test, expect } = require('@playwright/test');
const {
    TOI_TIE_BREAKS,
    TOI_COLUMNS,
    getPartnerStats,
    getSortedToiStats,
    getHeatStyle,
} = require('../js/toi_stats.js');

// These pin down the behaviour the toi_teammates/toi_opponents tables rely on today, including
// their quirks (e.g. a partner with zero games surviving every filter is dropped entirely, a
// missing game_id is silently skipped rather than throwing). Raw TOI rows follow the real data
// shape: [game_id, toi, toi_5v5, toi_4v4, toi_3v3, toi_5v4, toi_4v5, toi_5v3, toi_3v5, toi_4v3,
// toi_3v4, toi_6v5, toi_5v6, toi_6v4, toi_4v6].
const COLUMNS = [
    'game_id',
    'toi',
    'toi_5v5',
    'toi_4v4',
    'toi_3v3',
    'toi_5v4',
    'toi_4v5',
    'toi_5v3',
    'toi_3v5',
    'toi_4v3',
    'toi_3v4',
    'toi_6v5',
    'toi_5v6',
    'toi_6v4',
    'toi_4v6',
];

// builds one raw row with everything zeroed except the named columns, so each test only has to
// spell out the values it actually cares about
function row(overrides) {
    const base = COLUMNS.map(() => 0);
    Object.keys(overrides).forEach((key) => {
        base[COLUMNS.indexOf(key)] = overrides[key];
    });
    return base;
}

const CONTEXT_1 = { game_id: 1, home_road: 'home', opp_team: 'KEV', season_type: 'RS', round: 5 };
const CONTEXT_2 = { game_id: 2, home_road: 'road', opp_team: 'EBB', season_type: 'RS', round: 6 };

const PLAYERS = {
    100: {
        full_name: 'Marcus Weber',
        last_name: 'Weber',
        first_name: 'Marcus',
        position: 'DE',
        team: 'NIT',
    },
    200: {
        full_name: 'Jean-Luc Foudy',
        last_name: 'Foudy',
        first_name: 'Jean-Luc',
        position: 'FO',
        team: 'EBB',
    },
};

const TEAM_LOCATIONS = { NIT: 'Nürnberg', EBB: 'Straubing' };

const ALWAYS_PASS = () => true;

test.describe('getPartnerStats', () => {
    test('returns an empty array when any required input is missing', () => {
        const toiRaw = { columns: COLUMNS, others: { 100: [row({ game_id: 1, toi: 60 })] } };
        const contextById = { 1: CONTEXT_1 };
        expect(getPartnerStats(null, contextById, PLAYERS, TEAM_LOCATIONS, ALWAYS_PASS)).toEqual(
            [],
        );
        expect(getPartnerStats(toiRaw, null, PLAYERS, TEAM_LOCATIONS, ALWAYS_PASS)).toEqual([]);
        expect(getPartnerStats(toiRaw, contextById, null, TEAM_LOCATIONS, ALWAYS_PASS)).toEqual([]);
        expect(getPartnerStats(toiRaw, contextById, PLAYERS, null, ALWAYS_PASS)).toEqual([]);
    });

    test('sums shared TOI across games for one partner, including the PP/SH aggregates', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: {
                100: [
                    row({
                        game_id: 1,
                        toi: 500,
                        toi_5v5: 400,
                        toi_3v3: 10,
                        toi_5v4: 50,
                        toi_4v3: 5,
                        toi_5v3: 5,
                        toi_4v5: 20,
                        toi_3v4: 5,
                        toi_3v5: 5,
                    }),
                    row({
                        game_id: 2,
                        toi: 300,
                        toi_5v5: 250,
                        toi_3v3: 0,
                        toi_5v4: 20,
                        toi_4v3: 0,
                        toi_5v3: 0,
                        toi_4v5: 10,
                        toi_3v4: 0,
                        toi_3v5: 0,
                    }),
                ],
            },
        };
        const contextById = { 1: CONTEXT_1, 2: CONTEXT_2 };
        const [partner] = getPartnerStats(
            toiRaw,
            contextById,
            PLAYERS,
            TEAM_LOCATIONS,
            ALWAYS_PASS,
        );

        expect(partner.player_id).toBe('100');
        expect(partner.full_name).toBe('Marcus Weber');
        expect(partner.position).toBe('D');
        expect(partner.team_location).toBe('Nürnberg');
        expect(partner.games_together).toBe(2);
        expect(partner.toi).toBe(800);
        expect(partner.toi_5v5).toBe(650);
        expect(partner.toi_3v3).toBe(10);
        // PP = toi_5v4 + toi_4v3 + toi_5v3, summed across both games: (50+5+5) + (20+0+0)
        expect(partner.toi_pp).toBe(80);
        // SH = toi_4v5 + toi_3v4 + toi_3v5, summed across both games: (20+5+5) + (10+0+0)
        expect(partner.toi_sh).toBe(40);
        expect(partner.toi_5v4).toBe(70);
        expect(partner.toi_4v5).toBe(30);
    });

    test('maps DE/FO to D/F and passes through any other position unchanged', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: { 100: [row({ game_id: 1, toi: 60 })], 200: [row({ game_id: 1, toi: 60 })] },
        };
        const contextById = { 1: CONTEXT_1 };
        const players = {
            ...PLAYERS,
            300: {
                full_name: 'Someone Else',
                last_name: 'Else',
                first_name: 'Someone',
                position: 'GK',
                team: 'NIT',
            },
        };
        const toiRaw2 = { columns: COLUMNS, others: { 300: [row({ game_id: 1, toi: 60 })] } };

        const result = getPartnerStats(toiRaw, contextById, players, TEAM_LOCATIONS, ALWAYS_PASS);
        expect(result.find((p) => p.player_id === '100').position).toBe('D');
        expect(result.find((p) => p.player_id === '200').position).toBe('F');

        const goalieResult = getPartnerStats(
            toiRaw2,
            contextById,
            players,
            TEAM_LOCATIONS,
            ALWAYS_PASS,
        );
        expect(goalieResult[0].position).toBe('GK');
    });

    test('a partner with no entry in playersById still appears, with their raw id as the name and an empty team', () => {
        const toiRaw = { columns: COLUMNS, others: { 999: [row({ game_id: 1, toi: 60 })] } };
        const contextById = { 1: CONTEXT_1 };
        const [partner] = getPartnerStats(
            toiRaw,
            contextById,
            PLAYERS,
            TEAM_LOCATIONS,
            ALWAYS_PASS,
        );
        expect(partner.full_name).toBe('999');
        expect(partner.last_name).toBe('999');
        expect(partner.team).toBe('');
        expect(partner.team_location).toBe('');
    });

    test('falls back to the raw team abbreviation when it has no entry in teamLocationLookup', () => {
        const toiRaw = { columns: COLUMNS, others: { 100: [row({ game_id: 1, toi: 60 })] } };
        const contextById = { 1: CONTEXT_1 };
        const [partner] = getPartnerStats(toiRaw, contextById, PLAYERS, {}, ALWAYS_PASS);
        expect(partner.team_location).toBe('NIT');
    });

    test('a row whose game_id has no matching context is silently skipped', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: { 100: [row({ game_id: 1, toi: 60 }), row({ game_id: 999, toi: 999999 })] },
        };
        const contextById = { 1: CONTEXT_1 };
        const [partner] = getPartnerStats(
            toiRaw,
            contextById,
            PLAYERS,
            TEAM_LOCATIONS,
            ALWAYS_PASS,
        );
        expect(partner.games_together).toBe(1);
        expect(partner.toi).toBe(60);
    });

    test('a partner whose every shared game is filtered out does not appear at all', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: { 100: [row({ game_id: 1, toi: 60 }), row({ game_id: 2, toi: 60 })] },
        };
        const contextById = { 1: CONTEXT_1, 2: CONTEXT_2 };
        const result = getPartnerStats(toiRaw, contextById, PLAYERS, TEAM_LOCATIONS, () => false);
        expect(result).toEqual([]);
    });

    test('applies the given game filter per shared game, not just per partner', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: { 100: [row({ game_id: 1, toi: 60 }), row({ game_id: 2, toi: 90 })] },
        };
        const contextById = { 1: CONTEXT_1, 2: CONTEXT_2 };
        // only count home games
        const [partner] = getPartnerStats(
            toiRaw,
            contextById,
            PLAYERS,
            TEAM_LOCATIONS,
            (ctx) => ctx.home_road === 'home',
        );
        expect(partner.games_together).toBe(1);
        expect(partner.toi).toBe(60);
    });

    test('defaults to counting every resolvable game when no filter is given', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: { 100: [row({ game_id: 1, toi: 60 }), row({ game_id: 2, toi: 90 })] },
        };
        const contextById = { 1: CONTEXT_1, 2: CONTEXT_2 };
        const [partner] = getPartnerStats(toiRaw, contextById, PLAYERS, TEAM_LOCATIONS);
        expect(partner.games_together).toBe(2);
        expect(partner.toi).toBe(150);
    });

    test('aggregates independently per partner', () => {
        const toiRaw = {
            columns: COLUMNS,
            others: {
                100: [row({ game_id: 1, toi: 60 })],
                200: [row({ game_id: 1, toi: 30 }), row({ game_id: 2, toi: 40 })],
            },
        };
        const contextById = { 1: CONTEXT_1, 2: CONTEXT_2 };
        const result = getPartnerStats(toiRaw, contextById, PLAYERS, TEAM_LOCATIONS, ALWAYS_PASS);
        expect(result).toHaveLength(2);
        expect(result.find((p) => p.player_id === '100').toi).toBe(60);
        expect(result.find((p) => p.player_id === '200').toi).toBe(70);
        expect(result.find((p) => p.player_id === '200').games_together).toBe(2);
    });
});

test.describe('getSortedToiStats', () => {
    // unique games_together values on purpose, so these direction tests aren't accidentally
    // also exercising the tie-break (that gets its own dedicated fixture/tests below)
    const rows = [
        { player_id: 'a', games_together: 10, toi: 500 },
        { player_id: 'b', games_together: 20, toi: 800 },
        { player_id: 'c', games_together: 5, toi: 100 },
    ];

    test('sorts descending by the primary criterion', () => {
        const sorted = getSortedToiStats(rows, 'games_together', true);
        expect(sorted.map((r) => r.player_id)).toEqual(['b', 'a', 'c']);
    });

    test('sorts ascending by the primary criterion', () => {
        const sorted = getSortedToiStats(rows, 'games_together', false);
        expect(sorted.map((r) => r.player_id)).toEqual(['c', 'a', 'b']);
    });

    test('breaks a tie on games_together using toi, per TOI_TIE_BREAKS', () => {
        expect(TOI_TIE_BREAKS.games_together).toBe('toi');
        const tied = [
            { player_id: 'a', games_together: 10, toi: 500 },
            { player_id: 'b', games_together: 10, toi: 800 },
            { player_id: 'c', games_together: 5, toi: 100 },
        ];

        // a and b tie on games_together=10; descending overall, so the tie-break (toi) also
        // runs "bigger first" - b has more toi, so it must come first
        expect(getSortedToiStats(tied, 'games_together', true).map((r) => r.player_id)).toEqual([
            'b',
            'a',
            'c',
        ]);

        // ascending overall: the tie-break direction flips along with the primary direction,
        // so among the tied pair the smaller toi (a) now comes first
        expect(getSortedToiStats(tied, 'games_together', false).map((r) => r.player_id)).toEqual([
            'c',
            'a',
            'b',
        ]);
    });

    test('does not mutate the input array', () => {
        const original = [...rows];
        getSortedToiStats(rows, 'toi', true);
        expect(rows).toEqual(original);
    });

    test('a criterion with no configured tie-break just leaves genuine ties in place', () => {
        const tied = [
            { player_id: 'x', custom_field: 1, toi: 999 },
            { player_id: 'y', custom_field: 1, toi: 1 },
        ];
        expect(TOI_TIE_BREAKS.custom_field).toBeUndefined();
        const sorted = getSortedToiStats(tied, 'custom_field', true);
        // stable sort: original relative order preserved since there is nothing to break the tie
        expect(sorted.map((r) => r.player_id)).toEqual(['x', 'y']);
    });

    test('toi_5v5 and toi_3v3 tie-break each other both ways', () => {
        expect(TOI_TIE_BREAKS.toi_5v5).toBe('toi_3v3');
        expect(TOI_TIE_BREAKS.toi_3v3).toBe('toi_5v5');
        const sameFiveOnFive = [
            { player_id: 'p', toi_5v5: 100, toi_3v3: 20 },
            { player_id: 'q', toi_5v5: 100, toi_3v3: 5 },
        ];
        expect(getSortedToiStats(sameFiveOnFive, 'toi_5v5', true).map((r) => r.player_id)).toEqual([
            'p',
            'q',
        ]);
    });
});

test.describe('TOI_COLUMNS', () => {
    test('is exactly the key set of TOI_TIE_BREAKS', () => {
        expect(TOI_COLUMNS).toEqual(Object.keys(TOI_TIE_BREAKS));
    });

    test('includes every column the toi_teammates/toi_opponents tables can be sorted by', () => {
        [
            'last_name',
            'position',
            'team_location',
            'games_together',
            'toi',
            'toi_5v5',
            'toi_3v3',
            'toi_pp',
            'toi_5v4',
            'toi_5v3',
            'toi_sh',
            'toi_4v5',
            'toi_3v5',
        ].forEach((key) => expect(TOI_COLUMNS).toContain(key));
    });
});

test.describe('getHeatStyle', () => {
    const stats = [{ toi: 0 }, { toi: 50 }, { toi: 100 }];

    test('returns no style when the stats array is missing or empty', () => {
        expect(getHeatStyle(50, undefined, 'toi')).toEqual({});
        expect(getHeatStyle(50, [], 'toi')).toEqual({});
    });

    test('returns no style when every value in the column is zero (would otherwise divide by zero)', () => {
        expect(getHeatStyle(0, [{ toi: 0 }, { toi: 0 }], 'toi')).toEqual({});
    });

    test('the current maximum gets full-intensity blue', () => {
        expect(getHeatStyle(100, stats, 'toi')).toEqual({ 'background-color': 'rgb(85,136,187)' });
    });

    test('zero gets plain white', () => {
        expect(getHeatStyle(0, stats, 'toi')).toEqual({ 'background-color': 'rgb(255,255,255)' });
    });

    test('a value halfway to the max is interpolated halfway between white and the accent blue', () => {
        expect(getHeatStyle(50, stats, 'toi')).toEqual({ 'background-color': 'rgb(170,196,221)' });
    });

    test('scales relative to the max of the given field only, ignoring other fields on the same rows', () => {
        const mixed = [
            { toi: 10, toi_5v5: 1000 },
            { toi: 20, toi_5v5: 1 },
        ];
        expect(getHeatStyle(20, mixed, 'toi')).toEqual({ 'background-color': 'rgb(85,136,187)' });
    });
});
