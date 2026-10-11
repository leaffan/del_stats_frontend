/* global module */
// Config-driven "how many games met category X" tallying, used for both
// skater and goalie per-game stat lines in player_stats_controller.js. Not
// duplicated elsewhere - extracted purely for testability, since none of
// this logic could previously be exercised without the full app + real
// fixture data via Playwright.
//
// checkCondition's eval(value) is a pre-existing hack, not something this
// extraction fixes: cfg/stats_to_categorize.json has exactly one
// non-numeric `value` across the entire file - the goalie "quality_starts"
// category's "$scope.league_data.save_pctg * 100" - which the eval'd string
// expects to resolve against a variable literally named `$scope` in scope.
// $scope is threaded through as an explicit parameter (instead of an
// invisible closure, as it was before extraction) purely so that one
// condition keeps resolving exactly as before - every other condition in
// the config is a plain number and never touches $scope at all. See
// Plan.md for the deferred TODO to replace this with an explicit lookup
// instead of eval.
(function (root) {
    function checkCondition($scope, condition, stats) {
        let { operator, criterion, value } = condition;

        if (stats[criterion] === undefined) {
            return false; // Falls das Kriterium nicht existiert
        }
        // hacky: evaluating value if found to be of string type
        if (typeof value === 'string') {
            value = eval(value);
        }

        if (stats[criterion] === null) {
            return false;
        }

        switch (operator) {
            case 'greater_equal':
                return stats[criterion] >= value;
            case 'less_equal':
                return stats[criterion] <= value;
            case 'greater':
                return stats[criterion] > value;
            case 'less':
                return stats[criterion] < value;
            case 'equal':
                return stats[criterion] == value;
            case 'not_equal':
                return stats[criterion] != value;
            default:
                return false;
        }
    }

    function categorizeStatsForStatline(statsToCategorize, singleGameStats, filteredStats, $scope) {
        statsToCategorize.forEach((categoryCfg) => {
            if (categoryCfg.categories) {
                // checking category with multiple conditions combined by logical AND
                let allConditionsMet = categoryCfg.categories.every((cond) => {
                    return checkCondition($scope, cond, singleGameStats);
                });

                if (allConditionsMet) {
                    filteredStats[categoryCfg.name] = (filteredStats[categoryCfg.name] || 0) + 1;
                }
            } else {
                // checking category with one criterion
                if (checkCondition($scope, categoryCfg, singleGameStats)) {
                    filteredStats[categoryCfg.name] = (filteredStats[categoryCfg.name] || 0) + 1;
                }
            }
        });
    }

    const api = {
        checkCondition: checkCondition,
        categorizeStatsForStatline: categorizeStatsForStatline,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.StatCategorization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
