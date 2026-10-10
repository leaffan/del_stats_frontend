/* global module */
// Pure per-game-array metadata derivation shared across controllers that load
// a season's per-game stat lines. monthsPlayed is deliberately NOT included
// here even though it's duplicated the same way - it needs moment.js to
// parse game_date, and moment isn't an npm dependency of this project (only
// loaded via CDN in the browser), so it stays duplicated in each controller
// for now (see Plan.md item 4).
//
// roundsPlayed and maxRoundPlayed are two genuinely different computations
// that happen to both derive from "round" - not unified into one function,
// since doing so would couple two currently-independent call sites to the
// same parseInt-vs-raw-value assumption for no real benefit (see Plan.md).
(function (root) {
    // games: array of per-game stat-line records (weekday, round, ...)
    function deriveWeekdaysPlayed(games) {
        return [...new Set(games.map((item) => item.weekday))].sort();
    }

    // Used where a full, deduplicated, numerically-sorted list of rounds is
    // needed to populate a from/to round-range filter dropdown
    // (player_stats_controller.js, team_stats_controller.js).
    function deriveRoundsPlayed(games) {
        let roundsPlayed = [...new Set(games.map((item) => parseInt(item.round)))].sort(
            (a, b) => a - b,
        );
        return {
            roundsPlayed: roundsPlayed,
            toRoundSelect: Math.max.apply(Math, roundsPlayed).toString(),
        };
    }

    // Used where only a single upper-bound default is needed, not a
    // selectable list (player_profile_controller.js, team_profile_controller.js).
    function deriveMaxRoundPlayed(games) {
        return Math.max
            .apply(
                Math,
                games.map(function (o) {
                    return o.round;
                }),
            )
            .toString();
    }

    const api = {
        deriveWeekdaysPlayed: deriveWeekdaysPlayed,
        deriveRoundsPlayed: deriveRoundsPlayed,
        deriveMaxRoundPlayed: deriveMaxRoundPlayed,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameLogMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
