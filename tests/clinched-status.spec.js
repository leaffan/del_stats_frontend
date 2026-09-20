const { test, expect } = require('@playwright/test');
const { getClinchedStatus } = require('../js/clinched_status.js');

const flags = (overrides) => ({
    clinched_top_spot: false,
    clinched_quarters: false,
    clinched_playoffs: false,
    no_playoffs: false,
    relegated: false,
    ...overrides,
});

test.describe('getClinchedStatus', () => {
    test('returns null for missing team data', () => {
        expect(getClinchedStatus(undefined)).toBeNull();
        expect(getClinchedStatus(null)).toBeNull();
        expect(getClinchedStatus({})).toBeNull();
    });

    test('returns null when no flag is set', () => {
        expect(getClinchedStatus(flags({}))).toBeNull();
    });

    for (const [flag, letter, title] of [
        ['clinched_top_spot', 'M', 'Hauptrundenmeister'],
        ['clinched_quarters', 'V', 'Direktqualifikant Viertelfinale'],
        ['clinched_playoffs', 'P', 'Qualifikant Playoffs'],
        ['relegated', 'A', 'Absteiger'],
        ['no_playoffs', 'X', 'Keine Playoffqualifikation mehr möglich'],
    ]) {
        test(`maps ${flag} to ${letter}`, () => {
            expect(getClinchedStatus(flags({ [flag]: true }))).toEqual({ letter, title });
        });
    }

    test('cumulative flags resolve by priority', () => {
        const all = flags({
            clinched_top_spot: true,
            clinched_quarters: true,
            clinched_playoffs: true,
        });
        expect(getClinchedStatus(all).letter).toBe('M');
        expect(
            getClinchedStatus(flags({ clinched_quarters: true, clinched_playoffs: true })).letter,
        ).toBe('V');
        expect(getClinchedStatus(flags({ no_playoffs: true, relegated: true })).letter).toBe('A');
    });

    test('returns the identical object on repeated calls (AngularJS digest safety)', () => {
        const data = flags({ clinched_playoffs: true });
        expect(getClinchedStatus(data)).toBe(getClinchedStatus(data));
    });
});
