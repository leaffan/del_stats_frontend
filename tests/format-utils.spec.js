const { test, expect } = require('@playwright/test');
const {
    pad,
    formatDuration,
    calculateAge,
    isTeamValidForSeason,
    formatRecord,
    buildSortConfig,
} = require('../js/format_utils.js');

// These pin down the behaviour the app has today, including its quirks. All
// dates are built with the local-time Date constructor, because calculateAge
// reads local getters and an ISO string like '1988-03-11' is parsed as UTC.
const date = (year, month, day) => new Date(year, month - 1, day);

test.describe('pad', () => {
    test('left-pads with zeros up to the requested size', () => {
        expect(pad(5, 2)).toBe('05');
        expect(pad(0, 2)).toBe('00');
        expect(pad(7, 4)).toBe('0007');
    });

    test('never truncates a longer value', () => {
        expect(pad(123, 2)).toBe('123');
    });
});

test.describe('formatDuration', () => {
    test('zero', () => {
        expect(formatDuration(0)).toBe('0:00:00');
    });

    test('below one hour keeps a leading 0 hour', () => {
        expect(formatDuration(59)).toBe('0:00:59');
        expect(formatDuration(60)).toBe('0:01:00');
        expect(formatDuration(3599)).toBe('0:59:59');
    });

    test('rolls minutes over into hours', () => {
        expect(formatDuration(3600)).toBe('1:00:00');
        expect(formatDuration(44885)).toBe('12:28:05');
    });

    test('keeps counting hours past 24', () => {
        expect(formatDuration(86400)).toBe('24:00:00');
        expect(formatDuration(90061)).toBe('25:01:01');
    });

    test('drops fractional seconds instead of rounding', () => {
        expect(formatDuration(3661.9)).toBe('1:01:01');
    });
});

test.describe('calculateAge', () => {
    test('years, months and days since the birth date', () => {
        expect(calculateAge(date(1988, 3, 11), date(2026, 9, 24))).toBe(
            '38 Jahre 6 Monate 13 Tage',
        );
    });

    test('exactly zero days old', () => {
        expect(calculateAge(date(2026, 9, 24), date(2026, 9, 24))).toBe('0 Jahre 0 Monate 0 Tage');
    });

    test('singular for exactly one month and one day', () => {
        expect(calculateAge(date(2026, 8, 23), date(2026, 9, 24))).toBe('0 Jahre 1 Monat 1 Tag');
    });

    test('a birthday that has not happened yet this year', () => {
        expect(calculateAge(date(1990, 12, 30), date(2026, 9, 24))).toBe(
            '35 Jahre 8 Monate 25 Tage',
        );
    });

    test('borrows days from the birth month when the day of month is smaller', () => {
        expect(calculateAge(date(2000, 1, 31), date(2000, 3, 1))).toBe('0 Jahre 1 Monat 1 Tag');
    });

    test('leap day birth date', () => {
        expect(calculateAge(date(2000, 2, 29), date(2001, 3, 1))).toBe('1 Jahre 0 Monate 1 Tag');
    });

    test('compact format', () => {
        expect(calculateAge(date(1988, 3, 11), date(2026, 9, 24), true)).toBe('38 J. 6 M. 13 T.');
        expect(calculateAge(date(2026, 8, 23), date(2026, 9, 24), true)).toBe('0 J. 1 M. 1 T.');
    });

    // Only months and days have a singular form. This documents that behaviour;
    // if "1 Jahr" is wanted, change the function and this test together.
    test('years are always written in the plural, even for exactly one', () => {
        expect(calculateAge(date(2025, 9, 24), date(2026, 9, 24))).toBe('1 Jahre 0 Monate 0 Tage');
    });
});

