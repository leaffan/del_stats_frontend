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

    // categories like blown_leads/comeback_wins have a dedicated "opp" field
    // with a fixed role (the team's opponent, never the team itself), so the
    // opponent filter can - and must - match it directly, regardless of
    // whether a team is also selected; without this, selecting only an
    // opponent (no team) fell back to the "some field other than teamField"
    // check below with teamField undefined, which made every team_column
    // field count as a potential opponent match, including "team" itself
    ctrl.oppFilter = function (row) {
        if (!ctrl.oppSelect) return true;
        var fields = ctrl.teamColumnFields();
        if (fields.includes('opp')) {
            return row.opp === ctrl.oppSelect;
        }
        // symmetric pairs (e.g. home_abbr/road_abbr) have no fixed "opponent"
        // role, so it only makes sense relative to whichever field the team
        // filter matched: the opponent is the other side of that same game
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
