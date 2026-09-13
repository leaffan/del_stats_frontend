let app = angular.module('delStatsApp', [
    'ngResource',
    'ngRoute',
    'ngStorage',
    'moment-picker',
    'angularMoment',
]);

app.constant('config', {
    defaultSeason: 2026,
    cloudfrontBaseUrl: 'https://d1fqr5y2lyjylu.cloudfront.net/data/',
});

app.factory('cfgLoader', [
    '$http',
    function ($http) {
        return {
            statsToAggregate: function () {
                return $http.get('./cfg/stats_to_aggregate.json', { cache: true });
            },
            statsToCalculate: function () {
                return $http.get('./cfg/stats_to_calculate.json', { cache: true });
            },
            teamsHistoric: function () {
                return $http.get('./cfg/teams_historic.json', { cache: true });
            },
            sortCriteriaPlayers: function () {
                return $http.get('./cfg/sort_criteria_players.json', { cache: true });
            },
            sortCriteriaTables: function () {
                return $http.get('./cfg/sort_criteria_tables.json', { cache: true });
            },
        };
    },
]);

// main application configuration

app.config([
    '$routeProvider',
    function ($routeProvider) {
        $routeProvider
            .when('/home', {
                title: 'DEL-Statistiken',
                templateUrl: 'home.html',
                controller: 'homeController as ctrl',
                reloadOnSearch: false,
            })
            .when('/schedules/:season', {
                title: 'Spielpläne',
                templateUrl: 'schedules.html',
                controller: 'schedulesController as ctrl',
                reloadOnSearch: false,
            })
            .when('/del_stats/:season', {
                title: 'Spielerstatistiken',
                templateUrl: 'player_stats.html',
                controller: 'plrStatsController as ctrl',
                reloadOnSearch: false,
            })
            .when('/team_stats/:season', {
                title: 'Teamstatistiken',
                templateUrl: 'team_stats.html',
                controller: 'teamStatsController as ctrl',
                reloadOnSearch: false,
            })
            .when('/player_profile/:season/:team/:player_id', {
                title: 'Spielerprofil',
                templateUrl: 'player_profile.html',
                controller: 'plrProfileController as ctrl',
                reloadOnSearch: false,
            })
            .when('/team_profile/:season/:team/:table_select?', {
                title: 'Teamprofil',
                templateUrl: 'team_profile.html',
                controller: 'teamProfileController as ctrl',
                reloadOnSearch: false,
            })
            .when('/career_stats', {
                title: 'Karrierestatistiken',
                templateUrl: 'career_stats.html',
                controller: 'careerStatsController as ctrl',
                reloadOnSearch: false,
            })
            .when('/player_career/:player_id', {
                title: 'Karriereverlauf',
                templateUrl: 'player_career.html',
                controller: 'playerCareerController as ctrl',
                reloadOnSearch: false,
            })
            .when('/team_trivia/:category?/:seasonType?', {
                title: 'Team-Trivia',
                templateUrl: 'team_trivia.html',
                controller: 'teamTriviaController as ctrl',
                reloadOnSearch: false,
            })
            .when('/game_trivia/:category?/:seasonType?', {
                title: 'Spiel-Trivia',
                templateUrl: 'game_trivia.html',
                controller: 'gameTriviaController as ctrl',
                reloadOnSearch: false,
            })
            .when('/shot_explorer/:season/:player_id', {
                title: 'Shot Explorer',
                templateUrl: 'shot_explorer.html',
                controller: 'shotExplorerController',
                reloadOnSearch: false,
            })
            .otherwise({
                redirectTo: '/home',
            });
    },
]);

app.config([
    'momentPickerProvider',
    function (momentPickerProvider) {
        momentPickerProvider.options({
            locale: 'de',
            format: 'L',
            minView: 'decade',
            maxView: 'day',
            startView: 'month',
            autoclose: true,
            keyboard: true,
        });
    },
]);

app.run([
    '$rootScope',
    function ($rootScope) {
        $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
            // TODO: set page title dynamically to include current teams
            $rootScope.title = current.$$route.title;
        });
    },
]);

