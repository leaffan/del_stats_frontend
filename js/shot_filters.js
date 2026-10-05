/* global module */
// Pure shot-filtering/aggregation logic extracted from shot_explorer_controller.js
// so it's reachable from unit tests, not just E2E. Plain script so the same
// code runs in the browser (global ShotFilters) and in tests (see
// js/format_utils.js for the same dual-export pattern).
(function (root) {
    // shots: raw per-player shot records (data/<season>/shots/per_player/<id>.json)
    // filters: {
    //   seasonType, situation, targetType, period, homeRoad, opp, goalie: 'all' | a specific value,
    //   zoneFilter: 'all' | 'es:<CODE>' | 'edge:<group>' | 'ne:<CODE>',
    //   edgeZoneGroups: { group: [codes...] },
    //   fromDate, toDate: 'YYYY-MM-DD' or falsy,
    //   roundsPlayed: [{ round, po_round, key }], fromRoundKey, toRoundKey: strings
    // }
    function filterShots(shots, filters) {
        let result = shots.slice();

        if (filters.seasonType && filters.seasonType !== 'all') {
            result = result.filter(function (s) {
                return s.season_type === filters.seasonType;
            });
        }
        if (filters.situation && filters.situation !== 'all') {
            result = result.filter(function (s) {
                return s.situation === filters.situation;
            });
        }
        if (filters.targetType && filters.targetType !== 'all') {
            if (filters.targetType === 'goals') {
                result = result.filter(function (s) {
                    return s.scored;
                });
            } else {
                result = result.filter(function (s) {
                    return s.target_type === filters.targetType;
                });
            }
        }
        if (filters.period && filters.period !== 'all') {
            result = result.filter(function (s) {
                return s.period == filters.period;
            });
        }
        if (filters.homeRoad && filters.homeRoad !== 'all') {
            result = result.filter(function (s) {
                return s.home_road === filters.homeRoad;
            });
        }
        if (filters.opp && filters.opp !== 'all') {
            result = result.filter(function (s) {
                return s.opp_team === filters.opp;
            });
        }
        if (filters.goalie && filters.goalie !== 'all') {
            if (filters.goalie === 'empty_net') {
                result = result.filter(function (s) {
                    return s.goalie === null || s.goalie === undefined;
                });
            } else {
                result = result.filter(function (s) {
                    return s.goalie == filters.goalie;
                });
            }
        }

        if (filters.zoneFilter && filters.zoneFilter !== 'all') {
            let parts = filters.zoneFilter.split(':');
            let scheme = parts[0];
            let key = parts[1];
            if (scheme === 'es') {
                result = result.filter(function (s) {
                    return s.shot_zone === key;
                });
            } else if (scheme === 'edge') {
                let groupCodes = new Set((filters.edgeZoneGroups || {})[key] || []);
                result = result.filter(function (s) {
                    return groupCodes.has(s.ne_shot_zone);
                });
            } else {
                result = result.filter(function (s) {
                    return s.ne_shot_zone === key;
                });
            }
        }

        if (filters.fromDate) {
            result = result.filter(function (s) {
                return s.game_date >= filters.fromDate;
            });
        }
        if (filters.toDate) {
            result = result.filter(function (s) {
                return s.game_date <= filters.toDate;
            });
        }

        let roundsPlayed = filters.roundsPlayed || [];
        if (roundsPlayed.length > 0) {
            let fromIdx = roundsPlayed.findIndex(function (r) {
                return r.key === filters.fromRoundKey;
            });
            let toIdx = roundsPlayed.findIndex(function (r) {
                return r.key === filters.toRoundKey;
            });
            if (fromIdx === -1) fromIdx = 0;
            if (toIdx === -1) toIdx = roundsPlayed.length - 1;
            if (fromIdx > 0 || toIdx < roundsPlayed.length - 1) {
                let validKeys = new Set(
                    roundsPlayed.slice(fromIdx, toIdx + 1).map(function (r) {
                        return r.key;
                    }),
                );
                result = result.filter(function (s) {
                    return validKeys.has(s.round + '|' + (s.po_round || ''));
                });
            }
        }

        return result;
    }

    // Maps one raw shot to the shape the shot list table and rink SVG bind to.
    // context: {
    //   goalieShortNameById, goalieLastNameById: { playerId: name },
    //   delZoneLabels: { CODE: 'German label' },
    //   targetTypeLabels: { on_goal/blocked/missed: 'German label' },
    // }
    function transformShot(s, context) {
        let sx, sy;
        // Road teams attack left (x<0 = attacking zone); home teams attack
        // right (x>0 = attacking zone) → mirror home shots to show attacking left
        if (s.home_road === 'home') {
            sx = 60 - s.x * 2;
            sy = 30 + s.y * 2;
        } else {
            sx = 60 + s.x * 2;
            sy = 30 - s.y * 2;
        }
        let mins = Math.floor(s.time / 60);
        let secs = s.time % 60;

        // table dot color: table-sm row dots don't distinguish beyond
        // scored/on_goal/blocked (missed has no fill, see .shot-legend-outline)
        let dotColor = s.scored
            ? '#1a1a1a'
            : s.target_type === 'on_goal'
              ? '#2980b9'
              : s.target_type === 'blocked'
                ? '#f39c12'
                : 'transparent';

        let kindLabel = s.scored
            ? 'Tor'
            : (context.targetTypeLabels || {})[s.target_type] || s.target_type;
        let tooltip =
            kindLabel +
            ' | ' +
            ((context.delZoneLabels || {})[s.shot_zone] || s.shot_zone) +
            ' | ' +
            s.distance.toFixed(1) +
            ' m | P' +
            s.period +
            ' | ' +
            s.situation +
            ' | ' +
            s.home_road;

        let goalieShortNameById = context.goalieShortNameById || {};
        let goalieLastNameById = context.goalieLastNameById || {};

        return {
            svg_x: sx,
            svg_y: sy,
            scored: s.scored,
            target_type: s.target_type,
            shot_zone: s.shot_zone,
            ne_shot_zone: s.ne_shot_zone,
            opp_team: s.opp_team,
            game_date: s.game_date,
            goalie_name:
                s.goalie === null || s.goalie === undefined
                    ? 'Leeres Tor'
                    : goalieShortNameById[s.goalie] || 'Torhüter ' + s.goalie,
            goalie_last_name:
                s.goalie === null || s.goalie === undefined
                    ? 'Leeres Tor'
                    : goalieLastNameById[s.goalie] || 'Torhüter ' + s.goalie,
            distance: s.distance,
            period: s.period,
            situation: s.situation,
            plr_situation: s.plr_situation,
            home_road: s.home_road,
            time: s.time,
            time_str: mins + ':' + (secs < 10 ? '0' : '') + secs,
            dotColor: dotColor,
            tooltip: tooltip,
        };
    }

    // calculatePercentage-equivalent, duplicated rather than depending on
    // Angular's svc so this module stays plain-script/dependency-free
    function safePercentage(part, base) {
        if (!base) return 0;
        return (part / base) * 100;
    }

    function computeStats(shots) {
        if (!shots || shots.length === 0) {
            return null;
        }

        let goals = shots.filter(function (s) {
            return s.scored;
        }).length;
        let onGoal = shots.filter(function (s) {
            return s.target_type === 'on_goal';
        }).length;
        let blocked = shots.filter(function (s) {
            return s.target_type === 'blocked';
        }).length;
        let missed = shots.filter(function (s) {
            return s.target_type === 'missed';
        }).length;

        let totalDistance = shots.reduce(function (sum, s) {
            return sum + s.distance;
        }, 0);

        return {
            total: shots.length,
            goals: goals,
            on_goal: onGoal,
            blocked: blocked,
            missed: missed,
            // every scored shot also carries target_type 'on_goal', so onGoal is
            // the shots-on-goal count the rest of the site bases SH% on
            shooting_pct: safePercentage(goals, onGoal).toFixed(1),
            avg_distance: (totalDistance / shots.length).toFixed(1),
        };
    }

    const api = {
        filterShots: filterShots,
        transformShot: transformShot,
        computeStats: computeStats,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ShotFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
