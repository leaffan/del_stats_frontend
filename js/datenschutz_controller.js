app.controller('datenschutzController', function ($scope) {
    $scope.optedOut = null;

    window._paq.push([
        function () {
            var optedOut = this.isUserOptedOut();
            $scope.$applyAsync(function () {
                $scope.optedOut = optedOut;
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
