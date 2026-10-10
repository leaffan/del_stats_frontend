# Remaining Plan

This file captures the remaining repository improvement plan after the documentation and tooling baseline work already completed on this branch.

## 1. Repository hygiene and contributor flow

- ✅ Document deployment and release expectations together with the required runtime data files.
- ✅ Review repository hygiene items that can be improved without making the public/private sync harder.
- ⏸️ Issue/PR templates, `CODEOWNERS` — deferred, no outside contributors are expected; revisit if that changes.

## 2. Configuration consolidation

- ✅ Identify repeated season values, data source paths, and table configuration across controllers and templates.
- ✅ Move shared configuration into a smaller number of clearly named files while keeping existing paths stable where possible.
- ✅ Keep every change easy to trace and port to `del_stats_frontend_ext`.

## 3. Validation and CI coverage

- ✅ Extend automated checks beyond the current core-file formatting validation.
- ✅ Start with low-risk checks for additional documentation and configuration files before adding broader validation.
- ✅ Keep local and CI commands lightweight, reproducible, and easy to understand.
- ✅ Set up pre-commit hook for automatic code formatting before git commits.
- ✅ Add end-to-end tests with Playwright for critical user flows (6 core flows).

## 4. Controller maintainability

- Prioritize the largest AngularJS controllers for small, isolated cleanup steps.
- Extract clearly reusable helper logic without changing route, template, or data-loading behavior.
- Add focused validation around each refactoring step to keep behavior stable.
- Open-ended backlog, tackled one PR per item, ordered by duplication/impact
  (not controller-by-controller). Candidates identified so far (shared
  `main`/`ext` controllers only; `preview_controller.js` is `ext`-only and
  tracked separately):
    - ✅ `team_stats_controller.js`'s `setSortOrder` reimplemented
      `svc.setSortOrder2` instead of calling it (already used directly by
      `shot_explorer_controller.js`) — switched to delegate, ~20 duplicate lines
      removed, no behavior change (covered by `tests/sorting.spec.js`).
    - ✅ `elementPassedFilters` game-filter predicate: of its 9 criteria, 7
      were identical between `player_stats_controller.js` and
      `team_stats_controller.js` and moved to
      `js/game_filters.js#gamePassesCommonFilters` (unit-tested in
      `tests/game-filters.spec.js`). The other 2 (`situationSelect`,
      `seasonTypeSelect`) genuinely differ between the controllers —
      `team_stats_controller.js` supports extra max_lead/max_deficit
      situations and reads `seasonTypeSelect` from a different scope — so
      they were deliberately left controller-specific rather than forced
      into a shared shape, to avoid changing either controller's behavior.
    - ✅ Weekdays/rounds-played derivation, moved to `js/game_log_metadata.js`
      (unit-tested in `tests/game-log-metadata.spec.js`). Turned out to be two
      genuinely different "rounds" computations rather than one: a full
      deduped/sorted `roundsPlayed` list for round-range filter dropdowns
      (`deriveRoundsPlayed`, used by `player_stats_controller.js`/
      `team_stats_controller.js`) and a single `maxRoundPlayed` upper bound
      (`deriveMaxRoundPlayed`, used by `player_profile_controller.js`/
      `team_profile_controller.js`) — kept as two separate functions for the
      same reason as the `elementPassedFilters` split above.
      `monthsPlayed` was deliberately NOT extracted even though it's
      duplicated the same way: it needs `moment.js` to parse `game_date`, and
      `moment` wasn't an npm dependency of this project at the time (only
      loaded via CDN in the browser). That blocker is gone now that
      `changeTimespan` below added `moment` as a dev dependency — extracting
      `monthsPlayed` is a small, still-open follow-up.
    - ✅ `changeTimespan` date-range builder: only the "selected month" branch
      turned out to be truly identical, and only across four of the five
      controllers that define `changeTimespan` — moved to
      `js/timespan_utils.js#deriveMonthTimespan` (unit-tested in
      `tests/timespan-utils.spec.js`). The surrounding
      pre_dcup/post_dcup/pre_reunification/post_reunification/last_N-games
      branches are unevenly distributed (full set in
      `player_stats_controller.js`/`team_stats_controller.js`, only
      pre_dcup/post_dcup in `team_profile_controller.js`, none in
      `player_profile_controller.js`) and stay controller-specific.
      `shot_explorer_controller.js` has a fifth, incompatible
      `changeTimespan` (0-indexed month via moment's object constructor,
      numeric `$scope.season`) and wasn't touched — see the consolidation
      TODO below. This extraction needed real `moment.js` objects as output
      (callers call `.format()`/`.startOf('day')` on the result and bind it
      to the date-picker UI), so **`moment@2.31.0` is now a pinned dev
      dependency** (`package.json`), matching the `moment.js` CDN version in
      `index.html` (`2.31.0`, upgraded from `2.22.2` on its own branch —
      unrelated to controller maintainability, not tracked here).
      Incidentally fixed in passing: `player_stats_controller.js`'s version
      of this logic used two undeclared (implicit global) variables,
      `timespanSelect`/`season` — gone now that the logic lives in a properly
      scoped function.
    - `checkCondition`/`categorizeStatsForStatline` in
      `player_stats_controller.js` — config-driven, uses `eval()`, high value
      for isolated unit tests regardless of duplication.
    - Shot-metadata derivation in `shot_explorer_controller.js`, companion to
      the weekdays/rounds candidate above — likely folds into the
      existing `js/shot_filters.js`.
    - `sumIntoTarget`/`prepareSingleSeasonStatline` in
      `career_stats_controller.js` — not duplicated, but already a free
      function; lowest-risk "quick win" to establish the pattern in that file.

