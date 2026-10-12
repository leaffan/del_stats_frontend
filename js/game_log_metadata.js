/* global module */
// Pure per-game-array metadata derivation shared across controllers that load
// a season's per-game stat lines. monthsPlayed is deliberately NOT included
// here even though it's duplicated the same way - it needs moment.js to
// parse game_date, and moment isn't an npm dependency of this project (only
// loaded via CDN in the browser), so it stays duplicated in each controller
// for now (see Plan.md item 4).
(function (root) {
    // games: array of per-game stat-line records (weekday, round, ...)
    function deriveWeekdaysPlayed(games) {
        return [...new Set(games.map((item) => item.weekday))].sort();
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
        deriveRoundsPlayed: deriveRoundsPlayed,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameLogMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
