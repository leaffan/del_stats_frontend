/* global module */
// Pure formatting and ordering helpers that used to live inside the svc factory
// and the trivia page behaviour. Plain script so the same code runs in the
// browser (global FormatUtils) and, without any data or Angular, in tests.
(function (root) {
    function pad(num, size) {
        let s = num + '';
        while (s.length < size) s = '0' + s;
        return s;
    }

    // formats a (potentially large, multi-game) duration in seconds as h:mm:ss,
    // unlike svc.formatTime this rolls minutes over into hours instead of just
    // growing past 60
    function formatDuration(timeInSeconds) {
        let hours = Math.floor(timeInSeconds / 3600);
        let minutes = Math.floor((timeInSeconds % 3600) / 60);
        let seconds = Math.floor(timeInSeconds % 60);
        return hours + ':' + pad(minutes, 2) + ':' + pad(seconds, 2);
    }

    function calculateAge(birthDate, today, compact) {
        birthDate = new Date(birthDate);
        if (today === undefined) {
            today = new Date();
        }
        // calculating years
        let years;
        if (
            today.getMonth() > birthDate.getMonth() ||
            (today.getMonth() == birthDate.getMonth() && today.getDate() >= birthDate.getDate())
        ) {
            years = today.getFullYear() - birthDate.getFullYear();
        } else {
            years = today.getFullYear() - birthDate.getFullYear() - 1;
        }

        // calculating months
        let months;
        if (today.getDate() >= birthDate.getDate()) {
            months = today.getMonth() - birthDate.getMonth();
        } else if (today.getDate() < birthDate.getDate()) {
            months = today.getMonth() - birthDate.getMonth() - 1;
        }
        // make month positive
        months = months < 0 ? months + 12 : months;

        // Calculate days
        let days;
        // days of months in a year
        let monthDays;
        monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        // re-setting days of months in a year for leap years
        if (
            (0 == birthDate.getFullYear() % 4 && 0 != birthDate.getFullYear() % 100) ||
            0 == birthDate.getFullYear() % 400
        ) {
            monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        }
        if (today.getDate() >= birthDate.getDate()) {
            days = today.getDate() - birthDate.getDate();
        } else {
            days = today.getDate() - birthDate.getDate() + monthDays[birthDate.getMonth()];
        }

        if (compact) {
            return years + ' J. ' + months + ' M. ' + days + ' T.';
        }
        return (
            years +
            ' Jahre ' +
            months +
            ' Monat' +
            (months != 1 ? 'e ' : ' ') +
            days +
            ' Tag' +
            (days != 1 ? 'e' : '')
        );
    }

    // checks if team is valid for a given season (supports multiple periods via valid_periods)
    function isTeamValidForSeason(team, season) {
        // If valid_periods is defined, use that for teams with non-continuous presence
        if (team.valid_periods && Array.isArray(team.valid_periods)) {
            return team.valid_periods.some(
                (period) => season >= period.from && season <= period.to,
            );
        }
        // Otherwise use the classic valid_from/valid_to for backwards compatibility
        return team.valid_from <= season && team.valid_to >= season;
    }

    // combines a column's own field with its "record" companions (e.g.
    // wins-losses, or a home-road score pairing) into a single "A-B"
    // display; fields listed under "record_optional" (e.g. ties) are
    // only appended when non-zero, so rows without them stay "A-B"
    // instead of always showing a trailing "-0"
    function formatRecord(row, col) {
        let parts = [row[col.data_key]].concat((col.record || []).map((field) => row[field]));
        (col.record_optional || []).forEach((field) => {
            if (row[field]) parts.push(row[field]);
        });
        return parts.join('-');
    }

    // turns a human-readable, fully-signed sort spec (e.g. ["-length",
    // "-score_diff", "-scores_for", "season"], read as "length desc,
    // score_diff desc, scores_for desc, season asc") into the shape
    // Angular's orderBy needs to also get the sort-direction caret right.
    // The shared table-header directive shows the caret purely from
    // sortDescending, and orderBy applies that same boolean as a *global*
    // reversal on top of whatever "-"/"+" prefixes are already in the
    // array (confirmed empirically: flipping sortDescending on an
    // already-prefixed array reverses the whole order, it doesn't just
    // relabel it). So the primary key can never keep its own prefix -
    // its direction has to come entirely from sortDescending, or the two
    // would fight each other and the caret would show the opposite of
    // the true order. Fix: store the primary key unprefixed and
    // pre-invert every other key's prefix so that, once the global
    // reversal (sortDescending) is applied, each one still lands on its
    // originally-intended direction.
    function buildSortConfig(defaultSort) {
        let primaryDescending = defaultSort[0].startsWith('-');
        let sortKey = defaultSort[0].replace(/^-/, '');
        let sortCriteria = defaultSort.map(function (entry, index) {
            let key = entry.replace(/^-/, '');
            if (index === 0) return key;
            let entryDescending = entry.startsWith('-');
            let storedDescending = entryDescending !== primaryDescending;
            return storedDescending ? '-' + key : key;
        });
        return {
            sortKey: sortKey,
            sortCriteria: sortCriteria,
            sortDescending: primaryDescending,
        };
    }

    const api = {
        pad: pad,
        formatDuration: formatDuration,
        calculateAge: calculateAge,
        isTeamValidForSeason: isTeamValidForSeason,
        formatRecord: formatRecord,
        buildSortConfig: buildSortConfig,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.FormatUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
