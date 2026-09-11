app.controller('teamTriviaController', function ($scope, $http, config, svc, cfgLoader) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Team-Trivia');

    ctrl.defaultSeason = config.defaultSeason;
    ctrl.dataCache = {};
    ctrl.categorySelect = '';
    ctrl.seasonTypeSelect = '';

    // sorting by the team column sorts by location rather than by abbreviation,
    // since the table displays the full team name
    ctrl.sortCriteria = {
        team: function (row) {
            return ctrl.team_location_lookup ? ctrl.team_location_lookup[row.team] : row.team;
        },
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
    // data and resetting the season filter to that full range
    ctrl.setSeasonBounds = function () {
        if (!ctrl.trivia_data || !ctrl.trivia_data.length) return;
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

    ctrl.teamFilter = function (row) {
        return !ctrl.teamSelect || row.team === ctrl.teamSelect;
    };

    ctrl.seasonFilter = function (row) {
        return row.season >= ctrl.from_season && row.season <= ctrl.to_season;
    };
});
