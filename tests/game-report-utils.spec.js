const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
    formatGameClock,
    periodLabel,
    formatGameDate,
    formatPenaltyMinutes,
    formatToi,
    formatScore,
    buildGenericId,
    gameReportUrl,
    fallbackLabel,
    getLabel,
    parseFindingPath,
    describeFindingTarget,
    isWarningFinding,
    calculatePoints,
    calculateSavePercentage,
} = require('../js/game_report_utils.js');

const labels = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../cfg/game_report_labels.json'), 'utf8'),
);

function loadFixture(genericId) {
    return JSON.parse(
        fs.readFileSync(path.join(__dirname, 'fixtures/game_reports', genericId + '.json'), 'utf8'),
    );
}

test.describe('formatGameClock', () => {
    test('regulation periods, elapsed time within the period', () => {
        expect(formatGameClock(1, 0)).toBe('00:00');
        expect(formatGameClock(1, 155)).toBe('02:35');
        expect(formatGameClock(2, 1271)).toBe('01:11');
        expect(formatGameClock(3, 2460)).toBe('01:00');
    });

    test('overtime starts counting from 3600', () => {
        expect(formatGameClock(4, 3600)).toBe('00:00');
        expect(formatGameClock(4, 3770)).toBe('02:50');
    });

    test('a second overtime starts counting from 4800', () => {
        expect(formatGameClock(5, 4800)).toBe('00:00');
        expect(formatGameClock(5, 4805)).toBe('00:05');
    });
});

test.describe('periodLabel', () => {
    test('regulation periods', () => {
        expect(periodLabel(1)).toBe('1.');
        expect(periodLabel(2)).toBe('2.');
        expect(periodLabel(3)).toBe('3.');
    });

    test('the first overtime has no number', () => {
        expect(periodLabel(4)).toBe('OT');
    });

    test('further overtimes are numbered from the second one', () => {
        expect(periodLabel(5)).toBe('2. OT');
        expect(periodLabel(6)).toBe('3. OT');
    });
});

test.describe('formatGameDate', () => {
    test('date and time', () => {
        // 2026-09-17 is a Thursday
        expect(formatGameDate('2026-09-17', '19:30')).toBe('Do., 17.09.2026, 19:30 Uhr');
    });

    test('without a time, the report has none', () => {
        expect(formatGameDate('2026-09-17')).toBe('Do., 17.09.2026');
    });

    test('pads single-digit day and month', () => {
        expect(formatGameDate('2026-01-02', '08:00')).toBe('Fr., 02.01.2026, 08:00 Uhr');
    });
});

test.describe('formatPenaltyMinutes', () => {
    test('appends "Min."', () => {
        expect(formatPenaltyMinutes(2)).toBe('2 Min.');
        expect(formatPenaltyMinutes(5)).toBe('5 Min.');
    });
});

test.describe('formatToi', () => {
    test('formats seconds as MM:SS', () => {
        expect(formatToi(65)).toBe('01:05');
        expect(formatToi(3770)).toBe('62:50');
    });

    test('zero (never on the ice) is shown as an en dash', () => {
        expect(formatToi(0)).toBe('–');
    });

    test('undefined (not recorded) stays undefined', () => {
        expect(formatToi(undefined)).toBeUndefined();
    });
});

test.describe('formatScore', () => {
    test('home score first', () => {
        expect(formatScore(2, 1)).toBe('2:1');
        expect(formatScore(0, 0)).toBe('0:0');
    });
});

test.describe('buildGenericId', () => {
    test('date without dashes plus home and road abbreviations', () => {
        expect(buildGenericId('2025-09-26', 'EBB', 'STR')).toBe('20250926EBBSTR');
    });
});

