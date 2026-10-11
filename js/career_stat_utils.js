/* global module */
// Pure per-season stat-line construction/aggregation for
// career_stats_controller.js. Not duplicated elsewhere - extracted as a
// low-risk "quick win" to establish this module pattern in a controller
// that had none yet.
(function (root) {
    // preparedPlayer: the result of $scope.preparePlayer(player) - a plain
    //   object with player_id/first_name/last_name/position/country/
    //   first_season/last_season. Callers must pass a FRESH
    //   preparePlayer(player) call per invocation (not a shared/reused
    //   object) - this function mutates and returns the object it's given,
    //   matching the original code calling preparePlayer() anew each time.
    function prepareSingleSeasonStatline(
        preparedPlayer,
        playerSeasonStats,
        championships,
        combined,
    ) {
        preparedPlayer['season'] = playerSeasonStats[0]['season'];
        if (combined) {
            preparedPlayer['season_type'] = 'ALL';
        } else {
            preparedPlayer['season_type'] = playerSeasonStats[0]['season_type'];
        }
        preparedPlayer['age'] = playerSeasonStats[0]['age'];
        preparedPlayer['championships'] = championships > 0 ? 1 : 0;
        preparedPlayer['teams'] = Array.from(
            new Set(playerSeasonStats.map((season) => season['team'])),
        );
        preparedPlayer['teams_cnt'] = preparedPlayer['teams'].length;

        return preparedPlayer;
    }

    // Sums every numeric field across each of `array`'s objects into
    // `target`, skipping any key named in `attrsToIgnore`. Already a free
    // function with no Angular dependency - lifted here verbatim.
    function sumIntoTarget(array, target, attrsToIgnore) {
        array.forEach((obj) => {
            for (let key in obj) {
                if (!attrsToIgnore.includes(key) && typeof obj[key] === 'number') {
                    target[key] = (target[key] || 0) + obj[key];
                }
            }
        });
    }

    const api = {
        prepareSingleSeasonStatline: prepareSingleSeasonStatline,
        sumIntoTarget: sumIntoTarget,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CareerStatUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
