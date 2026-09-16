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
        //
        // ir_streaks_full_seasons carries first_name/last_name instead of a
        // combined "name" (unlike every other category here), and a
        // from_season/to_season pair instead of a single "season" field -
        // both are derived here so the shared player_column/season_identifier
        // rendering and the season range filter work without special-casing
        // this category in the template
        postProcessData: function (data) {
            return data.map(function (row) {
                if (row.date_of_birth && row.game_date) {
                    row._age_days = moment(row.game_date).diff(moment(row.date_of_birth), 'days');
                }
                if (row.first_name && row.last_name) {
                    row.name = row.first_name + ' ' + row.last_name;
                }
                if (row.from_season !== undefined && row.to_season !== undefined) {
                    row.season = [row.from_season, row.to_season];
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

    // renders a "team_column" cell that may hold either a single team
    // abbreviation (every existing category, shown with its full name) or a
    // list of them (ir_streaks_full_seasons: every team a player represented
    // during the streak) - the array shape is also the signal to use the
    // shorter location name instead, since up to four full names in one
    // cell stop being scannable
    ctrl.formatTeamColumn = function (row, col) {
        let value = row[col.data_key];
        if (Array.isArray(value)) {
            return value.map((team) => ctrl.team_location_lookup[team]).join(', ');
        }
        return ctrl.team_full_name_lookup[value];
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