test.describe('gameReportUrl', () => {
    test('a team row already carrying generic_id', () => {
        expect(gameReportUrl({ season: 2025, generic_id: '20250926EBBSTR' }, 2017)).toBe(
            '#!/game/2025/20250926EBBSTR',
        );
    });

    test('a player stat row without generic_id is built from game_date/team/opp_team/home_road', () => {
        let row = {
            season: 2025,
            game_date: '2025-09-26',
            team: 'EBB',
            opp_team: 'STR',
            home_road: 'home',
        };
        expect(gameReportUrl(row, 2017)).toBe('#!/game/2025/20250926EBBSTR');
    });

    test('the home/road order is resolved for an away row too', () => {
        let row = {
            season: 2025,
            game_date: '2025-09-26',
            team: 'STR',
            opp_team: 'EBB',
            home_road: 'road',
        };
        expect(gameReportUrl(row, 2017)).toBe('#!/game/2025/20250926EBBSTR');
    });

    test('a season before firstSeason has no report', () => {
        expect(gameReportUrl({ season: 2016, generic_id: '20160926EBBSTR' }, 2017)).toBeNull();
    });

    test('missing the fields to build a generic_id', () => {
        expect(
            gameReportUrl({ season: 2025, game_date: '2025-09-26', team: 'EBB' }, 2017),
        ).toBeNull();
    });
});

test.describe('fallbackLabel', () => {
    test('turns underscores into spaces', () => {
        expect(fallbackLabel('high_sticking')).toBe('high sticking');
    });

    test('leaves a non-string value untouched', () => {
        expect(fallbackLabel(5)).toBe(5);
        expect(fallbackLabel(undefined)).toBeUndefined();
    });
});

test.describe('getLabel', () => {
    test('a configured infraction', () => {
        expect(getLabel(labels, 'infractions', 'high_sticking')).toBe('Hoher Stock');
    });

    test('an unconfigured infraction falls back to the raw key with spaces', () => {
        expect(getLabel(labels, 'infractions', 'stick_lift')).toBe('stick lift');
    });

    test('an unconfigured section falls back the same way', () => {
        expect(getLabel(labels, 'no_such_section', 'some_key')).toBe('some key');
    });

    test('a nullish key is passed through', () => {
        expect(getLabel(labels, 'infractions', undefined)).toBeUndefined();
    });

    test('every severity used by the backend is configured', () => {
        expect(getLabel(labels, 'severities', 'missing')).toBe('fehlt');
        expect(getLabel(labels, 'severities', 'inconsistent')).toBe('widersprüchlich');
        expect(getLabel(labels, 'severities', 'corrected')).toBe('korrigiert');
    });
});

test.describe('parseFindingPath', () => {
    test('a bare section', () => {
        expect(parseFindingPath('goalies')).toEqual({
            section: 'goalies',
            side: undefined,
            index: undefined,
            field: undefined,
        });
    });

    test('a team field', () => {
        expect(parseFindingPath('teams.home.goals_per_period')).toEqual({
            section: 'teams',
            side: 'home',
            index: undefined,
            field: 'goals_per_period',
        });
    });

    test('an indexed scoring entry with a field', () => {
        expect(parseFindingPath('scoring[3].scorer')).toEqual({
            section: 'scoring',
            side: undefined,
            index: 3,
            field: 'scorer',
        });
    });

    test('an indexed scoring entry without a field', () => {
        expect(parseFindingPath('scoring[0]')).toEqual({
            section: 'scoring',
            side: undefined,
            index: 0,
            field: undefined,
        });
    });

    test('a side with an index and a field', () => {
        expect(parseFindingPath('skaters.home[5].penalty_minutes')).toEqual({
            section: 'skaters',
            side: 'home',
            index: 5,
            field: 'penalty_minutes',
        });
    });

    test('a side without an index', () => {
        expect(parseFindingPath('goalies.road')).toEqual({
            section: 'goalies',
            side: 'road',
            index: undefined,
            field: undefined,
        });
    });

    test('an unrecognized path is left for the caller to handle', () => {
        expect(parseFindingPath('game.round')).toBeNull();
    });
});

