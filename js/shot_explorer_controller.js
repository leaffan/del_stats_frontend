app.controller(
    'shotExplorerController',
    function ($scope, $http, $routeParams, $location, $timeout, config, svc) {
        $scope.svc = svc;

        // ── Season / Player from URL ─────────────────────────────────────────────
        $scope.season = Number.parseInt($routeParams.season) || config.defaultSeason;
        $scope.player_id = $routeParams.player_id;

        svc.setTitle('Schussanalyse ' + svc.getSeasonIdentifier($scope.season));

        // ── Filter defaults ──────────────────────────────────────────────────────
        $scope.seasonTypeFilter = 'all';
        $scope.situationFilter = 'all';
        $scope.targetTypeFilter = 'all';
        $scope.periodFilter = 'all';
        $scope.homeRoadFilter = 'all';
        $scope.oppFilter = 'all';
        $scope.goalieFilter = 'all';

        // ── PO round display mapping (manually configurable) ───────────────────
        $scope.poRoundLabels = {
            first_round: 'PO1',
            quarter_finals: 'VF',
            semi_finals: 'HF',
            finals: 'F',
        };

        // ── Zone overlay visibility (mutually exclusive: 'none', 'edge', or 'es') ──
        $scope.zoneOverlay = 'edge';

        // ── Shot list sorting ────────────────────────────────────────────────────
        // Each entry is the tie-break chain passed to orderBy for that column
        // (Angular's own leading "-" reverses just that one field; the whole
        // chain then flips together with sortConfig.sortDescending)
        $scope.sortCriteria = {
            game_date: ['game_date', 'period', 'time'],
            period: ['period', 'time'],
            time: ['time'],
            plr_situation: ['plr_situation', 'game_date', 'time'],
            opp_team: ['opp_team', 'game_date', 'time'],
            ne_shot_zone: ['ne_shot_zone', 'distance'],
            shot_zone: ['shot_zone', 'distance'],
            distance: ['distance', 'time'],
            target_type: ['target_type', 'distance'],
            goalie_last_name: ['goalie_last_name', 'game_date', 'time'],
        };
        $scope.sortConfig = { sortKey: null, sortCriteria: null, sortDescending: false };
        $scope.setSortOrder = function (sortKey) {
            $scope.sortConfig = svc.setSortOrder2(sortKey, $scope.sortConfig, $scope.sortCriteria, [
                'period',
                'opp_team',
                'goalie_last_name',
            ]);
        };

        // ── Model ────────────────────────────────────────────────────────────────
        $scope.model = { team: null, player_id: $scope.player_id, new_player_id: $scope.player_id };
        $scope.ctrl = {};

        // ── Time / round filter defaults ─────────────────────────────────────────
        $scope.timespanSelect = '';
        $scope.fromRoundSelect = '1';
        $scope.toRoundSelect = '';
        $scope.monthsPlayed = [];
        $scope.maxRoundPlayed = 52;
        $scope.filteredShots = [];
        $scope.shotStats = null;
        $scope.hoveredShotIndex = null;

        $scope.hoverShot = function (index) {
            $scope.hoveredShotIndex = index;
        };

        // Cache: for per-player files keyed as "season_playerId"; for legacy big file keyed as season number
        let shotCache = {};
        // All shots for the currently selected player (before UI filters)
        let playerShots = [];
        // Opposing goalie player_id -> full_name / abbreviated name, rebuilt
        // whenever the loaded shots change
        let goalieNameById = {};
        let goalieShortNameById = {};
        let goalieLastNameById = {};

        // ── Static data loads ────────────────────────────────────────────────────
        $http.get('./data/del_players.json').then(function (res) {
            $scope.players = res.data;
        });

        // loading player ids with portraits
        $http.get('./po/' + $scope.season + '/_portraits.json').then(function (res) {
            $scope.portraits = res.data;
            $scope.hasPortrait = $scope.portraits.includes($scope.player_id);
        });

        $http.get('./cfg/teams.json').then(function (res) {
            $scope.all_teams = res.data.filter(function (t) {
                return svc.isTeamValidForSeason(t, $scope.season);
            });
            maybeSetColors();
        });

        $http
            .get('./data/' + $scope.season + '/del_player_personal_data.json')
            .then(function (res) {
                let pd = res.data[1].find(function (p) {
                    return p.player_id == $scope.player_id;
                });
                if (pd) {
                    $scope.currentPlayerData = pd;
                    $scope.mainNumber = pd.no;
                }
            });

        $http
            .get('./data/' + $scope.season + '/del_player_game_stats_aggregated.json')
            .then(function (res) {
                let seen = {};
                $scope.all_players = [];
                res.data[1].forEach(function (el) {
                    let key = el.player_id + '_' + el.team;
                    if (!seen[key]) {
                        $scope.all_players.push(el);
                        seen[key] = true;
                    }
                });
                let currentPlayer = $scope.all_players.find(function (p) {
                    return p.player_id == $scope.player_id;
                });
                if (currentPlayer) {
                    $scope.player_name = currentPlayer.full_name;
                    $scope.model.team = currentPlayer.team;
                    maybeSetColors();
                }
                $scope.loadShots();
            });

        function maybeSetColors() {
            if ($scope.all_teams && $scope.model.team) {
                let teamObj = $scope.all_teams.find(function (t) {
                    return t.abbr === $scope.model.team;
                });
                if (teamObj) {
                    $scope.colors = teamObj.colors;
                }
            }
        }

        // ── Navigation helpers ───────────────────────────────────────────────────
        $scope.changeSeason = function () {
            $location.path('/shot_explorer/' + $scope.season + '/' + $scope.player_id);
        };

        // ── Shot loading ─────────────────────────────────────────────────────────
        $scope.loadShots = function () {
            if (!$scope.model.player_id) {
                return;
            }

            let season = $scope.season;
            let playerId = Number.parseInt($scope.model.player_id);

            // Season 2025+: per-player files available under shots/per_player/
            if (season >= 2025) {
                let cacheKey = season + '_' + playerId;
                if (shotCache[cacheKey]) {
                    playerShots = shotCache[cacheKey];
                    updateShotMetadata();
                    $scope.applyFilters();
                } else {
                    $http
                        .get('./data/' + season + '/shots/per_player/' + playerId + '.json')
                        .then(function (res) {
                            shotCache[cacheKey] = res.data;
                            playerShots = res.data;
                            updateShotMetadata();
                            $scope.applyFilters();
                        });
                }
            } else {
                // Legacy: load full season file and filter by player
                if (shotCache[season]) {
                    playerShots = shotCache[season].filter(function (s) {
                        return s.player_id === playerId;
                    });
                    updateShotMetadata();
                    $scope.applyFilters();
                } else {
                    $http.get('./data/' + season + '/del_shots.json').then(function (res) {
                        shotCache[season] = res.data;
                        playerShots = res.data.filter(function (s) {
                            return s.player_id === playerId;
                        });
                        updateShotMetadata();
                        $scope.applyFilters();
                    });
                }
            }
        };

        // ── Shot metadata (months / rounds) derived from loaded shots ────────────
        function updateShotMetadata() {
            let months = playerShots
                .map(function (s) {
                    return s.game_date ? new Date(s.game_date).getMonth() : null;
                })
                .filter(function (m) {
                    return m !== null;
                });
            $scope.monthsPlayed = [...new Set(months)];

            let seenRounds = {};
            let roundsPlayed = [];
            playerShots.forEach(function (s) {
                let key = s.round + '|' + (s.po_round || '');
                if (s.round && !seenRounds[key]) {
                    seenRounds[key] = true;
                    roundsPlayed.push({ round: s.round, po_round: s.po_round || null, key: key });
                }
            });
            $scope.roundsPlayed = roundsPlayed;
            $scope.maxRoundPlayed =
                roundsPlayed.length > 0
                    ? Math.max.apply(
                          Math,
                          roundsPlayed.map(function (r) {
                              return r.round;
                          }),
                      )
                    : 52;
            $scope.fromRoundSelect = roundsPlayed.length > 0 ? roundsPlayed[0].key : '1|';
            $scope.toRoundSelect =
                roundsPlayed.length > 0 ? roundsPlayed[roundsPlayed.length - 1].key : '52|';

            let dates = playerShots
                .map(function (s) {
                    return s.game_date;
                })
                .filter(Boolean)
                .sort();
            $scope.minShotDate = dates.length > 0 ? moment(dates[0]).format('DD.MM.YYYY') : null;
            $scope.maxShotDate =
                dates.length > 0 ? moment(dates[dates.length - 1]).format('DD.MM.YYYY') : null;

            // Goalies actually faced by this player this season, resolved to
            // full names via the same season roster used for the player select
            goalieNameById = {};
            goalieShortNameById = {};
            goalieLastNameById = {};
            let seenGoalies = {};
            let goalieOptions = [];
            $scope.hasEmptyNetShots = false;
            playerShots.forEach(function (s) {
                if (s.goalie === null || s.goalie === undefined) {
                    $scope.hasEmptyNetShots = true;
                    return;
                }
                if (!seenGoalies[s.goalie]) {
                    seenGoalies[s.goalie] = true;
                    let p =
                        $scope.all_players &&
                        $scope.all_players.find(function (pl) {
                            return pl.player_id == s.goalie;
                        });
                    let full_name = p ? p.full_name : 'Torhüter ' + s.goalie;
                    let last_name = p ? p.last_name : full_name;
                    goalieNameById[s.goalie] = full_name;
                    goalieLastNameById[s.goalie] = last_name;
                    goalieShortNameById[s.goalie] =
                        p && p.first_name ? p.first_name.charAt(0) + '. ' + p.last_name : full_name;
                    goalieOptions.push({
                        id: s.goalie,
                        full_name: full_name,
                        last_name: last_name,
                    });
                }
            });
            $scope.goalieOptions = goalieOptions.sort(function (a, b) {
                return a.last_name.localeCompare(b.last_name);
            });
        }

        // the moment-picker calendar doesn't reliably fire ng-change on its
        // input (especially combined with updateOn: 'blur'), so watch the
        // bound dates directly instead of relying on that event. Watching the
        // timestamp rather than the moment object itself, since the picker
        // appears to mutate the same moment instance in place on later
        // selections rather than assigning a new one, which a plain
        // reference-equality $watch would only catch on the first change
        $scope.$watch(
            function () {
                return $scope.ctrl.fromDate ? $scope.ctrl.fromDate.valueOf() : null;
            },
            function (newVal, oldVal) {
                if (newVal !== oldVal) $scope.applyFilters();
            },
        );
        $scope.$watch(
            function () {
                return $scope.ctrl.toDate ? $scope.ctrl.toDate.valueOf() : null;
            },
            function (newVal, oldVal) {
                if (newVal !== oldVal) $scope.applyFilters();
            },
        );

        $scope.changeTimespan = function () {
            if ($scope.timespanSelect === '' || $scope.timespanSelect === null) {
                $scope.ctrl.fromDate = null;
                $scope.ctrl.toDate = null;
            } else {
                let month = parseInt($scope.timespanSelect);
                let year = $scope.season + (month < 8 ? 1 : 0);
                $scope.ctrl.fromDate = moment({ year: year, month: month, date: 1 });
                $scope.ctrl.toDate = moment({ year: year, month: month, date: 1 }).endOf('month');
            }
            $scope.applyFilters();
        };

        // ── Filtering + coordinate transform ─────────────────────────────────────
        $scope.applyFilters = function () {
            let shots = playerShots.slice();

            if ($scope.seasonTypeFilter !== 'all') {
                shots = shots.filter(function (s) {
                    return s.season_type === $scope.seasonTypeFilter;
                });
            }
            if ($scope.situationFilter !== 'all') {
                shots = shots.filter(function (s) {
                    return s.situation === $scope.situationFilter;
                });
            }
            if ($scope.targetTypeFilter !== 'all') {
                if ($scope.targetTypeFilter === 'goals') {
                    shots = shots.filter(function (s) {
                        return s.scored;
                    });
                } else {
                    shots = shots.filter(function (s) {
                        return s.target_type === $scope.targetTypeFilter;
                    });
                }
            }
            if ($scope.periodFilter !== 'all') {
                shots = shots.filter(function (s) {
                    return s.period == $scope.periodFilter;
                });
            }
            if ($scope.homeRoadFilter !== 'all') {
                shots = shots.filter(function (s) {
                    return s.home_road === $scope.homeRoadFilter;
                });
            }
            if ($scope.oppFilter !== 'all') {
                shots = shots.filter(function (s) {
                    return s.opp_team === $scope.oppFilter;
                });
            }
            if ($scope.goalieFilter !== 'all') {
                if ($scope.goalieFilter === 'empty_net') {
                    shots = shots.filter(function (s) {
                        return s.goalie === null || s.goalie === undefined;
                    });
                } else {
                    shots = shots.filter(function (s) {
                        return s.goalie == $scope.goalieFilter;
                    });
                }
            }

            // Date range (set either by month selector or directly)
            if ($scope.ctrl.fromDate) {
                let from = $scope.ctrl.fromDate.format('YYYY-MM-DD');
                shots = shots.filter(function (s) {
                    return s.game_date >= from;
                });
            }
            if ($scope.ctrl.toDate) {
                let to = $scope.ctrl.toDate.format('YYYY-MM-DD');
                shots = shots.filter(function (s) {
                    return s.game_date <= to;
                });
            }

            // Round range
            let fromIdx = $scope.roundsPlayed.findIndex(function (r) {
                return r.key === $scope.fromRoundSelect;
            });
            let toIdx = $scope.roundsPlayed.findIndex(function (r) {
                return r.key === $scope.toRoundSelect;
            });
            if (fromIdx === -1) {
                fromIdx = 0;
            }
            if (toIdx === -1) {
                toIdx = $scope.roundsPlayed.length - 1;
            }
            if (fromIdx > 0 || toIdx < $scope.roundsPlayed.length - 1) {
                let validKeys = new Set(
                    $scope.roundsPlayed.slice(fromIdx, toIdx + 1).map(function (r) {
                        return r.key;
                    }),
                );
                shots = shots.filter(function (s) {
                    return validKeys.has(s.round + '|' + (s.po_round || ''));
                });
            }

            // Transform to SVG coords (full rink, goal on left, viewBox "-0.5 -0.5 121 61")
            // Road teams attack left (x<0 = attacking zone); home teams attack right (x>0 = attacking zone) → mirror to left
            $scope.filteredShots = shots.map(function (s) {
                let sx, sy;
                if (s.home_road === 'home') {
                    // home attacks right → mirror to show attacking left
                    sx = 60 - s.x * 2;
                    sy = 30 + s.y * 2;
                } else {
                    // road attacks left → already correct
                    sx = 60 + s.x * 2;
                    sy = 30 - s.y * 2;
                }
                let mins = Math.floor(s.time / 60);
                let secs = s.time % 60;
                return {
                    svg_x: sx,
                    svg_y: sy,
                    scored: s.scored,
                    target_type: s.target_type,
                    shot_zone: s.shot_zone,
                    ne_shot_zone: s.ne_shot_zone,
                    opp_team: s.opp_team,
                    game_date: s.game_date,
                    goalie_name:
                        s.goalie === null || s.goalie === undefined
                            ? 'Leeres Tor'
                            : goalieShortNameById[s.goalie] || 'Torhüter ' + s.goalie,
                    goalie_last_name:
                        s.goalie === null || s.goalie === undefined
                            ? 'Leeres Tor'
                            : goalieLastNameById[s.goalie] || 'Torhüter ' + s.goalie,
                    distance: s.distance,
                    period: s.period,
                    situation: s.situation,
                    plr_situation: s.plr_situation,
                    home_road: s.home_road,
                    time: s.time,
                    time_str: mins + ':' + (secs < 10 ? '0' : '') + secs,
                };
            });

            $scope.shotStats = computeStats(shots);
        };

        $scope.shotColor = function (shot) {
            if (shot.scored) {
                return '#1a1a1a';
            }
            if (shot.target_type === 'on_goal') {
                return '#2980b9';
            }
            if (shot.target_type === 'blocked') {
                return '#f39c12';
            }
            return '#e74c3c'; // missed
        };

        $scope.shotOpacity = function (shot) {
            return shot.scored ? 0.9 : 0.55;
        };

        // ── Statistics ───────────────────────────────────────────────────────────
        function computeStats(shots) {
            if (!shots || shots.length === 0) {
                return null;
            }

            let goals = shots.filter(function (s) {
                return s.scored;
            }).length;
            let onGoal = shots.filter(function (s) {
                return s.target_type === 'on_goal';
            }).length;
            let blocked = shots.filter(function (s) {
                return s.target_type === 'blocked';
            }).length;
            let missed = shots.filter(function (s) {
                return s.target_type === 'missed';
            }).length;

            let zoneCounts = {};
            shots.forEach(function (s) {
                let z = s.shot_zone || 'UNKNOWN';
                zoneCounts[z] = (zoneCounts[z] || 0) + 1;
            });
            let zoneList = Object.keys(zoneCounts)
                .map(function (k) {
                    return { zone: k, count: zoneCounts[k] };
                })
                .sort(function (a, b) {
                    return b.count - a.count;
                });

            return {
                total: shots.length,
                goals: goals,
                on_goal: onGoal,
                blocked: blocked,
                missed: missed,
                shooting_pct: ((goals / shots.length) * 100).toFixed(1),
                on_goal_pct: ((onGoal / shots.length) * 100).toFixed(1),
                zones: zoneList,
            };
        }

        // Download the current rink view as PNG, kept in the same portrait
        // orientation as it's shown on screen (viewBox 61 x 121), with a title
        // bar added above it
        $scope.downloadRink = function () {
            let svgEl = document.querySelector('.rink-svg');
            if (!svgEl) {
                return;
            }

            // Serialize SVG; all styles are inline so external CSS is not needed
            let serializer = new XMLSerializer();
            let svgStr = serializer.serializeToString(svgEl);
            // Ensure xmlns is present
            if (svgStr.indexOf('xmlns=') === -1) {
                svgStr = svgStr.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
            }

            let blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            let url = URL.createObjectURL(blob);
            let img = new Image();
            img.onload = function () {
                // Portrait render size, matching the on-screen viewBox aspect (61 x 121)
                let W = 600;
                let H = Math.round((W * 121) / 61);
                let titleHeight = 60;

                let canvas = document.createElement('canvas');
                canvas.width = W;
                canvas.height = H + titleHeight;
                let ctx = canvas.getContext('2d');

                // White background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Title
                let title =
                    'Schussanalyse – ' +
                    ($scope.player_name || 'Spieler ' + $scope.player_id) +
                    ' – Saison ' +
                    svc.getSeasonIdentifier($scope.season);
                ctx.fillStyle = '#1a1a1a';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(title, canvas.width / 2, titleHeight / 2);

                // Rink, unrotated, below the title
                ctx.drawImage(img, 0, titleHeight, W, H);
                URL.revokeObjectURL(url);

                let namePart = ($scope.player_name || 'player_' + $scope.player_id)
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '');
                let link = document.createElement('a');
                link.download = 'schussanalyse_' + namePart + '_' + $scope.season + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = url;
        };

        $scope.changePlayer = function () {
            $scope.model.player_id = $scope.model.new_player_id;
            $location.path('/shot_explorer/' + $scope.season + '/' + $scope.model.player_id);
        };
    },
);
