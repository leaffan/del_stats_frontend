app.controller('gameController', function ($scope, $http, $q, $routeParams, config, svc) {
    $scope.svc = svc;
    $scope.gru = GameReportUtils;

    $scope.season = Number.parseInt($routeParams.season);
    $scope.game_id = $routeParams.game_id;
    $scope.firstSeason = config.gameReports.firstSeason;

    $scope.loading = true;
    $scope.loadFailed = false;
    $scope.findingsShown = false;
    $scope.toggleFindings = function () {
        $scope.findingsShown = !$scope.findingsShown;
    };

    $q.all([
        $http.get('./cfg/game_report_labels.json', { cache: true }),
        $http.get('./data/' + $scope.season + '/game_reports/' + $scope.game_id + '.json', {
            cache: true,
        }),
    ])
        .then(function (results) {
            $scope.labels = results[0].data;
            $scope.report = results[1].data;
            buildViewModel();
            svc.setTitle(
                $scope.report.teams.home.abbr +
                    ' - ' +
                    $scope.report.teams.road.abbr +
                    ', ' +
                    GameReportUtils.formatGameDate($scope.report.game.date),
            );
        })
        .catch(function () {
            $scope.loadFailed = true;
        })
        .finally(function () {
            $scope.loading = false;
        });

    // builds everything the template needs beyond the raw report: labelled
    // meta badges for the header, and - for every section with rows - which
    // of them a data_quality finding points at, so the table can show a
    // warning symbol without re-parsing a path on every digest
    function buildViewModel() {
        let report = $scope.report;
        let game = report.game;

        $scope.gameMeta = buildGameMeta(game);
        $scope.playedStatus = game.armchair_played_status;

        let findings = report.data_quality.findings;
        $scope.warningCount = findings.filter(GameReportUtils.isWarningFinding).length;
        $scope.findingEntries = findings.map(function (finding) {
            return {
                finding: finding,
                target: GameReportUtils.describeFindingTarget(report, finding.path),
                severityLabel: GameReportUtils.getLabel(
                    $scope.labels,
                    'severities',
                    finding.severity,
                ),
                checkLabel: GameReportUtils.getLabel($scope.labels, 'checks', finding.check),
                isWarning: GameReportUtils.isWarningFinding(finding),
            };
        });

        let parsedFindings = findings.map(function (finding) {
            return { finding: finding, parsed: GameReportUtils.parseFindingPath(finding.path) };
        });

        function findingsFor(section, side, index) {
            return parsedFindings
                .filter(function (pf) {
                    return (
                        pf.parsed &&
                        pf.parsed.section === section &&
                        (side === undefined || pf.parsed.side === side) &&
                        (index === undefined || pf.parsed.index === index)
                    );
                })
                .map(function (pf) {
                    return pf.finding;
                });
        }

        // attaches the findings for its own row to every entry of a list
        // (scoring, penalties, or a side's skaters/goalies), so the template
        // only has to read row._findings/_hasWarning
        function attachRowFindings(rows, section, side) {
            (rows || []).forEach(function (row, index) {
                row._findings = findingsFor(section, side, index);
                row._hasWarning = row._findings.some(GameReportUtils.isWarningFinding);
            });
        }
        attachRowFindings(report.scoring, 'scoring');
        attachRowFindings(report.penalties, 'penalties');
        let allSkaters = [];
        GameReportUtils.SIDES.forEach(function (side) {
            let skaters = report.skaters && report.skaters[side];
            let goalies = report.goalies && report.goalies[side];
            attachRowFindings(skaters, 'skaters', side);
            attachRowFindings(goalies, 'goalies', side);
            allSkaters = allSkaters.concat(skaters || []);
            // backups without ice time go last, greyed out in the template;
            // sorting after attachRowFindings keeps each row's _findings
            // (set from the original, finding-path-matching order) intact
            if (goalies) {
                report.goalies[side] = goalies.slice().sort(function (a, b) {
                    return b.toi - a.toi;
                });
            }
        });
        $scope.hasPlusMinus = allSkaters.some((s) => s.plus_minus !== undefined);
        $scope.hasShotsOnGoal = allSkaters.some((s) => s.shots_on_goal !== undefined);
        $scope.hasToi = allSkaters.some((s) => s.toi !== undefined);

        // team-level findings (teams.<side>.<field>, e.g. shots_on_goal_per_period)
        // keyed by field, for the handful of team stat cells rather than rows
        $scope.teamFindings = {};
        GameReportUtils.SIDES.forEach(function (side) {
            let bySide = {};
            findingsFor('teams', side).forEach(function (finding) {
                let field = GameReportUtils.parseFindingPath(finding.path).field;
                if (!bySide[field]) bySide[field] = [];
                bySide[field].push(finding);
            });
            $scope.teamFindings[side] = bySide;
        });
    }

    // short badges below the header score (Spieltag, Runde, Phase, ...),
    // each shown only when the report actually has the underlying field
    function buildGameMeta(game) {
        let meta = [];
        if (game.matchday) meta.push('Spieltag ' + game.matchday);
        if (game.round) meta.push(GameReportUtils.getLabel($scope.labels, 'rounds', game.round));
        if (game.season_phase) {
            meta.push(GameReportUtils.getLabel($scope.labels, 'phases', game.season_phase));
        }
        if (game.season_type) {
            meta.push(GameReportUtils.getLabel($scope.labels, 'season_types', game.season_type));
        }
        if (game.game_in_series) meta.push('Spiel ' + game.game_in_series);
        if (game.best_of) meta.push('Best of ' + game.best_of);
        return meta;
    }

    $scope.playerProfileUrl = function (player, teamAbbr) {
        return GameReportUtils.playerProfileUrl(player, teamAbbr, $scope.season);
    };

    $scope.playerDisplayName = function (player) {
        return player ? player.first_name + ' ' + player.last_name : '';
    };

    $scope.findingTooltip = function (findings) {
        return (findings || [])
            .map((f) => GameReportUtils.getLabel($scope.labels, 'checks', f.check))
            .join('; ');
    };

    // the shootout goalie belongs to the team the shooting attempt was
    // against, not the attempt's own "team" field
    $scope.oppositeTeam = function (teamAbbr) {
        let teams = $scope.report.teams;
        return teamAbbr === teams.home.abbr ? teams.road.abbr : teams.home.abbr;
    };
});