app.run(function (amMoment) {
    amMoment.changeLocale('de');
});

// providing functions to several controllers as services
app.factory('svc', function ($rootScope) {
    return {
        setTitle: function (title) {
            $rootScope.title = title;
        },
        // sets sorting order according to selected sort criterion
        setSortOrder: function (
            sortCriterion,
            oldSortCriterion,
            oldStatsSortDescending,
            ascendingAttrs,
        ) {
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
        setSortOrder2: function (sortKey, oldSortConfig, globalSortConfig, ascendingAttrs) {
            // if previous sort key equals the new one
            if (oldSortConfig['sortKey'] == sortKey) {
                // just change sort direction
                return {
                    sortKey: oldSortConfig['sortKey'],
                    sortCriteria: oldSortConfig['sortCriteria'],
                    sortDescending: !oldSortConfig['sortDescending'],
                };
            } else {
                let sortCriteria = globalSortConfig[sortKey] || sortKey;
                // ascending sort order for a few columns
                if (ascendingAttrs.indexOf(sortKey) !== -1) {
                    return {
                        sortKey: sortKey,
                        sortCriteria: sortCriteria,
                        sortDescending: false,
                    };
                    // otherwise descending sort order
                } else {
                    return {
                        sortKey: sortKey,
                        sortCriteria: sortCriteria,
                        sortDescending: true,
                    };
                }
            }
        },
        // gets season identifier in the form of 2022/23 for 2022 season
        getSeasonIdentifier: function (season) {
            return season + '/' + (parseInt(season) + 1).toString().slice(-2);
        },
        // checks if team is valid for a given season (supports multiple periods via valid_periods)
        isTeamValidForSeason: function (team, season) {
            // If valid_periods is defined, use that for teams with non-continuous presence
            if (team.valid_periods && Array.isArray(team.valid_periods)) {
                return team.valid_periods.some(
                    (period) => season >= period.from && season <= period.to,
                );
            }
            // Otherwise use the classic valid_from/valid_to for backwards compatibility
            return team.valid_from <= season && team.valid_to >= season;
        },
        // formats time (in seconds) as mm:ss
        formatTime: function (timeInSeconds, factor) {
            if (factor) timeInSeconds = timeInSeconds * factor;
            return (
                this.pad(Math.floor(timeInSeconds / 60), 2) +
                ':' +
                ('00' + (Math.floor(timeInSeconds) % 60)).slice(-2)
            );
        },
        // formats a (potentially large, multi-game) duration in seconds as h:mm:ss,
        // unlike formatTime this rolls minutes over into hours instead of just
        // growing past 60
        formatDuration: function (timeInSeconds) {
            let hours = Math.floor(timeInSeconds / 3600);
            let minutes = Math.floor((timeInSeconds % 3600) / 60);
            let seconds = Math.floor(timeInSeconds % 60);
            return hours + ':' + this.pad(minutes, 2) + ':' + this.pad(seconds, 2);
        },
        // gets total sum of attribute values from provided list optionally starting at from season and for specified season type
        getFilteredTotal: function (list, attribute, dataSource, fromSeason, seasonType) {
            if (dataSource === undefined) return;
            if (list === undefined) return;
            list = list.filter((item) => item.order != 0);
            if (seasonType && seasonType != 'ALL') {
                list = list.filter((item) => item.season_type == seasonType);
            }
            if (fromSeason) {
                list = list.filter((item) => item.season >= fromSeason);
            }
            return list.reduce((sum, item) => {
                return sum + item[attribute];
            }, 0);
        },
        getNumberOfUniqueItemsInSeasons: function (seasons, attribute, fromSeason, seasonType) {
            if (seasons === undefined) return;
            seasons = seasons.filter((season) => season.order != 0);
            if (seasonType && seasonType != 'ALL') {
                seasons = seasons.filter((season) => season.season_type == seasonType);
            }
            if (fromSeason) {
                seasons = seasons.filter((season) => season.season >= fromSeason);
            }
            return new Set(seasons.map((season) => season[attribute])).size;
        },
        getMinMaxFromSeasons: function (seasons, attribute) {
            if (seasons === undefined) return;
            let all_ages = new Set(seasons.map((season) => season.age));
            return [Math.min(...all_ages), Math.max(...all_ages)];
        },
        // gets total sum of filtered attributed values through a specified game date
        getFilteredAccumulatedTotal: function (list, attribute, dataSource, to) {
            if (dataSource === undefined) {
                return;
            }
            let total = 0;
            for (let i = list.length - 1; i >= 0; i--) {
                total += list[i][attribute];
                if (list[i]['game_date'] == to) {
                    return total;
                }
            }
            return total;
        },
        // gets average of filtered attributed values through a specified game date
        getFilteredAverageTotal: function (list, attribute, dataSource, to) {
            if (dataSource === undefined) {
                return;
            }
            let total = 0;
            let cnt_data = 0;
            for (let i = list.length - 1; i >= 0; i--) {
                cnt_data++;
                total += list[i][attribute];

                if (list[i]['game_date'] == to) {
                    return total / cnt_data;
                }
            }
            return total / cnt_data;
        },
        parseFloat: function (floatAsString) {
            return parseFloat(floatAsString);
        },
        parseInt: function (intAsString) {
            return parseInt(intAsString);
        },
        isNumeric: function (num) {
            return !isNaN(num);
        },
        replaceRoundNames: function (roundName, short) {
            if (roundName === undefined) return;
            if (!isNaN(roundName)) return roundName;
            if (short) {
                return roundName
                    .replace('first_round_', '1. PR ')
                    .replace('quarter_finals_', 'VF ')
                    .replace('semi_finals_', 'HF ')
                    .replace('finals_', 'F ');
            } else {
                return roundName
                    .replace('first_round_', '1. Playoff-Runde ')
                    .replace('quarter_finals_', 'Viertelfinale ')
                    .replace('semi_finals_', 'Halbfinale ')
                    .replace('finals_', 'Finale ');
            }
        },
        setTextColor: function (score, opp_score) {
            if (score > opp_score) {
                return ' green';
            } else if (opp_score > score) {
                return ' red';
            } else {
                return '';
            }
        },
        range: function (min, max, step) {
            step = step || 1;
            let input = [];
            for (let i = min; i <= max; i += step) {
                input.push(i);
            }
            return input;
        },
        // team stats to be simply aggregated
        stats_to_aggregate: function () {
            return [
                'games_played',
                'score',
                'opp_score',
                'goals',
                'opp_goals',
                'w',
                'rw',
                'ow',
                'sw',
                'l',
                'rl',
                'ol',
                'sl',
                'points',
                'goals_1',
                'opp_goals_1',
                'goals_2',
                'opp_goals_2',
                'goals_3',
                'opp_goals_3',
                'shots',
                'shots_on_goal',
                'shots_missed',
                'shots_blocked',
                'opp_shots',
                'opp_shots_on_goal',
                'opp_shots_missed',
                'opp_shots_blocked',
                'saves',
                'opp_saves',
                'pim',
                'pp_time',
                'pp_opps',
                'pp_goals',
                'opp_pim',
                'opp_pp_time',
                'opp_pp_opps',
                'opp_pp_goals',
                'sh_opps',
                'sh_goals',
                'opp_sh_opps',
                'opp_sh_goals',
                'faceoffs_won',
                'faceoffs_lost',
                'faceoffs',
                'sl_sh',
                'lf_sh',
                'rg_sh',
                'bl_sh',
                'sl_og',
                'lf_og',
                'rg_og',
                'bl_og',
                'sl_sh_a',
                'lf_sh_a',
                'rg_sh_a',
                'bl_sh_a',
                'sl_og_a',
                'lf_og_a',
                'rg_og_a',
                'bl_og_a',
                'attendance',
                'penalty_2',
                'penalty_5',
                'penalty_10',
                'penalty_20',
                'penalty_25',
                'shots_on_goal_5v5',
                'goals_5v5',
                'opp_shots_on_goal_5v5',
                'opp_goals_5v5',
                'capacity',
                'sl_g',
                'lf_g',
                'rg_g',
                'bl_g',
                'sl_g_a',
                'lf_g_a',
                'rg_g_a',
                'bl_g_a',
                'tied',
                'leading',
                'trailing',
                'time_played',
                'shots_5v5',
                'opp_shots_5v5',
                'shots_unblocked_5v5',
                'opp_shots_unblocked_5v5',
                'shots_pp',
                'shots_unblocked_pp',
                'shots_on_goal_pp',
                'so_rounds',
                'so_a',
                'so_g',
                'opp_so_a',
                'opp_so_g',
                'hit_post',
                'opp_hit_post',
                'pp_5v4',
                'ppg_5v4',
                'pp_5v3',
                'ppg_5v3',
                'pp_4v3',
                'ppg_4v3',
                'opp_pp_5v4',
                'opp_ppg_5v4',
                'opp_pp_5v3',
                'opp_ppg_5v3',
                'opp_pp_4v3',
                'opp_ppg_4v3',
                'ppt_5v4',
                'opp_ppt_5v4',
                'ppt_5v3',
                'opp_ppt_5v3',
                'ppt_4v3',
                'opp_ppt_4v3',
                'ev_goals',
                'opp_ev_goals',
                'f_goals',
                'f_assists',
                'f_points',
                'f_sog',
                'd_goals',
                'd_assists',
                'd_points',
                'd_sog',
                'u23_gp',
                'u23_g',
                'u23_a',
                'u23_pts',
                'u23_shifts',
                'u23_toi',
                'u23_toi_pp_sh',
                'en_goals',
                'opp_en_goals',
                'ea_goals',
                'opp_ea_goals',
                'xg',
                'opp_xg',
                'xg_5v5',
                'opp_xg_5v5',
                'sellout',
            ];
        },
        pad: function pad(num, size) {
            let s = num + '';
            while (s.length < size) s = '0' + s;
            return s;
        },
        germanDays: function () {
            return [0, 1, 2, 3, 4, 5, 6].map((day) =>
                moment().locale('de').weekday(day).format('dddd'),
            );
        },
        germanMonths: function () {
            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) =>
                moment().locale('de').month(month).format('MMMM'),
            );
        },
        shortenName: function (full_name) {
            if (!full_name) {
                return '';
            }
            let names = full_name.split(' ');
            return names[0][0] + '. ' + names.slice(-1)[0];
        },
        calculateDifference: function (minuend, subtrahend) {
            return minuend - subtrahend;
        },
        calculateRate: function (value_to_rate, rating_parameter, factor) {
            if (factor) value_to_rate = value_to_rate * factor;
            if (rating_parameter) {
                return value_to_rate / rating_parameter;
            } else {
                return 0;
            }
        },
        calculatePercentage: function (part_value, base_value, factor, return_null) {
            if (factor === undefined) factor = 1;
            if (base_value) {
                return (part_value / (base_value * factor)) * 100;
            } else {
                if (return_null) {
                    return null;
                } else {
                    return 0;
                }
            }
        },
        calculateFrom100Percentage: function (part_value, base_value, factor) {
            if (factor === undefined) factor = 1;
            if (base_value) {
                return 100 - (part_value / (base_value * factor)) * 100;
            } else {
                return null;
            }
        },
        calculatePer60: function (value, toi_seconds) {
            if (toi_seconds) {
                return (value / (toi_seconds / 60)) * 60;
            } else {
                return 0;
            }
        },
        calculatePer2Minutes: function (value, toi_seconds) {
            if (toi_seconds) {
                return (value / toi_seconds) * 120;
            } else {
                return 0;
            }
        },
        calculateAge: function (birthDate, today) {
            birthDate = new Date(birthDate);
            if (today === undefined) {
                today = new Date();
            }
            // calculating years
            let years;
            if (
                today.getMonth() > birthDate.getMonth() ||
                (today.getMonth() == birthDate.getMonth() && today.getDate() >= birthDate.getDate())
            ) {
                years = today.getFullYear() - birthDate.getFullYear();
            } else {
                years = today.getFullYear() - birthDate.getFullYear() - 1;
            }

            // calculating months
            let months;
            if (today.getDate() >= birthDate.getDate()) {
                months = today.getMonth() - birthDate.getMonth();
            } else if (today.getDate() < birthDate.getDate()) {
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
            if (
                (0 == birthDate.getFullYear() % 4 && 0 != birthDate.getFullYear() % 100) ||
                0 == birthDate.getFullYear() % 400
            ) {
                monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            }
            if (today.getDate() >= birthDate.getDate()) {
                days = today.getDate() - birthDate.getDate();
            } else {
                days = today.getDate() - birthDate.getDate() + monthDays[birthDate.getMonth()];
            }

            return (
                years +
                ' Jahre ' +
                months +
                ' Monat' +
                (months != 1 ? 'e ' : ' ') +
                days +
                ' Tag' +
                (days != 1 ? 'e' : '')
            );
        },
        getShutouts: function (element) {
            if (element.so == element.so + element.sl_so) {
                return element.so;
            } else {
                return element.so + element.sl_so + ' (' + element.sl_so + ')';
            }
        },
        // calculating derived stats according to calculate configuration for each specified season
        calculateDerivedStatsForSeasons: function (seasons, statsToCalculate) {
            seasons.forEach((season) => {
                this.calculateDerivedStats(season, statsToCalculate);
            });
        },
        calculateDerivedStats: function (statLine, statsToCalculate) {
            statsToCalculate.forEach((calcCfg) => {
                switch (calcCfg.type) {
                    case 'from_100_percentage':
                        statLine[calcCfg.name] = this.calculateFrom100Percentage(
                            statLine[calcCfg.value],
                            statLine[calcCfg.base],
                        );
                        break;
                    case 'rate_with_factor':
                        statLine[calcCfg.name] = this.calculateRate(
                            statLine[calcCfg.numerator],
                            statLine[calcCfg.denominator],
                            calcCfg.factor,
                        );
                        break;
                    case 'sum':
                        statLine[calcCfg.name] =
                            statLine[calcCfg.summand_1] + statLine[calcCfg.summand_2];
                        break;
                    case 'rate':
                        statLine[calcCfg.name] = this.calculateRate(
                            statLine[calcCfg.numerator],
                            statLine[calcCfg.denominator],
                        );
                        break;
                    case 'rate_per_60':
                        statLine[calcCfg.name] = this.calculatePer60(
                            statLine[calcCfg.numerator],
                            statLine[calcCfg.denominator],
                        );
                        break;
                    case 'difference':
                        statLine[calcCfg.name] =
                            statLine[calcCfg.minuend] - statLine[calcCfg.subtrahend];
                        break;
                    case 'percentage':
                        statLine[calcCfg.name] = this.calculatePercentage(
                            statLine[calcCfg.value],
                            statLine[calcCfg.base],
                        );
                        break;
                    case 'filter':
                        if (statLine['season'] >= calcCfg.valid_from) {
                            statLine[calcCfg.name] = statLine[calcCfg.value];
                        } else {
                            statLine[calcCfg.name] = 0;
                        }
                        break;
                    default:
                        break;
                }
            });
        },
    };
});

