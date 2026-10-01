/* global module */
// Pure shared-ice-time helpers for the toi_teammates/toi_opponents tables on
// player_profile.html. Plain script so the same code runs in the browser
// (global ToiStats) and, without $scope/Angular, in tests - same pattern as
// format_utils.js.
(function (root) {
    // tie-break chains for the toi_teammates/toi_opponents tables, since this page (unlike
    // player_stats.html's sort_criteria_player_stats.json) has no config-driven tie-break system
    const TOI_TIE_BREAKS = {
        last_name: 'first_name',
        position: 'last_name',
        team_location: 'last_name',
        games_together: 'toi',
        toi: 'toi_5v5',
        toi_5v5: 'toi_3v3',
        toi_3v3: 'toi_5v5',
        toi_pp: 'toi_5v4',
        toi_5v4: 'toi_5v3',
        toi_5v3: 'toi_5v4',
        toi_sh: 'toi_4v5',
        toi_4v5: 'toi_3v5',
        toi_3v5: 'toi_4v5',
    };
    const TOI_COLUMNS = Object.keys(TOI_TIE_BREAKS);

    // aggregates per-game shared-ice-time rows (one of toiRaw per subject player, shaped
    // {columns, others: {<otherPlayerId>: [[game_id, toi, toi_5v5, ...], ...]}}) into one summary
    // row per teammate/opponent. gameContextById resolves a row's bare game_id to that game's
    // date/round/season_type/home_road/opp_team (etc.) context, since the raw TOI rows don't
    // carry that themselves; gameFilter(context) decides whether a given shared game counts
    // (callers compose this from whatever filter UI is active). playersById resolves the other
    // player's name/position; teamLocationLookup resolves their team abbreviation to a city name.
    function getPartnerStats(toiRaw, gameContextById, playersById, teamLocationLookup, gameFilter) {
        if (!toiRaw || !gameContextById || !playersById || !teamLocationLookup) {
            return [];
        }
        gameFilter =
            gameFilter ||
            function () {
                return true;
            };

        const colIndex = {};
        toiRaw.columns.forEach(function (col, i) {
            colIndex[col] = i;
        });
        const ppCols = ['toi_5v4', 'toi_4v3', 'toi_5v3'].map((c) => colIndex[c]);
        const shCols = ['toi_4v5', 'toi_3v4', 'toi_3v5'].map((c) => colIndex[c]);

        const result = [];
        Object.keys(toiRaw.others).forEach(function (otherId) {
            let games = 0;
            let totalToi = 0;
            let toi5v5 = 0;
            let toi3v3 = 0;
            let toiPp = 0;
            let toiSh = 0;
            let toi5v4 = 0;
            let toi5v3 = 0;
            let toi4v5 = 0;
            let toi3v5 = 0;
            toiRaw.others[otherId].forEach(function (row) {
                const context = gameContextById[row[colIndex.game_id]];
                if (!context || !gameFilter(context)) {
                    return;
                }
                games += 1;
                totalToi += row[colIndex.toi];
                toi5v5 += row[colIndex.toi_5v5];
                toi3v3 += row[colIndex.toi_3v3];
                toi5v4 += row[colIndex.toi_5v4];
                toi5v3 += row[colIndex.toi_5v3];
                toi4v5 += row[colIndex.toi_4v5];
                toi3v5 += row[colIndex.toi_3v5];
                ppCols.forEach(function (i) {
                    toiPp += row[i];
                });
                shCols.forEach(function (i) {
                    toiSh += row[i];
                });
            });
            if (games > 0) {
                const other = playersById[otherId];
                result.push({
                    player_id: otherId,
                    full_name: other ? other.full_name : otherId,
                    last_name: other ? other.last_name : otherId,
                    first_name: other ? other.first_name : '',
                    position: other
                        ? other.position == 'DE'
                            ? 'D'
                            : other.position == 'FO'
                              ? 'F'
                              : other.position
                        : '',
                    team: other ? other.team : '',
                    team_location: other ? teamLocationLookup[other.team] || other.team : '',
                    games_together: games,
                    toi: totalToi,
                    toi_5v5: toi5v5,
                    toi_3v3: toi3v3,
                    toi_pp: toiPp,
                    toi_5v4: toi5v4,
                    toi_5v3: toi5v3,
                    toi_sh: toiSh,
                    toi_4v5: toi4v5,
                    toi_3v5: toi3v5,
                });
            }
        });
        return result;
    }

    // sorts a getPartnerStats() result by sortCriterion, breaking ties using TOI_TIE_BREAKS.
    // Implemented by hand (rather than passing a [criterion, tieBreak] array to Angular's
    // orderBy filter) so the comparison logic is simple to verify directly.
    function getSortedToiStats(toiRows, sortCriterion, sortDescending) {
        const tieBreakKey = TOI_TIE_BREAKS[sortCriterion];
        const dir = sortDescending ? -1 : 1;
        return toiRows.slice().sort(function (a, b) {
            if (a[sortCriterion] !== b[sortCriterion]) {
                return a[sortCriterion] > b[sortCriterion] ? dir : -dir;
            }
            if (tieBreakKey && a[tieBreakKey] !== b[tieBreakKey]) {
                return a[tieBreakKey] > b[tieBreakKey] ? dir : -dir;
            }
            return 0;
        });
    }

    // heatmap background for a TOI cell: white at 0, solid blue (matching the #5588bb accent
    // already used for shot-zone highlighting) at the current maximum for that field within
    // statsArray - i.e. relative to whatever's currently filtered/shown, not a fixed scale.
    function getHeatStyle(value, statsArray, field) {
        if (!statsArray || !statsArray.length) {
            return {};
        }
        const max = Math.max.apply(
            Math,
            statsArray.map(function (s) {
                return s[field];
            }),
        );
        if (!max) {
            return {};
        }
        const ratio = value / max;
        const r = Math.round(255 + (85 - 255) * ratio);
        const g = Math.round(255 + (136 - 255) * ratio);
        const b = Math.round(255 + (187 - 255) * ratio);
        return { 'background-color': 'rgb(' + r + ',' + g + ',' + b + ')' };
    }

    const api = {
        TOI_TIE_BREAKS: TOI_TIE_BREAKS,
        TOI_COLUMNS: TOI_COLUMNS,
        getPartnerStats: getPartnerStats,
        getSortedToiStats: getSortedToiStats,
        getHeatStyle: getHeatStyle,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ToiStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
