/* global module, require */
// Pure "selected month" date-range derivation, shared across controllers that
// offer a per-season month dropdown. This is only the month branch of each
// controller's changeTimespan() - the surrounding pre_dcup/post_dcup/
// pre_reunification/post_reunification/last_N-games branches are NOT
// identical across controllers (player_stats_controller.js/
// team_stats_controller.js have all four, team_profile_controller.js has
// only pre_dcup/post_dcup, player_profile_controller.js has none) and stay
// in each controller. shot_explorer_controller.js's own changeTimespan is a
// different approach entirely (0-indexed month, moment's object
// constructor, numeric $scope.season) and isn't touched by this at all - see
// Plan.md for the full picture and the deferred full-consolidation TODO.
//
// Unlike js/game_filters.js and js/game_log_metadata.js, this module needs
// moment.js itself (the result must be real moment objects - callers go on
// to call .format()/.startOf('day') on them and bind them to the
// moment-picker UI), so moment is now a pinned devDependency
// (moment@2.31.0, matching the CDN version in index.html) purely so
// tests/timespan-utils.spec.js can require it under Node.
(function (root) {
    var moment = typeof module !== 'undefined' && module.exports ? require('moment') : root.moment;

    // season: the season string/number the page is showing (e.g. '2025').
    // timespanSelect: the selected dropdown value, a 0-indexed calendar
    //   month (0 = January ... 11 = December) - the same raw value
    //   $scope.monthsPlayed holds via moment().month(). Since a DEL season
    //   spans two calendar years (roughly September through April/May), a
    //   month before September is taken to be the second half of the
    //   season and rolls over to season + 1.
    function deriveMonthTimespan(season, timespanSelect) {
        let month = parseInt(timespanSelect) + 1;
        let year;
        if (month < 9) {
            year = parseInt(season) + 1;
        } else {
            year = parseInt(season);
        }
        return {
            fromDate: moment(year + '-' + month + '-1', 'YYYY-M-D'),
            toDate: moment(year + '-' + month + '-1', 'YYYY-M-D').endOf('month'),
        };
    }

    const api = { deriveMonthTimespan: deriveMonthTimespan };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TimespanUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
