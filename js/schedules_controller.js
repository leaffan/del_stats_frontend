app.controller('schedulesController', function ($scope, svc, config) {
    $scope.svc = svc;
    $scope.season = config.defaultSeason;
});
