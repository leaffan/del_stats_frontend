app.controller('plrStatsController', function ($scope, $http, $window, $routeParams, $q, svc, $timeout) {

    $scope.svc = svc;
    var ctrl = this;

    ctrl.season = $scope.season = $routeParams.season;
    svc.setTitle("DEL-Spielerstatistiken " + svc.getSeasonIdentifier($scope.season));
    // default table selection and sort criterion for skater page
    ctrl.tableSelect = 'basic_stats';
    ctrl.seasonTypeSelect = 'RS';
    // if ($scope.season == 2025) {
    //     ctrl.seasonTypeSelect = 'PO';
    // }
    ctrl.scoringStreakTypeSelect = $scope.scoringStreakTypeSelect = 'points';
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

    // loading sorting criteria
    $http.get('./cfg/sort_criteria_player_stats.json').then(response => {
        let tableSortConfig = response.data;
        // default columns to sort after for each displayed table
        $scope.tableSortCriteria = tableSortConfig.tableSortCriteria;
        // attributes to sort in ascending order by default
        $scope.ascendingAttrs = tableSortConfig.ascendingAttrs;
        // sorting hierarchy for each sortable column
        ctrl.sortCriteria = $scope.sortCriteria = tableSortConfig.sortCriteria;
        // setting initial sort configuration based on selected table
        ctrl.sortConfig = $scope.sortConfig = {
            // sort key represents default sorting column for selected table
            'sortKey': $scope.tableSortCriteria[ctrl.tableSelect],
            // sort criteria identify the sorting hierarchy
            'sortCriteria': $scope.sortCriteria[$scope.tableSortCriteria[ctrl.tableSelect]],
            // this one toggles whether sorting is initially in ascending or descending order
            'sortDescending': !$scope.ascendingAttrs.includes($scope.sortCriteria[$scope.tableSortCriteria[ctrl.tableSelect]][0])
        }
    });

    $scope.fromRoundSelect = '1';
    // default filter values
    ctrl.nameFilter = $scope.nameFilter = ''; // empty name filter
    ctrl.teamSelect = $scope.teamSelect = ''; // empty name filter
    $scope.gamesBackSelect = '';
    ctrl.limit = 100;

    $window.onscroll = function() {
        let pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.offsetHeight;
        let max = document.documentElement.scrollHeight;
        if (pos >= max) {
            $scope.$apply(loadMoreRecords());
        }
    };

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./cfg/columns_player_stats.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    // retrieving significant dates and previous year's attendance from external file
    $http.get('./data/' + $scope.season + '/dates_attendance.json').then(function (res) {
        $scope.dcup_date = moment(res.data['dates']['dcup_date']);
        $scope.reunification_date = moment(res.data['dates']['reunification_date']);
    });

    // retrieving teams
    $http.get('./cfg/teams.json').then(function (res) {
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
        'tableSelect', 'homeAwaySelect', 'ctrl.seasonTypeSelect', 'fromRoundSelect', 'toRoundSelect', 'weekdaySelect', 'gamesBackSelect'
    ], function (newValue, oldValue) {
        if ($scope.player_games && !ctrl.tableSelect.includes('goalie')) {
            $scope.filtered_player_stats = $scope.filterStats();
        }
        if ($scope.goalie_games && ctrl.tableSelect.includes('goalie')) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
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
        $http.get('./cfg/iso_countries.json').then(function (res) {
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

    // loading list of stats to be aggregated
    $http.get('./cfg/stats_to_aggregate.json').then(function (res) {
        ctrl.statsToAggregate = res.data['season_skater_stats_to_aggregate'];
        ctrl.goalieStatsToAggregate = res.data['season_goalie_stats_to_aggregate'];
    });

    // wrapping loading of players around data processing to make sure the all_players object really exists before
    // we do so
    $http.get('data/del_players.json').then(function (res) {
        $scope.all_players = res.data;
        $http.get('data/' + $scope.season + '/del_player_game_stats.csv').then($scope.preProcessData);
        $http.get('data/' + $scope.season + '/del_goalie_game_stats.json').then(function (res) {
            $scope.goalie_games = res.data;
            $scope.prep_goalie_stats = $scope.prepareGoalieStats($scope.goalie_games);
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
        });
    });

	$scope.preProcessData = function(allText) {
        // spliting content based on new line
		let allTextLines = allText.data.split(/\r\n|\n/);
		let headers = allTextLines[0].split(';');
		let lines = [];

        for (const line of allTextLines) {
            // splitting content based on separator
            const data = line.split(';');
            if (data.length === headers.length) {
                const tarr = [];
                for (const header of headers) {
                    tarr.push(data[headers.indexOf(header)]);
                }
                lines.push(tarr);
            }
        }
        $scope.player_games = lines.slice(1).map(function(line) {
            return line.reduce(function(player_game, value, i) {
                if (ctrl.statsToAggregate.includes(headers[i])) {
                    player_game[headers[i]] = parseFloat(value);
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
        $scope.prep_player_games = $scope.preparePlayerStats($scope.player_games);
	};

    $scope.preparePersonalData = function(player_game) {
        personal_data = {};
        personal_data['player_id'] = plr_id;
        personal_data['first_name'] = $scope.all_players[plr_id]['first_name'];
        personal_data['last_name'] = $scope.all_players[plr_id]['last_name'];
        personal_data['full_name'] = $scope.all_players[plr_id]['first_name'] + ' ' + $scope.all_players[plr_id]['last_name'];
        personal_data['age'] = $scope.all_players[plr_id]['age'];
        // setting player statuses from combined player status
        personal_data = $scope.setPlayerStatus(player_game['status'], personal_data)
        personal_data['iso_country'] = $scope.all_players[plr_id]['iso_country'];
        personal_data['position'] = $scope.all_players[plr_id]['position'];
        personal_data['shoots'] = $scope.all_players[plr_id]['hand'];
        personal_data['team'] = player_game['team'];
        personal_data['single_team'] = true;
        return personal_data;
    };

    $scope.prepareGoalieStats = function(goalie_games) {
        let prep_goalie_stats = {};

        goalie_games.forEach(element => {
            plr_id = element['goalie_id'];
            team = element['team'];
            key = [plr_id, team];
            if (!prep_goalie_stats[key]) {
                prep_goalie_stats[key] = $scope.preparePersonalData(element);
                ctrl.goalieStatsToAggregate.forEach(category => {
                    prep_goalie_stats[key][category] = 0;
                });
                ctrl.goalieStatsToCategorize.forEach(categoryCfg => {
                    prep_goalie_stats[key][categoryCfg.name] = 0;
                })
            }
        });
        return prep_goalie_stats
    };

    $scope.preparePlayerStats = function(player_games) {
        // preparing player games for later filtering, i.e. retrieving personal data etc.
        let prep_player_stats = {};

        player_games.forEach(element => {
            plr_id = element['player_id'];
            team = element['team'];
            key = [plr_id, team]
            if (!prep_player_stats[key]) {
                prep_player_stats[key] = $scope.preparePersonalData(element);
                ctrl.statsToAggregate.forEach(category => {
                    prep_player_stats[key][category] = 0;
                });
                ctrl.statsToCategorize.forEach(categoryCfg => {
                    prep_player_stats[key][categoryCfg.name] = 0;
                })
            };
        });
        return prep_player_stats;
    };

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

    $scope.filterGoalieStats = function() {
        filtered_goalie_stats = angular.copy($scope.prep_goalie_stats);
        goalie_teams = {};
        if ($scope.goalie_games === undefined)
            return filtered_goalie_stats;
        $scope.goalie_games.forEach(element => {
            plr_id = element['goalie_id'];
            team = element['team'];
            key = [plr_id, team];
            // checking whether current element passes all filters
            if ($scope.elementPassedFilters(element))
            {
                // aggregating values
                ctrl.goalieStatsToAggregate.forEach(category => {
                    filtered_goalie_stats[key][category] += (element[category] ? element[category] : 0);
                });
                // calculating save pctg, gaa etc for single game
                svc.calculateDerivedStats(element, ctrl.goalieStatsToCalculate);
                $scope.categorizeStatsForStatline(ctrl.goalieStatsToCategorize, element, filtered_goalie_stats[key]);
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
            svc.calculateDerivedStats(element, ctrl.goalieStatsToCalculate);
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

    $scope.categorizeStatsForStatline = function(statsToCategorize, singleGameStats, filteredStats) {
        statsToCategorize.forEach(categoryCfg => {
            if (categoryCfg.categories) {
                // checking category with multiple conditions combined by logical AND
                let allConditionsMet = categoryCfg.categories.every(cond => {
                    return checkCondition(cond, singleGameStats);
                });
    
                if (allConditionsMet) {
                    filteredStats[categoryCfg.name] = (filteredStats[categoryCfg.name] || 0) + 1;
                }
            } else {
                // checking category with one criterion
                if (checkCondition(categoryCfg, singleGameStats)) {
                    filteredStats[categoryCfg.name] = (filteredStats[categoryCfg.name] || 0) + 1;
                }
            }
        });
    };
    
    // helper function to check single condition
    function checkCondition(condition, stats) {
        let { operator, criterion, value } = condition;
    
        if (stats[criterion] === undefined) {
            return false; // Falls das Kriterium nicht existiert
        }
        // hacky: evaluating value if found to be of string type
        if (typeof(value) === "string") {
            value = eval(value);
        }

        if (stats[criterion] === null) {
            return false;
        }

        switch (operator) {
            case 'greater_equal': return stats[criterion] >= value;
            case 'less_equal': return stats[criterion] <= value;
            case 'greater': return stats[criterion] > value;
            case 'less': return stats[criterion] < value;
            case 'equal': return stats[criterion] == value;
            case 'not_equal': return stats[criterion] != value;
            default: return false;
        }
    }
    

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
        // if seasonTypeSelect is set to "Hauptrunde und Playoffs" we just want games of these types but no pre-season games
        is_selected_season_type = ["RS", "PO", "MSC"].includes(ctrl.seasonTypeSelect) ? ctrl.seasonTypeSelect === element.season_type : ["RS", "PO"].includes(element.season_type);


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
                ctrl.goalieStatsToCategorize.forEach(categoryCfg => {
                    multiTeamPlayerStats[categoryCfg.name] = 0;
                })
            } else {
                ctrl.statsToAggregate.forEach(category => {
                    multiTeamPlayerStats[category] = 0;
                })
                ctrl.statsToCategorize.forEach(categoryCfg => {
                    multiTeamPlayerStats[categoryCfg.name] = 0;
                })
            }
            // aggregating numeric attributes
            teams.forEach(team => {
                plr_team_stats = filtered_stats[[plr_id, team]];
                if (goalies) {
                    ctrl.goalieStatsToAggregate.forEach(category => {
                        multiTeamPlayerStats[category] += plr_team_stats[category];
                    });
                    ctrl.goalieStatsToCategorize.forEach(categoryCfg => {
                        multiTeamPlayerStats[categoryCfg.name] += plr_team_stats[categoryCfg.name];
                    })
                } else {
                    ctrl.statsToAggregate.forEach(category => {
                        multiTeamPlayerStats[category] += plr_team_stats[category];
                    })
                    ctrl.statsToCategorize.forEach(categoryCfg => {
                        multiTeamPlayerStats[categoryCfg.name] += plr_team_stats[categoryCfg.name];
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

    // loading criteria to calculate stats
    $http.get('./cfg/stats_to_calculate.json').then(function (res) {
        ctrl.statsToCalculate = res.data['season_skater_stats_to_calculate'];
        ctrl.goalieStatsToCalculate = res.data['season_goalie_stats_to_calculate'];
    });

    // loading criteria to categorize stats
    $http.get('./cfg/stats_to_categorize.json').then(function (res) {
        ctrl.statsToCategorize = res.data['season_skater_stats_categories'];
        ctrl.goalieStatsToCategorize = res.data['season_goalie_stats_categories'];
    });

    $scope.filterStats = function() {
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
                $scope.categorizeStatsForStatline(ctrl.statsToCategorize, element, filtered_player_stats[key]);
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
            svc.calculateDerivedStats(element, ctrl.statsToCalculate);
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

    $scope.change5v5Check = function() {
        // console.log("5v5 check");
    }

    // changing sorting criteria according to table selected for display
    $scope.changeTable = function() {
        // retrieving sort key for current table from list of default table
        // sort criteria
        sortKey = $scope.tableSortCriteria[ctrl.tableSelect];
        // checking whether current sort key indicates default ascending
        // sort order
        if ($scope.ascendingAttrs.indexOf(sortKey) !== -1) {
            sortDescending = false;
        } else {
            sortDescending = true;
        }
        // setting global sort configuration according to findings
        ctrl.sortConfig = $scope.sortConfig = {
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
    ctrl.greaterThanFilter = $scope.greaterThanFilter = function (prop, val) {
        return function (item) {
            if ($scope.season == 2017 && prop.includes('on_ice')) {
                return true;
            }
            if (prop == 'goals' && !['goals_per_period'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'toi' && !['goalie_stats', 'goalie_against_avg_stats', 'goalie_stats_ev', 'goalie_stats_sh', 'goalie_stats_pp', 'goalie_zone_stats_near', 'goalie_zone_stats_far'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'time_on_ice' && !['per_game_stats', 'per_60_stats', 'time_on_ice_shift_stats'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'time_on_ice_pp' && !['power_play_stats'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'time_on_ice_sh' && !['shorthanded_stats'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'faceoffs_per_game' && !['faceoff_stats', 'faceoff_by_side_stats', 'faceoff_by_zone_stats'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (prop == 'so_games_played' && !['goalie_shootout_stats', 'shootout_stats'].includes(ctrl.tableSelect)) {
                return true;
            }
            if (item[prop] === undefined)
                return true;
            return item[prop] > val;
        }
    }

    ctrl.goalieFilter = function(a) {
        if (['player_information', 'basic_stats', 'bottom_game_scores_per_game', 'top_game_scores_per_game'].includes(ctrl.tableSelect)) {
            return true;
        }
        if (ctrl.tableSelect.startsWith('goalie') && a.position == 'GK') {
            return true;
        }
        if (!ctrl.tableSelect.startsWith('goalie') && a.position == 'GK') {
            return false;
        }
        return true;
    };

    ctrl.playerStatusFilter = $scope.playerStatusFilter = function(a) {
        if (!ctrl.playerStatusSelect)
            return true;
        switch (ctrl.playerStatusSelect) {
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


    ctrl.longestStreakFilter = $scope.longestStreakFilter = function(a) {
        if (!['streaks', 'slumps', 'goalie_streaks'].includes(ctrl.tableSelect)) {
            return true;
        }
        if (!$scope.showOnlyLongestStreak) {
            return true;
        }
        if ($scope.showOnlyLongestStreak && a.longest) {
            return true;
        } else {
            return false;
        }
    };

    ctrl.currentStreakFilter = $scope.currentStreakFilter = function(a) {
        if (!['streaks', 'slumps', 'goalie_streaks'].includes(ctrl.tableSelect)) {
            return true;
        }
        if (!$scope.showOnlyCurrentStreak)
            return true;
        if ($scope.showOnlyCurrentStreak && a.current) {
            return true;
        } else {
            return false;
        }
    };

    ctrl.minimumAgeFilter = $scope.minimumAgeFilter = function (a) {
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

    ctrl.maximumAgeFilter = $scope.maximumAgeFilter = function (a) {
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
            $scope.filtered_player_stats = $scope.filterStats();
        };
        if ($scope.goalie_games) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
        }
        $scope.filtered_top_game_scores = $scope.filterGameScores($scope.top_game_scores);
        $scope.filtered_bottom_game_scores = $scope.filterGameScores($scope.bottom_game_scores);
    }

    ctrl.teamFilter = $scope.teamFilter = function (a) {
        if ($scope.teamSelect) {
            if (['Nord', 'Süd', 'A', 'B'].includes($scope.teamSelect)) {
                if ($scope.divisions[ctrl.seasonTypeSelect][$scope.teamSelect] && $scope.divisions[ctrl.seasonTypeSelect][$scope.teamSelect].includes(a.team)) {
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

    ctrl.streakSlumpTeamFilter = $scope.streakSlumpTeamFilter = function(a) {
        if (!['streaks', 'slumps', 'goalie_streaks'].includes(ctrl.tableSelect)) {
            return true;
        }
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

    ctrl.scoringStreakTypeFilter = $scope.scoringStreakTypeFilter = function(a) {
        if (!['streaks', 'slumps'].includes(ctrl.tableSelect)) {
            return true;
        }
        if (a.type == ctrl.scoringStreakTypeSelect) {
            return true;
        } else {
            return false;
        }
    };

    ctrl.countryFilter = $scope.countryFilter = function(a) {
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
        if (ctrl.tableSelect.includes('goalie')) {
            $scope.filtered_goalie_stats = $scope.filterGoalieStats();
        } else {
            $scope.filtered_player_stats = $scope.filterStats();
        }
        $scope.$apply();
    }

    inputMinTimeOnIce = function() {
        if (ctrl.tableSelect.includes('goalie')) {
            $scope.minGoalieTimeOnIce = $scope.minGoalieTimeOnIceInMinutes * 60;
            $scope.minGoalieTimeOnIceInMinutesFormatted = svc.pad($scope.minGoalieTimeOnIceInMinutes, 2) + ':00';
        } else {
            $scope.minTimeOnIce = $scope.minTimeOnIceInMinutes * 60;
            $scope.minTimeOnIceInMinutesFormatted = svc.pad($scope.minTimeOnIceInMinutes, 2) + ':00';
        }
    }

    changeMinTimeOnIce = function() {
        if (ctrl.tableSelect.includes('goalie')) {
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

    let loadMoreRecords = function () {
        ctrl.limit += 100;
    };

});