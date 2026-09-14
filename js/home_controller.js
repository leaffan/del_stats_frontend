app.controller('homeController', function ($scope, $http, $cacheFactory, config, svc) {
    $scope.config = config;
    $scope.svc = svc;
    // this is certainly not the way to do it but
    // I can't get this working as a function with season
    // as parameter (which then would be called from the HTML)
    $http
        .get('data/' + config.defaultSeason + '/del_player_game_stats_aggregated.json', {
            cache: true,
        })
        .then(function (res) {
            var team_players = [
                ...new Set(res.data[1].map((item) => item.team + '/' + item.player_id)),
            ];
            var players = [...new Set(res.data[1].map((item) => item.player_id))];
            $scope.random_team_player_default_season =
                team_players[Math.floor(Math.random() * team_players.length)];
            $scope.random_player_default_season =
                players[Math.floor(Math.random() * players.length)];
        });

    // shot-tracking data only goes back to season 2025 so far (unlike the
    // other per-season stats above), so this picks its own random player
    // from that season specifically rather than config.defaultSeason -
    // update the season here once 2026/27 shot data exists. Goalies are
    // excluded since they don't take shots; a handful of very low-minutes
    // skaters have no shot file either, so this isn't a 100%-safe pick, but
    // matches the same not-guarded-against-edge-cases spirit as the random
    // picks above
    $http
        .get('data/2025/del_player_game_stats_aggregated.json', { cache: true })
        .then(function (res) {
            var skaterIds = [
                ...new Set(
                    res.data[1]
                        .filter((item) => item.position !== 'GK')
                        .map((item) => item.player_id),
                ),
            ];
            $scope.random_player_shot_explorer =
                skaterIds[Math.floor(Math.random() * skaterIds.length)];
        });
});
