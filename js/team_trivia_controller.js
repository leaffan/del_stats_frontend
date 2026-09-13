app.controller('teamTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Team-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_team_trivia.json',
        dataFolder: 'data/team_trivia/',
    });

    // sorting the "length" column (re-)applies the full tie-break chain
    // (also used as the default sort, see applyDefaultSort) rather than
    // just comparing streak length in isolation; sorting the combined
    // "W-L[-T]" record columns by win differential rather than raw win
    // count, so a small-sample 1-0 record doesn't outrank a 20-10 one
    Object.assign(ctrl.sortCriteria, {
        length: ctrl.buildSortConfig(['-length', '-score_diff', '-scores_for', 'season'])
            .sortCriteria,
        ot_w: function (row) {
            return row.ot_w - row.ot_l;
        },
        so_w: function (row) {
            return row.so_w - row.so_l;
        },
        rw: function (row) {
            return row.rw - row.rl;
        },
        ow: function (row) {
            return row.ow - row.ol;
        },
        sw: function (row) {
            return row.sw - row.sl;
        },
    });

    ctrl.initFromRoute();
});
