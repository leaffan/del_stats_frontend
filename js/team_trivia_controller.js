app.controller('teamTriviaController', function ($scope, $http, config, svc, cfgLoader) {
    let ctrl = this;
    $scope.svc = svc;
    svc.setTitle('DEL-Team-Trivia');

    ctrl.defaultSeason = config.defaultSeason;
    ctrl.dataCache = {};
    ctrl.categorySelect = '';
    ctrl.seasonTypeSelect = '';

    // turns a human-readable, fully-signed sort spec (e.g. ["-length",
    // "-score_diff", "-scores_for", "season"], read as "length desc, score_diff
    // desc, scores_for desc, season asc") into the shape Angular's orderBy needs
    // to also get the sort-direction caret right. The shared table-header
    // directive shows the caret purely from sortDescending, and orderBy applies
    // that same boolean as a *global* reversal on top of whatever "-"/"+"
    // prefixes are already in the array (confirmed empirically: flipping
    // sortDescending on an already-prefixed array reverses the whole order, it
    // doesn't just relabel it). So the primary key can never keep its own prefix
    // - its direction has to come entirely from sortDescending, or the two would
    // fight each other and the caret would show the opposite of the true order.
    // Fix: store the primary key unprefixed and pre-invert every other key's
    // prefix so that, once the global reversal (sortDescending) is applied, each
    // one still lands on its originally-intended direction.
    ctrl.buildSortConfig = function (defaultSort) {
        let primaryDescending = defaultSort[0].startsWith('-');
        let sortKey = defaultSort[0].replace(/^-/, '');
        let sortCriteria = defaultSort.map(function (entry, index) {
            let key = entry.replace(/^-/, '');
            if (index === 0) return key;
            let entryDescending = entry.startsWith('-');
            let storedDescending = entryDescending !== primaryDescending;
            return storedDescending ? '-' + key : key;
        });
        return { sortKey: sortKey, sortCriteria: sortCriteria, sortDescending: primaryDescending };
    };

    // sorting by the team column sorts by location rather than by abbreviation,
    // since the table displays the full team name; sorting by the "length" column
    // (re-)applies the full tie-break chain (also used as the default sort, see
    // applyDefaultSort) rather than just comparing streak length in isolation
    ctrl.sortCriteria = {
        team: function (row) {
            return ctrl.team_location_lookup ? ctrl.team_location_lookup[row.team] : row.team;
        },
        length: ctrl.buildSortConfig(['-length', '-score_diff', '-scores_for', 'season'])
            .sortCriteria,
    };

    // grouping consecutive categories sharing the same group_label_de into one
    // <optgroup> each, in the order they appear in the config
    ctrl.buildCategoryGroups = function (categories) {
        let groups = [];
        Object.keys(categories).forEach(function (key) {
            let label = categories[key].group_label_de;
            let lastGroup = groups[groups.length - 1];
            if (!lastGroup || lastGroup.label !== label) {
                groups.push({ label: label, keys: [key] });
            } else {
                lastGroup.keys.push(key);
            }
        });
        return groups;
    };

    // retrieving category/column configuration, defaulting to the first defined category
    $http.get('./cfg/columns_team_trivia.json').then(function (res) {
        ctrl.categories = res.data;
        ctrl.categoryGroups = ctrl.buildCategoryGroups(res.data);
        ctrl.categorySelect = Object.keys(res.data)[0];
        ctrl.changeCategory();
    });

    // retrieving all teams that were ever active in the DEL, for the team filter
    // and for displaying full team names sorted by location
    cfgLoader.teamsHistoric().then(function (res) {
        let orig_teams = res.data;
        let active_teams = orig_teams
            .filter((team) => team.active)
            .sort((a, b) => (a.location > b.location ? 1 : -1))
            .map((team) => team.abbr);
        let inactive_teams = orig_teams
            .filter((team) => !team.active)
            .sort((a, b) => (a.location > b.location ? 1 : -1))
            .map((team) => team.abbr);
        ctrl.all_teams = active_teams.concat(inactive_teams);
        ctrl.team_full_name_lookup = orig_teams.reduce(
            (o, team) => Object.assign(o, { [team.abbr]: team.full_name }),
            {},
        );
        ctrl.team_location_lookup = orig_teams.reduce(
            (o, team) => Object.assign(o, { [team.abbr]: team.location }),
            {},
        );
    });

    // "season" is usually a single number, but a streak that ran across a season
    // boundary (e.g. a winning streak starting in March and ending the following
    // September) is recorded as a [firstSeason, lastSeason] pair instead
    ctrl.seasonValues = function (season) {
        return Array.isArray(season) ? season : [season];
    };

    ctrl.formatSeason = function (season) {
        return ctrl.seasonValues(season).map(svc.getSeasonIdentifier).join('–');
    };

    // combines a column's own field with its "record" companions (e.g. wins-losses)
    // into a single "W-L" display; fields listed under "record_optional" (e.g. ties)
    // are only appended when non-zero, so modern rows without ties stay "W-L"
    // instead of always showing a trailing "-0"
    ctrl.formatRecord = function (row, col) {
        let parts = [row[col.data_key]].concat((col.record || []).map((field) => row[field]));
        (col.record_optional || []).forEach((field) => {
            if (row[field]) parts.push(row[field]);
        });
        return parts.join('-');
    };

    ctrl.currentCategory = function () {
        return ctrl.categories ? ctrl.categories[ctrl.categorySelect] : null;
    };

    ctrl.currentSeasonType = function () {
        let category = ctrl.currentCategory();
        return category ? category.season_types[ctrl.seasonTypeSelect] : null;
    };

    ctrl.applyDefaultSort = function () {
        let seasonType = ctrl.currentSeasonType();
        if (!seasonType) return;
        ctrl.sortConfig = ctrl.buildSortConfig(seasonType.default_sort);
    };

    // (re-)deriving the season range available in the currently loaded season type's
    // data and resetting the season filter to that full range; data without a
    // "season" field simply doesn't get a season filter
    ctrl.setSeasonBounds = function () {
        ctrl.first_season = ctrl.from_season = ctrl.last_season = ctrl.to_season = undefined;
        if (!ctrl.trivia_data || !ctrl.trivia_data.length) return;
        if (ctrl.trivia_data[0].season === undefined) return;
        let seasons = ctrl.trivia_data.reduce(
            (all, row) => all.concat(ctrl.seasonValues(row.season)),
            [],
        );
        ctrl.first_season = ctrl.from_season = Math.min(...seasons);
        ctrl.last_season = ctrl.to_season = Math.max(...seasons);
    };

    // loading the data file of the currently selected season type (each season type
    // of a category, e.g. "Heimspiele"/"Auswärtsspiele", may point to its own file)
    ctrl.loadCategoryData = function () {
        let seasonType = ctrl.currentSeasonType();
        if (!seasonType) return;
        if (ctrl.dataCache[seasonType.data_file]) {
            ctrl.trivia_data = ctrl.dataCache[seasonType.data_file];
            ctrl.setSeasonBounds();
            return;
        }
        $http.get('data/team_trivia/' + seasonType.data_file).then(function (res) {
            ctrl.dataCache[seasonType.data_file] = res.data;
            ctrl.trivia_data = res.data;
            ctrl.setSeasonBounds();
        });
    };

    // switching to the newly selected category, defaulting to its first season type
    ctrl.changeCategory = function () {
        let category = ctrl.currentCategory();
        if (!category) return;
        ctrl.seasonTypeSelect = Object.keys(category.season_types)[0];
        ctrl.applyDefaultSort();
        ctrl.loadCategoryData();
    };

    // switching the season type view within the currently selected category; this
    // may point to a different data file, so data is (re-)loaded as well
    ctrl.changeSeasonType = function () {
        ctrl.applyDefaultSort();
        ctrl.loadCategoryData();
    };

    ctrl.teamFilter = function (row) {
        return !ctrl.teamSelect || row.team === ctrl.teamSelect;
    };

    // a row matches the selected season range if its season(s) overlap it at all,
    // so a streak spanning a season boundary still shows up on either end
    ctrl.seasonFilter = function (row) {
        if (ctrl.first_season === undefined) return true;
        let seasons = ctrl.seasonValues(row.season);
        return Math.max(...seasons) >= ctrl.from_season && Math.min(...seasons) <= ctrl.to_season;
    };
});