// shared behavior for the trivia pages (team_trivia, game_trivia, and future
// pages built on the same category/season-type/data-file config shape).
// Mixes generic methods and state directly onto the given controller instance;
// each controller still owns whatever is specific to it (extra sortCriteria
// entries, extra filters, formatRecord, etc.) and calls ctrl.initFromRoute()
// once it has finished its own setup.
app.factory('triviaPageBehavior', [
    '$http',
    '$routeParams',
    'svc',
    'cfgLoader',
    function ($http, $routeParams, svc, cfgLoader) {
        return function (ctrl, options) {
            ctrl.dataCache = {};
            ctrl.categorySelect = '';
            ctrl.seasonTypeSelect = '';

            // turns a human-readable, fully-signed sort spec (e.g. ["-length",
            // "-score_diff", "-scores_for", "season"], read as "length desc,
            // score_diff desc, scores_for desc, season asc") into the shape
            // Angular's orderBy needs to also get the sort-direction caret right.
            // The shared table-header directive shows the caret purely from
            // sortDescending, and orderBy applies that same boolean as a *global*
            // reversal on top of whatever "-"/"+" prefixes are already in the
            // array (confirmed empirically: flipping sortDescending on an
            // already-prefixed array reverses the whole order, it doesn't just
            // relabel it). So the primary key can never keep its own prefix -
            // its direction has to come entirely from sortDescending, or the two
            // would fight each other and the caret would show the opposite of
            // the true order. Fix: store the primary key unprefixed and
            // pre-invert every other key's prefix so that, once the global
            // reversal (sortDescending) is applied, each one still lands on its
            // originally-intended direction.
            ctrl.buildSortConfig = function (defaultSort) {
                let primaryDescending = defaultSort[0].startsWith('-');
                let sortKey = defaultSort[0].replace(/^-/, '');
                let sortCriteria = defaultSort.map(function (entry, index) {
                    let key = entry.replace(/^-/, '');
                    if (index === 0) return key;
                    let entryDescending = entry.startsWith('-');
                    let storedDescending = entryDescending !== primaryDescending;
                    return storedDescending ? '-' + key : key;
                });
                return {
                    sortKey: sortKey,
                    sortCriteria: sortCriteria,
                    sortDescending: primaryDescending,
                };
            };

            // sorting a "team_column"-flagged field (see below) sorts by
            // location rather than by abbreviation, since the table displays
            // the full team name; individual controllers extend this map with
            // their own extras (e.g. Object.assign(ctrl.sortCriteria, {...})),
            // never replace it. Populated once the config is loaded (see
            // initFromRoute), since the actual field names ("team"/"opp",
            // "home_abbr"/"road_abbr", ...) vary per category
            let sortByLocation = function (field) {
                return function (row) {
                    return ctrl.team_location_lookup
                        ? ctrl.team_location_lookup[row[field]]
                        : row[field];
                };
            };
            ctrl.sortCriteria = {};

            // a column is a "team column" when its data_key holds a team
            // abbreviation that should render as the full team name and sort
            // by location - regardless of what that field happens to be called
            // in a given category's data (team/opp, home_abbr/road_abbr, ...)
            ctrl.teamColumnFields = function () {
                let seasonType = ctrl.currentSeasonType();
                if (!seasonType) return [];
                return seasonType.columns
                    .filter((col) => col.team_column)
                    .map((col) => col.data_key);
            };

            // grouping consecutive categories sharing the same group_label_de
            // into one <optgroup> each, in the order they appear in the config
            ctrl.buildCategoryGroups = function (categories) {
                let groups = [];
                Object.keys(categories).forEach(function (key) {
                    let label = categories[key].group_label_de;
                    let lastGroup = groups[groups.length - 1];
                    if (!lastGroup || lastGroup.label !== label) {
                        groups.push({ label: label, keys: [key] });
                    } else {
                        lastGroup.keys.push(key);
                    }
                });
                return groups;
            };

            // retrieving all teams that were ever active in the DEL, for team
            // filters and for displaying full team names (both "team" and
            // "opp" columns) sorted by location
            cfgLoader.teamsHistoric().then(function (res) {
                let orig_teams = res.data;
                let active_teams = orig_teams
                    .filter((team) => team.active)
                    .sort((a, b) => (a.location > b.location ? 1 : -1))
                    .map((team) => team.abbr);
                let inactive_teams = orig_teams
                    .filter((team) => !team.active)
                    .sort((a, b) => (a.location > b.location ? 1 : -1))
                    .map((team) => team.abbr);
                ctrl.all_teams = active_teams.concat(inactive_teams);
                ctrl.team_full_name_lookup = orig_teams.reduce(
                    (o, team) => Object.assign(o, { [team.abbr]: team.full_name }),
                    {},
                );
                ctrl.team_location_lookup = orig_teams.reduce(
                    (o, team) => Object.assign(o, { [team.abbr]: team.location }),
                    {},
                );
            });

            // "season" is usually a single number, but a streak that ran across
            // a season boundary (e.g. a winning streak starting in March and
            // ending the following September) is recorded as a [firstSeason,
            // lastSeason] pair instead
            ctrl.seasonValues = function (season) {
                return Array.isArray(season) ? season : [season];
            };

            ctrl.formatSeason = function (season) {
                return ctrl.seasonValues(season).map(svc.getSeasonIdentifier).join('–');
            };

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
                ctrl.sortConfig = ctrl.buildSortConfig(seasonType.default_sort);
            };

            // (re-)deriving the season range available in the currently loaded
            // season type's data and resetting the season filter to that full
            // range; data without a "season" field simply doesn't get one
            ctrl.setSeasonBounds = function () {
                ctrl.first_season =
                    ctrl.from_season =
                    ctrl.last_season =
                    ctrl.to_season =
                        undefined;
                if (!ctrl.trivia_data || !ctrl.trivia_data.length) return;
                if (ctrl.trivia_data[0].season === undefined) return;
                let seasons = ctrl.trivia_data.reduce(
                    (all, row) => all.concat(ctrl.seasonValues(row.season)),
                    [],
                );
                ctrl.first_season = ctrl.from_season = Math.min(...seasons);
                ctrl.last_season = ctrl.to_season = Math.max(...seasons);
            };

            // loading the data file of the currently selected season type
            // (each season type of a category, e.g. "Heimspiele"/
            // "Auswärtsspiele", may point to its own file)
            ctrl.loadCategoryData = function () {
                let seasonType = ctrl.currentSeasonType();
                if (!seasonType) return;
                if (ctrl.dataCache[seasonType.data_file]) {
                    ctrl.trivia_data = ctrl.dataCache[seasonType.data_file];
                    ctrl.setSeasonBounds();
                    return;
                }
                $http.get(options.dataFolder + seasonType.data_file).then(function (res) {
                    ctrl.dataCache[seasonType.data_file] = res.data;
                    ctrl.trivia_data = res.data;
                    ctrl.setSeasonBounds();
                });
            };

            // switching to the newly selected category, defaulting to its
            // first season type
            ctrl.changeCategory = function () {
                let category = ctrl.currentCategory();
                if (!category) return;
                ctrl.seasonTypeSelect = Object.keys(category.season_types)[0];
                ctrl.applyDefaultSort();
                ctrl.loadCategoryData();
            };

            // switching the season type view within the currently selected
            // category; this may point to a different data file, so data is
            // (re-)loaded as well
            ctrl.changeSeasonType = function () {
                ctrl.applyDefaultSort();
                ctrl.loadCategoryData();
            };

            ctrl.teamFilter = function (row) {
                if (!ctrl.teamSelect) return true;
                return ctrl.teamColumnFields().some((field) => row[field] === ctrl.teamSelect);
            };

            // combines a column's own field with its "record" companions (e.g.
            // wins-losses, or a home-road score pairing) into a single "A-B"
            // display; fields listed under "record_optional" (e.g. ties) are
            // only appended when non-zero, so rows without them stay "A-B"
            // instead of always showing a trailing "-0"
            ctrl.formatRecord = function (row, col) {
                let parts = [row[col.data_key]].concat(
                    (col.record || []).map((field) => row[field]),
                );
                (col.record_optional || []).forEach((field) => {
                    if (row[field]) parts.push(row[field]);
                });
                return parts.join('-');
            };

            // appends a "(VL)"/"(SO)" marker to a score when the game was
            // decided in overtime or a shootout, based on the row's sibling
            // "decided_by" field (REG/OT/SO)
            ctrl.formatScore = function (row, col) {
                let suffix = { OT: ' (VL)', SO: ' (SO)' }[row.decided_by] || '';
                return row[col.data_key] + suffix;
            };

            // a row matches the selected season range if its season(s) overlap
            // it at all, so a streak spanning a season boundary still shows up
            // on either end
            ctrl.seasonFilter = function (row) {
                if (ctrl.first_season === undefined) return true;
                let seasons = ctrl.seasonValues(row.season);
                return (
                    Math.max(...seasons) >= ctrl.from_season &&
                    Math.min(...seasons) <= ctrl.to_season
                );
            };

            // retrieving category/column configuration; deep-links via the
            // optional /:category/:seasonType route params pick a specific
            // starting view, falling back to the first category/season type
            // when absent or invalid. Called explicitly by each controller
            // once it has finished adding its own sortCriteria/filters/etc.
            ctrl.initFromRoute = function () {
                $http.get(options.configUrl).then(function (res) {
                    ctrl.categories = res.data;
                    ctrl.categoryGroups = ctrl.buildCategoryGroups(res.data);
                    // registering location-based sorting for every "team
                    // column" field name used anywhere in this page's config,
                    // so a future category can introduce yet another field
                    // name (team/opp, home_abbr/road_abbr, ...) without any
                    // code change here
                    Object.values(res.data).forEach((category) => {
                        Object.values(category.season_types).forEach((seasonType) => {
                            seasonType.columns
                                .filter((col) => col.team_column)
                                .forEach((col) => {
                                    ctrl.sortCriteria[col.data_key] = sortByLocation(col.data_key);
                                });
                        });
                    });
                    ctrl.categorySelect =
                        $routeParams.category && res.data[$routeParams.category]
                            ? $routeParams.category
                            : Object.keys(res.data)[0];
                    let category = ctrl.currentCategory();
                    if (!category) return;
                    ctrl.seasonTypeSelect =
                        $routeParams.seasonType && category.season_types[$routeParams.seasonType]
                            ? $routeParams.seasonType
                            : Object.keys(category.season_types)[0];
                    ctrl.applyDefaultSort();
                    ctrl.loadCategoryData();
                });
            };
        };
    },
]);

