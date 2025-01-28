app.controller('playerCareerController', function ($scope, $http, $routeParams, svc) {

    let ctrl = this;
    $scope.svc = svc;
    $scope.player_id = $routeParams.player_id;
    $scope.season_type = 'ALL';
    $scope.has_partial_seasons = false;
    $scope.show_partial_seasons = true;

    // loading sort criteria for player stats
    $http.get('./js/sort_criteria_players.json').then(function (res) {
        ctrl.sortCriteria = res.data;
        // defining default sort configuration, consisting of...
        ctrl.sortConfig = {
            // ...name of the column to be indicated as being used for sorting
            'sortKey': 'season',
            // ...criteria for sorting (used in hierarchical order)
            'sortCriteria': ctrl.sortCriteria['season'],
            // ...indicator of initial sort direction
            'sortDescending': false
        };
        // defining default sort configuration for aggregated data by team
        ctrl.teamSeasonSortConfig = {
            'sortKey': 'gp',
            'sortCriteria': ctrl.sortCriteria['gp'],
            'sortDescending': true
        };
    });

    // loading list of stats to be aggregated
    $http.get('./js/stats_to_aggregate.json').then(function (res) {
        ctrl.statsToAggregate = res.data;
    });

    // loading criteria to calculate stats
    $http.get('./js/stats_to_calculate.json').then(function (res) {
        ctrl.statsToCalculate = res.data;
    });

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/player_career_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    // loading all (including historic) teams
    $http.get('./js/teams_historic.json').then(function (res) {
        $scope.teams = res.data;
        // creating lookup from team abbreviation to full team name
        $scope.team_full_name_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.full_name}), {});
    });

    // loading stats from external json file
    $http.get('data/career_stats/per_player/' + $scope.player_id + '.json').then(function (res) {
        $scope.player_stats = res.data;
        $scope.player_first_name = res.data.first_name;
        $scope.player_last_name = res.data.last_name;
        svc.setTitle($scope.player_first_name + " " + $scope.player_last_name + ": Karriereverlauf")
        let statsToAggregate = [];
        let statsToCalculate = [];
        if ($scope.player_stats.position.startsWith('G')) {
            statsToAggregate = ctrl.statsToAggregate['career_goalie_stats_to_aggregate']
            statsToCalculate = ctrl.statsToCalculate['goalie_stats_to_calculate']
            $scope.table_select = 'goalie_career_stats';
        } else {
            statsToAggregate = ctrl.statsToAggregate['career_skater_stats_to_aggregate']
            statsToCalculate = ctrl.statsToCalculate['skater_stats_to_calculate']
            $scope.table_select = 'skater_career_stats';
        }
        // getting all player's countries
        $scope.player_stats.countries = $scope.player_stats.country.split(", ");

        $scope.seasons = res.data.seasons;
        let all_seasons = new Set($scope.seasons.map(season => season.season));
        // retrieving (or identifying) first and last season of player career
        ctrl.first_season = $scope.player_stats.first_season ? $scope.player_stats.first_season : Math.min(...all_seasons);
        ctrl.last_season = $scope.player_stats.last_season ? $scope.player_stats.last_season : Math.max(...all_seasons);
        // retrieving (or calculating) number of seasons in player career
        $scope.no_of_seasons = $scope.player_stats.no_of_seasons ? $scope.player_stats.no_of_seasons : all_seasons.size;
        // initially setting displayed from and to seasons to initial and last season of player career
        ctrl.from_season = ctrl.first_season;
        ctrl.to_season = ctrl.last_season;

        // combining regular seasons with more than one team
        all_seasons.forEach(single_season => {
            let single_season_data = $scope.seasons.filter(season => season.season_type == 'RS' && season.season == single_season);
            if (single_season_data.length > 1) {
                $scope.has_partial_seasons = true;
                let combined_season = {}
                combined_season['season'] = single_season;
                combined_season['season_type'] = 'RS';
                combined_season['order'] = 0;
                combined_season['age'] = single_season_data[0]['age'];
                combined_season['team'] = Array.from(new Set(single_season_data.map(season => season.team))).join(", ");
                statsToAggregate.forEach(attr => {
                    combined_season[attr] = single_season_data.reduce((attr_sum, season) => {return attr_sum + season[attr];}, 0);
                });
                $scope.seasons.push(combined_season);
                single_season_data.map(season => season.partial = true);
            }
        });

        // calculating all derived stats for all of player's seasons
        $scope.svc.calculateDerivedStatsForSeasons($scope.seasons, statsToCalculate);

        // retrieving (or identifying) first and last age of player's career
        let all_ages = new Set($scope.seasons.map(season => season.age));
        $scope.min_age = $scope.from_age = Math.min(...all_ages);
        $scope.max_age = $scope.to_age = Math.max(...all_ages);
        
        // identifying all teams of player's career
        let all_teams = new Set($scope.seasons.map(season => season.team));
        $scope.all_teams = [...all_teams];
        // calculating current age
        $scope.current_age = svc.calculateAge($scope.player_stats.dob);
    });

    // definining attributes to trigger re-filtering when changed in frontend
    $scope.$watchGroup(['ctrl.from_season', 'ctrl.to_season', 'season_type', 'team', 'from_age', 'to_age', 'table_select'], function() {
        if ($scope.player_stats) {
            $scope.filtered_seasons = $scope.filterPlayerCareerStats();
        }
    }, true);

    $scope.filterPlayerCareerStats = function() {

        let filtered_seasons = [];

        // filtering seasons first
        $scope.seasons.forEach(season => {
            if ($scope.elementPassedFilters(season)) {
                filtered_seasons.push(season);
            };
        });

        // grouping filtered seasons by teams and season types
        let filteredSeasonsGroupedByTeamsAndSeasonTypes = $scope.groupSeasonsByTeamsAndSeasonTypes(filtered_seasons);

        // publishing data to controller
        ctrl.filtered_seasons_by_team = filteredSeasonsGroupedByTeamsAndSeasonTypes;
        ctrl.number_of_championships = filtered_seasons.filter(season => season.c == 1).reduce((number_of_championships, season) => {return number_of_championships + season.c;}, 0);

        // finally calculating career values
        ctrl.career_values = $scope.calculateCareerValues(filtered_seasons, $scope.player_stats['position']);

        return filtered_seasons;
    };

    $scope.groupSeasonsByTeamsAndSeasonTypes = function(filteredSeasons) {
        let seasonsGroupedByTeamsAndSeasonTypes = [];
        let statsToAggregate = [];
        let statsToCalculate = [];
        if ($scope.player_stats.position.startsWith('G')) {
            statsToAggregate = ctrl.statsToAggregate['career_goalie_stats_to_aggregate']
            statsToCalculate = ctrl.statsToCalculate['career_goalie_stats_to_calculate']
        } else {
            statsToAggregate = ctrl.statsToAggregate['career_skater_stats_to_aggregate']
            statsToCalculate = ctrl.statsToCalculate['career_skater_stats_to_calculate']
        }
        let playerTeams = Array.from(new Set(filteredSeasons.map(season => season.team)));
        playerTeams.forEach(team => {
            // skipping combined seasons
            if (team.indexOf(',') > -1) {
                return;
            }
            // not considering seasons for other teams or with order == 0, i.e. combined seasons with multiple phases
            let teamSeasons = filteredSeasons.filter(season => season.team == team && season.order > 0);
            ['ALL', 'RS', 'PO'].forEach(seasonType => {
                let teamCareer = {};
                let minMaxAges = []
                teamCareer['team'] = team;
                teamCareer['season_type'] = seasonType;
                if (seasonType == 'ALL') {
                    teamCareer['no_of_seasons'] = new Set(teamSeasons.map(season => season.season)).size;
                    minMaxAges = svc.getMinMaxFromSeasons(teamSeasons, 'age');
                    statsToAggregate.forEach(parameter => {
                        teamCareer[parameter] = teamSeasons.reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
                    });
                } else {
                    let teamTypeSeasons = teamSeasons.filter(season => season.season_type == seasonType);
                    teamCareer['no_of_seasons'] = new Set(teamTypeSeasons.map(season => season.season)).size;
                    minMaxAges = svc.getMinMaxFromSeasons(teamTypeSeasons, 'age');
                    statsToAggregate.forEach(parameter => {
                        teamCareer[parameter] = teamTypeSeasons.reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
                    });
                };

                $scope.svc.calculateDerivedStats(teamCareer, statsToCalculate);
                
                teamCareer['championships'] = teamSeasons.filter(season => season.c == 1).reduce((number_of_championships, season) => {return number_of_championships + season.c;}, 0);
                teamCareer['min_age'] = minMaxAges[0];
                teamCareer['max_age'] = minMaxAges[1];
                seasonsGroupedByTeamsAndSeasonTypes.push(teamCareer);
            });
        });
        return seasonsGroupedByTeamsAndSeasonTypes;
    };

    $scope.calculateCareerValues = function(filteredSeasons, plrPosition) {
        let careers = {};
        let statsToAggregate = [];
        let statsToCalculate = []
        if (plrPosition.startsWith('G')) {
            statsToAggregate = ctrl.statsToAggregate['career_goalie_stats_to_aggregate'];
            statsToCalculate = ctrl.statsToCalculate['career_goalie_stats_to_calculate'];
        } else {
            statsToAggregate = ctrl.statsToAggregate['career_skater_stats_to_aggregate'];
            statsToCalculate = ctrl.statsToCalculate['career_skater_stats_to_calculate'];
        }
        filteredSeasons = filteredSeasons.filter(season => season.order > 0);
        ['ALL', 'RS', 'PO'].forEach(seasonType => {
            let seasonTypeCareer = {};
            seasonTypeCareer['total_teams'] = svc.getNumberOfUniqueItemsInSeasons(filteredSeasons, 'team', '', seasonType);
            seasonTypeCareer['total_seasons'] = svc.getNumberOfUniqueItemsInSeasons(filteredSeasons, 'season', '', seasonType);
            if (seasonType == 'ALL') {
                statsToAggregate.forEach(parameter => {
                    seasonTypeCareer[parameter] = filteredSeasons.reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
                })
            } else {
                statsToAggregate.forEach(parameter => {
                    seasonTypeCareer[parameter] = filteredSeasons.filter(season => season.season_type == seasonType).reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
                })
            }
            $scope.svc.calculateDerivedStats(seasonTypeCareer, statsToCalculate);
            careers[seasonType] = seasonTypeCareer;
        });
        return careers;
    };

    $scope.elementPassedFilters = function(element) {

        let is_selected_season_type = false;
        let is_selected_team = false;
        let is_equal_past_from_season = false;
        let is_prior_equal_to_season = false;
        let is_equal_older_from_age = false;
        let is_younger_equal_to_age = false;

        // testing for selected season type
        if ($scope.season_type == 'ALL' || $scope.season_type == element['season_type']) {
            is_selected_season_type = true;
        }

        // testing for selected from season
        if (ctrl.from_season) {
            if (element['season'] >= ctrl.from_season)
                is_equal_past_from_season = true;
        } else {
            is_equal_past_from_season = true;
        }

        // testing for selected to season
        if (ctrl.to_season) {
            if (element['season'] <= ctrl.to_season)
                is_prior_equal_to_season = true;
        } else {
            is_prior_equal_to_season = true;
        }

        // testing for selected from age
        if ($scope.from_age) {
            if (element['age'] >= $scope.from_age)
                is_equal_older_from_age = true;
        } else {
            is_equal_older_from_age = true;
        }

        // testing for selected to age
        if ($scope.to_age) {
            if (element['age'] <= $scope.to_age)
                is_younger_equal_to_age = true;
        } else {
            is_younger_equal_to_age = true;
        }
        
        // testing for selected team
        if ($scope.team) {
            if (element['team'] == $scope.team)
                is_selected_team = true;
        } else {
            is_selected_team = true;
        }

        return ([
            is_selected_season_type, is_selected_team, is_equal_past_from_season, is_prior_equal_to_season,
            is_equal_older_from_age, is_younger_equal_to_age
        ].every(Boolean))

    };

    ctrl.partialSeasonFilter = function(a) {
        if (a.partial === undefined) {
            return true;
        }
        if ($scope.show_partial_seasons) {
            return true;
        } else {
            return !a.partial;
        }
    };


});
