app.controller('teamTriviaController', function ($scope, $http, config, svc, cfgLoader) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Team-Trivia');

    ctrl.defaultSeason = config.defaultSeason;
    ctrl.dataCache = {};
    ctrl.categorySelect = '';
    ctrl.seasonTypeSelect = '';

    // sorting by the team column sorts by location rather than by abbreviation,
    // since the table displays the full team name; different categories use
    // different field names for the team abbreviation (e.g. "team" vs "team_abbr")
    let sortByTeamLocation = function (row, field) {
        return ctrl.team_location_lookup ? ctrl.team_location_lookup[row[field]] : row[field];
    };
    ctrl.sortCriteria = {
        team: (row) => sortByTeamLocation(row, 'team'),
        team_abbr: (row) => sortByTeamLocation(row, 'team_abbr'),
    };

    // retrieving category/column configuration, defaulting to the first defined category
    $http.get('./cfg/columns_team_trivia.json').then(function (res) {
        ctrl.categories = res.data;
        ctrl.categorySelect = Object.keys(res.data)[0];
        ctrl.changeCategory();
    });

    // retrieving all teams that were ever active in the DEL, for the team filter
    // and for displaying full team names sorted by location
    cfgLoader.teamsHistoric().then(function (res) {
        let orig_teams = res.data;
        let active_teams = orig_teams
            .filter((team) => team.active)
            .sort((a, b) => (a.location > b.location ? 1 : -1))
            .map((team) => team.abbr);
        let inactive_teams = orig_teams
            .filter((team) => !team.active)
            .sort((a, b) => (a.location > b.location ? 1 : -1))
            .map((team) => team.abbr);
        ctrl.all_teams = active_teams.concat(inactive_teams);
        ctrl.team_full_name_lookup = orig_teams.reduce(
            (o, team) => Object.assign(o, { [team.abbr]: team.full_name }),
            {},
        );
        ctrl.team_location_lookup = orig_teams.reduce(
            (o, team) => Object.assign(o, { [team.abbr]: team.location }),
            {},
        );
    });

    ctrl.currentCategory = function () {
        return ctrl.categories ? ctrl.categories[ctrl.categorySelect] : null;
    };

    ctrl.currentSeasonType = function () {
        let category = ctrl.currentCategory();
        return category ? category.season_types[ctrl.seasonTypeSelect] : null;
    };

    ctrl.applyDefaultSort = function () {
        let seasonType = ctrl.currentSeasonType();
        if (!seasonType) return;
        ctrl.sortConfig = {
            sortKey: seasonType.default_sort.data_key,
            sortCriteria: seasonType.default_sort.data_key,
            sortDescending: seasonType.default_sort.direction === 'desc',
        };
    };

    // (re-)deriving the season range available in the currently loaded category
    // data and resetting the season filter to that full range; categories whose
    // data has no single "season" field (e.g. streaks spanning a date range)
    // simply don't get a season filter
    ctrl.setSeasonBounds = function () {
        ctrl.first_season = ctrl.from_season = ctrl.last_season = ctrl.to_season = undefined;
        if (!ctrl.trivia_data || !ctrl.trivia_data.length) return;
        if (typeof ctrl.trivia_data[0].season !== 'number') return;
        let seasons = ctrl.trivia_data.map((row) => row.season);
        ctrl.first_season = ctrl.from_season = Math.min(...seasons);
        ctrl.last_season = ctrl.to_season = Math.max(...seasons);
    };

    ctrl.loadCategoryData = function () {
        let category = ctrl.currentCategory();
        if (!category) return;
        if (ctrl.dataCache[category.data_file]) {
            ctrl.trivia_data = ctrl.dataCache[category.data_file];
            ctrl.setSeasonBounds();
            return;
        }
        $http.get('data/team_trivia/' + category.data_file).then(function (res) {
            ctrl.dataCache[category.data_file] = res.data;
            ctrl.trivia_data = res.data;
            ctrl.setSeasonBounds();
        });
    };

    // switching to the newly selected category, defaulting to its first season type
    ctrl.changeCategory = function () {
        let category = ctrl.currentCategory();
        if (!category) return;
        ctrl.seasonTypeSelect = Object.keys(category.season_types)[0];
        ctrl.applyDefaultSort();
        ctrl.loadCategoryData();
    };

    // switching the season type view within the currently selected category
    ctrl.changeSeasonType = function () {
        ctrl.applyDefaultSort();
    };

    // TODO: winning_streaks.json/losing_streaks.json currently store the full team
    // name under "team" and the abbreviation under "team_abbr", unlike every other
    // category where "team" already is the abbreviation. Once those data files are
    // regenerated to consistently use "team" for the abbreviation, this lookup (and
    // the "team_column" flag in cfg/columns_team_trivia.json) can be removed again
    // in favor of a plain data_key == 'team' check.
    // finding which field of the currently displayed columns holds the team
    // abbreviation, since that field's name varies between categories
    ctrl.teamAbbrField = function () {
        let seasonType = ctrl.currentSeasonType();
        let teamCol = seasonType && seasonType.columns.find((col) => col.team_column);
        return teamCol ? teamCol.data_key : 'team';
    };

    ctrl.teamFilter = function (row) {
        return !ctrl.teamSelect || row[ctrl.teamAbbrField()] === ctrl.teamSelect;
    };

    ctrl.seasonFilter = function (row) {
        if (ctrl.first_season === undefined) return true;
        return row.season >= ctrl.from_season && row.season <= ctrl.to_season;
    };
});
