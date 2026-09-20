/* global module */
// Derives the displayed playoff-qualification marker of a team from its
// (cumulative) clinching flags. Plain script so it can also be required in tests.
(function (root) {
    // ordered by priority: first flag that is true wins. The status objects are
    // returned as-is (stable identity), since AngularJS templates call this on every
    // digest and a fresh object each time would trigger an infinite digest loop.
    const STATUSES = [
        { flag: 'clinched_top_spot', status: { letter: 'M', title: 'Hauptrundenmeister' } },
        {
            flag: 'clinched_quarters',
            status: { letter: 'V', title: 'Direktqualifikant Viertelfinale' },
        },
        { flag: 'clinched_playoffs', status: { letter: 'P', title: 'Qualifikant Playoffs' } },
        { flag: 'relegated', status: { letter: 'A', title: 'Absteiger' } },
        {
            flag: 'no_playoffs',
            status: { letter: 'X', title: 'Keine Playoffqualifikation mehr möglich' },
        },
    ];

    // returns {letter, title} for the given team's clinching flags, or null
    function getClinchedStatus(teamData) {
        if (!teamData) return null;
        const match = STATUSES.find((s) => teamData[s.flag] === true);
        return match ? match.status : null;
    }

    const api = { getClinchedStatus: getClinchedStatus };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ClinchedStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
