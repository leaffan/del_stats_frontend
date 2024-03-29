app.controller('plrCareerController', function ($scope, $http, $routeParams, svc) {
    $scope.svc = svc;
    $scope.player_id = $routeParams.player_id;
    $scope.table_select = 'skater_career_stats';
    $scope.season_type = 'ALL';
    $scope.sortConfig = {
        'sortKey': 'season',
        'sortCriteria': ['-season', 'season_type', '-order'],
        'sortDescending': true
    }
    $scope.sortCriteria = {
        "gp": ['gp', 'pts', 'g'],
        "g": ['g', '-gp'],
        "sog": ['sog', '-gp'],
        "season_type": ['season_type', '-season'],
        "season": ['-season', 'season_type', '-order'],
        "total_so": ['total_so', 'so', '-gp']
    };

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/player_career_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    $http.get('./js/teams_historic.json').then(function (res) {
        // only retaining teams that are valid for current season
        $scope.teams = res.data;
        $scope.team_full_name_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.full_name}), {});
    });

    // loading stats from external json file
    $http.get('data/career_stats/per_player/' + $scope.player_id + '.json').then(function (res) {
        $scope.player_stats = res.data;
        $scope.player_first_name = res.data.first_name;
        $scope.player_last_name = res.data.last_name;
        if (res.data.position.startsWith('G')) {
            $scope.table_select = 'goalie_career_stats';
        }
        $scope.seasons = res.data.seasons;
        var all_seasons = new Set()
        var all_teams = new Set()
        $scope.seasons.forEach(season_stat_line => {
            all_seasons.add(season_stat_line['season']);
            all_teams.add(season_stat_line['team']);
        });
        $scope.min_season = Math.min(...all_seasons);
        $scope.max_season = Math.max(...all_seasons);
        $scope.from_season = $scope.min_season;
        $scope.to_season = $scope.max_season;
        $scope.first_season = res.data.first_season ? res.data.first_season : $scope.from_season;
        $scope.last_season = res.data.last_season ? res.data.last_season : $scope.to_season;
        $scope.all_teams = [...all_teams];
    });

    $scope.$watchGroup(['from_season', 'to_season', 'season_type', 'team'], function() {
        if ($scope.player_stats) {
            $scope.filtered_seasons = $scope.filterPlayerCareerStats();
        }
    }, true);

    $scope.filterPlayerCareerStats = function() {
        var filtered_seasons = [];
        var filtered_regular_seasons = [];
        var filtered_playoff_seasons = [];
        var unique_filtered_seasons = new Set();
        var unique_filtered_regular_seasons = new Set();
        var unique_filtered_regular_season_teams = new Set();
        var unique_filtered_playoff_seasons = new Set();
        var unique_filtered_playoff_season_teams = new Set();
        var unique_filtered_teams = new Set();
        if ($scope.player_stats === undefined)
            return filtered_career_stats;
        $scope.seasons.forEach(season => {
            if ($scope.elementPassedFilters(season)) {
                filtered_seasons.push(season);
                unique_filtered_seasons.add(season['season']);
                unique_filtered_teams.add(season['team']);
                if (season['season_type'] == 'RS') {
                    filtered_regular_seasons.push(season);
                    unique_filtered_regular_seasons.add(season['season']);
                    unique_filtered_regular_season_teams.add(season['team']);
                }
                if (season['season_type'] == 'PO') {
                    filtered_playoff_seasons.push(season);
                    unique_filtered_playoff_seasons.add(season['season']);
                    unique_filtered_playoff_season_teams.add(season['team']);
                }
                season['sv_pctg'] = 100 - (season['ga'] / season['sa'] * 100);
                season['total_so'] = season['so'] + season['sl_so'];
                season['gaa'] = season['ga'] * 3600 / season['toi'];
                season['gpg'] = season['g'] / season['gp'];
                season['ptspg'] = season['pts'] / season['gp'];
                if (season['sog'] > 0) {
                    season['sh_pctg'] = season['g'] / season['sog'] * 100;
                } else {
                    season['sh_pctg'] = 0.;
                }
            }
        });
        $scope.min_filtered_regular_season = Math.min(...unique_filtered_regular_seasons);
        $scope.min_filtered_playoff_season = Math.min(...unique_filtered_playoff_seasons);
        $scope.min_filtered_season = Math.min(...unique_filtered_seasons);
        $scope.number_of_seasons = unique_filtered_seasons.size;
        $scope.number_of_regular_seasons = unique_filtered_regular_seasons.size;
        $scope.number_of_playoff_seasons = unique_filtered_playoff_seasons.size;
        $scope.number_of_teams = unique_filtered_teams.size;
        $scope.number_of_regular_season_teams = unique_filtered_regular_season_teams.size;
        $scope.number_of_playoff_season_teams = unique_filtered_playoff_season_teams.size;
        $scope.filtered_playoff_seasons = filtered_playoff_seasons;
        $scope.filtered_regular_seasons = filtered_regular_seasons;
        if ($scope.player_stats.position.startsWith('G')) {
            $scope.toi_post_1998 = filtered_seasons.filter(season => season.season > 1998).reduce((sum_toi_post_1998, season) => {return sum_toi_post_1998 + season.toi;}, 0);
            $scope.regular_toi_post_1998 = filtered_regular_seasons.filter(season => season.season > 1998).reduce((sum_toi_post_1998, season) => {return sum_toi_post_1998 + season.toi;}, 0);
            $scope.playoff_toi_post_1998 = filtered_playoff_seasons.filter(season => season.season > 1998).reduce((sum_toi_post_1998, season) => {return sum_toi_post_1998 + season.toi;}, 0);
        } else {
            $scope.goals_post_1998 = filtered_seasons.filter(season => season.season > 1998).reduce((sum_goals_post_1998, season) => {return sum_goals_post_1998 + season.g;}, 0);
            $scope.regular_goals_post_1998 = filtered_regular_seasons.filter(season => season.season > 1998).reduce((sum_goals_post_1998, season) => {return sum_goals_post_1998 + season.g;}, 0);
            $scope.playoff_goals_post_1998 = filtered_playoff_seasons.filter(season => season.season > 1998).reduce((sum_goals_post_1998, season) => {return sum_goals_post_1998 + season.g;}, 0);
        }
        return filtered_seasons;
    };

    $scope.elementPassedFilters = function(element) {

        is_single_season_data = false;
        is_equal_past_from_season = false;
        is_prior_equal_to_season = false;
        is_selected_team = false;
        is_selected_season_type = false;

        if (typeof(element.team) == 'string') {
            is_single_season_data = true;
        }

        // testing for selected season type
        if ($scope.season_type == 'ALL') {
            is_selected_season_type = true;
        }
        else {
            if (element['season_type'] == $scope.season_type)
                is_selected_season_type = true;
        }

        // testing for selected from season
        if ($scope.from_season) {
            if (element['season'] >= $scope.from_season)
                is_equal_past_from_season = true;
        } else {
            is_equal_past_from_season = true;
        }

        // testing for selected to season
        if ($scope.to_season) {
            if (element['season'] <= $scope.to_season)
                is_prior_equal_to_season = true;
        } else {
            is_prior_equal_to_season = true;
        }
        
        // testing for selected team
        if ($scope.team) {
            if (element['team'] == $scope.team)
                is_selected_team = true;
        } else {
            is_selected_team = true;
        }
        // finally aggregating values of all season stat lines that have been filtered
        if (
            is_equal_past_from_season && is_prior_equal_to_season &&
            is_selected_season_type && is_selected_team && is_single_season_data
        ) {
            return true;
        } else {
            return false;
        }
    }

    // function to change sort order, actually just a wrapper around a service
    // function defined above
    $scope.setSortOrder = function(sortKey, oldSortConfig) {
        return svc.setSortOrder2(sortKey, oldSortConfig, $scope.sortCriteria, ['team', 'season']);
    };

});