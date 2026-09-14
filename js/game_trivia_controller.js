app.controller('gameTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Spiel-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_game_trivia.json',
        dataFolder: 'data/historic_trivia/',
    });

    // the "Torreichstes Drittel" category is the only one with real season-type
    // variants (1./2./3. Drittel), so its variant dropdown gets its own spot in
    // the top row instead of sharing the generic (currently unused elsewhere on
    // this page) hasMultipleSeasonTypes() check
    ctrl.isGoalsPerPeriod = function () {
        return ctrl.categorySelect === 'goals_per_period';
    };

    // filters by the game's own RS/PO phase - not to be confused with
    // seasonTypeSelect, which picks the category's variant (e.g. "overall")
    ctrl.gamePhaseFilter = function (row) {
        return !ctrl.gamePhaseSelect || row.season_type === ctrl.gamePhaseSelect;
    };

    ctrl.initFromRoute();
});
