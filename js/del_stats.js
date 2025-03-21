let app = angular.module('delStatsApp', ['ngResource', 'ngRoute', 'ngStorage', 'moment-picker', 'angularMoment'])

app.constant('config', {
    defaultSeason: 2025,
});

// main application configuration

app.config(['$routeProvider', function($routeProvider){
    $routeProvider
        .when('/home', {
            title: 'DEL-Statistiken',
            templateUrl: 'home.html',
            controller: 'homeController as ctrl',
            reloadOnSearch: false
        })
        .when('/schedules/:season', {
            title: 'Spielpläne',
            templateUrl: 'schedules.html',
            controller: 'schedulesController as ctrl',
            reloadOnSearch: false
        })
        .when('/del_stats/:season', {
            title: 'Spielerstatistiken',
            templateUrl: 'player_stats.html',
            controller: 'plrStatsController as ctrl',
            reloadOnSearch: false
        })
        .when('/team_stats/:season', {
            title: 'Teamstatistiken',
            templateUrl: 'team_stats.html',
            controller: 'teamStatsController as ctrl',
            reloadOnSearch: false
        })
        .when('/player_profile/:season/:team/:player_id',
        {
            title: 'Spielerprofil',
            templateUrl: 'player_profile.html',
            controller: 'plrProfileController as ctrl',
            reloadOnSearch: false
        })
        .when('/team_profile/:season/:team/:table_select?',
        {
            title: 'Teamprofil',
            templateUrl: 'team_profile.html',
            controller: 'teamProfileController as ctrl',
            reloadOnSearch: false
        })
        .when('/career_stats_old',
        {
            title: 'Karrierestatistiken',
            templateUrl: 'career_stats_old.html',
            controller: 'careerStatsControllerOld as ctrl',
            reloadOnSearch: false
        })
        .when('/career_stats',
        {
            title: 'Karrierestatistiken',
            templateUrl: 'career_stats.html',
            controller: 'careerStatsController as ctrl',
            reloadOnSearch: false
        })
        .when('/player_career/:player_id',
        {
            title: 'Karriereverlauf',
            templateUrl: 'player_career.html',
            controller: 'playerCareerController as ctrl',
            reloadOnSearch: false
        })
        .when('/skater_career/:player_id',
        {
            title: 'Karriereverlauf',
            templateUrl: 'skater_career.html',
            controller: 'skaterCareerController as ctrl',
            reloadOnSearch: false
        })
        .when('/goalie_career/:player_id',
        {
            title: 'Karriereverlauf',
            templateUrl: 'goalie_career.html',
            controller: 'goalieCareerController as ctrl',
            reloadOnSearch: false
        })
        .otherwise({
            redirectTo: '/home'
        })
}]);

app.config(['momentPickerProvider', function(momentPickerProvider){
    momentPickerProvider.options({
        locale: 'de',
        format: 'L',
        minView: 'decade',
        maxView: 'day',
        startView: 'month',
        autoclose: true,
        keyboard: true
    })
}]);

app.run(['$rootScope', function($rootScope) {
    $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
        // TODO: set page title dynamically to include current teams
        $rootScope.title = current.$$route.title;
    });
}]);

app.run(function(amMoment) {
	amMoment.changeLocale('de');
});

