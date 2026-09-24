'use strict';

const { requireData } = require('./test-base');

// Each probe HEADs one file the tested view actually loads. A missing file
// skips the test locally and fails it in CI (see requireData), so a probe must
// name the file its view needs, not a neighbouring one.
function probe(file) {
    const check = async (page) => {
        try {
            const response = await page.request.head(`http://localhost:8000/${file}`, {
                timeout: 5000,
            });
            return response.ok();
        } catch {
            return false;
        }
    };
    check.file = file;
    return check;
}

async function requireFixture(page, check) {
    requireData(await check(page), check.file);
}

const hasAggregatedPlayerStats = probe('data/2025/del_player_game_stats_aggregated.json');
const hasCareerData = probe('data/career_stats/upd_full_career_stats_stripped.json');
const hasTeamGameStats = (season) => probe(`data/${season}/del_team_game_stats.json`);
const hasPlayerFile = (season, team, id) => probe(`data/${season}/per_player/${team}_${id}.json`);
const hasTeamTriviaData = probe('data/historic_trivia/overtime_games_per_season_pctg.json');
const hasGameTriviaData = probe('data/historic_trivia/blown_leads.json');
const hasPlayerTriviaData = probe('data/historic_trivia/fastest_first_goal_period_1.json');
const hasShotExplorerData = probe('data/2025/shots/per_player/100.json');

module.exports = {
    requireFixture,
    hasAggregatedPlayerStats,
    hasCareerData,
    hasTeamGameStats,
    hasPlayerFile,
    hasTeamTriviaData,
    hasGameTriviaData,
    hasPlayerTriviaData,
    hasShotExplorerData,
};
