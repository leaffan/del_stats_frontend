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
    var PO_STAGE_ORDER = ['first_round', 'quarter_finals', 'semi_finals', 'finals'];
    // Originally defined inline as shot_explorer_controller.js's own
    // $scope.poRoundLabels - used by roundOptionLabel below so every
    // controller using the round-selection dropdown shows the same
    // abbreviations (the dropdown's label now lives on each entry, not in
    // the template - see roundOptionLabel/deriveRoundSelection).
    var PO_STAGE_LABELS = {
        first_round: 'PO1',
        quarter_finals: 'VF',
        semi_finals: 'HF',
        finals: 'F',
    };

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

    // item: anything with .round/.season_type/.po_round (a per-game stat-line
    //   record or a per-shot record) - the single place this key format is
    //   built, shared by deriveRoundSelection below and by the round-range
    //   membership checks in js/game_filters.js and js/shot_filters.js.
    function roundKeyOf(item) {
        return item.round + '|' + item.season_type + '|' + (normalizedPoRound(item.po_round) || '');
    }

    // entry: one already-normalized {round, season_type, po_round} triple
    //   (as built by deriveRoundSelection below).
    //
    // Display label for a round-selection dropdown option. po_round gives
    // the most specific prefix when known (e.g. "VF / Spieltag 3"). When
    // it's not (still the case for player_stats_controller.js/
    // team_stats_controller.js's data sources, which don't have a po_round
    // field yet - see Plan.md), season_type is the next best thing: it's
    // always available, and at least tells a PO/MSC entry apart from an RS
    // entry sharing the same round number, even though it can't be more
    // specific than "PO"/"MSC". No prefix at all for RS, the common case.
    function roundOptionLabel(entry) {
        let prefix = '';
        if (entry.po_round) {
            prefix = (PO_STAGE_LABELS[entry.po_round] || entry.po_round) + ' / ';
        } else if (entry.season_type && entry.season_type !== 'RS') {
            prefix = entry.season_type + ' / ';
        }
        return prefix + 'Spieltag ' + entry.round;
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
            let key = roundKeyOf(item);
            if (item.round && !seen[key]) {
                seen[key] = true;
                let entry = {
                    round: item.round,
                    season_type: item.season_type,
                    po_round: normalizedPoRound(item.po_round),
                    key: key,
                };
                entry.label = roundOptionLabel(entry);
                roundsPlayed.push(entry);
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

    // roundsPlayed: the sorted {round, season_type, po_round, key}[] from
    //   deriveRoundSelection above.
    // fromRoundKey, toRoundKey: the currently selected range's keys.
    //
    // Returns the Set of keys that fall within the selected range, or null
    // when the full range is selected - callers should skip the round
    // filter entirely in that case rather than build/check a Set that would
    // just match everything. Shared by js/shot_filters.js#filterShots and
    // js/game_filters.js#gamePassesCommonFilters's callers so this
    // index-slice logic exists in exactly one place.
    function deriveValidRoundKeys(roundsPlayed, fromRoundKey, toRoundKey) {
        if (!roundsPlayed || roundsPlayed.length === 0) return null;
        let fromIdx = roundsPlayed.findIndex((r) => r.key === fromRoundKey);
        let toIdx = roundsPlayed.findIndex((r) => r.key === toRoundKey);
        if (fromIdx === -1) fromIdx = 0;
        if (toIdx === -1) toIdx = roundsPlayed.length - 1;
        if (fromIdx > 0 || toIdx < roundsPlayed.length - 1) {
            return new Set(roundsPlayed.slice(fromIdx, toIdx + 1).map((r) => r.key));
        }
        return null;
    }

    const api = {
        deriveWeekdaysPlayed: deriveWeekdaysPlayed,
        deriveMonthsPlayed: deriveMonthsPlayed,
        deriveRoundsPlayed: deriveRoundsPlayed,
        deriveRoundSelection: deriveRoundSelection,
        deriveValidRoundKeys: deriveValidRoundKeys,
        normalizedPoRound: normalizedPoRound,
        roundKeyOf: roundKeyOf,
        roundOptionLabel: roundOptionLabel,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GameLogMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
