// Pure per-game filtering logic shared between player_stats_controller.js and
// team_stats_controller.js - only the criteria that are identical between the
// two. situationSelect and seasonTypeSelect are handled differently by each
// controller (team_stats_controller.js supports extra max_lead/max_deficit
// situations, and reads seasonTypeSelect from a different scope) and stay in
// each controller, ANDed together with this function's result.
(function (root) {
    // element: one per-game stat-line record (game_date 'YYYY-MM-DD',
    //   home_road, weekday, round, games_back, ...)
    // filters: {
    //   fromDate, toDate: 'YYYY-MM-DD' or falsy (format a moment with
    //     'YYYY-MM-DD' at the call site - element.game_date is always a
    //     date-only string, so this is equivalent to the original
    //     moment-vs-moment day-granularity comparison, without needing
    //     the moment library in this pure module),
    //   homeAwaySelect: 'home' | 'road' | falsy,
    //   weekdaySelect: weekday value or falsy,
    //   fromRoundSelect, toRoundSelect: string/number or falsy,
    //   gamesBackSelect: number or falsy,
    // }
    function gamePassesCommonFilters(element, filters) {
        let isEqualPastFromDate = !filters.fromDate || element.game_date >= filters.fromDate;
        let isPriorEqualToDate = !filters.toDate || element.game_date <= filters.toDate;
        let isSelectedHomeAwayType =
            !filters.homeAwaySelect || filters.homeAwaySelect === element.home_road;
        let isSelectedWeekday = !filters.weekdaySelect || filters.weekdaySelect == element.weekday;
        let isEqualPastFromRound =
            !filters.fromRoundSelect || element.round >= parseFloat(filters.fromRoundSelect);
        let isPriorEqualToRound =
            !filters.toRoundSelect || element.round <= parseFloat(filters.toRoundSelect);
        let isSelectedGamesBack =
            !filters.gamesBackSelect || element.games_back <= filters.gamesBackSelect;

        return (
            isEqualPastFromDate &&
            isPriorEqualToDate &&
            isSelectedHomeAwayType &&
            isSelectedWeekday &&
            isEqualPastFromRound &&
            isPriorEqualToRound &&
            isSelectedGamesBack
        );
    }

    const api = { gamePassesCommonFilters: gamePassesCommonFilters };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