// providing functions to several controllers as services
app.factory('svc', function($rootScope) {
    return {
        setTitle: function(title) {
            $rootScope.title = title;
        },
        // sets sorting order according to selected sort criterion
        setSortOrder: function(sortCriterion, oldSortCriterion, oldStatsSortDescending, ascendingAttrs) {
            // if current criterion equals the new one
            if (oldSortCriterion === sortCriterion) {
                // just change sort direction
                return !oldStatsSortDescending;
            } else {
                // ascending for a few columns
                if (ascendingAttrs.indexOf(sortCriterion) !== -1) {
                    return false;
                } else {
                    // otherwise descending sort order
                    return true;
                }
            }
        },
        setSortOrder2: function(sortKey, oldSortConfig, globalSortConfig, ascendingAttrs) {
            // if previous sort key equals the new one
            if (oldSortConfig['sortKey'] == sortKey) {
                // just change sort direction
                return {
                    'sortKey': oldSortConfig['sortKey'],
                    'sortCriteria': oldSortConfig['sortCriteria'],
                    'sortDescending': !oldSortConfig['sortDescending']
                }
            } else {
                let sortCriteria = globalSortConfig[sortKey] || sortKey;
                // ascending sort order for a few columns
                if (ascendingAttrs.indexOf(sortKey) !== -1) {
                    return {
                        'sortKey': sortKey,
                        'sortCriteria': sortCriteria,
                        'sortDescending': false
                    }
                // otherwise descending sort order
                } else {
                    return {
                        'sortKey': sortKey,
                        'sortCriteria': sortCriteria,
                        'sortDescending': true
                    }
                }
            }
        },
        // gets season identifier in the form of 2022/23 for 2022 season
        getSeasonIdentifier: function(season) {
            return season + "/" + (parseInt(season) + 1).toString().slice(-2);
        },
        // formats time (in seconds) as mm:ss
        formatTime: function(timeInSeconds, factor) {
            if (factor)
                timeInSeconds = timeInSeconds * factor;
            return this.pad(Math.floor(timeInSeconds / 60), 2) + ":" + ('00' + (Math.floor(timeInSeconds) % 60)).slice(-2);
        },
        // gets total sum of attribute values from provided list optionally starting at from season and for specified season type
        getFilteredTotal: function(list, attribute, dataSource, fromSeason, seasonType) {
            if (dataSource === undefined)
                return;
            if (list === undefined)
                return;
            list = list.filter(item => item.order != 0);
            if (seasonType && seasonType != 'ALL') {
                list = list.filter(item => item.season_type == seasonType);
            }
            if (fromSeason) {
                list = list.filter(item => item.season >= fromSeason);
            }
            return list.reduce((sum, item) => {return sum + item[attribute];}, 0);
        },
        getNumberOfUniqueItemsInSeasons: function(seasons, attribute, fromSeason, seasonType) {
            if (seasons === undefined)
                return;
            seasons = seasons.filter(season => season.order != 0);
            if (seasonType && seasonType != 'ALL')  {
                seasons = seasons.filter(season => season.season_type == seasonType);
            }
            if (fromSeason) {
                seasons = seasons.filter(season => season.season >= fromSeason);
            }
            return new Set(seasons.map(season => season[attribute])).size;
        },
        getMinMaxFromSeasons: function(seasons, attribute) {
            if (seasons === undefined)
                return;
            let all_ages = new Set(seasons.map(season => season.age));
            return [Math.min(...all_ages), Math.max(...all_ages)];
        },
        // gets total sum of filtered attributed values through a specified game date
        getFilteredAccumulatedTotal: function(list, attribute, dataSource, to) {
            if (dataSource === undefined) {
                return
            }
            let total = 0;
            for (let i = list.length-1; i >= 0; i--) {
                total += list[i][attribute];
                if (list[i]['game_date'] == to)
                {
                    return total;
                }
            }
            return total;
        },
        // gets average of filtered attributed values through a specified game date
        getFilteredAverageTotal: function(list, attribute, dataSource, to) {
            if (dataSource === undefined) {
                return;
            }
            let total = 0;
            let cnt_data = 0;
            for (let i = list.length-1; i >= 0; i--) {
                cnt_data++;
                total += list[i][attribute];
                
                if (list[i]['game_date'] == to)
                {
                    return total / cnt_data;
                }
            }
            return total / cnt_data;
        },
        parseFloat: function(floatAsString) {
            return parseFloat(floatAsString);
        },
        parseInt: function(intAsString) {
            return parseInt(intAsString);
        },
        isNumeric: function(num) {
            return !isNaN(num);
        },
        replaceRoundNames: function(roundName, short) {
            if (roundName === undefined)
                return;
            if (!isNaN(roundName))
                return roundName;
            if (short) {
                return roundName.replace(
                    "first_round_", "1. PR "
                ).replace(
                    "quarter_finals_", "VF "
                ).replace(
                    "semi_finals_", "HF "
                ).replace(
                    "finals_", "F ");
            } else {
                return roundName.replace(
                    "first_round_", "1. Playoff-Runde "
                ).replace(
                    "quarter_finals_", "Viertelfinale "
                ).replace(
                    "semi_finals_", "Halbfinale "
                ).replace(
                    "finals_", "Finale ");
            }
        },     
        setTextColor: function(score, opp_score) {
            if (score > opp_score) {
                return " green";
            }
            else if (opp_score > score) {
                return " red";
            }
            else {
                return "";
            }
        },
        range: function(min, max, step) {
            step = step || 1;
            let input = [];
            for (let i = min; i <= max; i += step) {
                input.push(i);
            }
            return input;
        },
        // team stats to be simply aggregated
        stats_to_aggregate: function() {
            return [
                'games_played', 'score', 'opp_score', 'goals', 'opp_goals',
                'w', 'rw', 'ow', 'sw', 'l', 'rl', 'ol', 'sl', 'points', 'goals_1',
                'opp_goals_1', 'goals_2', 'opp_goals_2', 'goals_3', 'opp_goals_3',
                'shots', 'shots_on_goal', 'shots_missed', 'shots_blocked',
                'opp_shots', 'opp_shots_on_goal', 'opp_shots_missed',
                'opp_shots_blocked', 'saves', 'opp_saves', 'pim', 'pp_time',
                'pp_opps', 'pp_goals', 'opp_pim', 'opp_pp_time', 'opp_pp_opps',
                'opp_pp_goals', 'sh_opps', 'sh_goals', 'opp_sh_opps', 'opp_sh_goals',
                'faceoffs_won', 'faceoffs_lost', 'faceoffs', 'sl_sh', 'lf_sh', 'rg_sh',
                'bl_sh', 'sl_og', 'lf_og', 'rg_og', 'bl_og', 'sl_sh_a', 'lf_sh_a',
                'rg_sh_a', 'bl_sh_a', 'sl_og_a', 'lf_og_a', 'rg_og_a', 'bl_og_a',
                'attendance', 'penalty_2', 'penalty_5', 'penalty_10', 'penalty_20', 'penalty_25',
                'shots_on_goal_5v5', 'goals_5v5', 'opp_shots_on_goal_5v5', 'opp_goals_5v5',
                'capacity', 'sl_g', 'lf_g', 'rg_g', 'bl_g', 'sl_g_a', 'lf_g_a', 'rg_g_a', 'bl_g_a',
                'tied', 'leading', 'trailing', 'time_played',
                'shots_5v5', 'opp_shots_5v5', 'shots_unblocked_5v5', 'opp_shots_unblocked_5v5',
                'shots_pp', 'shots_unblocked_pp', 'shots_on_goal_pp',
                'so_rounds', 'so_a', 'so_g', 'opp_so_a', 'opp_so_g', 'hit_post', 'opp_hit_post',
                'pp_5v4', 'ppg_5v4', 'pp_5v3', 'ppg_5v3', 'pp_4v3', 'ppg_4v3',
                'opp_pp_5v4', 'opp_ppg_5v4', 'opp_pp_5v3', 'opp_ppg_5v3', 'opp_pp_4v3', 'opp_ppg_4v3',
                'ppt_5v4', 'opp_ppt_5v4', 'ppt_5v3', 'opp_ppt_5v3', 'ppt_4v3', 'opp_ppt_4v3',
                'ev_goals', 'opp_ev_goals', 'f_goals', 'f_assists', 'f_points', 'f_sog', 'd_goals', 'd_assists',
                'd_points', 'd_sog', 'u23_gp', 'u23_g', 'u23_a', 'u23_pts', 'u23_shifts', 'u23_toi', 'u23_toi_pp_sh',
                'en_goals', 'opp_en_goals', 'ea_goals', 'opp_ea_goals', 'xg', 'opp_xg', 'xg_5v5', 'opp_xg_5v5',
                'sellout'
            ];    
        },
        pad: function pad(num, size) {
            let s = num+"";
            while (s.length < size) s = "0" + s;
            return s;
        },
        germanDays: function() {
            return [0, 1, 2, 3, 4, 5, 6].map(day => moment().locale('de').weekday(day).format('dddd'));
        },
        germanMonths: function() {
            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(month => moment().locale('de').month(month).format('MMMM'));
        },
        shortenName: function(full_name) {
            if (!full_name) {
                return '';
            }
            let names = full_name.split(' ');
            return names[0][0] + '. ' + names.slice(-1)[0];
        },
        calculateDifference: function(minuend, subtrahend) {
            return minuend - subtrahend;
        },
        calculateRate: function(value_to_rate, rating_parameter, factor) {
            if (factor)
                value_to_rate = value_to_rate * factor;
            if (rating_parameter) {
                return value_to_rate / rating_parameter;
            } else {
                return 0;
            }
        },
        calculatePercentage: function(part_value, base_value, factor, return_null) {
            if (factor === undefined)
                factor = 1
            if (base_value) {
                return (part_value / (base_value * factor)) * 100
            } else {
                if (return_null) {
                    return null;
                } else {
                    return 0;
                }
            }
        },
        calculateFrom100Percentage: function(part_value, base_value, factor) {
            if (factor === undefined)
                factor = 1
            if (base_value) {
                return 100 - (part_value / (base_value * factor)) * 100
            } else {
                return null;
            }
        },
        calculatePer60: function(value, toi_seconds) {
            if (toi_seconds) {
                return value / (toi_seconds / 60) * 60;
            } else {
                return 0;
            }
        },
        calculatePer2Minutes: function(value, toi_seconds) {
            if (toi_seconds) {
                return (value / toi_seconds) * 120;
            } else {
                return 0;
            }
        },
        calculateAge: function(birthDate, today) {
            birthDate = new Date(birthDate);
            if (today === undefined) {
                today = new Date();
            }
            // calculating years
            let years;
            if (today.getMonth() > birthDate.getMonth() || (today.getMonth() == birthDate.getMonth() && today.getDate() >= birthDate.getDate())) {
                years = today.getFullYear() - birthDate.getFullYear();
            }
            else {
                years = today.getFullYear() - birthDate.getFullYear() - 1;
            }
          
            // calculating months
            let months;
            if (today.getDate() >= birthDate.getDate()) {
                months = today.getMonth() - birthDate.getMonth();
            }
            else if (today.getDate() < birthDate.getDate()) {
                months = today.getMonth() - birthDate.getMonth() - 1;
            }
            // make month positive
            months = months < 0 ? months + 12 : months;
          
            // Calculate days
            let days;
            // days of months in a year
            let monthDays;
            monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            // re-setting days of months in a year for leap years
            if ((0 == birthDate.getFullYear() % 4) && (0 != birthDate.getFullYear() % 100) || (0 == birthDate.getFullYear() % 400)) {
                monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            }
            if (today.getDate() >= birthDate.getDate()) {
                days = today.getDate() - birthDate.getDate();
            } else {
                days = today.getDate() - birthDate.getDate() + monthDays[birthDate.getMonth()];
            }
    
            return years + " Jahre " + months + " Monat" + (months != 1 ? "e " : " ") + days + " Tag" + (days != 1 ? "e" : "");
        },
        getShutouts: function(element) {
            if (element.so == element.so + element.sl_so) {
                return element.so;
            } else {
                return element.so + element.sl_so + ' (' + element.sl_so + ')';
            }
        },
        // calculating derived stats according to calculate configuration for each specified season
        calculateDerivedStatsForSeasons: function(seasons, statsToCalculate) {
            seasons.forEach(season => {
                this.calculateDerivedStats(season, statsToCalculate);
            });
        },
        calculateDerivedStats: function(statLine, statsToCalculate) {
            statsToCalculate.forEach(calcCfg => {
                switch (calcCfg.type) {
                    case 'from_100_percentage':
                        statLine[calcCfg.name] = this.calculateFrom100Percentage(statLine[calcCfg.value], statLine[calcCfg.base]);
                        break;
                    case 'rate_with_factor':
                        statLine[calcCfg.name] = this.calculateRate(statLine[calcCfg.numerator], statLine[calcCfg.denominator], calcCfg.factor);
                        break;
                    case 'sum':
                        statLine[calcCfg.name] = statLine[calcCfg.summand_1] + statLine[calcCfg.summand_2];
                        break;
                    case 'rate':
                        statLine[calcCfg.name] = this.calculateRate(statLine[calcCfg.numerator], statLine[calcCfg.denominator]);
                        break;
                    case 'rate_per_60':
                        statLine[calcCfg.name] = this.calculatePer60(statLine[calcCfg.numerator], statLine[calcCfg.denominator]);
                        break;
                    case 'difference':
                        statLine[calcCfg.name] = statLine[calcCfg.minuend] - statLine[calcCfg.subtrahend];
                        break;
                    case 'percentage':
                        statLine[calcCfg.name] = this.calculatePercentage(statLine[calcCfg.value], statLine[calcCfg.base]);
                        break;
                    case 'filter':
                        if (statLine['season'] >= calcCfg.valid_from) {
                            statLine[calcCfg.name] = statLine[calcCfg.value];
                        } else {
                            statLine[calcCfg.name] = 0;
                        };
                        break;
                    default:
                        break;
                };
            });

        }
    }
});