## 5. Data and runtime expectations

- ✅ Document the required untracked `data/` inputs for local and hosted usage.
- ✅ Clarify which public-repo changes must also be mirrored in the private superset repository.
- ✅ Capture the main manual verification scenarios for the key pages.

## Explicitly deferred (not in scope now)

- Changelog / semver release process — the site deploys via `git pull` directly
  into the web server's document root with no build step, so a formal
  versioning process was judged to be overhead without payoff.
- Issue/PR templates, `CODEOWNERS` (see item 1 above).
- Additional deploy-time gating beyond "CI is green" (e.g. a required-status
  check blocking the pull, a staging environment) — judged unnecessary for a
  solo-maintained static site.
- Expanding `tests/core-flows.spec.js` coverage further — plenty of
  interactions/pages remain untested beyond the current smoke coverage.
- Turning ESLint from report-only into a blocking CI check, and/or fixing the
  pre-existing warnings it currently surfaces.
- Shot explorer: a display mode showing aggregate shot counts per zone instead
  of individual dots on the rink.
- App-wide: no `$http` request outside the shot explorer has error handling —
  a failed request fails silently. `js/shot_explorer_controller.js`'s
  `loadErrors` pattern is the reference to follow once this is picked up.
- `player_stats_controller.js`/`team_stats_controller.js`'s `roundsPlayed`
  (`js/game_log_metadata.js#deriveRoundsPlayed`) dedupes by raw round number
  only, so a regular-season round and a playoff round sharing the same
  number (e.g. both "round 1") collapse into one entry in the round-range
  filter dropdown. `shot_explorer_controller.js`'s `updateShotMetadata`
  already solves this correctly with a composite `round + '|' + po_round`
  key — adopt that scheme here too when this gets revisited. A real behavior
  change, not a pure refactor, so kept out of the extraction pass above.
- Full `changeTimespan` consolidation across all five controllers that
  define it (`player_stats_controller.js`, `team_stats_controller.js`,
  `team_profile_controller.js`, `player_profile_controller.js`,
  `shot_explorer_controller.js`), covering the pre_dcup/post_dcup/
  pre_reunification/post_reunification/last_N-games branches too (currently
  only the "selected month" branch is shared, see above) and reconciling
  `shot_explorer_controller.js`'s incompatible 0-indexed/object-constructor
  approach with the rest. A real redesign, not a pure refactor — would need
  to decide on one canonical representation (probably `shot_explorer`'s
  object-constructor form, or a `{year, month}` input shape) rather than
  string-format parsing everywhere.
- `monthsPlayed` derivation (`moment(item.game_date).month()`, duplicated in
  `player_stats_controller.js`, `team_stats_controller.js`,
  `player_profile_controller.js`, `team_profile_controller.js`) — not
  extracted into `js/game_log_metadata.js` when that module was created,
  since `moment` wasn't a dev dependency yet. It is now (see above); this is
  a small, low-risk follow-up.

`del_stats_frontend_ext`'s `docs/ROADMAP.md` tracks additional deferred items
specific to that private superset (trivia/preview pages, test-flakiness
details, etc.) not repeated here.
