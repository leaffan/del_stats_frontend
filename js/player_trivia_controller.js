app.controller('playerTriviaController', function ($scope, svc, triviaPageBehavior) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Spieler-Trivia');

    triviaPageBehavior(ctrl, {
        configUrl: './cfg/columns_player_trivia.json',
        dataFolder: 'data/historic_trivia/',
        // the age-record categories (youngest/oldest at a milestone game or
        // goal) carry date_of_birth + game_date but no precomputed age, so a
        // numeric sort key is derived here once per row instead of shipping
        // a redundant field in the data; display still goes through
        // svc.calculateAge for the human-readable "X Jahre Y Monate Z Tage"
        postProcessData: function (data) {
            return data.map(function (row) {
                if (row.date_of_birth && row.game_date) {
                    row._age_days = moment(row.game_date).diff(moment(row.date_of_birth), 'days');
                }
                return row;
            });
        },
    });

    // resolves a "player_column"'s id field to the id the player_career route
    // expects: a numeric c_id is used as-is, but a string is a raw g_id that
    // (unlike career_stats' pre-resolved player_id) still needs its 'g'
    // prefix added here, since per_player files for those players are named
    // "g<g_id>.json", not "<g_id>.json"
    ctrl.playerLinkId = function (row, col) {
        let id = row[col.id_field];
        return typeof id === 'string' ? 'g' + id : id;
    };

    ctrl.nameFilter = '';

    // finds the data_key of the (single) "player_column" in the current
    // season type, so the name search stays category-agnostic even though a
    // future category (hattricks, first shutouts, ...) may name its player
    // field differently than "scorer"
    ctrl.playerColumnField = function () {
        let seasonType = ctrl.currentSeasonType();
        if (!seasonType) return null;
        let col = seasonType.columns.find((col) => col.player_column);
        return col ? col.data_key : null;
    };

    ctrl.nameFilterFn = function (row) {
        if (!ctrl.nameFilter) return true;
        let field = ctrl.playerColumnField();
        if (!field) return true;
        return (row[field] || '').toLowerCase().indexOf(ctrl.nameFilter.toLowerCase()) !== -1;
    };

    // formats the age at a milestone (game_date/goal_date) as "X Jahre Y
    // Monate Z Tage", reusing the same date-diff logic already used for a
    // player's current age on player_career.html/player_information.html -
    // just called with a historical second date instead of "now"
    ctrl.formatAge = function (row, col) {
        return svc.calculateAge(row.date_of_birth, new Date(row[col.age_reference_field]));
    };

    // buckets the raw position code (C, D, F, G, LD, LW, RD, RW, ...) into
    // the same three groups used by the position filter on career_stats/
    // player_stats (Torhüter/Verteidiger/Stürmer), since these categories
    // use the granular position codes rather than career_stats' GK/DE/FO
    ctrl.positionFilterFn = function (row) {
        if (!ctrl.positionFilter || row.position === undefined) return true;
        if (ctrl.positionFilter === 'GK') return row.position.startsWith('G');
        if (ctrl.positionFilter === 'DE') return row.position.includes('D');
        return !row.position.startsWith('G') && !row.position.includes('D');
    };

    ctrl.initFromRoute();
});
