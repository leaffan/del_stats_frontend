app.controller('plrStatsController', function ($scope, $http, $routeParams, $q, svc, $timeout) {

    $scope.svc = svc;
    var ctrl = this;
    $scope.season = $routeParams.season;
    svc.setTitle("DEL-Spielerstatistiken " + svc.getSeasonIdentifier($scope.season));
    // default table selection and sort criterion for skater page
    $scope.tableSelect = 'basic_stats';
    $scope.seasonTypeSelect = 'RS';
    if ($scope.season == 2024) {
        $scope.seasonTypeSelect = 'PO';
    }
    $scope.scoringStreakTypeFilter = 'points';
    $scope.minGamesPlayed = 1;
    $scope.minTimeOnIce = 0;
    $scope.minTimeOnIceInMinutes = 0;
    $scope.minTimeOnIceInMinutesFormatted = '00:00';
    $scope.minGoalieGamesPlayed = 1;
    $scope.minGoalieTimeOnIce = 0;
    $scope.minGoalieTimeOnIceInMinutes = 0;
    $scope.minGoalieTimeOnIceInMinutesFormatted = '00:00';
    $scope.showStrictStreaks = true;
    $scope.u23Check = false;
    // setting default sort configuration
    $scope.sortConfig = {
        'sortKey': 'points',
        'sortCriteria': ['points', 'goals', '-games_played', 'primary_points'],
        'sortDescending': true
    }
    $scope.fromRoundSelect = '1';
    // default filter values
    $scope.nameFilter = ''; // empty name filter
    $scope.teamSelect = ''; // empty name filter
    $scope.gamesBackSelect = '';

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/player_stats_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    // retrieving significant dates and previous year's attendance from external file
    $http.get('./data/' + $scope.season + '/dates_attendance.json').then(function (res) {
        $scope.dcup_date = moment(res.data['dates']['dcup_date']);
        $scope.reunification_date = moment(res.data['dates']['reunification_date']);
    });

    // retrieving teams
    $http.get('./js/teams.json').then(function (res) {
        // only retaining teams that are valid for current season
        $scope.teams = res.data.filter(team => team.valid_from <= $scope.season && team.valid_to >= $scope.season);
        // creating lookup structures...
        // ...for team locations
        $scope.team_location_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.location}), {});
        // ...for playoff participation indicator
        $scope.team_playoff_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.po[$scope.season]}), {});
        // ...divisions
        $scope.divisions = {};
        $scope.teams.forEach(team => {
            // only if divisions are defined for the current season
            if (team['division'][$scope.season]) {
                for (const [season_type, division_name] of Object.entries(team['division'][$scope.season])) {
                    if (!$scope.divisions[season_type]) {
                        $scope.divisions[season_type] = {};
                    }
                    if (!$scope.divisions[season_type][division_name]) {
                        $scope.divisions[season_type][division_name] = [];
                    }
                    $scope.divisions[season_type][division_name].push(team.abbr)
                };
            };
        });
    });

    // starting to watch filter selection lists
    $scope.$watchGroup([
        'homeAwaySelect', 'seasonTypeSelect', 'fromRoundSelect', 'toRoundSelect', 'weekdaySelect', 'gamesBackSelect'
    ], function (newValue, oldValue) {
        if ($scope.player_games && !$scope.tableSelect.includes('goalie')) {
            $scope.filtered_player_stats = $scope.filterStats($scope.player_games);
        }
        if ($scope.goalie_games && $scope.tableSelect.includes('goalie')) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats($scope.goalie_games);
        }
        $scope.filtered_top_game_scores = $scope.filterGameScores($scope.top_game_scores);
        $scope.filtered_bottom_game_scores = $scope.filterGameScores($scope.bottom_game_scores);
    }, true);

    // loading league-wide stats from external json file
    $http.get('data/' + $scope.season + '/del_league_stats.json').then(function (res) {
        $scope.league_data = res.data;
    });

    // loading personal player data from external json file
    $http.get('data/' + $scope.season + '/del_player_personal_data.json').then(function (res) {
        $scope.last_modified = res.data[0];
        $scope.personal_data = res.data[1];
        // retrieving countries of players
        $http.get('js/iso_countries.json').then(function (res) {
            country_mapping = res.data;
            countries_in_player_games = [...new Set($scope.personal_data.map(item => item.iso_country))].sort();
            $scope.display_countries = []
            countries_in_player_games.forEach(iso_country => {
                $scope.display_countries.push({'iso_country': iso_country, 'country': country_mapping[iso_country]})
            });
            $scope.display_countries.sort((a, b)=> (a.country > b.country ? 1 : -1))
        });
    });

    // loading strictly defined player scoring streaks from external json file
    $http.get('data/' + $scope.season + '/del_streaks_strict.json').then(function (res) {
        $scope.strict_streaks = res.data;
        $scope.streaks = $scope.strict_streaks;
    });
    // loading loosely defined player scoring streaks from external json file
    $http.get('data/' + $scope.season + '/del_streaks_loose.json').then(function (res) {
        $scope.loose_streaks = res.data;
    });

    // loading strictly defined player scoring slumps from external json file
    $http.get('data/' + $scope.season + '/del_slumps_strict.json').then(function (res) {
        $scope.strict_slumps = res.data;
        $scope.slumps = $scope.strict_slumps;
    });
    // loading loosely defined player scoring streaks from external json file
    $http.get('data/' + $scope.season + '/del_slumps_loose.json').then(function (res) {
        $scope.loose_slumps = res.data;
    });

    // loading goalie streaks from external json file
    $http.get('data/' + $scope.season + '/del_streaks_goalies.json').then(function (res) {
        $scope.goalie_streaks = res.data;
    });

    // loading game scores per game and player from external json file
    $http.get('data/' + $scope.season + '/del_game_scores_per_game_top.json').then(function (res) {
        $scope.top_game_scores = res.data;
    });
    $http.get('data/' + $scope.season + '/del_game_scores_per_game_bottom.json').then(function (res) {
        $scope.bottom_game_scores = res.data;
    });

    // wrapping loading of players around data processing to make sure the all_players objects really exists before
    // we do so
    // loading all players from external json file
    $http.get('data/del_players.json').then(function (res) {
        $scope.all_players = res.data;
        $scope.readCSV = function() {
            // http get request to read CSV file content
            $http.get('data/' + $scope.season + '/del_player_game_stats.csv').then($scope.processData);
        };
        $scope.readCSV();
        // loading goalie stats from external json file
        $http.get('data/' + $scope.season + '/del_goalie_game_stats.json').then(function (res) {
            $scope.goalie_games = res.data;
            // temporary hack to delay filtering goalie stats for a minuscule while until all player data is loaded
            // somehow we're always having problems at the beginning of seasons
            // $timeout(function(){$scope.filtered_goalie_stats = $scope.filterGoalieStats($scope.goalie_games);}, 1);
            $scope.filtered_goalie_stats = $scope.filterGoalieStats($scope.goalie_games);
        });
    });

	$scope.processData = function(allText) {
        // split content based on new line
		let allTextLines = allText.data.split(/\r\n|\n/);
		let headers = allTextLines[0].split(';');
		let lines = [];

        for (const line of allTextLines) {
            // Split content based on separator
            const data = line.split(';');
            if (data.length === headers.length) {
                const tarr = [];
                for (const header of headers) {
                    tarr.push(data[headers.indexOf(header)]);
                }
                lines.push(tarr);
            }
        }
        headers = lines[0];
        $scope.player_games = lines.slice(1).map(function(line) {
            return line.reduce(function(player_game, value, i) {
                if ($scope.svc.player_stats_to_aggregate().indexOf(headers[i]) !== -1) {
                    player_game[headers[i]] = parseInt(value);
                } else if ($scope.svc.player_float_stats_to_aggregate().indexOf(headers[i]) !== -1 ) {
                    player_game[headers[i]] = parseFloat(value);
                } else if (headers[i] == 'u23') {
                    if (value == 'True') {
                        player_game[headers[i]] = true;
                    } else {
                        player_game[headers[i]] = false;
                    }
                } else {
                    player_game[headers[i]] = value;
                }
                return player_game;
            }, {})
        });
        // retrieving all weekdays a game was played
        $scope.weekdaysPlayed = [...new Set($scope.player_games.map(item => item.weekday))].sort();
        // retrieving all months a game was played
        $scope.monthsPlayed = [...new Set($scope.player_games.map(item => moment(item.game_date).month()))];
        // retrieving rounds played
        $scope.roundsPlayed = [...new Set($scope.player_games.map(item => svc.parseInt(item.round)))].sort(function(a, b) {return a - b;});
        // retrieving maximum round played and setting round to selection to it
        $scope.toRoundSelect = Math.max.apply(Math, $scope.roundsPlayed).toString();

        // preparing player games for later filtering, i.e. retrieving personal data etc.
        $scope.prep_player_games = {};

        $scope.player_games.forEach(element => {
            plr_id = element['player_id'];
            team = element['team'];
            key = [plr_id, team]
            if ($scope.all_players === undefined || !$scope.all_players[plr_id])
                return;
            if (!$scope.prep_player_games[key]) {
                $scope.prep_player_games[key] = {};
                $scope.prep_player_games[key]['player_id'] = plr_id;
                $scope.prep_player_games[key]['first_name'] = $scope.all_players[plr_id]['first_name'];
                $scope.prep_player_games[key]['last_name'] = $scope.all_players[plr_id]['last_name'];
                $scope.prep_player_games[key]['full_name'] = $scope.all_players[plr_id]['first_name'] + ' ' + $scope.all_players[plr_id]['last_name'];
                $scope.prep_player_games[key]['age'] = $scope.all_players[plr_id]['age'];
                // setting player statuses from combined player status
                $scope.prep_player_games[key] = $scope.setPlayerStatus(element['status'], $scope.prep_player_games[key])
                $scope.prep_player_games[key]['iso_country'] = $scope.all_players[plr_id]['iso_country'];
                $scope.prep_player_games[key]['position'] = $scope.all_players[plr_id]['position'];
                $scope.prep_player_games[key]['shoots'] = $scope.all_players[plr_id]['hand'];
                $scope.prep_player_games[key]['team'] = element['team'];
                $scope.prep_player_games[key]['single_team'] = true;
                $scope.svc.player_stats_to_aggregate().forEach(category => {
                    $scope.prep_player_games[key][category] = 0;
                });
                svc.player_float_stats_to_aggregate().forEach(category => {
                    $scope.prep_player_games[key][category] = 0.0;
                });
                ctrl.statsToFilter.forEach(filterCfg => {
                    prep_player_stats[key][filterCfg.name] = 0;
                })
            };
        });
        // deactivated since initial filtering will be triggered after change of maximum round played
        // $scope.filtered_player_stats = $scope.filterStats();
	};

    // $scope.readCSV();

    $scope.filterGameScores = function(game_scores) {
        if (game_scores === undefined)
            return game_scores;
        filtered_game_scores = [];
        game_scores.forEach(element => {
            element_passed = $scope.elementPassedFilters(element)
            if (element_passed) {
                filtered_game_scores.push(element);
            }
        });
        return filtered_game_scores;
    }

    $scope.filterGoalieStats = function(stats) {
        filtered_goalie_stats = {};
        goalie_teams = {};
        if ($scope.goalie_games === undefined)
            return filtered_goalie_stats;
        $scope.goalie_games.forEach(element => {
            plr_id = element['goalie_id'];
            team = element['team'];
            key = [plr_id, team];
            if (!filtered_goalie_stats[key]) {
                filtered_goalie_stats[key] = {};
                filtered_goalie_stats[key]['player_id'] = plr_id;
                filtered_goalie_stats[key]['first_name'] = element['first_name'];
                filtered_goalie_stats[key]['last_name'] = element['last_name'];
                filtered_goalie_stats[key]['full_name'] = element['first_name'] + ' ' + element['last_name'];
                filtered_goalie_stats[key]['age'] = $scope.all_players[plr_id]['age'];
                // splitting up original player status into three single player statuses
                filtered_goalie_stats[key] = $scope.setPlayerStatus(element['status'], filtered_goalie_stats[key])
                filtered_goalie_stats[key]['iso_country'] = $scope.all_players[plr_id]['iso_country'];
                filtered_goalie_stats[key]['position'] = $scope.all_players[plr_id]['position'];
                filtered_goalie_stats[key]['team'] = element['team'];
                filtered_goalie_stats[key]['single_team'] = true;
                $scope.svc.goalie_stats_to_aggregate().forEach(category => {
                    filtered_goalie_stats[key][category] = 0;
                });
            }
            // checking whether current element passes all filters
            if ($scope.elementPassedFilters(element))
            {
                // aggregating values
                ctrl.goalieStatsToAggregate.forEach(category => {
                    filtered_goalie_stats[key][category] += (element[category] ? element[category] : 0);
                });
                // registering player's team
                if (!goalie_teams[plr_id]) {
                    goalie_teams[plr_id] = new Set();
                }
                goalie_teams[plr_id].add(team);
            }
        });

        $scope.processMultiTeamPlayers(filtered_goalie_stats, goalie_teams, true);
        filtered_goalie_stats = Object.values(filtered_goalie_stats);

        filtered_goalie_stats.forEach(element => {
            // calculating standard save percentage
            element['save_pctg'] = 100 - svc.calculatePercentage(element['goals_against'], element['shots_against']);
            if (element['toi']) {
                element['gaa'] = (element['goals_against'] * 3600.) / element['toi'];
            } else {
                element['gaa'] = 0;
            }
            // calculating grouped save percentages in even strength
            if (element['sa_5v5']) {
                element['save_pctg_5v5'] = (1 - element['ga_5v5'] / element['sa_5v5']) * 100.;
            } else {
                element['save_pctg_5v5'] = null;
            }
            if (element['sa_4v4']) {
                element['save_pctg_4v4'] = (1 - element['ga_4v4'] / element['sa_4v4']) * 100.;
            } else {
                element['save_pctg_4v4'] = null;
            }
            if (element['sa_3v3']) {
                element['save_pctg_3v3'] = (1 - element['ga_3v3'] / element['sa_3v3']) * 100.;
            } else {
                element['save_pctg_3v3'] = null;
            }
            // calculating grouped shorthanded save percentages
            if (element['sa_4v5']) {
                element['save_pctg_4v5'] = (1 - element['ga_4v5'] / element['sa_4v5']) * 100.;
            } else {
                element['save_pctg_4v5'] = null;
            }
            if (element['sa_3v4']) {
                element['save_pctg_3v4'] = (1 - element['ga_3v4'] / element['sa_3v4']) * 100.;
            } else {
                element['save_pctg_3v4'] = null;
            }
            if (element['sa_3v5']) {
                element['save_pctg_3v5'] = (1 - element['ga_3v5'] / element['sa_3v5']) * 100.;
            } else {
                element['save_pctg_3v5'] = null;
            }
            // calculating grouped powerplay save percentages
            if (element['sa_5v4']) {
                element['save_pctg_5v4'] = (1 - element['ga_5v4'] / element['sa_5v4']) * 100.;
            } else {
                element['save_pctg_5v4'] = null;
            }
            if (element['sa_4v3']) {
                element['save_pctg_4v3'] = (1 - element['ga_4v3'] / element['sa_4v3']) * 100.;
            } else {
                element['save_pctg_4v3'] = null;
            }
            if (element['sa_5v3']) {
                element['save_pctg_5v3'] = (1 - element['ga_5v3'] / element['sa_5v3']) * 100.;
            } else {
                element['save_pctg_5v3'] = null;
            }
            // calculating save percentages by shot zone
            if (element['sa_slot']) {
                element['save_pctg_slot'] = (1 - element['ga_slot'] / element['sa_slot']) * 100.;
            } else {
                element['save_pctg_slot'] = null;
            }
            if (element['sa_left']) {
                element['save_pctg_left'] = (1 - element['ga_left'] / element['sa_left']) * 100.;
            } else {
                element['save_pctg_left'] = null;
            }
            if (element['sa_right']) {
                element['save_pctg_right'] = (1 - element['ga_right'] / element['sa_right']) * 100.;
            } else {
                element['save_pctg_right'] = null;
            }
            if (element['sa_blue_line']) {
                element['save_pctg_blue_line'] = (1 - element['ga_blue_line'] / element['sa_blue_line']) * 100.;
            } else {
                element['save_pctg_blue_line'] = null;
            }
            if (element['sa_neutral_zone']) {
                element['save_pctg_neutral_zone'] = (1 - element['ga_neutral_zone'] / element['sa_neutral_zone']) * 100.;
            } else {
                element['save_pctg_neutral_zone'] = null;
            }
            // calculating save percentage in shootouts
            if (element['so_attempts_a']) {
                element['so_sv_pctg'] = (1 - element['so_goals_a'] / element['so_attempts_a']) * 100.; 
            } else {
                element['so_sv_pctg'] = null; 
            }
            // calculating total shutouts from shutouts in wins and shutouts in shootout losses
            element['total_so'] = element['so'] + element['sl_so'];
        });

        $scope.maxGoalieGamesPlayed = Math.max.apply(Math, filtered_goalie_stats.map(function(o) { return o.games_played; }));
        $scope.maxGoalieTimeOnIce = Math.max.apply(Math, filtered_goalie_stats.map(function(o) { return o.toi; }));
        $scope.maxGoalieTimeOnIceInMinutes = Math.floor($scope.maxGoalieTimeOnIce / 60);
        if ($scope.minGoalieGamesPlayed > 1) {
            filtered_goalie_stats = filtered_goalie_stats.filter(stat_line => stat_line.games_played >= $scope.minGoalieGamesPlayed);
        }
        if ($scope.minGoalieTimeOnIce > 0) {
            filtered_goalie_stats = filtered_goalie_stats.filter(stat_line => stat_line.toi >= $scope.minGoalieTimeOnIce);
        }

        return filtered_goalie_stats;
    }

    $scope.filterStatsForStatline = function(stats_to_filter, single_game, filtered_stat_line) {
        stats_to_filter.forEach(filterCfg => {
            if (filterCfg.operator == 'greater_equal' && single_game[filterCfg.criterion] >= filterCfg.value) {
                filtered_stat_line[filterCfg.name] += 1;
            }
            if (filterCfg.operator == 'less_equal' && single_game[filterCfg.criterion] <= filterCfg.value) {
                filtered_stat_line[filterCfg.name] += 1;
            }
            if (filterCfg.operator == 'greater' && single_game[filterCfg.criterion] > filterCfg.value) {
                filtered_stat_line[filterCfg.name] += 1;
            }
        });
    };

    $scope.calculateStatsForStatline = function(stats_to_calculate, filtered_stat_line) {
        stats_to_calculate.forEach(calcCfg => {
            if (calcCfg.type == 'sum') {
                filtered_stat_line[calcCfg.name] = filtered_stat_line[calcCfg.summand_1] + filtered_stat_line[calcCfg.summand_2];
            }
            if (calcCfg.type == 'rate') {
                filtered_stat_line[calcCfg.name] = svc.calculateRate(filtered_stat_line[calcCfg.numerator], filtered_stat_line[calcCfg.denominator]);
            }
            if (calcCfg.type == 'rate_per_60') {
                filtered_stat_line[calcCfg.name] = svc.calculatePer60(filtered_stat_line[calcCfg.numerator], filtered_stat_line[calcCfg.denominator]);
            }
            if (calcCfg.type == 'rate_with_factor') {
                filtered_stat_line[calcCfg.name] = svc.calculateRate(filtered_stat_line[calcCfg.numerator], filtered_stat_line[calcCfg.denominator], calcCfg.factor);
            }
            if (calcCfg.type == 'difference') {
                filtered_stat_line[calcCfg.name] = filtered_stat_line[calcCfg.minuend] - filtered_stat_line[calcCfg.subtrahend];
            }
            if (calcCfg.type == 'percentage') {
                filtered_stat_line[calcCfg.name] = svc.calculatePercentage(filtered_stat_line[calcCfg.value], filtered_stat_line[calcCfg.base]);
            }
            if (calcCfg.type == 'from_100_percentage') {
                filtered_stat_line[calcCfg.name] = svc.calculateFrom100Percentage(filtered_stat_line[calcCfg.value], filtered_stat_line[calcCfg.base]);
            }
        });
    };


    $scope.elementPassedFilters = function(element) {
        let is_equal_past_from_date = false;
        let is_prior_equal_to_date = false;
        let is_selected_home_away_type = false;
        let is_selected_game_situation = false;
        let is_selected_season_type = false;
        let is_selected_weekday = false;
        let is_equal_past_from_round = false;
        let is_prior_equal_to_round = false;
        let is_selected_games_back = false;

        // retrieving game date as moment structure
        date_to_test = moment(element.game_date);

        is_equal_past_from_date = !ctrl.fromDate || date_to_test >= ctrl.fromDate.startOf('day');
        is_prior_equal_to_date = !ctrl.toDate || date_to_test <= ctrl.toDate.startOf('day');
        is_selected_home_away_type = !$scope.homeAwaySelect || $scope.homeAwaySelect === element.home_road;
        is_selected_game_situation = !$scope.situationSelect || element[$scope.situationSelect];
        is_selected_weekday = !$scope.weekdaySelect || $scope.weekdaySelect == element.weekday;
        is_equal_past_from_round = !$scope.fromRoundSelect || element.round >= parseFloat($scope.fromRoundSelect);
        is_prior_equal_to_round = !$scope.toRoundSelect || element.round <= parseFloat($scope.toRoundSelect);
        is_selected_games_back = !$scope.gamesBackSelect || element.games_back <= $scope.gamesBackSelect;

        // testing selected season type
        if ($scope.seasonTypeSelect) {
            if ($scope.seasonTypeSelect === element.season_type)
                is_selected_season_type = true;
        } else {
            // if seasonTypeSelect is set to "Hauptrunde und Playoffs" we just want that but no pre-season games
            if (element['season_type'] != 'MSC')
                is_selected_season_type = true;
        }

        // finally combining booleans of all previous tests
        return is_equal_past_from_date && is_prior_equal_to_date &&
        is_selected_home_away_type && is_selected_game_situation &&
        is_selected_season_type && is_selected_weekday &&
        is_equal_past_from_round && is_prior_equal_to_round &&
        is_selected_games_back;
    }

    $scope.processMultiTeamPlayers = function(filtered_stats, player_teams, goalies=false) {
        // identifying multi-team players
        let multiTeamPlayers = Object.keys(player_teams).reduce((p, plr_id) => {
            if (player_teams[plr_id].size > 1) p[plr_id] = player_teams[plr_id];
            return p;
        }, {});

        // combining single-team stats of players that have dressed for multiple teams 
        Object.keys(multiTeamPlayers).forEach(plr_id => {
            teams = multiTeamPlayers[plr_id];
            key = [plr_id, teams.size];
            multiTeamPlayerStats = {}
            if (goalies) {
                ctrl.goalieStatsToAggregate.forEach(category => {
                    multiTeamPlayerStats[category] = 0;
                });
            } else {
                ctrl.statsToAggregate.forEach(category => {
                    multiTeamPlayerStats[category] = 0;
                })
                ctrl.statsToFilter.forEach(filterCfg => {
                    multiTeamPlayerStats[filterCfg.name] = 0;
                })
            }
            // aggregating numeric attributes
            teams.forEach(team => {
                plr_team_stats = filtered_stats[[plr_id, team]];
                if (goalies) {
                    ctrl.goalieStatsToAggregate.forEach(category => {
                        multiTeamPlayerStats[category] += plr_team_stats[category];
                    });
                } else {
                    ctrl.statsToAggregate.forEach(category => {
                        multiTeamPlayerStats[category] += plr_team_stats[category];
                    })
                    ctrl.statsToFilter.forEach(filterCfg => {
                        multiTeamPlayerStats[filterCfg.name] += plr_team_stats[filterCfg.name];
                    })
                }
            });
            // finally setting non-numeric attributes
            multiTeamPlayerStats['team'] = teams.size + " Tms";
            multiTeamPlayerStats['player_id'] = plr_id;
            multiTeamPlayerStats['first_name'] = plr_team_stats['first_name'];
            multiTeamPlayerStats['last_name'] = plr_team_stats['last_name'];
            multiTeamPlayerStats['full_name'] = plr_team_stats['first_name'] + ' ' + plr_team_stats['last_name'];
            multiTeamPlayerStats['age'] = plr_team_stats['age'];
            multiTeamPlayerStats['u23'] = plr_team_stats['u23'];
            multiTeamPlayerStats['iso_country'] = plr_team_stats['iso_country'];
            multiTeamPlayerStats['position'] = plr_team_stats['position'];
            // setting flag to make current dataset identifiable for multi-team content
            multiTeamPlayerStats['single_team'] = false;
            filtered_stats[[plr_id, teams]] = multiTeamPlayerStats;
        });
    }

    // loading list of stats to be aggregated
    $http.get('./js/stats_to_aggregate.json').then(function (res) {
        ctrl.statsToAggregate = res.data['season_skater_stats_to_aggregate'];
        ctrl.goalieStatsToAggregate = res.data['season_goalie_stats_to_aggregate'];
    });

    // loading criteria to calculate stats
    $http.get('./js/stats_to_calculate.json').then(function (res) {
        ctrl.statsToCalculate = res.data['season_skater_stats_to_calculate'];
        ctrl.goalieStatsToCalculate = res.data['season_goalie_stats_to_calculate'];
    });

    // loading criteria to filter stats
    $http.get('./js/stats_to_filter.json').then(function (res) {
        ctrl.statsToFilter = res.data['season_skater_stats_to_filter'];
    });

    $scope.filterStats = function(stats) {
        // copying template for filtered stats from prepared player games
        filtered_player_stats = angular.copy($scope.prep_player_games);
        player_teams = {};
        if ($scope.player_games === undefined)
            return filtered_player_stats;
        $scope.player_games.forEach(element => {
            plr_id = element['player_id'];
            team = element['team'];
            key = [plr_id, team]
            // checking whether current element passes all filters
            if ($scope.elementPassedFilters(element))
            {
                // aggregating values
                ctrl.statsToAggregate.forEach(category => {
                    filtered_player_stats[key][category] += (element[category] ? element[category] : 0);
                });
                // filtering values
                $scope.filterStatsForStatline(ctrl.statsToFilter, element, filtered_player_stats[key]);
                // registering player's team
                if (!player_teams[plr_id]) {
                    player_teams[plr_id] = new Set();
                }
                player_teams[plr_id].add(team);
            }
        });

        $scope.processMultiTeamPlayers(filtered_player_stats, player_teams);
        // flattening filtered player stats
        filtered_player_stats = Object.values(filtered_player_stats);

        filtered_player_stats.forEach(element => {
            $scope.calculateStatsForStatline(ctrl.statsToCalculate, element);
        });

        // retrieving maximum number of games played from filtered player stats
        $scope.maxGamesPlayed = Math.max.apply(Math, filtered_player_stats.map(function(o) { return o.games_played; }));
        // retrieving maximum amount of time on ice from filtered players
        $scope.maxTimeOnIce = Math.max.apply(Math, filtered_player_stats.map(function(o) { return o.time_on_ice; }));
        // converting time on ice from seconds into full minutes
        $scope.maxTimeOnIceInMinutes = Math.floor($scope.maxTimeOnIce / 60);

        // applying minimum games played filter
        if ($scope.minGamesPlayed > 1) {
            filtered_player_stats = filtered_player_stats.filter(stat_line => stat_line.games_played >= $scope.minGamesPlayed);
        }
        // applying minimum time on ice filter
        if ($scope.minTimeOnIce > 0) {
            filtered_player_stats = filtered_player_stats.filter(stat_line => stat_line.time_on_ice >= $scope.minTimeOnIce);
        }

        return filtered_player_stats;
    };

    $scope.setPlayerStatus = function(original_status, stats_item) {
        // splitting up player status into three single player statuses
        if (original_status.charAt(0) == 't') {
            stats_item['u23'] = true;
        } else {
            stats_item['u23'] = false;
        }
        if (original_status.charAt(1) == 't') {
            stats_item['u20'] = true;
        } else {
            stats_item['u20'] = false;
        }
        if (original_status.charAt(2) == 't') {
            stats_item['rookie'] = true;
        } else {
            stats_item['rookie'] = false;
        }
        return stats_item;
    }

    // default sorting criteria for all defined tables
    $scope.tableSortCriteria = {
        'player_information': 'last_name',
        'streaks': 'length',
        'slumps': 'length',
        'goalie_streaks': 'so_streak_seconds',
        'basic_stats': 'points',
        'basic_stats_5v5': 'points_5v5',
        'on_goal_shot_zones': 'shots_on_goal',
        'goal_categories': 'gw_goals',
        'goals_per_period': 'goals',
        'shot_zones': 'shots',
        'per_game_stats': 'points_per_game',
        'time_on_ice_shift_stats': 'time_on_ice',
        'power_play_stats': 'time_on_ice_pp',
        'shorthanded_stats': 'time_on_ice_sh',
        'penalty_stats': 'pim_from_events',
        'shot_stats': 'shots_on_goal',
        'shootout_stats': 'so_goals',
        'on_ice_stats': 'plus_minus',
        'on_ice_shot_stats': 'on_ice_sh_pctg',
        'on_ice_shot_on_goal_stats': 'on_ice_sog_pctg',
        'on_ice_shot_stats_5v5': 'on_ice_sh_pctg_5v5',
        'on_ice_shot_on_goal_stats_5v5': 'on_ice_sog_pctg_5v5',
        'faceoff_stats': 'faceoff_pctg',
        'faceoff_by_zone_stats': 'ozone_faceoff_pctg',
        'faceoff_by_side_stats': 'left_side_faceoff_pctg',
        'per_60_stats': 'points_per_60',
        'goalie_stats': 'save_pctg',
        'goalie_against_avg_stats': 'gsaa',
        'goalie_stats_ev': 'save_pctg_5v5',
        'goalie_stats_sh': 'save_pctg_4v5',
        'goalie_stats_pp': 'save_pctg_5v4',
        'goalie_zone_stats_near': 'save_pctg_slot',
        'goalie_zone_stats_far': 'save_pctg_blue_line',
        'goalie_shootout_stats': 'so_sv_pctg',
        'game_score_stats': 'game_score',
        'top_game_scores_per_game': 'single_game_score',
        'bottom_game_scores_per_game': 'b_single_game_score',
        'game_categories': 'two_point_games',
        'game_minutes': 'time_on_ice'
    }

    // sorting attributes to be used in ascending order
    $scope.ascendingAttrs = [
        'last_name', 'team', 'position', 'shoots',
        'date_of_birth', 'iso_country', 'gaa', 'from_date', 'to_date'
    ];

    // actual sorting criteria for various sorting attributes, including
    // criteria for tie breaking
    $scope.sortCriteria = {
        "last_name": ['last_name', 'team'],
        "points": ['points', 'goals', '-games_played', 'primary_points'],
        "points_5v5": ['points_5v5', 'goals_5v5_from_events', '-games_played', 'primary_points_5v5'],
        "assists": ['assists', '-games_played', 'primary_assists'],
        "goals": ['goals', '-games_played', 'points'],
        "sh_goals": ['sh_goals', '-time_on_ice_sh', '-games_played'],
        "games_played": ['games_played', '-team'],
        "length": ['length', 'points', 'from_date'],
        "so_streak_seconds": ['so_streak_seconds'],
        "save_pctg_blue_line": ['save_pctg_blue_line', 'sa_blue_line'],
        'save_pctg_slot': ['save_pctg_slot', 'sa_slot'],
        'save_pctg_5v4': ['save_pctg_5v4', 'sa_5v4'],
        'save_pctg_4v5': ['save_pctg_4v5', 'sa_4v5'],
        'save_pctg_5v5': ['save_pctg_5v5', 'sa_5v5'],
        'save_pctg': ['save_pctg', 'shots_against', 'toi'],
        'points_per_60': ['points_per_60', 'time_on_ice_seconds'],
        'shots_on_goal': ['shots_on_goal', 'slot_on_goal_pctg', 'slot_on_goal'],
        'shots': ['shots', 'slot_pctg', 'slot_shots'],
        'points_per_game': ['points_per_game', 'primary_points_per_game'],
        'time_on_ice': ['time_on_ice', 'shifts'],
        'time_on_ice_pp': ['time_on_ice_pp', 'pp_goals_per_60'],
        'time_on_ice_sh': ['time_on_ice_sh', 'sh_points '],
        'pim_from_events': ['pim_from_events', '-games_played'],
        'faceoff_pctg': ['faceoff_pctg', 'faceoffs'],
        'so_goals': ['so_goals'],
        'plus_minus': ['plus_minus'],
        'gw_goals': ['gw_goals', '-goals', '-games_played'],
        'on_ice_sh_pctg': ['on_ice_sh_pctg'],
        'on_ice_sh_pctg_5v5': ['on_ice_sh_pctg_5v5'],
        'on_ice_sog_pctg': ['on_ice_sog_pctg'],
        'on_ice_sog_pctg_5v5': ['on_ice_sog_pctg_5v5'],
        'game_score': ['game_score', 'goals', 'primary_assists'],
        'single_game_score': ['single_game_score', 'game_date'],
        'b_single_game_score': ['-b_single_game_score', 'game_date'],
        'gsaa': ['gsaa'],
        'so_sv_pctg': ['so_sv_pctg'],
        'left_side_faceoff_pctg': ['left_side_faceoff_pctg', 'left_side_faceoffs'],
        'right_side_faceoff_pctg': ['right_side_faceoff_pctg', 'right_side_faceoffs'],
        'nzone_faceoff_pctg': ['nzone_faceoff_pctg', 'nzone_faceoffs'],
        'ozone_faceoff_pctg': ['ozone_faceoff_pctg', 'ozone_faceoffs'],
        'dzone_faceoff_pctg': ['dzone_faceoff_pctg', 'dzone_faceoffs'],
        'multi_season': ['multi_season', 'length', 'from_date'],
        'two_point_games': ['two_point_games', '-games_played'],
        'total_so': ['total_so', 'so', '-toi', 'sv_pctg']
    };

    $scope.change5v5Check = function() {
        // console.log("5v5 check");
    }

    // changing sorting criteria according to table selected for display
    $scope.changeTable = function() {
        // retrieving sort key for current table from list of default table
        // sort criteria
        sortKey = $scope.tableSortCriteria[$scope.tableSelect];
        // checking whether current sort key indicates default ascending
        // sort order
        if ($scope.ascendingAttrs.indexOf(sortKey) !== -1) {
            sortDescending = false;
        } else {
            sortDescending = true;
        }
        // setting global sort configuration according to findings
        $scope.sortConfig = {
            'sortKey': sortKey,
            'sortCriteria': $scope.sortCriteria[sortKey],
            'sortDescending': sortDescending
        };
    };

    // function to change sort order, actually just a wrapper around a service
    // function defined above
    $scope.setSortOrder = function(sortKey, oldSortConfig) {
        return svc.setSortOrder2(sortKey, oldSortConfig, $scope.sortCriteria, $scope.ascendingAttrs);
    };

    // filter definitions
    $scope.greaterThanFilter = function (prop, val) {
        if ($scope.season == 2017 && prop.includes('on_ice')) {
            return true;
        }
        return function (item) {
            return item[prop] > val;
        }
    }

    $scope.playerStatusFilter = function(a) {
        if (!$scope.playerStatusSelect)
            return true;
        switch ($scope.playerStatusSelect) {
            case 'u23':
                if (a.u23) {
                    return true;
                } else {
                    return false;
                }
            case 'u20':
                if (a.u20) {
                    return true;
                } else {
                    return false;
                }
            case 'rookie':
                if (a.rookie) {
                    return true;
                } else {
                    return false;
                }
        }
    };


    $scope.longestStreakFilter = function(a) {
        if (!$scope.showOnlyLongestStreak) {
            return true;
        }
        if ($scope.showOnlyLongestStreak && a.longest) {
            return true;
        } else {
            return false;
        }
    };

    $scope.currentStreakFilter = function(a) {
        if (!$scope.showOnlyCurrentStreak)
            return true;
        if ($scope.showOnlyCurrentStreak && a.current) {
            return true;
        } else {
            return false;
        }
    };

    $scope.minimumAgeFilter = function (a) {
        if ($scope.minimumAge) {
            if (a.age < $scope.minimumAge) {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    };

    $scope.maximumAgeFilter = function (a) {
        if ($scope.maximumAge) {
            if (a.age > $scope.maximumAge) {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    };

    $scope.changeStreakType = function() {
        if ($scope.showStrictStreaks) {
            $scope.streaks = $scope.strict_streaks;
            $scope.slumps = $scope.strict_slumps;
        } else {
            $scope.streaks = $scope.loose_streaks;
            $scope.slumps = $scope.loose_slumps;
        }
    };

    $scope.changeTimespan = function() {
        $scope.gamesBackSelect = '';
        if (!$scope.timespanSelect) {
            ctrl.fromDate = null;
            ctrl.toDate = null;
            return;
        }
        if ($scope.timespanSelect === '-----------')
            return;
        if ($scope.timespanSelect == 'pre_dcup')
        {
            ctrl.fromDate = moment($scope.season + '-09-01');
            ctrl.toDate = $scope.dcup_date;
        } else if ($scope.timespanSelect == 'post_dcup') {
            ctrl.fromDate = $scope.dcup_date;
            var nextSeason = parseFloat($scope.season) + 1;
            ctrl.toDate = moment(nextSeason + '-05-01');
        } else if ($scope.timespanSelect == 'pre_reunification') {
            ctrl.fromDate = moment($scope.season + '-12-16');
            ctrl.toDate = $scope.reunification_date;
        } else if ($scope.timespanSelect == 'post_reunification') {
            ctrl.fromDate = $scope.reunification_date;
            ctrl.toDate = moment('2021-04-19');
        // last 5, 10, 15, ... games played
        } else if ($scope.timespanSelect.startsWith('last')) {
            ctrl.fromDate = null;
            ctrl.toDate = null;
            $scope.gamesBackSelect = parseInt($scope.timespanSelect.split('_')[1]);
        } else {
            timespanSelect = parseInt($scope.timespanSelect) + 1;
            if (timespanSelect < 9) {
                season = parseInt($scope.season) + 1;
            } else {
                season = parseInt($scope.season);
            }
            ctrl.fromDate = moment(season + '-' + timespanSelect + '-1', 'YYYY-M-D');
            ctrl.toDate = moment(season + '-' + timespanSelect + '-1', 'YYYY-M-D').endOf('month');
            }
    }

    $scope.changeDate = function() {
        if ($scope.player_games) {
            $scope.filtered_player_stats = $scope.filterStats($scope.player_games);
        };
        if ($scope.goalie_games) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats($scope.goalie_games);
        }
        $scope.filtered_top_game_scores = $scope.filterGameScores($scope.top_game_scores);
        $scope.filtered_bottom_game_scores = $scope.filterGameScores($scope.bottom_game_scores);
    }

    $scope.teamFilter = function (a) {
        if ($scope.teamSelect) {
            if (['Nord', 'Süd', 'A', 'B'].includes($scope.teamSelect)) {
                if ($scope.divisions[$scope.seasonTypeSelect][$scope.teamSelect] && $scope.divisions[$scope.seasonTypeSelect][$scope.teamSelect].includes(a.team)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                if (a.team == $scope.teamSelect) {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            return true;
        }
    };

    $scope.streakSlumpTeamFilter = function(a) {
        if ($scope.teamSelect) {
            if (a.team.includes($scope.teamSelect)) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    $scope.countryFilter = function(a) {
        if ($scope.countrySelect) {
            if ($scope.countrySelect == 'non_de' && a.iso_country != 'de') {
                return true
            } else if ($scope.countrySelect == a.iso_country) {
                return true
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    changeMinGamesPlayed = function() {
        if ($scope.tableSelect.includes('goalie')) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
        } else {
            $scope.filtered_player_stats = $scope.filterStats();
        }
        $scope.$apply();
    }

    inputMinTimeOnIce = function() {
        if ($scope.tableSelect.includes('goalie')) {
            $scope.minGoalieTimeOnIce = $scope.minGoalieTimeOnIceInMinutes * 60;
            $scope.minGoalieTimeOnIceInMinutesFormatted = svc.pad($scope.minGoalieTimeOnIceInMinutes, 2) + ':00';
        } else {
            $scope.minTimeOnIce = $scope.minTimeOnIceInMinutes * 60;
            $scope.minTimeOnIceInMinutesFormatted = svc.pad($scope.minTimeOnIceInMinutes, 2) + ':00';
        }
    }

    changeMinTimeOnIce = function() {
        if ($scope.tableSelect.includes('goalie')) {
            $scope.minGoalieTimeOnIce = $scope.minGoalieTimeOnIceInMinutes * 60;
            $scope.minGoalieTimeOnIceInMinutesFormatted = svc.pad($scope.minGoalieTimeOnIceInMinutes, 2) + ':00';
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
        } else {
            $scope.minTimeOnIce = $scope.minTimeOnIceInMinutes * 60;
            $scope.minTimeOnIceInMinutesFormatted = svc.pad($scope.minTimeOnIceInMinutes, 2) + ':00';
            $scope.filtered_player_stats = $scope.filterStats();
        }
        $scope.$apply();
    }

});