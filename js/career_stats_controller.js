app.controller('careerStatsController', ['$scope', '$http', '$window', 'svc', 'config', function ($scope, $http, $window, svc, config) {
    let ctrl = this;
    $scope.svc = svc;
    $scope.table_type = 'skater_career_stats';
    $scope.season_type = 'ALL';
    $scope.show_only_active = false;
    $scope.aggregate_season = true;
    ctrl.display_games_with_other_teams = false;
    ctrl.display_single_seasons = false;
    ctrl.limit = 100;

    $window.onscroll = function() {
        let pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.offsetHeight;
        let max = document.documentElement.scrollHeight;
        if (pos >= max) {
            $scope.$apply(loadMoreRecords());
        }
    };

    // loading list of stats to be aggregated
    $http.get('./js/stats_to_aggregate.json').then(function (res) {
        ctrl.statsToAggregate = res.data;
    });

    // loading criteria to calculate stats
    $http.get('./js/stats_to_calculate.json').then(function (res) {
        ctrl.statsToCalculate = res.data;
    });

    // loading sort criteria for displayed tables
    $http.get('./js/sort_criteria_tables.json').then(function (res) {
        ctrl.tableSortCriteria = res.data;
    });

    // loading sort criteria for player stats
    $http.get('./js/sort_criteria_players.json').then(function (res) {
        ctrl.sortCriteria = res.data;
    });

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/career_stats_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    $http.get('./js/teams_historic.json').then(function (res) {
        let orig_teams = res.data;
        // setting teams that are valid for current season as active ones
        let active_teams = orig_teams.filter(team => team.active).sort((a, b)=> (a.location > b.location ? 1 : -1)).map(team => team.abbr);
        // setting teams that are not valid for current season as inactive ones
        let inactive_teams = orig_teams.filter(team => !team.active).sort((a, b)=> (a.location > b.location ? 1 : -1)).map(team => team.abbr);
        $scope.all_teams = active_teams.concat(inactive_teams);
        // setting up lookup dictionary for full team names
        $scope.team_full_name_lookup = orig_teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.full_name}), {});
    });

    // loading player information from external file
    $http.get('data/career_stats/upd_all_players.json').then(function (res) {
        $scope.players = res.data;
        let all_hands = new Set($scope.players.map(player => player['hand']));
        let all_countries = new Set($scope.players.map(player => player['country'].split(", ")).flat());
        $http.get('js/iso_countries.json').then(function (res) {
            let country_mapping = res.data;
            $scope.display_countries = []
            all_countries.forEach(iso_country => {
                let plrs_per_country = $scope.players.filter((player) => player.country.includes(iso_country)).length;
                $scope.display_countries.push({
                    'iso_country': iso_country,
                    'country': country_mapping[iso_country],
                    'count': plrs_per_country
                })
            });
            $scope.display_countries.sort((a, b)=> (a.count < b.count ? 1 : -1))
        });
    });

    // loading stats from external json file
    $http.get('data/career_stats/upd_full_career_stats_stripped.json').then(function (res) {
        $scope.player_stats = res.data;

        let all_seasons = new Set($scope.player_stats.map(career => career['seasons']).flat().map(season => season['season']));
        let all_ages = new Set($scope.player_stats.map(career => career['seasons']).flat().map(season => season['age']).filter(Number.isFinite));

        ctrl.first_season = ctrl.from_season = Math.min(...all_seasons);
        ctrl.last_season = ctrl.to_season = Math.max(...all_seasons);
        ctrl.min_age = ctrl.from_age = Math.min(...all_ages);
        ctrl.max_age = ctrl.to_age = Math.max(...all_ages);
    });

    $scope.$watchGroup([
        'country', 'team', 'position', 'season_type',
        'ctrl.from_season', 'ctrl.to_season', 'ctrl.from_age', 'ctrl.to_age',
        'table_type', 'show_only_active', 'ctrl.display_games_with_other_teams',
        'ctrl.display_single_seasons'
    ], function(new_values, old_values) {
        // if (old_values != new_values)
        //     console.log(old_values, "=>", new_values, old_values === new_values);
        // setting sort criteria according to selected table type
        if (ctrl.tableSortCriteria) {
            let sortKey = ctrl.tableSortCriteria[$scope.table_type]        
            ctrl.sortConfig = {
                'sortKey': sortKey,
                'sortCriteria': ctrl.sortCriteria[sortKey] || sortKey,
                'sortDescending': true
            };
        }
        // filtering player career stats
        if (ctrl.display_single_seasons) {
            $scope.filtered_season_player_stats = $scope.filterSingleSeasons();
        } else {
            $scope.filtered_season_player_stats = $scope.filterCareerStats();
        }
        // re-setting limit of displayed rows
        ctrl.limit = 100;
    });

    // identifies whether specified player is of interest according to defined filters
    $scope.filterPlayer = function(player) {
        if (!['skater_career_stats', 'goalie_career_stats'].includes($scope.table_type) && player['position'].includes('G'))
            return false;
        if ($scope.show_only_active && player['last_season'] != config.defaultSeason)
            return false;
        if ($scope.position) {
            if ($scope.position == 'DE' && !player['position'].includes('D'))
                return false;
            if ($scope.position == 'GK' && !player['position'].includes('G'))
                return false;
            if ($scope.position == 'FO' && (player['position'].includes('G') || player['position'].includes('D')))
                return false;
        }
        if (ctrl.from_season > player['last_season'])
            return false;
        if (ctrl.to_season < player['first_season'])
            return false;
        if ($scope.country) {
            if ($scope.country == 'non_de') {
                if (player['country'].includes('de'))
                    return false;
            } else {
                if (!player['country'].includes($scope.country))
                    return false;
            }
        }

        return true;
    };

    $scope.filterPlayerSeasons = function(player_season, player_teams) {
        if (player_season['season'] < ctrl.from_season)
            return false;
        if (player_season['season'] > ctrl.to_season)
            return false;
        if (ctrl.from_age != $scope.min_age && (player_season['age'] < ctrl.from_age || player_season['age'] === undefined))
            return false;
        if (ctrl.to_age != $scope.max_age && (player_season['age'] > ctrl.to_age || player_season['age'] === undefined))
            return false;
        if ($scope.season_type != 'ALL' && player_season['season_type'] != $scope.season_type)
            return false;
        if ($scope.team) {
            if (ctrl.display_games_with_other_teams) {
                if (!player_teams.has($scope.team))
                    return false
            } else {
                if (player_season['team'] != $scope.team)
                    return false;                
            }
        }
        return true;
    };

    $scope.preparePlayer = function(player) {
        return {
            'player_id': player['last_season'] < config.defaultSeason ? 'g' + player['g_id'] : player['c_id'], 
            'first_name': player['first_name'],
            'last_name': player['last_name'],
            'position': player['position'],
            'country': player['country'].split(", "),
            'first_season': player['first_season'],
            'last_season': player['last_season'],
        };
    };

    $scope.filterSingleSeasons = function() {
        if ($scope.players === undefined)
            return;
        let players_of_interest = $scope.players.filter(function(player) {
            return $scope.filterPlayer(player);
        });
        let filtered_season_stats = [];
        players_of_interest.forEach(player => {
            let player_seasons = $scope.player_stats.filter(career => (career['id'] == player['g_id'] || career['id'] == player['c_id'])).map(career => career['seasons']).flat();
            let player_teams = new Set(player_seasons.map(player_season => player_season.team));
            if (!['skater_career_stats', 'goalie_career_stats'].includes($scope.table_type)) {
                player_seasons = player_seasons.filter(season => season.season >= 2018);
            }
            player_seasons = player_seasons.filter(function(player_season) {
                return $scope.filterPlayerSeasons(player_season, player_teams);
            });
            if (player_seasons.length < 1)
                return;
            let seasons_played = new Set(player_seasons.map(season => season['season']));
            let stats_to_fill_up;
            let stats_to_calculate;
            if (player.position.startsWith('G')) {
                stats_to_fill_up = ctrl.statsToAggregate['career_goalie_stats_to_aggregate'];
                stats_to_calculate = ctrl.statsToCalculate['career_goalie_stats_to_calculate'];
            } else {
                stats_to_fill_up = ctrl.statsToAggregate['career_skater_stats_to_aggregate'];
                stats_to_calculate = ctrl.statsToCalculate['career_skater_stats_to_calculate'];
            }
            seasons_played.forEach(season => {
                let player_season_stats = player_seasons.filter(single_season => single_season.season == season);
                let championships = player_season_stats.filter(single_season => single_season.c == 1).length;
                ['RS', 'PO'].forEach(seasonType => {
                    let player_season_type_stats = player_season_stats.filter(single_season => single_season.season_type == seasonType);
                    if (player_season_type_stats.length < 1)
                        return;
                    let filtered_stat_line = $scope.preparePlayer(player);
                    filtered_stat_line['season'] = player_season_type_stats[0]['season'];
                    filtered_stat_line['season_type'] = player_season_type_stats[0]['season_type'];
                    filtered_stat_line['age'] = player_season_type_stats[0]['age'];
                    filtered_stat_line['championships'] = championships > 0 ? 1 : 0;
                    filtered_stat_line['teams'] = Array.from(new Set(player_season_type_stats.map(season => season['team'])));
                    filtered_stat_line['teams_cnt'] = filtered_stat_line['teams'].length;
                    stats_to_fill_up.forEach(parameter => {
                        filtered_stat_line[parameter] = player_season_type_stats.reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
                    })
                    if (filtered_stat_line['season'] > 1998)
                        filtered_stat_line['g_post_1998'] = filtered_stat_line['g'];
                    $scope.calculateStatsForStatline(stats_to_calculate, filtered_stat_line);
                    filtered_season_stats.push(filtered_stat_line);
                });
            });
        });
        return filtered_season_stats;
    };

    $scope.filterCareerStats = function() {
        if ($scope.players === undefined)
            return;
        let filtered_career_stats = [];
        let players_of_interest = $scope.players.filter(function(player) {
            return $scope.filterPlayer(player);
        });

        players_of_interest.forEach(player => {
            let player_seasons = $scope.player_stats.filter(career => (career['id'] == player['g_id'] || career['id'] == player['c_id'])).map(career => career['seasons']).flat();
            let player_teams = new Set(player_seasons.map(player_season => player_season.team));
            if (!['skater_career_stats', 'goalie_career_stats'].includes($scope.table_type)) {
                player_seasons = player_seasons.filter(season => season.season >= 2018);
            }
            player_seasons = player_seasons.filter(function(player_season) {
                return $scope.filterPlayerSeasons(player_season, player_teams);
            });
            if (player_seasons.length < 1)
                return;
            // setting up filtered cumulated stat line for current player
            let filtered_stat_line = $scope.preparePlayer(player);
            filtered_stat_line['teams'] = new Set(player_seasons.map(season => season['team']));
            let stats_to_aggregate;
            let stats_to_calculate;
            if (player.position.startsWith('G')) {
                stats_to_aggregate = ctrl.statsToAggregate['career_goalie_stats_to_aggregate'];
                stats_to_calculate = ctrl.statsToCalculate['career_goalie_stats_to_calculate'];
            } else {
                stats_to_aggregate = ctrl.statsToAggregate['career_skater_stats_to_aggregate'];
                stats_to_calculate = ctrl.statsToCalculate['career_skater_stats_to_calculate'];
            }
            if (stats_to_calculate == undefined)
                return;
            stats_to_aggregate.forEach(parameter => {
                filtered_stat_line[parameter] = player_seasons.reduce((param, season) => {return param + (season[parameter] || 0);}, 0);
            })
            filtered_stat_line['g_post_1998'] = player_seasons.filter(season => season.season > 1998).reduce((param, season) => {return param + (season['g'] || 0);}, 0);
            $scope.calculateStatsForStatline(stats_to_calculate, filtered_stat_line);
            filtered_stat_line['championships'] = player_seasons.filter(season => season.c == 1).length;
            filtered_stat_line['teams'] = Array.from(filtered_stat_line['teams']);
            filtered_stat_line['teams_cnt'] = filtered_stat_line['teams'].length;
            filtered_career_stats.push(filtered_stat_line);
        });
        return filtered_career_stats;
    };

    $scope.calculateStatsForStatline = function(stats_to_calculate, filtered_stat_line) {
        stats_to_calculate.forEach(calculation_cfg => {
            if (calculation_cfg.type == 'sum') {
                filtered_stat_line[calculation_cfg.name] = filtered_stat_line[calculation_cfg.summand_1] + filtered_stat_line[calculation_cfg.summand_2];
            }
            if (calculation_cfg.type == 'rate') {
                filtered_stat_line[calculation_cfg.name] = svc.calculateRate(filtered_stat_line[calculation_cfg.numerator], filtered_stat_line[calculation_cfg.denominator]);
            }
            if (calculation_cfg.type == 'rate_with_factor') {
                filtered_stat_line[calculation_cfg.name] = svc.calculateRate(filtered_stat_line[calculation_cfg.numerator], filtered_stat_line[calculation_cfg.denominator], calculation_cfg.factor);
            }
            if (calculation_cfg.type == 'difference') {
                filtered_stat_line[calculation_cfg.name] = filtered_stat_line[calculation_cfg.minuend] - filtered_stat_line[calculation_cfg.subtrahend];
            }
            if (calculation_cfg.type == 'percentage') {
                filtered_stat_line[calculation_cfg.name] = svc.calculatePercentage(filtered_stat_line[calculation_cfg.value], filtered_stat_line[calculation_cfg.base]);
            }
            if (calculation_cfg.type == 'from_100_percentage') {
                filtered_stat_line[calculation_cfg.name] = svc.calculateFrom100Percentage(filtered_stat_line[calculation_cfg.value], filtered_stat_line[calculation_cfg.base]);
            }
        });
    };

    let loadMoreRecords = function () {
        ctrl.limit += 100;
    };

}]);