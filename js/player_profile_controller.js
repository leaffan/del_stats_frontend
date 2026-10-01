app.controller('plrProfileController', function ($scope, $http, $routeParams, $location, svc) {
    var ctrl = this;
    $scope.svc = svc;

    $scope.season = $routeParams.season;
    $scope.player_id = $routeParams.player_id;
    $scope.seasonTypeFilter = 'RS';
    $scope.fromRoundSelect = '1';
    $scope.shootoutParticipation = false;

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./cfg/columns_player_profile.json').then(function (res) {
        $scope.stats_cols = res.data;
    });

    $http.get('data/' + $scope.season + '/del_player_personal_data.json').then(function (res) {
        $scope.last_modified = res.data[0];
        $scope.personal_data = res.data[1];
        $scope.current_player_data = $scope.personal_data.find(
            (player) => player.player_id == $scope.player_id,
        );
        // Create players object indexed by player_id for quick lookup
        $scope.players = {};
        $scope.personal_data.forEach(function (player) {
            $scope.players[player.player_id] = player;
        });
        $scope.refreshToiStats();
    });

    // loading player ids with portraits
    $http.get('./po/' + $scope.season + '/_portraits.json').then(function (res) {
        $scope.portraits = res.data;
        $scope.hasPortrait = $scope.portraits.includes($scope.player_id);
    });

    // retrieving current season's teams as well currently selected team and its colors
    $http.get('./cfg/teams.json').then(function (res) {
        $scope.all_teams = res.data.filter((team) => svc.isTeamValidForSeason(team, $scope.season));
        $scope.team_lookup = $scope.all_teams.reduce(
            (o, key) => Object.assign(o, { [key.abbr]: key.url_name }),
            {},
        );
        $scope.team_location_lookup = $scope.all_teams.reduce(
            (o, key) => Object.assign(o, { [key.abbr]: key.location }),
            {},
        );
        $scope.currentTeam = $scope.all_teams.filter((team) => team.abbr == $routeParams.team);
        $scope.colors = $scope.currentTeam[0].colors;
        $scope.refreshToiStats();
    });

    // loading stats from external json file
    $http
        .get(
            'data/' +
                $scope.season +
                '/per_player/' +
                $routeParams.team +
                '_' +
                $routeParams.player_id +
                '.json',
        )
        .then(function (res) {
            $scope.player_stats = res.data;
            $scope.player_name = res.data[0].full_name;
            svc.setTitle(
                $scope.player_name + ': Spielerprofil ' + svc.getSeasonIdentifier($scope.season),
            );
            if ($scope.player_stats[0]['position'] == 'GK') {
                $scope.tableSelect = 'goalie_stats';
            } else {
                $scope.tableSelect = 'basic_game_by_game';
            }
            // retrieving maximum round played
            $scope.maxRoundPlayed = Math.max
                .apply(
                    Math,
                    $scope.player_stats.map(function (o) {
                        return o.round;
                    }),
                )
                .toString();
            // retrieving all weekdays a game was played by the current team
            $scope.weekdaysPlayed = [
                ...new Set($scope.player_stats.map((item) => item.weekday)),
            ].sort();
            // retrieving all months a game was played by the current team
            $scope.monthsPlayed = [
                ...new Set($scope.player_stats.map((item) => moment(item.game_date).month())),
            ];
            // setting to round selection to maximum round played
            $scope.toRoundSelect = $scope.maxRoundPlayed;
            // retrieving all numbers a player used
            $scope.numbersWorn = [...new Set($scope.player_stats.map((item) => item.no))];
            let numberFrequencies = $scope.player_stats.reduce(function (obj, v) {
                // increment or set the property
                // `(obj[v.status] || 0)` returns the property value if defined
                // or 0 ( since `undefined` is a falsy value
                obj[v.no] = (obj[v.no] || 0) + 1;
                // return the updated object
                return obj;
                // set the initial value as an object
            }, {});
            $scope.mainNumber = parseInt(
                Object.entries(numberFrequencies).sort(([, a], [, b]) => b - a)[0][0],
            );
            // console.log($scope.numbersWorn[$scope.numbersWorn.length - 1]);
            // retrieving indication whether player took part in a shootout
            $scope.shootoutParticipationGames = $scope.player_stats.filter(
                (item) => item.so_attempts,
            );
            if ($scope.shootoutParticipationGames.length > 0) {
                $scope.shootoutParticipation = true;
            }
            // indexing own per-game rows by game_id so shared-ice-time rows (which only carry
            // a game_id) can be joined back to date/round/season_type/home_road/opp_team for filtering
            $scope.game_context_by_id = {};
            $scope.player_stats.forEach(function (game) {
                $scope.game_context_by_id[game.game_id] = game;
            });
            $scope.refreshToiStats();
        });

    // loading shared ice-time with teammates/opponents, broken down by game and skater-strength
    // situation; available for every season with ice-time tracking (2018 onward), same as the
    // other TOI-dependent tables on this page
    if ($scope.season != 2017) {
        $http
            .get('data/' + $scope.season + '/per_player_toi/' + $scope.player_id + '.json')
            .then(function (res) {
                $scope.toi_teammates_raw = res.data;
                $scope.refreshToiStats();
            });
        $http
            .get('data/' + $scope.season + '/per_player_toi_opp/' + $scope.player_id + '.json')
            .then(function (res) {
                $scope.toi_opponents_raw = res.data;
                $scope.refreshToiStats();
            });
    }

    // loading goalie stats
    $http.get('./data/' + $scope.season + '/del_goalie_game_stats.json').then(function (res) {
        $scope.goalie_stats = res.data;
        $scope.goalie_so_stats = $scope.goalie_stats.filter((item) => item.so_attempts_a);
    });

    $http
        .get('data/' + $scope.season + '/del_player_game_stats_aggregated.json')
        .then(function (res) {
            let seen = [];
            $scope.all_players = [];
            // de-duplicating array with players because they usually will appear with
            // both aggregated regular season and playoff statistics
            res.data[1].forEach((element) => {
                // using a combination of player id and team abbreviation to account for players that
                // changed teams during the season
                let player_team_key = element.player_id + '_' + element.team;
                if (!seen[player_team_key]) {
                    $scope.all_players.push(element);
                    seen[player_team_key] = true;
                }
            });
            // $scope.all_players = res.data[1];
        });

    $scope.model = {
        team: $routeParams.team,
        new_team: $routeParams.team,
        player_id: $routeParams.player_id,
        new_player_id: $routeParams.player_id,
    };

    $scope.sortCriterion = 'game_date';
    $scope.statsSortDescending = true;

    $scope.setSortOrder = function (sortCriterion, oldSortCriterion, oldStatsSortDescending) {
        return svc.setSortOrder(sortCriterion, oldSortCriterion, oldStatsSortDescending, [
            'round',
            'opp_team',
            'last_name',
            'team_location',
        ]);
    };

    $scope.getTotal = function (attribute) {
        if ($scope.player_stats === undefined) {
            return;
        }
        var total = 0;
        for (var i = 0; i < $scope.player_stats.length; i++) {
            total += $scope.player_stats[i][attribute];
        }
        return total;
    };

    $scope.goalieFilter = function (a) {
        if (!a['games_played']) {
            return false;
        }
        if (a['goalie_id'] == $routeParams.player_id) {
            return true;
        } else {
            return false;
        }
    };

    $scope.dayFilter = function (a) {
        const date_to_test = moment(a.game_date);
        if (ctrl.fromDate && ctrl.toDate) {
            if (
                date_to_test >= ctrl.fromDate.startOf('day') &&
                date_to_test <= ctrl.toDate.startOf('day')
            ) {
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

    // aggregates per-game shared-ice-time rows (toi_teammates_raw / toi_opponents_raw) into one
    // summary row per teammate/opponent, applying the same filter chain used by the other
    // game-by-game tables on this page. Pure function - must not be called directly from
    // ng-repeat (it allocates a new array/objects every call, which combined with orderBy
    // caused an Angular $rootScope:infdig loop); callers must stash the result in a plain
    // scope var instead, refreshed explicitly via refreshToiStats().
    $scope.getToiPartnerStats = function (toiRaw) {
        if (
            !toiRaw ||
            !$scope.game_context_by_id ||
            !$scope.players ||
            !$scope.team_location_lookup
        ) {
            return [];
        }
        var colIndex = {};
        toiRaw.columns.forEach(function (col, i) {
            colIndex[col] = i;
        });
        var ppCols = ['toi_5v4', 'toi_4v3', 'toi_5v3'].map((c) => colIndex[c]);
        var shCols = ['toi_4v5', 'toi_3v4', 'toi_3v5'].map((c) => colIndex[c]);

        var result = [];
        Object.keys(toiRaw.others).forEach(function (otherId) {
            var games = 0;
            var totalToi = 0;
            var toi5v5 = 0;
            var toi3v3 = 0;
            var toiPp = 0;
            var toiSh = 0;
            var toi5v4 = 0;
            var toi5v3 = 0;
            var toi4v5 = 0;
            var toi3v5 = 0;
            toiRaw.others[otherId].forEach(function (row) {
                var context = $scope.game_context_by_id[row[colIndex.game_id]];
                if (!context) {
                    return;
                }
                if (
                    !$scope.dayFilter(context) ||
                    !$scope.fromRoundFilter(context) ||
                    !$scope.toRoundFilter(context) ||
                    !$scope.weekdayFilter(context) ||
                    ($scope.homeRoadFilter && context.home_road != $scope.homeRoadFilter) ||
                    ($scope.oppFilter && context.opp_team != $scope.oppFilter) ||
                    ($scope.seasonTypeFilter && context.season_type != $scope.seasonTypeFilter)
                ) {
                    return;
                }
                games += 1;
                totalToi += row[colIndex.toi];
                toi5v5 += row[colIndex.toi_5v5];
                toi3v3 += row[colIndex.toi_3v3];
                toi5v4 += row[colIndex.toi_5v4];
                toi5v3 += row[colIndex.toi_5v3];
                toi4v5 += row[colIndex.toi_4v5];
                toi3v5 += row[colIndex.toi_3v5];
                ppCols.forEach(function (i) {
                    toiPp += row[i];
                });
                shCols.forEach(function (i) {
                    toiSh += row[i];
                });
            });
            if (games > 0) {
                var other = $scope.players[otherId];
                result.push({
                    player_id: otherId,
                    full_name: other ? other.full_name : otherId,
                    last_name: other ? other.last_name : otherId,
                    first_name: other ? other.first_name : '',
                    team: other ? other.team : '',
                    team_location: other
                        ? $scope.team_location_lookup[other.team] || other.team
                        : '',
                    games_together: games,
                    toi: totalToi,
                    toi_5v5: toi5v5,
                    toi_3v3: toi3v3,
                    toi_pp: toiPp,
                    toi_5v4: toi5v4,
                    toi_5v3: toi5v3,
                    toi_sh: toiSh,
                    toi_4v5: toi4v5,
                    toi_3v5: toi3v5,
                });
            }
        });
        return result;
    };

    // tie-break chains for the toi_teammates/toi_opponents tables, since this page (unlike
    // player_stats.html's sort_criteria_player_stats.json) has no config-driven tie-break system
    var toiTieBreaks = {
        last_name: 'first_name',
        team_location: 'last_name',
        games_together: 'toi',
        toi: 'toi_5v5',
        toi_5v5: 'toi_3v3',
        toi_3v3: 'toi_5v5',
        toi_pp: 'toi_5v4',
        toi_5v4: 'toi_5v3',
        toi_5v3: 'toi_5v4',
        toi_sh: 'toi_4v5',
        toi_4v5: 'toi_3v5',
        toi_3v5: 'toi_4v5',
    };
    var toiColumns = Object.keys(toiTieBreaks);

    // sorts a toi_*_stats array by sortCriterion, breaking ties using toiTieBreaks. Implemented
    // by hand (rather than passing a [criterion, tieBreak] array to Angular's orderBy filter)
    // so the comparison logic is simple to verify directly. Safe to call from ng-repeat: toiRows
    // is only reordered (new wrapper array), the row objects themselves keep their identity, so
    // this can't reproduce the infdig loop that calling getToiPartnerStats() directly from a
    // template caused.
    //
    // sortCriterion/sortDescending are passed in as arguments rather than read from $scope here
    // on purpose: each toi_* table lives inside its own <table data-ng-if="...">, which Angular
    // gives its own child scope, and the column header's $parent.sortCriterion = ... click
    // handler writes into THAT child scope, not the controller's root $scope. Template
    // expressions evaluated inside the same table (like the call below) see that shadowed value
    // through the normal scope chain; a function reading $scope.sortCriterion directly would
    // only ever see the (never updated) root value.
    $scope.getSortedToiStats = function (toiRows, sortCriterion, sortDescending) {
        var tieBreakKey = toiTieBreaks[sortCriterion];
        var dir = sortDescending ? -1 : 1;
        return toiRows.slice().sort(function (a, b) {
            if (a[sortCriterion] !== b[sortCriterion]) {
                return a[sortCriterion] > b[sortCriterion] ? dir : -dir;
            }
            if (tieBreakKey && a[tieBreakKey] !== b[tieBreakKey]) {
                return a[tieBreakKey] > b[tieBreakKey] ? dir : -dir;
            }
            return 0;
        });
    };

    // resetting to a sensible default sort when switching into a toi_* table from a table
    // whose sortCriterion doesn't exist on toi_* rows (e.g. 'game_date'). The seasonTypeFilter
    // select also triggers changeTable(), but with no argument - oldSortCriterion stays
    // undefined there, so that call deliberately leaves the current sort alone.
    $scope.changeTable = function (oldSortCriterion) {
        if (
            oldSortCriterion !== undefined &&
            ($scope.tableSelect == 'toi_teammates' || $scope.tableSelect == 'toi_opponents') &&
            toiColumns.indexOf(oldSortCriterion) === -1
        ) {
            $scope.sortCriterion = 'toi_5v5';
            $scope.statsSortDescending = true;
        }
    };

    $scope.toi_teammates_stats = [];
    $scope.toi_opponents_stats = [];

    // recomputes the stable toi_*_stats arrays the templates actually bind to; call this
    // after any filter change or whenever new source data (raw TOI files, game context,
    // player lookup) finishes loading - never bind getToiPartnerStats() directly in a template
    $scope.refreshToiStats = function () {
        $scope.toi_teammates_stats = $scope.getToiPartnerStats($scope.toi_teammates_raw);
        $scope.toi_opponents_stats = $scope.getToiPartnerStats($scope.toi_opponents_raw);
    };

    // re-running the TOI aggregation whenever one of the shared filter controls changes
    $scope.$watchGroup(
        [
            'homeRoadFilter',
            'oppFilter',
            'seasonTypeFilter',
            'fromRoundSelect',
            'toRoundSelect',
            'weekdaySelect',
        ],
        function () {
            $scope.refreshToiStats();
        },
        true,
    );

    $scope.changeTeam = function () {
        $scope.filtered_players = $scope.all_players.filter(
            (player) => player.team == $scope.model.new_team,
        );
        $scope.model.new_player_id = $scope.filtered_players[0].player_id;
        $location.path(
            '/player_profile/' +
                $scope.season +
                '/' +
                $scope.model.new_team +
                '/' +
                $scope.model.new_player_id,
        );
    };

    $scope.changePlayer = function () {
        $scope.model.player_id = $scope.model.new_player_id;
        $location.path(
            '/player_profile/' +
                $scope.season +
                '/' +
                $scope.model.new_team +
                '/' +
                $scope.model.player_id,
        );
    };

    $scope.changeTimespan = function () {
        if (!$scope.timespanSelect) {
            ctrl.fromDate = null;
            ctrl.toDate = null;
            $scope.refreshToiStats();
            return;
        }
        const timespanSelect = parseInt($scope.timespanSelect) + 1;
        let season;
        if (timespanSelect < 9) {
            season = parseInt($scope.season) + 1;
        } else {
            season = parseInt($scope.season);
        }
        ctrl.fromDate = moment(season + '-' + timespanSelect + '-1', 'YYYY-M-D');
        ctrl.toDate = moment(season + '-' + timespanSelect + '-1', 'YYYY-M-D').endOf('month');
        $scope.refreshToiStats();
    };
});