test.describe('describeFindingTarget', () => {
    test('a bare scoring/penalties/shootout section', () => {
        expect(describeFindingTarget({}, 'scoring')).toBe('Tore');
        expect(describeFindingTarget({}, 'penalties')).toBe('Strafen');
        expect(describeFindingTarget({}, 'shootout')).toBe('Penaltyschießen');
    });

    test('an indexed goal', () => {
        expect(describeFindingTarget({}, 'scoring[2].scorer')).toBe('Tor 3');
    });

    test('an indexed penalty', () => {
        expect(describeFindingTarget({}, 'penalties[0].player')).toBe('Strafe 1');
    });

    test('a team field names the side and the field', () => {
        expect(describeFindingTarget({}, 'teams.home.shots_on_goal_per_period')).toBe(
            'Heim: shots on goal per period',
        );
    });

    test('a skater resolves to the player name when the line exists', () => {
        let report = {
            skaters: { home: [{ first_name: 'Mitchell', last_name: 'Reinke' }] },
        };
        expect(describeFindingTarget(report, 'skaters.home[0].penalty_minutes')).toBe(
            'Heim: Mitchell Reinke',
        );
    });

    test('a skater index outside the report falls back to a numbered placeholder', () => {
        expect(describeFindingTarget({ skaters: { home: [] } }, 'skaters.home[3]')).toBe(
            'Heim: Feldspieler 4',
        );
    });

    test('a goalie section without an index', () => {
        expect(describeFindingTarget({}, 'goalies.road')).toBe('Gast: Torhüter');
    });

    test('using real findings from a fixture with goalie_sources_disagree', () => {
        let report = loadFixture('20261002KECRBM');
        let finding = report.data_quality.findings.find(
            (f) => f.check === 'goalie_sources_disagree',
        );
        expect(finding.path).toBe('goalies');
        expect(describeFindingTarget(report, finding.path)).toBe('Torhüter');
    });

    test('using real findings from a fixture with goal_situation_implausible', () => {
        let report = loadFixture('20261002STRBHV');
        let findings = report.data_quality.findings.filter(
            (f) => f.check === 'goal_situation_implausible',
        );
        expect(findings).toHaveLength(7);
        expect(describeFindingTarget(report, findings[0].path)).toBe('Tor 1');
    });

    test('using a real finding from a fixture with sog_per_period', () => {
        let report = loadFixture('20260925STRING');
        let finding = report.data_quality.findings.find((f) => f.check === 'sog_per_period');
        expect(finding.path).toBe('teams.home.shots_on_goal_per_period');
        expect(describeFindingTarget(report, finding.path)).toBe('Heim: shots on goal per period');
    });
});

test.describe('isWarningFinding', () => {
    test('an ordinary inconsistency is a warning', () => {
        expect(isWarningFinding({ check: 'sog_per_period', severity: 'inconsistent' })).toBe(true);
    });

    test('a corrected finding is never a warning', () => {
        expect(isWarningFinding({ check: 'sog_per_period', severity: 'corrected' })).toBe(false);
    });

    test('shootout_details_missing is a neutral hint, not a warning', () => {
        expect(isWarningFinding({ check: 'shootout_details_missing', severity: 'missing' })).toBe(
            false,
        );
    });

    test('infraction_unknown is a neutral hint, not a warning', () => {
        expect(isWarningFinding({ check: 'infraction_unknown', severity: 'missing' })).toBe(false);
    });
});

test.describe('calculatePoints', () => {
    test('goals plus assists', () => {
        expect(calculatePoints({ goals: 2, assists: 1 })).toBe(3);
        expect(calculatePoints({ goals: 0, assists: 0 })).toBe(0);
    });

    test('a real skater line from a fixture', () => {
        let report = loadFixture('20260917EBBSTR');
        let skater = report.skaters.home[0];
        expect(calculatePoints(skater)).toBe(skater.goals + skater.assists);
    });
});

test.describe('calculateSavePercentage', () => {
    test('saves over shots against, as a 0-100 percentage', () => {
        expect(calculateSavePercentage({ shots_against: 33, goals_against: 3 })).toBeCloseTo(
            90.909,
            3,
        );
    });

    test('no shots against at all is 0, not NaN', () => {
        expect(calculateSavePercentage({ shots_against: 0, goals_against: 0 })).toBe(0);
    });

    test('shots_against missing (older seasons) is undefined, not 0', () => {
        expect(calculateSavePercentage({ goals_against: 0 })).toBeUndefined();
    });

    test('a real goalie line from a fixture', () => {
        let report = loadFixture('20260917EBBSTR');
        let goalie = report.goalies.home.find((g) => g.started);
        let expected = ((goalie.shots_against - goalie.goals_against) / goalie.shots_against) * 100;
        expect(calculateSavePercentage(goalie)).toBeCloseTo(expected, 6);
    });
});
