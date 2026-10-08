app.controller('datenschutzController', function ($scope) {
    $scope.optedOut = null;

    window._paq.push([
        function () {
            $scope.$applyAsync(function () {
                $scope.optedOut = this.isUserOptedOut();
            });
        },
    ]);

    $scope.optOut = function () {
        window._paq.push(['optUserOut']);
        $scope.optedOut = true;
    };

    $scope.optIn = function () {
        window._paq.push(['forgetUserOptOut']);
        $scope.optedOut = false;
    };
});
