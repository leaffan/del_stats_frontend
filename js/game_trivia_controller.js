app.controller('gameTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Spiel-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_game_trivia.json',
        dataFolder: 'data/team_trivia/',
    });

    ctrl.oppFilter = function (row) {
        return !ctrl.oppSelect || row.opp === ctrl.oppSelect;
    };

    // filters by the game's own RS/PO phase - not to be confused with
    // seasonTypeSelect, which picks the category's variant (e.g. "overall")
    ctrl.gamePhaseFilter = function (row) {
        return !ctrl.gamePhaseSelect || row.season_type === ctrl.gamePhaseSelect;
    };

    ctrl.initFromRoute();
});
