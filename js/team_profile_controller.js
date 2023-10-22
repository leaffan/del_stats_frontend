app.controller('teamProfileController', function($scope, $http, $routeParams, $location, svc) {
    var ctrl = this;
    $scope.svc = svc;
    $scope.season = $routeParams.season;
    $scope.seasonTypeFilter = 'RS';
    $scope.current_team = $routeParams.team;
    if ($routeParams.table_select) {
        $scope.tableSelect = $routeParams.table_select;
    } else {
        $scope.tableSelect = 'basic_game_by_game';
    }
    $scope.fromRoundSelect = '1';
    $scope.sortCriterion = 'date';
    $scope.statsSortDescending = true;

    // loading stats from external json file
    $http.get('data/'+ $scope.season + '/del_team_game_stats.json').then(function (res) {
        $scope.last_modified = res.data[0];
        $scope.team_stats = res.data[1];
        $scope.game_log = $scope.team_stats.filter(function(value, index, arr) {
            return value['team'] == $scope.current_team;
        });
        // retrieving special game log with shootout games only
        $scope.so_game_log = $scope.game_log.filter(game => game.sw == 1 || game.sl == 1);
        // retrieving maximum round played
        $scope.maxRoundPlayed = Math.max.apply(Math, $scope.game_log.map(function(o) { return o.round; })).toString();
        // retrieving all weekdays a game was played by the current team
        $scope.weekdaysPlayed = [...new Set($scope.game_log.map(item => item.weekday))].sort();
        // retrieving all months a game was played by the current team
        $scope.monthsPlayed = [...new Set($scope.game_log.map(item => moment(item.game_date).month()))];
        // setting to round selection to maximum round played
        $scope.toRoundSelect = $scope.maxRoundPlayed;

        $scope.game_log.forEach(element => {
            // calculating expected goals for percentage
            element['xg_pctg'] = svc.calculatePercentage(element['xg'], element['xg'] + element['opp_xg']);
            element['xg_pctg_5v5'] = svc.calculatePercentage(element['xg_5v5'], element['xg_5v5'] + element['opp_xg_5v5']);
        });

    });

    // retrieving significant dates and previous year's attendance from external file
    $http.get('./data/' + $scope.season + '/dates_attendance.json').then(function (res) {
        $scope.dcup_date = moment(res.data['dates']['dcup_date']);
        $scope.avg_attendance_last_season = res.data['avg_attendance_last_season'];
    });

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/team_profile_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });
    // retrieving teams
    $http.get('./js/teams.json').then(function (res) {
        $scope.teams = res.data;
        $scope.teams = $scope.teams.filter(team => team.valid_from <= $scope.season && team.valid_to >= $scope.season);
        // creating lookup structures...
        // ...for team names used in urls
        $scope.team_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.url_name}), {});
        // ...for full team names
        $scope.team_full_name_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.full_name}), {});
        // ...for team locations
        $scope.team_location_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.location}), {});
        // ...for playoff participation indicator
        $scope.team_playoff_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.po}), {});
        // retrieving current team's data
        $scope.current_team_data = $scope.teams.filter(team => team.abbr == $scope.current_team)[0];
    });

    $scope.model = {
        ascendingAttrs: [
            'opp_team', 'arena', 'coach', 'opp_coach', 'date', 'ref_1',
            'ref_2', 'lma_1', 'lma_2', 'round']
    }

    $scope.changeTable = function() {
        // $location.path('/team_profile/' + $scope.season + '/' + $scope.current_team + '/' + $scope.tableSelect);
        if ($scope.tableSelect === 'basic_game_by_game') {
            $scope.sortCriterion = 'date';
            $scope.statsSortDescending = false;
        } else if ($scope.tableSelect === 'game_refs') {
            $scope.sortCriterion = 'date';
            $scope.statsSortDescending = false;
        }
    };

    $scope.setSortOrder = function(sortCriterion, oldSortCriterion, oldStatsSortDescending) {
        return svc.setSortOrder(sortCriterion, oldSortCriterion, oldStatsSortDescending, $scope.model.ascendingAttrs);
    };

    // get standings position through specified game date
    $scope.getStandingsPositionThroughDate = function(cutoff_date) {

        cutoff_date = moment(cutoff_date);

        // creating associative array to contain teams' points, goal difference and goals scored
        var team_points_log = $scope.teams.reduce(
            (o, key) => Object.assign(o, {[key.abbr]: {'team_id': key.id, 'team_abbr': key.abbr, 'games': 0, 'pts': 0, 'gdiff': 0, 'gf': 0, 'pts_per_game': 0}}), {});
        // filtering team stats to only contain games played not later than the specified cutoff date
        var team_stats_pre_cutoff = $scope.team_stats.filter(team_game => moment(team_game['game_date']) <= cutoff_date);

        // collecting team stats through cutoff date
        team_stats_pre_cutoff.forEach(team_game => {
            var team = team_game['team'];
            team_points_log[team]['games'] += 1;
            team_points_log[team]['pts'] += team_game['points'];
            team_points_log[team]['gf'] += team_game['goals'];
            team_points_log[team]['gdiff'] += (team_game['goals'] - team_game['opp_goals']);
            team_points_log[team]['pts_per_game'] = team_points_log[team]['pts'] / team_points_log[team]['games'];
        });

        // converting team points log to an actual array
        team_table = Object.keys(team_points_log).map(function(key) {
            return {
                'team_id': team_points_log[key].id,
                'team': key,
                'pts': team_points_log[key].pts,
                'gdiff': team_points_log[key].gdiff,
                'gf': team_points_log[key].gf,
                'pts_per_game': team_points_log[key].pts_per_game}
        });

        // sorting team table by main category points or points per game (dependant on season)
        team_table.sort(function(b, a){
            if ($scope.season == 2020 || $scope.season == 2021 || $scope.season == 2022) {
                if (a.pts_per_game == b.pts_per_game)
                {
                    if (a.gdiff == b.gdiff)
                    {
                        return a.gf - b.gf;
                    }
                    return a.gdiff - b.gdiff;
                }
    
                return a.pts_per_game - b.pts_per_game;

            } else {
                if (a.pts == b.pts)
                {
                    if (a.gdiff == b.gdiff)
                    {
                        return a.gf - b.gf;
                    }
                    return a.gdiff - b.gdiff;
                }
    
                return a.pts - b.pts;
            }
        });

        // returning actual table position of current team in sorted rankings
        return team_table.map(function(e) { return e.team}).indexOf($scope.current_team) + 1;
    };

    $scope.dayFilter = function (a) {
        date_to_test = moment(a.game_date);
        if (ctrl.fromDate && ctrl.toDate) {
            if ((date_to_test >= ctrl.fromDate.startOf('day')) && (date_to_test <= ctrl.toDate.startOf('day'))) {
                return true;
            } else {
                return false;
            }
        } else if (ctrl.fromDate) {
            if (date_to_test >= ctrl.fromDate.startOf('day')) {
                return true;
            } else {
                return false;
            }
        } else if (ctrl.toDate) {
            if (date_to_test <= ctrl.toDate.startOf('day')) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    $scope.fromRoundFilter = function (a) {
        if ($scope.fromRoundSelect) {
            if (a.round >= $scope.fromRoundSelect) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    $scope.toRoundFilter = function (a) {
        if ($scope.toRoundSelect) {
            if (a.round <= $scope.toRoundSelect) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    $scope.weekdayFilter = function (a) {
        if ($scope.weekdaySelect) {
            if (a.weekday == $scope.weekdaySelect) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };

    $scope.changeTeam = function() {
        $location.path('/team_profile/' + $scope.season + '/' + $scope.current_team + '/' + $scope.tableSelect);
    };

    $scope.changeTimespan = function() {
        if (!$scope.timespanSelect) {
            ctrl.fromDate = null;
            ctrl.toDate = null;
            return;
        }
        if ($scope.timespanSelect == 'pre_dcup')
        {
            ctrl.fromDate = moment($scope.season + '-09-01');
            ctrl.toDate = $scope.dcup_date;
        } else if ($scope.timespanSelect == 'post_dcup') {
            ctrl.fromDate = $scope.dcup_date;
            var nextSeason = parseFloat($scope.season) + 1;
            ctrl.toDate = moment(nextSeason + '-05-01');
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

});