test.describe('isTeamValidForSeason', () => {
    const KEV = {
        valid_periods: [
            { from: 2017, to: 2021 },
            { from: 2026, to: 2026 },
        ],
    };

    test('valid_periods: inside a period, boundaries included', () => {
        expect(isTeamValidForSeason(KEV, 2017)).toBe(true);
        expect(isTeamValidForSeason(KEV, 2020)).toBe(true);
        expect(isTeamValidForSeason(KEV, 2021)).toBe(true);
        expect(isTeamValidForSeason(KEV, 2026)).toBe(true);
    });

    test('valid_periods: the gap between two periods and outside all of them', () => {
        expect(isTeamValidForSeason(KEV, 2022)).toBe(false);
        expect(isTeamValidForSeason(KEV, 2025)).toBe(false);
        expect(isTeamValidForSeason(KEV, 2016)).toBe(false);
        expect(isTeamValidForSeason(KEV, 2027)).toBe(false);
    });

    test('valid_periods takes precedence over valid_from/valid_to', () => {
        const team = { ...KEV, valid_from: 2000, valid_to: 2100 };
        expect(isTeamValidForSeason(team, 2023)).toBe(false);
    });

    test('falls back to valid_from/valid_to without valid_periods', () => {
        const team = { valid_from: 2017, valid_to: 2024 };
        expect(isTeamValidForSeason(team, 2017)).toBe(true);
        expect(isTeamValidForSeason(team, 2024)).toBe(true);
        expect(isTeamValidForSeason(team, 2016)).toBe(false);
        expect(isTeamValidForSeason(team, 2025)).toBe(false);
    });

    test('an empty valid_periods list means the team was never valid', () => {
        expect(
            isTeamValidForSeason({ valid_periods: [], valid_from: 2000, valid_to: 2100 }, 2020),
        ).toBe(false);
    });

    test('a season from the route (string) compares numerically', () => {
        expect(isTeamValidForSeason(KEV, '2020')).toBe(true);
        expect(isTeamValidForSeason(KEV, '2023')).toBe(false);
    });
});

test.describe('formatRecord', () => {
    const otRecord = { data_key: 'ot_w', record: ['ot_l'], record_optional: ['ot_t'] };

    test('joins wins and losses', () => {
        expect(formatRecord({ ot_w: 1, ot_l: 2 }, otRecord)).toBe('1-2');
    });

    test('appends the optional field only when it is non-zero', () => {
        expect(formatRecord({ ot_w: 1, ot_l: 2, ot_t: 12 }, otRecord)).toBe('1-2-12');
        expect(formatRecord({ ot_w: 1, ot_l: 2, ot_t: 0 }, otRecord)).toBe('1-2');
        expect(formatRecord({ ot_w: 1, ot_l: 2 }, otRecord)).toBe('1-2');
    });

    test('all zero still shows the required part', () => {
        expect(formatRecord({ ot_w: 0, ot_l: 0, ot_t: 0 }, otRecord)).toBe('0-0');
    });

    test('a column without companions is just its own value', () => {
        expect(formatRecord({ score: 4 }, { data_key: 'score' })).toBe('4');
    });

    test('several companions keep their configured order', () => {
        const col = { data_key: 'w', record: ['l', 'otl'] };
        expect(formatRecord({ w: 30, l: 10, otl: 5 }, col)).toBe('30-10-5');
    });
});

test.describe('buildSortConfig', () => {
    test('descending primary key: sortDescending carries its direction', () => {
        expect(buildSortConfig(['-length', '-score_diff', '-scores_for', 'season'])).toEqual({
            sortKey: 'length',
            sortCriteria: ['length', 'score_diff', 'scores_for', '-season'],
            sortDescending: true,
        });
    });

    test('ascending primary key: other directions are stored as written', () => {
        expect(buildSortConfig(['season', '-length', 'team'])).toEqual({
            sortKey: 'season',
            sortCriteria: ['season', '-length', 'team'],
            sortDescending: false,
        });
    });

    test('a single key', () => {
        expect(buildSortConfig(['-points'])).toEqual({
            sortKey: 'points',
            sortCriteria: ['points'],
            sortDescending: true,
        });
        expect(buildSortConfig(['team'])).toEqual({
            sortKey: 'team',
            sortCriteria: ['team'],
            sortDescending: false,
        });
    });

    // orderBy applies sortDescending as one global reversal, so a key whose
    // stored prefix equals the primary's must end up with its own direction
    // once reversed: that is what the pre-inversion is for
    test('applying the global reversal restores each key to its intended direction', () => {
        const spec = ['-a', 'b', '-c'];
        const { sortCriteria, sortDescending } = buildSortConfig(spec);
        const intended = spec.map((entry) => (entry.startsWith('-') ? 'desc' : 'asc'));
        const effective = sortCriteria.map((entry, index) => {
            if (index === 0) return sortDescending ? 'desc' : 'asc';
            const stored = entry.startsWith('-') ? 'desc' : 'asc';
            if (!sortDescending) return stored;
            return stored === 'desc' ? 'asc' : 'desc';
        });
        expect(effective).toEqual(intended);
    });
});