app.directive('playerStatsTable', ['svc', function(svc) {
    return {
        restrict: 'E',         
        scope: {
            id: '@',
            filteredPlayerStats: '=',
            statsCols: '=',
            ctrl: '=',
            seasonType: '='
        },
        templateUrl: 'custom_directives/player_stats_table.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('careerStatsTable', ['svc', function(svc) {
    return {
        restrict: 'E',         
        scope: {
            id: '@',
            filteredSeasonPlayerStats: '=',
            statsCols: '=',
            ctrl: '=',
            seasonType: '='
        },
        templateUrl: 'custom_directives/career_stats_table.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);


app.directive('playerCareerTable', ['svc', function(svc) {
    return {
        restrict: 'E',         
        scope: {
            id: '@',
            pid: '=',
            filteredSeasons: '=',
            statsCols: '=',
            ctrl: '=',
            seasonType: '='
        },
        templateUrl: 'custom_directives/player_career_table.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('playerCareerTableFooter', ['svc', function(svc) {
    return {
        restrict: 'A',         
        scope: {
            filteredSeasons: '=',
            statsCols: '=',
            ctrl: '=',
            seasonType: '='
        },
        templateUrl: 'custom_directives/player_career_table_footer.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('tableHeader', ['svc', function(svc) {
    return {
        restrict: 'A',
        scope: {
            filteredSeasons: '=',
            statsCols: '=',
            ctrl: '=',
            seasonType: '='
        },
        templateUrl: 'custom_directives/table_header.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('previewTableHeader', ['svc', function(svc) {
    return {
        restrict: 'A',
        scope: {
            statsCols: '=',
            ctrl: '=',
            tableTopic: '=',
            noRank: '='
        },
        templateUrl: 'custom_directives/preview_table_header.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('previewHomeRoadSwitch', ['svc', function(svc) {
    return {
        restrict: 'E',
        scope: {
            // statsCols: '=',
            ctrl: '=',
            periods: '='
        },
        templateUrl: 'custom_directives/preview_home_road_switch.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('previewSectionHeader', ['svc', function(svc) {
    return {
        restrict: 'E',
        scope: {
            ctrl: '=',
            sectionId: '=',
            sectionTitle: '=',
            po: '=',
            minGames: '=',
            team: '='
        },
        templateUrl: 'custom_directives/preview_section_header.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);

app.directive('previewTeamTable', ['svc', function(svc) {
    return {
        restrict: 'E',         
        scope: {
            // id: '@',
            // pid: '=',
            // filteredSeasons: '=',
            statsCols: '=',
            ctrl: '=',
            tableTopic: '=',
            displayStats: '=',
            po: '=',
            filter: '=',
            limit: '='
        },
        templateUrl: 'custom_directives/preview_team_table.html',
        link: function(scope) {
            scope.svc = svc;
        }
    }
}]);
