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
      (used by `player_stats_controller.js`/`team_stats_controller.js`) and a
      single `maxRoundPlayed` upper bound (used by
      `player_profile_controller.js`/`team_profile_controller.js` via
      `svc.range(1, maxRoundPlayed)`) — initially kept as two separate
      functions (`deriveRoundsPlayed`/`deriveMaxRoundPlayed`) for the same
      reason as the `elementPassedFilters` split above, since
      `deriveRoundsPlayed` used `parseInt(item.round)` while
      `deriveMaxRoundPlayed` took the raw `round` value straight into
      `Math.max` (which itself coerces to number) — a real difference _if_
      `round` were ever a non-numeric string. Later merged into one
      `deriveRoundsPlayed` returning `{roundsPlayed, toRoundSelect,
maxRoundPlayed}` after a dedicated fact-finding pass confirmed `round`
      is purely numeric everywhere this project actually has data (all
      seasons/season_types, across `del_team_game_stats.json`,
      `per_player/*.json`, `del_player_game_stats.csv`), so the parseInt-vs-raw
      distinction never materializes in practice; `player_profile_controller.js`/
      `team_profile_controller.js` now read `.maxRoundPlayed` off the merged
      result instead of calling a separate function.
      `monthsPlayed` was initially NOT extracted even though it's duplicated
      the same way: it needed `moment.js` to parse `game_date`, and `moment`
      wasn't an npm dependency of this project at the time (only loaded via
      CDN in the browser). That blocker went away once `changeTimespan` below
      added `moment` as a dev dependency, and it has since been extracted too
      — `GameLogMetadata.deriveMonthsPlayed(games)`, identical across all four
      controllers (`[...new Set(games.map(item => moment(item.game_date).month()))]`,
      deliberately left unsorted, matching the original inline version in
      each controller). `shot_explorer_controller.js`'s own months
      computation (see the shot-metadata entry below) was later unified into
      this too, once a fact-finding pass confirmed it was safe.
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
    - ✅ `checkCondition`/`categorizeStatsForStatline` in
      `player_stats_controller.js` (not duplicated elsewhere — extracted
      purely for testability) moved to `js/stat_categorization.js` (unit-tested
      in `tests/stat-categorization.spec.js`). `checkCondition`'s `eval(value)`
      is a pre-existing hack, not something this extraction fixes:
      `cfg/stats_to_categorize.json` has exactly one non-numeric `value`
      across the whole file — the goalie `quality_starts` category's
      `"$scope.league_data.save_pctg * 100"` — which the eval'd string
      expects to resolve against a variable literally named `$scope`. `$scope`
      is now threaded through as an explicit parameter (was an invisible
      closure dependency before extraction) purely so that one condition
      keeps resolving exactly as before; seven of the other eight
      operator/guard paths never touch `$scope` at all and are now directly
      unit-tested for the first time. See the deferred TODO below for
      replacing the `eval` hack itself with something safer.
    - ✅ `sumIntoTarget`/`prepareSingleSeasonStatline` in
      `career_stats_controller.js` moved to `js/career_stat_utils.js`
      (unit-tested in `tests/career-stat-utils.spec.js`) — the lowest-risk
      "quick win" of the batch, establishing the module pattern in a
      controller that had none yet. `sumIntoTarget` was already a free
      function, lifted verbatim. `prepareSingleSeasonStatline` called
      `$scope.preparePlayer(player)` internally (itself already pure); call
      sites now call `$scope.preparePlayer(player)` themselves and pass the
      fresh result in, so the "one new object per call" behavior is
      unchanged. Incidentally fixed in passing: one call site used
      `(combined = true)` — an assignment expression as an argument, which
      created an undeclared (implicit global) `combined` variable as a side
      effect, harmless here (nothing ever read it) but the same bug pattern
      as `changeTimespan` above — replaced with a plain `true`.
    - ✅ Shot-metadata derivation in `shot_explorer_controller.js`
      (`updateShotMetadata`'s months/rounds/date-range computation, not its
      `resolveGoalies()` call) moved to `js/shot_filters.js#deriveShotMetadata`
      (unit-tested in `tests/shot-filters.spec.js`), the companion to the
      weekdays/rounds candidate above. A different scheme from
      `js/game_log_metadata.js`: it works off raw shot records rather than
      per-game stat-line records, and its `roundsPlayed` already dedupes by a
      composite `round + '|' + po_round` key instead of raw round number alone
      — see the deferred TODO below about adopting that scheme for
      `deriveRoundsPlayed` too. Incidentally fixed in passing: `ShotFilters`
      was used by this controller already (`filterShots`/`transformShot`/
      `computeStats`) but was missing from `eslint.config.js`'s globals list —
      added alongside the other module globals. A Copilot PR review caught a
      real, pre-existing timezone bug in `monthsPlayed`'s original
      `new Date(s.game_date).getMonth()`: a `'YYYY-MM-DD'` string is a
      date-only ISO form, which native `Date` parses as UTC midnight while
      `.getMonth()` reads it back in local time — in a negative-UTC-offset
      timezone a day-1-of-month game rolls back into the previous month.
      Fixed by switching to `moment(s.game_date).month()`, which deliberately
      parses date-only strings as local time instead of round-tripping
      through UTC. This also incidentally resolved what had been a
      pre-existing inconsistency with `monthsPlayed`'s duplicated computation
      elsewhere (`moment(item.game_date).month()` in `player_stats_controller.js`
      etc.) — which then made full unification possible: `deriveShotMetadata`'s
      `months` now calls `GameLogMetadata.deriveMonthsPlayed(shots)` directly
      instead of computing its own copy (it only reads `.game_date`, so it
      works the same whether given per-game or per-shot records). This also
      dropped `deriveShotMetadata`'s null-`game_date` guard
      (`s.game_date ? ... : null`, then filtered out) — a dedicated
      fact-finding pass, not just a code read, confirmed via a full scan (not
      a sample) of all 337k+ shot records across every season with this data
      (2018-2026) that `game_date` is never null/missing/empty in practice,
      and no code comment or doc explained the guard's origin, so it was
      judged dead defensive code. A null `game_date` would now surface as a
      `NaN` entry in `monthsPlayed` instead of being silently filtered (see
      `tests/shot-filters.spec.js`) — acceptable since this never occurs with
      real data; worth revisiting only if the backend data generator's
      guarantees ever change.

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
- **In progress, 3-PR plan** (`round_selection_scheme` work): unify the
  round-range selection scheme across all three controller pairs. Root
  problem: `player_stats_controller.js`/`team_stats_controller.js`'s
  `roundsPlayed` (`js/game_log_metadata.js#deriveRoundsPlayed`) and
  `player_profile_controller.js`/`team_profile_controller.js`'s
  `maxRoundPlayed` both dedupe/bound by raw round number only, so a
  regular-season round and a playoff round sharing the same number collapse
  together in the round-range filter - and, confirmed against real data,
  it's worse than that: `round` resets to 1 at the start of each playoff
  _stage_ (`po_round`: `first_round`/`quarter_finals`/`semi_finals`/
  `finals`), so e.g. "round 1" alone can mean four different real games in
  the same PO season. `del_team_game_stats.json`/`del_player_game_stats.csv`
  don't have a `po_round` field at all yet (only `shots/per_player/*.json`
  does) - the maintainer is adding it to that pipeline, but the new scheme
  doesn't require it: it's keyed on `round + season_type + (po_round || '')`,
  so `season_type` alone already fixes the RS-vs-PO collision today, and
  `po_round` additionally resolves the playoff-stage collision once/wherever
  it's populated (also defensively treats the literal string `'rnd_type'` -
  a known pipeline bug in some `MSC` records - as absent, same as missing).
    - ✅ **PR 1**: new shared `js/game_log_metadata.js#deriveRoundSelection`
      (unit-tested in `tests/game-log-metadata.spec.js`), sorted `MSC` → `RS` →
      `PO` (matching existing season_type `<select>` option order), playoff
      entries sub-sorted by tournament stage then round.
      `shot_explorer_controller.js`/`js/shot_filters.js#deriveShotMetadata`
      migrated onto it (it already had the right idea with its own
      `round + '|' + po_round` key, just not shared or season_type-aware;
      `js/shot_filters.js#filterShots`'s round-range membership check updated
      to match). `deriveRoundsPlayed` (the old, round-number-only function)
      stays for now - `player_stats_controller.js`/`team_stats_controller.js`/
      `player_profile_controller.js`/`team_profile_controller.js` haven't
      migrated yet, delete it once they have.
    - ✅ **PR 2**: `player_stats_controller.js`/`team_stats_controller.js`
      migrated onto `deriveRoundSelection`. Along the way, extracted the
      index-slice/key-membership logic itself out of
      `js/shot_filters.js#filterShots` into
      `js/game_log_metadata.js#deriveValidRoundKeys` (so it's not duplicated a
      third time) and the composite-key string building into
      `js/game_log_metadata.js#roundKeyOf` (same reason -
      `deriveRoundSelection` and `filterShots` were each building that string
      themselves). `js/game_filters.js#gamePassesCommonFilters` takes a
      pre-built `validRoundKeys` Set (or null for "no restriction") instead of
      raw `fromRoundSelect`/`toRoundSelect` strings - both controllers compute
      it once per filtering pass (in the existing `$watchGroup` callback that
      already re-runs filtering on any filter change), not once per element,
      since it's the same Set for every element in that pass. Templates move
      from a plain-number dropdown to the `{round, season_type, po_round,
key}` shape, matching `shot_explorer.html`'s pattern exactly. This also
      fixes the "Hauptrunde und Playoffs" combined-season-type-mode bug
      identified earlier (a round-range narrowed within one season_type's
      contiguous sorted block - e.g. "RS round 1 to 10" - can no longer pull
      in a different season_type's games, since the sort groups `MSC`/`RS`/`PO`
      into separate contiguous ranges).
      **Follow-up found after this PR's templates went live**: with
      `player_stats_controller.js`/`team_stats_controller.js`'s data sources
      still lacking `po_round` (see above), every PO/MSC entry's dropdown
      label looked identical to an RS entry sharing the same round number
      (e.g. two indistinguishable "Spieltag 1" options) - the key already
      disambiguated them correctly, but nothing signaled that visually.
      Fixed by moving the label out of the template (previously duplicated,
      slightly differently, in `player_stats.html`/`team_stats.html`/
      `shot_explorer.html`) into `js/game_log_metadata.js#roundOptionLabel`,
      computed once per entry inside `deriveRoundSelection` itself (a `.label`
      field, alongside `.key`) - it now falls back to `season_type` as the
      prefix (e.g. "PO / Spieltag 1") when `po_round` isn't available, instead
      of showing no prefix at all. shot_explorer_controller.js's inline
      `$scope.poRoundLabels` (the PO stage abbreviations) moved into that
      same function (as `PO_STAGE_LABELS`, no longer exposed on any
      `$scope` - the three controllers' own `$scope.poRoundLabels`
      assignments were deleted along with the template logic that read them).
    - ⬜ **PR 3**: `player_profile_controller.js`/`team_profile_controller.js` -
      replace the `maxRoundPlayed`/`svc.range(1, maxRoundPlayed)` 1..N-range
      approach (and the numeric `$scope.fromRoundFilter`/`$scope.toRoundFilter`
      Angular filter functions) with the same shared scheme; delete
      `deriveRoundsPlayed` once this lands, since nothing will call it anymore.
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
- `checkCondition`'s `eval(value)` hack (`js/stat_categorization.js`) — only
  the goalie `quality_starts` category needs it, to resolve
  `"$scope.league_data.save_pctg * 100"` dynamically against the league's
  live average save percentage. Replace with an explicit, non-`eval` lookup
  (e.g. a `valueRef`/`valueMultiplier` config shape resolved against a passed-in
  context object) instead of a raw string eval'd in the caller's scope. A
  real behavior/config-format change, not a pure refactor, so kept out of
  the extraction pass above.

`del_stats_frontend_ext`'s `docs/ROADMAP.md` tracks additional deferred items
specific to that private superset (trivia/preview pages, test-flakiness
details, etc.) not repeated here.
