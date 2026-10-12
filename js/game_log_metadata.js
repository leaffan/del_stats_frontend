/* global module, require */
// Pure per-game-array metadata derivation shared across controllers that load
// a season's per-game stat lines.
(function (root) {
    var moment = typeof module !== 'undefined' && module.exports ? require('moment') : root.moment;

    // games: array of per-game stat-line records (weekday, round, ...)
    function deriveWeekdaysPlayed(games) {
        return [...new Set(games.map((item) => item.weekday))].sort();
    }

    // Deduplicated, 0-indexed calendar months a team/player had a game in -
    // NOT sorted, matching all four controllers' original inline version
    // (player_stats_controller.js, team_stats_controller.js,
    // player_profile_controller.js, team_profile_controller.js). Not
    // extracted when this module was created since moment wasn't an npm
    // dependency yet - it is now (see deriveRoundsPlayed/js/timespan_utils.js).
    function deriveMonthsPlayed(games) {
        return [...new Set(games.map((item) => moment(item.game_date).month()))];
    }

    // roundsPlayed/toRoundSelect: a full, deduplicated, numerically-sorted
    // list of rounds, for a from/to round-range filter dropdown
    // (player_stats_controller.js, team_stats_controller.js).
    // maxRoundPlayed: just the upper bound, for controllers that only need a
    // 1..N range and not a selectable list (player_profile_controller.js,
    // team_profile_controller.js via svc.range(1, maxRoundPlayed)).
    // Originally two separate functions - deriveRoundsPlayed's roundsPlayed
    // used parseInt(item.round), deriveMaxRoundPlayed took the raw round
    // value straight into Math.max (which itself coerces to number). Merged
    // after confirming against real data (all seasons, all season_types
    // RS/PO/MSC, across del_team_game_stats.json/per_player per-game
    // JSON/del_player_game_stats.csv) that `round` is always purely numeric,
    // so parseInt is a no-op there and this is not a behavior change for any
    // data this project actually has.
    function deriveRoundsPlayed(games) {
        let roundsPlayed = [...new Set(games.map((item) => parseInt(item.round)))].sort(
            (a, b) => a - b,
        );
        let maxRoundPlayed = Math.max.apply(Math, roundsPlayed).toString();
        return {
            roundsPlayed: roundsPlayed,
            toRoundSelect: maxRoundPlayed,
            maxRoundPlayed: maxRoundPlayed,
        };
    }

    const api = {
        deriveWeekdaysPlayed: deriveWeekdaysPlayed,
        deriveMonthsPlayed: deriveMonthsPlayed,
        deriveRoundsPlayed: deriveRoundsPlayed,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameLogMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