app.directive('playerStatsTable', [
    'svc',
    function (svc) {
        return {
            restrict: 'E',
            scope: {
                filteredPlayerStats: '=',
                statsCols: '=',
                ctrl: '=',
            },
            templateUrl: 'custom_directives/player_stats_table.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);

app.directive('careerStatsTable', [
    'svc',
    function (svc) {
        return {
            restrict: 'E',
            scope: {
                id: '@',
                filteredSeasonPlayerStats: '=',
                statsCols: '=',
                ctrl: '=',
                seasonType: '=',
            },
            templateUrl: 'custom_directives/career_stats_table.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);

app.directive('playerCareerTable', [
    'svc',
    function (svc) {
        return {
            restrict: 'E',
            scope: {
                id: '@',
                pid: '=',
                filteredSeasons: '=',
                statsCols: '=',
                ctrl: '=',
                seasonType: '=',
            },
            templateUrl: 'custom_directives/player_career_table.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);

app.directive('playerCareerTableFooter', [
    'svc',
    function (svc) {
        return {
            restrict: 'A',
            scope: {
                filteredSeasons: '=',
                statsCols: '=',
                ctrl: '=',
                seasonType: '=',
            },
            templateUrl: 'custom_directives/player_career_table_footer.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);

app.directive('tableHeader', [
    'svc',
    function (svc) {
        return {
            restrict: 'A',
            scope: {
                filteredSeasons: '=',
                statsCols: '=',
                ctrl: '=',
                seasonType: '=',
            },
            templateUrl: 'custom_directives/table_header.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);

app.directive('playerInformation', [
    'svc',
    function (svc) {
        return {
            restrict: 'E',
            scope: {
                currentPlayerData: '=',
                model: '=',
                season: '=',
                playerId: '=',
                hasPortrait: '=',
                colors: '=',
                mainNumber: '=',
            },
            templateUrl: 'custom_directives/player_information.html',
            link: function (scope) {
                scope.svc = svc;
            },
        };
    },
]);
