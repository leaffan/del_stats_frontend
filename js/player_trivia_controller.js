app.controller('playerTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Spieler-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_player_trivia.json',
        dataFolder: 'data/historic_trivia/',
    });

    // resolves a "player_column"'s id field to the id the player_career route
    // expects: a numeric c_id is used as-is, but a string is a raw g_id that
    // (unlike career_stats' pre-resolved player_id) still needs its 'g'
    // prefix added here, since per_player files for those players are named
    // "g<g_id>.json", not "<g_id>.json"
    ctrl.playerLinkId = function (row, col) {
        let id = row[col.id_field];
        return typeof id === 'string' ? 'g' + id : id;
    };

    ctrl.nameFilter = '';

    // finds the data_key of the (single) "player_column" in the current
    // season type, so the name search stays category-agnostic even though a
    // future category (hattricks, first shutouts, ...) may name its player
    // field differently than "scorer"
    ctrl.playerColumnField = function () {
        let seasonType = ctrl.currentSeasonType();
        if (!seasonType) return null;
        let col = seasonType.columns.find((col) => col.player_column);
        return col ? col.data_key : null;
    };

    ctrl.nameFilterFn = function (row) {
        if (!ctrl.nameFilter) return true;
        let field = ctrl.playerColumnField();
        if (!field) return true;
        return (row[field] || '').toLowerCase().indexOf(ctrl.nameFilter.toLowerCase()) !== -1;
    };

    // unlike the shared teamFilter (which matches a team against ANY
    // team_column field), the team filter here only narrows on the scorer's
    // own team - a fastest-goal row's home_abbr/road_abbr describe the game,
    // not necessarily who actually scored
    ctrl.teamFilter = function (row) {
        return !ctrl.teamSelect || row.team === ctrl.teamSelect;
    };

    // the opponent is whichever side of the game (home/road) wasn't the
    // scoring team
    ctrl.oppFilter = function (row) {
        if (!ctrl.oppSelect) return true;
        let opponent = row.home_abbr === row.team ? row.road_abbr : row.home_abbr;
        return opponent === ctrl.oppSelect;
    };

    ctrl.initFromRoute();
});
