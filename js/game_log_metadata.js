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
    // Superseded by deriveRoundSelection below (round-number dedup alone
    // collides RS/PO/playoff-stage games sharing a round number - see
    // Plan.md) - kept only until player_stats_controller.js/
    // team_stats_controller.js/player_profile_controller.js/
    // team_profile_controller.js migrate onto it too, then delete.
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

    // Display order for the composite key scheme below - matches the order
    // season_type already appears in in every season_type <select> in this
    // project (MagentaSport Cup, then Hauptrunde, then Playoffs).
    var SEASON_TYPE_ORDER = ['MSC', 'RS', 'PO'];
    // Matches shot_explorer_controller.js's $scope.poRoundLabels key order.
    var PO_STAGE_ORDER = ['first_round', 'quarter_finals', 'semi_finals', 'finals'];

    // po_round is sometimes the literal string 'rnd_type' - an unresolved
    // template placeholder, a known pipeline bug, not a real stage name -
    // and is absent entirely for all RS games and most MSC games. Treated
    // the same as "unknown" regardless of which of these applies.
    function normalizedPoRound(po_round) {
        return po_round && po_round !== 'rnd_type' ? po_round : null;
    }

    function roundSortRank(entry) {
        let seasonTypeRank = SEASON_TYPE_ORDER.indexOf(entry.season_type);
        let stageRank = entry.po_round ? PO_STAGE_ORDER.indexOf(entry.po_round) : -1;
        return [
            seasonTypeRank === -1 ? SEASON_TYPE_ORDER.length : seasonTypeRank,
            stageRank === -1 ? PO_STAGE_ORDER.length : stageRank,
            entry.round,
        ];
    }

    function compareRoundEntries(a, b) {
        let aRank = roundSortRank(a);
        let bRank = roundSortRank(b);
        for (let i = 0; i < aRank.length; i++) {
            if (aRank[i] !== bRank[i]) return aRank[i] - bRank[i];
        }
        return 0;
    }

    // games: array of per-game-ish records (round, season_type, po_round?,
    //   ...) - works for per-game stat-line records AND per-shot records,
    //   since it only reads .round/.season_type/.po_round.
    //
    // Supersedes deriveRoundsPlayed's single round-number dedup, which
    // collides a regular-season round with a playoff round sharing the same
    // number, AND - since a playoff "round" is really "game N of a best-of
    // series" and resets to 1 at the start of each new playoff stage -
    // collides different playoff stages with each other too (confirmed
    // against real data: e.g. round 1 occurs in first_round, quarter_finals,
    // semi_finals AND finals of the same season). Modeled on
    // shot_explorer_controller.js's pre-existing composite-key scheme.
    // po_round isn't available yet in every data source - round+season_type
    // alone already fixes the RS-vs-PO collision, po_round additionally
    // resolves the playoff-stage collision - so this degrades gracefully
    // when po_round is absent rather than requiring it everywhere.
    function deriveRoundSelection(games) {
        let seen = {};
        let roundsPlayed = [];
        games.forEach((item) => {
            let po_round = normalizedPoRound(item.po_round);
            let key = item.round + '|' + item.season_type + '|' + (po_round || '');
            if (item.round && !seen[key]) {
                seen[key] = true;
                roundsPlayed.push({
                    round: item.round,
                    season_type: item.season_type,
                    po_round: po_round,
                    key: key,
                });
            }
        });
        roundsPlayed.sort(compareRoundEntries);

        return {
            roundsPlayed: roundsPlayed,
            fromRoundSelect: roundsPlayed.length > 0 ? roundsPlayed[0].key : '1|RS|',
            toRoundSelect:
                roundsPlayed.length > 0 ? roundsPlayed[roundsPlayed.length - 1].key : '52|RS|',
        };
    }

    const api = {
        deriveWeekdaysPlayed: deriveWeekdaysPlayed,
        deriveMonthsPlayed: deriveMonthsPlayed,
        deriveRoundsPlayed: deriveRoundsPlayed,
        deriveRoundSelection: deriveRoundSelection,
        normalizedPoRound: normalizedPoRound,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameLogMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
