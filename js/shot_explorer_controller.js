app.controller(
    'shotExplorerController',
    function ($scope, $http, $routeParams, $location, $timeout, config, svc) {
        $scope.svc = svc;

        // Collects a German message for each failed request below, shown as a
        // dismissable list instead of leaving the page silently incomplete
        $scope.loadErrors = [];
        function reportLoadError(message) {
            $scope.loadErrors.push(message);
        }

        $http
            .get('./cfg/columns_shot_explorer.json')
            .then(function (res) {
                $scope.shotColumns = res.data;
            })
            .catch(function () {
                reportLoadError('Tabellenspalten konnten nicht geladen werden.');
            });

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

        // ── Zone filter ──────────────────────────────────────────────────────────
        $scope.delZoneLabels = {
            SLOT: 'Slot',
            BLUE_LINE: 'Blaue Linie',
            LEFT: 'Linke Seite',
            RIGHT: 'Rechte Seite',
            NEUTRAL_ZONE: 'Neutrale Zone',
            BEHIND_GOAL: 'Hinter dem Tor',
        };
        $scope.edgeZoneGroupLabels = {
            left: 'Links',
            right: 'Rechts',
            point: 'Point',
            slot: 'Slot',
            tornah: 'Tornah',
            neutral: 'Neutral',
        };
        $scope.edgeZoneGroups = {
            left: ['LCN', 'LNS', 'LCI', 'LOS'],
            right: ['RCN', 'RNS', 'RCI', 'ROS'],
            point: ['CPT', 'LPT', 'RPT'],
            slot: ['LSL', 'HSL'],
            tornah: ['BTN', 'CRS'],
            neutral: ['NZ'],
        };
        $scope.edgeZoneLabels = {
            LCN: 'Linke Ecke',
            LNS: 'Linke Torseite',
            LCI: 'Linker Bullykreis',
            LOS: 'Linke Außenzone',
            RCN: 'Rechte Ecke',
            RNS: 'Rechte Torseite',
            RCI: 'Rechter Bullykreis',
            ROS: 'Rechte Außenzone',
            CPT: 'Center Point',
            LPT: 'Linker Point',
            RPT: 'Rechter Point',
            LSL: 'Unterer Slot',
            HSL: 'Oberer Slot',
            BTN: 'Hinter dem Tor',
            CRS: 'Torraum',
            NZ: 'Neutrale Zone',
        };
        // Each Edge group, followed by its own zones indented underneath
        $scope.edgeZoneOptions = [];
        Object.keys($scope.edgeZoneGroupLabels).forEach(function (group) {
            $scope.edgeZoneOptions.push({
                value: 'edge:' + group,
                label: $scope.edgeZoneGroupLabels[group],
            });
            $scope.edgeZoneGroups[group].forEach(function (code) {
                $scope.edgeZoneOptions.push({
                    value: 'ne:' + code,
                    label: '  · ' + $scope.edgeZoneLabels[code],
                });
            });
        });

        // 'all', or a scheme-prefixed zone key: 'es:' a DEL zone, 'edge:' a whole
        // Edge group, 'ne:' a single Edge zone - the prefix keeps zone names that
        // exist in more than one scheme apart
        $scope.zoneFilter = 'all';
        $scope.changeZoneFilter = function () {
            if ($scope.zoneFilter !== 'all') {
                $scope.zoneOverlay = $scope.zoneFilter.startsWith('es:') ? 'es' : 'edge';
            }
            $scope.applyFilters();
        };

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
        // svc.germanMonths() builds a fresh array via 12 moment() calls - too
        // expensive to call from the timespan dropdown's ng-repeat every digest
        $scope.monthNames = svc.germanMonths();
        $scope.filteredShots = [];
        $scope.shotStats = null;
        $scope.hoveredShot = null;

        // The shot itself, not its row index: the table is sorted while the rink
        // dots are not, so an index would point at a different shot once sorted
        $scope.hoverShot = function (shot) {
            $scope.hoveredShot = shot;
        };

        // All shots for the currently selected player (before UI filters)
        let playerShots = [];
        // Opposing goalie player_id -> abbreviated / last name, rebuilt whenever
        // the loaded shots change
        let goalieShortNameById = {};
        let goalieLastNameById = {};

        // ── Static data loads ────────────────────────────────────────────────────
        // loading player ids with portraits
        $http
            .get('./po/' + $scope.season + '/_portraits.json')
            .then(function (res) {
                $scope.portraits = res.data;
                $scope.hasPortrait = $scope.portraits.includes($scope.player_id);
            })
            .catch(function () {
                reportLoadError('Porträt-Liste konnte nicht geladen werden.');
            });

        $http
            .get('./cfg/teams.json')
            .then(function (res) {
                $scope.all_teams = res.data.filter(function (t) {
                    return svc.isTeamValidForSeason(t, $scope.season);
                });
                maybeSetColors();
            })
            .catch(function () {
                reportLoadError('Teamliste konnte nicht geladen werden.');
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
            })
            .catch(function () {
                reportLoadError('Spielerdaten konnten nicht geladen werden.');
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
            })
            .catch(function () {
                reportLoadError('Spielerliste konnte nicht geladen werden.');
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

        // ── Shot loading ─────────────────────────────────────────────────────────
        // Only true once loading has actually finished (success or failure) -
        // guards the "no data" message against flashing while still loading
        $scope.shotsLoaded = false;
        $scope.shotsLoadFailed = false;

        $scope.loadShots = function () {
            if (!$scope.model.player_id) {
                return;
            }

            let season = $scope.season;
            let playerId = Number.parseInt($scope.model.player_id);

            // 2017 has no shot tracking at all (same cutoff used elsewhere for
            // shift-level data) - skip the fetch rather than let it 404
            if (season == 2017) {
                playerShots = [];
                $scope.shotsLoaded = true;
                updateShotMetadata();
                $scope.applyFilters();
                return;
            }

            $http
                .get('./data/' + season + '/shots/per_player/' + playerId + '.json')
                .then(function (res) {
                    playerShots = res.data;
                    updateShotMetadata();
                    $scope.applyFilters();
                })
                .catch(function () {
                    $scope.shotsLoadFailed = true;
                    reportLoadError('Schussdaten konnten nicht geladen werden.');
                })
                .finally(function () {
                    $scope.shotsLoaded = true;
                });
        };

        // Independent of the fetches above - it only needs model.player_id,
        // which is already known from the route, so a slow/failing portrait
        // or roster request can no longer delay or block the shot data itself
        $scope.loadShots();

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

        // target_type is 'on_goal' for goals too, so scored is checked first
        $scope.targetTypeLabels = { on_goal: 'Torschuss', blocked: 'geblockt', missed: 'daneben' };

        // ── Filtering + coordinate transform ─────────────────────────────────────
        // Idea for later: a display mode showing aggregate shot counts per zone
        // (grouped by whichever scheme - DEL or Edge - is active) instead of
        // individual dots on the rink. A per-shot_zone count aggregation used to
        // live in ShotFilters.computeStats() (removed October 2026 as dead code,
        // since it was computed but never displayed); re-add a similar grouping,
        // keyed by the active zoneOverlay scheme, when building that feature.
        $scope.applyFilters = function () {
            let shots = ShotFilters.filterShots(playerShots, {
                seasonType: $scope.seasonTypeFilter,
                situation: $scope.situationFilter,
                targetType: $scope.targetTypeFilter,
                period: $scope.periodFilter,
                homeRoad: $scope.homeRoadFilter,
                opp: $scope.oppFilter,
                goalie: $scope.goalieFilter,
                zoneFilter: $scope.zoneFilter,
                edgeZoneGroups: $scope.edgeZoneGroups,
                fromDate: $scope.ctrl.fromDate ? $scope.ctrl.fromDate.format('YYYY-MM-DD') : null,
                toDate: $scope.ctrl.toDate ? $scope.ctrl.toDate.format('YYYY-MM-DD') : null,
                roundsPlayed: $scope.roundsPlayed,
                fromRoundKey: $scope.fromRoundSelect,
                toRoundKey: $scope.toRoundSelect,
            });

            let transformContext = {
                goalieShortNameById: goalieShortNameById,
                goalieLastNameById: goalieLastNameById,
                delZoneLabels: $scope.delZoneLabels,
                targetTypeLabels: $scope.targetTypeLabels,
            };
            $scope.filteredShots = shots.map(function (s) {
                return ShotFilters.transformShot(s, transformContext);
            });

            $scope.shotStats = ShotFilters.computeStats(shots);
        };

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
