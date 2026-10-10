const { test, expect } = require('@playwright/test');
const { deriveMonthTimespan } = require('../js/timespan_utils.js');

test.describe('deriveMonthTimespan', () => {
    // timespanSelect is a 0-indexed calendar month (0 = January ... 11 =
    // December, matching $scope.monthsPlayed's moment().month() values).
    // Since a DEL season spans two calendar years (roughly September to
    // April/May), a month < 9 (i.e. before September) is understood to fall
    // in the second half of the season and rolls over to season+1.

    test('a late-season value (>= 9) stays within the season start year', () => {
        // timespanSelect 9 -> month 10 (October), season 2025 -> year 2025
        const result = deriveMonthTimespan('2025', 9);
        expect(result.fromDate.format('YYYY-MM-DD')).toBe('2025-10-01');
        expect(result.toDate.format('YYYY-MM-DD')).toBe('2025-10-31');
    });

    test('an early-season value (< 9) rolls over into the following year', () => {
        // timespanSelect 0 -> month 1 (January), season 2025 -> year 2026
        const result = deriveMonthTimespan('2025', 0);
        expect(result.fromDate.format('YYYY-MM-DD')).toBe('2026-01-01');
        expect(result.toDate.format('YYYY-MM-DD')).toBe('2026-01-31');
    });

    test('the <9/>=9 boundary itself (timespanSelect 8 -> month 9, September)', () => {
        const result = deriveMonthTimespan('2025', 8);
        expect(result.fromDate.format('YYYY-MM-DD')).toBe('2025-09-01');
        expect(result.toDate.format('YYYY-MM-DD')).toBe('2025-09-30');
    });

    test('toDate is the last day of the month, including a leap-year February', () => {
        // timespanSelect 4 -> month 5 (May 2026) - a plain 31-day month
        const result = deriveMonthTimespan('2025', 4);
        expect(result.toDate.format('YYYY-MM-DD')).toBe('2026-05-31');

        // timespanSelect 1 -> month 2 (February), season 2019 -> year 2020,
        // a leap year - must be the 29th, not the 28th
        const leapResult = deriveMonthTimespan('2019', 1);
        expect(leapResult.toDate.format('YYYY-MM-DD')).toBe('2020-02-29');
    });

    test('accepts a string season/timespanSelect, matching how $scope values arrive', () => {
        const result = deriveMonthTimespan('2025', '9');
        expect(result.fromDate.format('YYYY-MM-DD')).toBe('2025-10-01');
    });
});
