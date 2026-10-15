/* global module */
// Pure helpers for the game report page (time/period formatting, labels with
// fallback, the generic_id/link scheme, and resolving data_quality findings
// to a readable target). Plain script so the same code runs in the browser
// (global GameReportUtils) and, without any data or Angular, in tests - same
// pattern as format_utils.js.
(function (root) {
    const PERIOD_LENGTH = 1200;
    const SIDES = ['home', 'road'];

    function pad(num, size) {
        let s = num + '';
        while (s.length < size) s = '0' + s;
        return s;
    }

    // start of a period in seconds since the beginning of the game: periods 1
    // to 3 are 1200s each, from period 4 on (overtime) the three regulation
    // periods have already used up 3600s
    function periodStart(period) {
        return period <= 3 ? (period - 1) * PERIOD_LENGTH : 3600 + (period - 4) * PERIOD_LENGTH;
    }

    // formats the time of an event (seconds since the start of the game) as
    // MM:SS within its period
    function formatGameClock(period, timeInSeconds) {
        let inPeriod = timeInSeconds - periodStart(period);
        return pad(Math.floor(inPeriod / 60), 2) + ':' + pad(inPeriod % 60, 2);
    }

    // "Drittel" label for a period: 1./2./3. in regulation, OT for the first
    // overtime, then "2. OT", "3. OT" and so on for further ones
    function periodLabel(period) {
        if (period <= 3) return period + '.';
        if (period === 4) return 'OT';
        return period - 3 + '. OT';
    }

    const GERMAN_WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

    // "Mi., 17.09.2026, 19:30 Uhr", or without the time part when it is
    // missing from the report; date is the report's "YYYY-MM-DD" string,
    // parsed as a local date so the weekday does not shift with timezone
    function formatGameDate(date, time) {
        let [year, month, day] = date.split('-').map(Number);
        let local = new Date(year, month - 1, day);
        let formatted =
            GERMAN_WEEKDAYS[local.getDay()] + ', ' + pad(day, 2) + '.' + pad(month, 2) + '.' + year;
        return time ? formatted + ', ' + time + ' Uhr' : formatted;
    }

    // "2 Min."
    function formatPenaltyMinutes(minutes) {
        return minutes + ' Min.';
    }

    // MM:SS, with 0 (never on the ice, e.g. a backup goalie) shown as "–"
    function formatToi(toiInSeconds) {
        if (toiInSeconds === undefined) return undefined;
        if (toiInSeconds === 0) return '–';
        return pad(Math.floor(toiInSeconds / 60), 2) + ':' + pad(toiInSeconds % 60, 2);
    }

    // "2:1", home score first
    function formatScore(home, road) {
        return home + ':' + road;
    }

    // generic_id: YYYYMMDD of the game date plus the home and road abbreviations
    function buildGenericId(gameDate, home, road) {
        return gameDate.replace(/-/g, '') + home + road;
    }

    // the link target for a player/team statistics row, or null when the row
    // predates config.gameReports.firstSeason (no report exists for it) or is
    // missing what it takes to resolve a generic_id. Rows already carry
    // generic_id (team rows) or can have one built from game_date/team/
    // opp_team/home_road (most player stat rows, until the backend fills it
    // in directly - see Todo.md section 6).
    function gameReportUrl(row, firstSeason) {
        if (row.season === undefined || row.season < firstSeason) return null;
        let genericId = row.generic_id;
        if (!genericId) {
            if (!row.game_date || !row.team || !row.opp_team || !row.home_road) return null;
            let home = row.home_road === 'home' ? row.team : row.opp_team;
            let road = row.home_road === 'home' ? row.opp_team : row.team;
            genericId = buildGenericId(row.game_date, home, road);
        }
        return '#!/game/' + row.season + '/' + genericId;
    }

    // an unknown key is shown as-is, with underscores turned into spaces
    // (e.g. an infraction "high_sticking" the labels config does not know yet
    // becomes "high sticking") rather than failing or showing the raw key
    function fallbackLabel(key) {
        return typeof key === 'string' ? key.replace(/_/g, ' ') : key;
    }

    // looks up key in the given section of the labels config (infractions,
    // checks, severities, strengths, rounds, phases, season_types,
    // positions, outcomes), falling back to the raw key when the section or
    // the key itself is not configured
    function getLabel(labels, section, key) {
        if (key === undefined || key === null) return key;
        let sectionLabels = labels && labels[section];
        if (sectionLabels && Object.prototype.hasOwnProperty.call(sectionLabels, key)) {
            return sectionLabels[key];
        }
        return fallbackLabel(key);
    }

    // a data_quality finding's path (see schemas/game_report.schema.json in
    // the backend repo), e.g. "teams.home.goals_per_period",
    // "scoring[3].scorer", "skaters.home[5].penalty_minutes" or a bare
    // section name like "goalies" or "shootout". Returns null if it does not
    // match the grammar the backend's checks actually produce.
    function parseFindingPath(path) {
        let match =
            /^(scoring|penalties|shootout|skaters|goalies|teams)(?:\.(home|road))?(?:\[(\d+)\])?(?:\.(.+))?$/.exec(
                path,
            );
        if (!match) return null;
        return {
            section: match[1],
            side: match[2] || undefined,
            index: match[3] !== undefined ? parseInt(match[3], 10) : undefined,
            field: match[4] || undefined,
        };
    }

    function sideLabel(side) {
        return side === 'home' ? 'Heim' : 'Gast';
    }

    function playerName(player) {
        return player.first_name + ' ' + player.last_name;
    }

    // a human-readable description of what a finding's path points at (e.g.
    // "Tor 3", "Heim: Mitchell Reinke"), used both in the data-quality block
    // and for the tooltip of a table row's warning symbol. report is the
    // full game report, used to resolve a skaters/goalies index to a name;
    // without a match for the path, or a player, falls back to something
    // still readable rather than failing
    function describeFindingTarget(report, path) {
        let parsed = parseFindingPath(path);
        if (!parsed) return path;
        let prefix = parsed.side ? sideLabel(parsed.side) + ': ' : '';
        switch (parsed.section) {
            case 'scoring':
                return parsed.index !== undefined ? 'Tor ' + (parsed.index + 1) : 'Tore';
            case 'penalties':
                return parsed.index !== undefined ? 'Strafe ' + (parsed.index + 1) : 'Strafen';
            case 'shootout':
                return 'Penaltyschießen';
            case 'skaters': {
                if (parsed.index === undefined) return prefix + 'Feldspieler';
                let player = report?.skaters?.[parsed.side]?.[parsed.index];
                return prefix + (player ? playerName(player) : 'Feldspieler ' + (parsed.index + 1));
            }
            case 'goalies': {
                if (!parsed.side) return 'Torhüter';
                if (parsed.index === undefined) return prefix + 'Torhüter';
                let goalie = report?.goalies?.[parsed.side]?.[parsed.index];
                return prefix + (goalie ? playerName(goalie) : 'Torhüter ' + (parsed.index + 1));
            }
            case 'teams':
                return prefix + fallbackLabel(parsed.field);
            default:
                return path;
        }
    }

    // shootout_details_missing and infraction_unknown (with an unknown
    // value) are neutral hints rather than warnings, and a "corrected"
    // finding is shown without a warning symbol as well - this is the single
    // place both the data-quality block and the table row symbols check
    function isWarningFinding(finding) {
        if (finding.severity === 'corrected') return false;
        return (
            finding.check !== 'shootout_details_missing' && finding.check !== 'infraction_unknown'
        );
    }

    // player profiles only exist for seasons from 2016 on, independent of
    // config.gameReports.firstSeason (which gates the report page itself)
    const PLAYER_PROFILE_FIRST_SEASON = 2016;

    // the link target for a player's name on the game report page, or null
    // when it has no profile to link to: an archive-only player (no
    // ids.current) or a season before player profiles exist
    function playerProfileUrl(player, teamAbbr, season) {
        if (!player || !player.ids || player.ids.current === undefined) return null;
        if (season < PLAYER_PROFILE_FIRST_SEASON) return null;
        return '#!/player_profile/' + season + '/' + teamAbbr + '/' + player.ids.current;
    }

    // goals + assists for a skater line
    function calculatePoints(skater) {
        return (skater.goals || 0) + (skater.assists || 0);
    }

    // save percentage (0-100) from a goalie's shots_against/goals_against;
    // undefined when shots_against is not in the report (old seasons did not
    // record it), matching how toi/shots_on_goal are optional elsewhere
    function calculateSavePercentage(goalie) {
        if (goalie.shots_against === undefined) return undefined;
        if (!goalie.shots_against) return 0;
        return ((goalie.shots_against - goalie.goals_against) / goalie.shots_against) * 100;
    }

    const api = {
        SIDES: SIDES,
        formatGameClock: formatGameClock,
        periodLabel: periodLabel,
        formatGameDate: formatGameDate,
        formatPenaltyMinutes: formatPenaltyMinutes,
        formatToi: formatToi,
        formatScore: formatScore,
        buildGenericId: buildGenericId,
        gameReportUrl: gameReportUrl,
        playerProfileUrl: playerProfileUrl,
        fallbackLabel: fallbackLabel,
        getLabel: getLabel,
        parseFindingPath: parseFindingPath,
        describeFindingTarget: describeFindingTarget,
        isWarningFinding: isWarningFinding,
        calculatePoints: calculatePoints,
        calculateSavePercentage: calculateSavePercentage,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameReportUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
