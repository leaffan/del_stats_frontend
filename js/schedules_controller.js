app.controller('schedulesController', function($scope, $routeParams, svc) {
    $scope.svc = svc;
    $scope.season = $routeParams.season;
});