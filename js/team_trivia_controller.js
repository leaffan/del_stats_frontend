app.controller('teamTriviaController', function ($scope, $http, config, svc) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Team-Trivia');

    ctrl.defaultSeason = config.defaultSeason;
    ctrl.dataCache = {};
    ctrl.sortCriteria = {};
    ctrl.categorySelect = '';
    ctrl.seasonTypeSelect = '';
    ctrl.teamSelect = '';

    // retrieving category/column configuration, defaulting to the first defined category
    $http.get('./cfg/columns_team_trivia.json').then(function (res) {
        ctrl.categories = res.data;
        ctrl.categorySelect = Object.keys(res.data)[0];
        ctrl.changeCategory();
    });

    // retrieving all teams that were ever active in the DEL, for the team filter
    $http.get('./cfg/teams_historic.json').then(function (res) {
        ctrl.all_teams = res.data;
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

    ctrl.loadCategoryData = function () {
        let category = ctrl.currentCategory();
        if (!category) return;
        if (ctrl.dataCache[category.data_file]) {
            ctrl.trivia_data = ctrl.dataCache[category.data_file];
            return;
        }
        $http.get('data/team_trivia/' + category.data_file).then(function (res) {
            ctrl.dataCache[category.data_file] = res.data;
            ctrl.trivia_data = res.data;
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
});
