app.controller('gameTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Spiel-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_game_trivia.json',
        dataFolder: 'data/team_trivia/',
    });

    // the "Torreichstes Drittel" category is the only one with real season-type
    // variants (1./2./3. Drittel), so its variant dropdown gets its own spot in
    // the top row instead of sharing the generic (currently unused elsewhere on
    // this page) hasMultipleSeasonTypes() check
    ctrl.isGoalsPerPeriod = function () {
        return ctrl.categorySelect === 'goals_per_period';
    };

    // generic like teamFilter: works for team/opp pairs as well as
    // home_abbr/road_abbr pairs, by requiring the opponent to sit in a
    // different team_column field than the one the selected team matched
    ctrl.oppFilter = function (row) {
        if (!ctrl.oppSelect) return true;
        var fields = ctrl.teamColumnFields();
        var teamField = ctrl.teamSelect
            ? fields.find(function (f) {
                  return row[f] === ctrl.teamSelect;
              })
            : null;
        return fields.some(function (f) {
            return f !== teamField && row[f] === ctrl.oppSelect;
        });
    };

    // filters by the game's own RS/PO phase - not to be confused with
    // seasonTypeSelect, which picks the category's variant (e.g. "overall")
    ctrl.gamePhaseFilter = function (row) {
        return !ctrl.gamePhaseSelect || row.season_type === ctrl.gamePhaseSelect;
    };

    ctrl.initFromRoute();
});
