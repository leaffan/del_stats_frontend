app.controller('careerStatsController', function ($scope, $http, $routeParams, svc) {
    $scope.svc = svc;
    $scope.season_type = 'ALL';
    $scope.show_only_active = false;
    // $scope.position = 'GK';
    $scope.sortConfig = {
        'sortKey': 'pts',
        'sortCriteria': ['pts', 'ptspg', 'g', '-gp'],
        'sortDescending': true
    }
    $scope.sortCriteria = {
        "gp": ['gp', 'pts', 'g'],
        "pts": ['pts', 'ptspg', 'g', '-gp'],
        "pim": ['pim', '-gp'],
        "w": ['w', '-gp'],
        "l": ['l', 'gp'],
        "ga": ['ga', 'gp'],
        "teams_cnt": ['teams_cnt', '-teams[0]'],
        "ppg": ['ppg', '-gp'],
        "shg": ['shg', '-gp'],
        "ptspg": ['ptspg', 'pts', 'g'],
        "gpg": ['gpg', 'g', 'pts'],
        "sog": ['sog', '-gp'],
        "sh_pctg": ['sh_pctg', 'sog', '-gp'],
        "sv_pctg": ['sv_pctg', 'sa', 'toi'],
        "total_so": ['total_so', 'so', '-gp', '-toi']
    };

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/career_stats_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    $http.get('./js/teams_historic.json').then(function (res) {
        orig_teams = res.data;
        // setting teams that are valid for current season as active ones
        active_teams = orig_teams.filter(team => team.active).sort((a, b)=> (a.location > b.location ? 1 : -1)).map(team => team.abbr);
        // setting teams that are not valid for current season as inactive ones
        inactive_teams = orig_teams.filter(team => !team.active).sort((a, b)=> (a.location > b.location ? 1 : -1)).map(team => team.abbr);
        $scope.all_teams = active_teams.concat(inactive_teams);
        // setting up lookup dictionary for full team names
        $scope.team_full_name_lookup = orig_teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.full_name}), {});
    });

    // loading player information from external file
    $http.get('data/career_stats/upd_all_players.json').then(function (res) {
        $scope.players = res.data;
    });

    // loading stats from external json file
    $http.get('data/career_stats/upd_full_career_stats_stripped.json').then(function (res) {
        $scope.player_stats = res.data;
        var all_seasons = new Set();
        $scope.player_stats.forEach(element => {
            element['seasons'].forEach(season_stat_line => {
                all_seasons.add(season_stat_line['season']);
            })
        });
        $scope.min_season = Math.min(...all_seasons);
        $scope.max_season = Math.max(...all_seasons);
        $scope.from_season = $scope.min_season;
        $scope.to_season = $scope.max_season;
    });

    $scope.$watchGroup(['position', 'from_season', 'to_season', 'season_type', 'team', 'show_only_active'], function(new_values, old_values) {
        // adjusting sort order when switching between skaters and goaltenders
        if (new_values[0] == 'GK' && old_values[0] != 'GK') {
            $scope.sortConfig = $scope.setSortOrder('sv_pctg', $scope.sortConfig);
        } else if (new_values[0] != 'GK' && old_values[0] == 'GK') {
            $scope.sortConfig = $scope.setSortOrder('pts', $scope.sortConfig);
        }
        // filtering stats to adjust displayed players
        if ($scope.player_stats) {
            $scope.filtered_season_player_stats = $scope.filterCareerStats();
        }
    }, true);

    $scope.to_aggregate = [
        'gp', 'g', 'a', 'plus_minus', 'pim', 'ppg', 'shg', 'gwg', 'sog', 'toi', 'w', 'l', 'sa', 'ga', 'so', 'sl_so'];

    $scope.filterCareerStats = function() {
        filtered_career_stats = [];
        if ($scope.player_stats === undefined)
            return filtered_career_stats;
        $scope.player_stats.forEach(player => {
            player_data = $scope.players.filter(function(orig_player) {
                if (orig_player.c_id && orig_player.c_id == player.id) {
                    return true;
                } else if (orig_player.c_id && orig_player.c_id == player.id) {
                    return true;
                } else if (orig_player.g_id && orig_player.g_id == player.id) {
                    return true;
                }
                return false;
            });
            player_data = player_data[0];
            let player_ep_id = '';
            if (player_data['ep_id'] === undefined) {
                player_ep_id = 'g' + player_data['g_id'];
            } else {
                player_ep_id = 'e' + player_data['ep_id'].split("/")[0];
            }
            // setting up filtered cumulated stat line for current player
            filtered_stat_line = {
                'player_id': player_data['last_season'] < 2023 ? 'g' + player_data['g_id'] : player_data['c_player_id'] ? player_data['c_player_id'] : player_data['c_id'] ? player_data['c_id'] : 'g' + player_data['g_id'],
                'player_ep_id': player_ep_id,
                'first_name': player_data['first_name'],
                'last_name': player_data['last_name'],
                'position': player_data['position'],
                'first_season': player_data['first_season'],
                'last_season': player_data['last_season'],
                'pts': 0,
                'sh_pctg': 0.0,
                'sv_pctg': 0.0,
                'gpg': 0.0,
                'ptspg': 0.0,
                'teams': new Set()
            };
            $scope.to_aggregate.forEach(category => {
                filtered_stat_line[category] = 0;
            })
            // setting up category for goals past 1998/99 season to calculate shooting percentages properly
            filtered_stat_line['g_post_98'] = 0;

            // checking if current player is an active player
            is_active = false;
            if (player_data['last_season'] == 2023)
                is_active = true;
                
            if ($scope.show_only_active && !is_active)
                return;

            // checking if current player plays selected position
            is_selected_position = false;
            // only show skaters by default
            if (!$scope.position) {
                if (player_data['position'].startsWith('G')) {
                    is_selected_position = false;
                } else {
                    is_selected_position = true;
                }
            } else {
                if ($scope.position == 'GK' && player_data['position'].startsWith('G')) {
                    is_selected_position = true;
                } else if ($scope.position == 'DE' && player_data['position'].includes('D')) {
                    is_selected_position = true;
                } else if ($scope.position == 'FO' && !player_data['position'].startsWith('G') && !player_data['position'].includes('D')) {
                    is_selected_position = true;
                }
            }

            if (!is_selected_position)
                return;

            player['seasons'].forEach(season_stat_line => {
                in_season_range = false;
                in_season_types = false;
                is_selected_team = false;

                // checking if current stat line is from a selected season
                if (season_stat_line['season'] >= $scope.from_season && season_stat_line['season'] <= $scope.to_season)
                    in_season_range = true;
                // checking if current stat line is of a selected season type
                if ($scope.season_type == 'ALL') {
                    in_season_types = true;
                } else {
                    if ($scope.season_type == season_stat_line['season_type'])
                        in_season_types = true;
                };
                // checking if current stat line is for the selected team
                if (!$scope.team) {
                    is_selected_team = true;
                } else {
                    if (season_stat_line['team'] == $scope.team)
                        is_selected_team = true;
                };
                // finally aggregating values of all season stat lines that have been filtered
                if (in_season_range && in_season_types && is_selected_team && is_selected_position) {
                    filtered_stat_line['teams'].add(season_stat_line['team']);
                    $scope.to_aggregate.forEach(category => {
                        if (season_stat_line[category])
                            filtered_stat_line[category] += season_stat_line[category];
                    });
                    if (season_stat_line['season'] > 1998)
                        if (season_stat_line['g'])    
                            filtered_stat_line['g_post_98'] += season_stat_line['g'];
                }
            });
            filtered_stat_line['pts'] = filtered_stat_line['g'] + filtered_stat_line['a']
            // calculating shooting percentage (only using goal totals after 1998/99 season to do so)
            if (filtered_stat_line['sog'])
                filtered_stat_line['sh_pctg'] = filtered_stat_line['g_post_98'] / filtered_stat_line['sog'] * 100.;
            // calculating total shutouts
            filtered_stat_line['total_so'] = filtered_stat_line['so'] + filtered_stat_line['sl_so'];
            // calculating save percentage
            if (filtered_stat_line['sa'])
                filtered_stat_line['sv_pctg'] = 100 - (filtered_stat_line['ga'] / filtered_stat_line['sa'] * 100.);
            // calculating goals against average
            if (filtered_stat_line['toi'])
                filtered_stat_line['gaa'] = filtered_stat_line['ga'] * 3600. / filtered_stat_line['toi'];
            // calculating per-game statistics
            if (filtered_stat_line['gp']) {
                filtered_stat_line['gpg'] = filtered_stat_line['g'] / filtered_stat_line['gp'];
                // filtered_stat_line['apg'] = filtered_stat_line['a'] / filtered_stat_line['gp'];
                filtered_stat_line['ptspg'] = filtered_stat_line['pts'] / filtered_stat_line['gp'];
            };
            filtered_stat_line['teams'] = Array.from(filtered_stat_line['teams']);
            filtered_stat_line['teams_cnt'] = filtered_stat_line['teams'].length;
            filtered_career_stats.push(filtered_stat_line);
        });
        return filtered_career_stats;
    };

    $scope.setSortOrder = function(sortKey, oldSortConfig) {
        return svc.setSortOrder2(sortKey, oldSortConfig, $scope.sortCriteria, ['last_name']);
    };

    $scope.greaterThanFilter = function (prop, val) {
        return function (item) {
            return item[prop] > val;
        }
    }

});
