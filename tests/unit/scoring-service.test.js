// ============================================
// SCORING SERVICE UNIT TESTS
// ============================================

import { ScoringService } from '../../js/scoring-service.js';
import { PLAYERS } from '../../js/config.js';
import { restoreLogging } from '../lib/fixtures.js';

const { assert } = window;
const runner = window.testRunner;

// Note: ScoringService is stateless (all static methods), so no fixtures needed.
// We still add afterEach for CONFIG restoration consistency.

runner.describe('ScoringService - Zone Detection', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should return zone 3 for x < 20', () => {
        const result = ScoringService.getZoneInfo(10, 50, false);
        assert.equal(result.zoneId, '3');
        assert.equal(result.points, 3);
        assert.ok(result.isHigh);
    });

    runner.it('should return zone 2 for 20 <= x < 40', () => {
        const result = ScoringService.getZoneInfo(30, 50, false);
        assert.equal(result.zoneId, '2');
        assert.equal(result.points, 2);
    });

    runner.it('should return zone 1 for 40 <= x < 60', () => {
        const result = ScoringService.getZoneInfo(50, 50, false);
        assert.equal(result.zoneId, '1');
        assert.equal(result.points, 1);
    });

    runner.it('should return zone 0 for x >= 60', () => {
        const result = ScoringService.getZoneInfo(70, 50, false);
        assert.equal(result.zoneId, '0');
        assert.equal(result.points, 0);
    });

    runner.it('should return outer zone for x < 0', () => {
        const result = ScoringService.getZoneInfo(-10, 50, false);
        assert.equal(result.zoneId, 'outer');
        assert.equal(result.points, 0);
    });

    runner.it('should return outer zone for x > 100', () => {
        const result = ScoringService.getZoneInfo(110, 50, false);
        assert.equal(result.zoneId, 'outer');
        assert.equal(result.points, 0);
    });

    runner.it('should return outer zone for y < 0', () => {
        const result = ScoringService.getZoneInfo(50, -10, false);
        assert.equal(result.zoneId, 'outer');
        assert.equal(result.points, 0);
    });

    runner.it('should return outer zone for y > 100', () => {
        const result = ScoringService.getZoneInfo(50, 110, false);
        assert.equal(result.zoneId, 'outer');
        assert.equal(result.points, 0);
    });
});

runner.describe('ScoringService - Circular Zones', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should detect circle zone 4 (top circle)', () => {
        const result = ScoringService.getZoneInfo(50, 19, false);
        assert.equal(result.zoneId, '4');
        assert.equal(result.points, 4);
    });

    runner.it('should detect circle zone 5 (bottom circle)', () => {
        const result = ScoringService.getZoneInfo(50, 81, false);
        assert.equal(result.zoneId, '5');
        assert.equal(result.points, 5);
    });

    runner.it('should prioritize circular zones over rectangular zones', () => {
        // Position that is in zone 1 rectangle but also in circle 4
        const result = ScoringService.getZoneInfo(50, 19, false);
        assert.equal(result.zoneId, '4'); // Circle takes precedence
        assert.equal(result.points, 4);
    });
});

runner.describe('ScoringService - Table Flip', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should swap circle 4 and 5 when flipped', () => {
        const topNormal = ScoringService.getZoneInfo(50, 19, false);
        const topFlipped = ScoringService.getZoneInfo(50, 19, true);

        assert.equal(topNormal.zoneId, '4');
        assert.equal(topFlipped.zoneId, '5'); // Swapped!
    });

    runner.it('should swap circle 5 and 4 when flipped', () => {
        const bottomNormal = ScoringService.getZoneInfo(50, 81, false);
        const bottomFlipped = ScoringService.getZoneInfo(50, 81, true);

        assert.equal(bottomNormal.zoneId, '5');
        assert.equal(bottomFlipped.zoneId, '4'); // Swapped!
    });

    runner.it('should not affect rectangular zones when flipped', () => {
        const zone3Normal = ScoringService.getZoneInfo(10, 50, false);
        const zone3Flipped = ScoringService.getZoneInfo(10, 50, true);

        assert.equal(zone3Normal.zoneId, '3');
        assert.equal(zone3Flipped.zoneId, '3'); // Same
        assert.equal(zone3Normal.points, zone3Flipped.points);
    });
});

runner.describe('ScoringService - Boundary Detection', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should detect boundary between zone 3 and 2', () => {
        const result = ScoringService.getZoneInfo(19, 50, false);
        assert.notOk(result.isHigh, 'Should be on boundary');
        assert.equal(result.boundaryZone, '2', 'Should show lower zone');
    });

    runner.it('should detect boundary between zone 2 and 1', () => {
        const result = ScoringService.getZoneInfo(39, 50, false);
        assert.notOk(result.isHigh);
        assert.equal(result.boundaryZone, '1');
    });

    runner.it('should detect boundary between zone 1 and 0', () => {
        const result = ScoringService.getZoneInfo(59, 50, false);
        assert.notOk(result.isHigh);
        assert.equal(result.boundaryZone, '0');
    });

    runner.it('should not detect boundary in middle of zone', () => {
        const result = ScoringService.getZoneInfo(30, 50, false);
        assert.ok(result.isHigh, 'Should be in high zone (not boundary)');
        assert.equal(result.boundaryZone, null);
    });

    runner.it('should award lower zone points on boundary', () => {
        const boundary = ScoringService.getZoneInfo(19, 50, false);
        const normal = ScoringService.getZoneInfo(15, 50, false);

        assert.lessThan(boundary.points, normal.points, 'Boundary should score lower');
    });
});

runner.describe('ScoringService - Edge Cases', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should handle exact boundary values', () => {
        const result = ScoringService.getZoneInfo(20, 50, false);
        assert.equal(result.zoneId, '2'); // Should be zone 2 (just past zone 3)
    });

    runner.it('should handle center of table', () => {
        const result = ScoringService.getZoneInfo(50, 50, false);
        assert.equal(result.zoneId, '1'); // Middle is zone 1
    });

    runner.it('should handle corners', () => {
        const topLeft = ScoringService.getZoneInfo(0, 0, false);
        const topRight = ScoringService.getZoneInfo(100, 0, false);
        const bottomLeft = ScoringService.getZoneInfo(0, 100, false);
        const bottomRight = ScoringService.getZoneInfo(100, 100, false);

        // Corners should be zone 3 or 0 depending on x position
        assert.equal(topLeft.zoneId, '3');
        assert.equal(bottomLeft.zoneId, '3');
        assert.equal(topRight.zoneId, '0');
        assert.equal(bottomRight.zoneId, '0');
    });
});

runner.describe('ScoringService - Lookup Functions', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should lookup score by zone ID', () => {
        assert.equal(ScoringService.lookupScore('0'), 0);
        assert.equal(ScoringService.lookupScore('1'), 1);
        assert.equal(ScoringService.lookupScore('2'), 2);
        assert.equal(ScoringService.lookupScore('3'), 3);
        assert.equal(ScoringService.lookupScore('4'), 4);
        assert.equal(ScoringService.lookupScore('5'), 5);
        assert.equal(ScoringService.lookupScore('outer'), 0);
    });

    runner.it('should return boundary score when on boundary', () => {
        const zone1Boundary = ScoringService.lookupScore('1', true);
        const zone1Normal = ScoringService.lookupScore('1', false);

        assert.lessThan(zone1Boundary, zone1Normal);
    });
});

runner.describe('ScoringService - getPlayerScore', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should calculate total score for a player', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 10, y: 50 },   // 3 points
            { id: 'red2', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 50, y: 50 }  // 1 point
        ];

        const redScore = ScoringService.getPlayerScore(PLAYERS.RED, poks, false);
        const blueScore = ScoringService.getPlayerScore(PLAYERS.BLUE, poks, false);

        assert.equal(redScore, 5); // 3 + 2
        assert.equal(blueScore, 1);
    });

    runner.it('should return 0 for player with no poks', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 10, y: 50 }
        ];

        const blueScore = ScoringService.getPlayerScore(PLAYERS.BLUE, poks, false);
        assert.equal(blueScore, 0);
    });

    runner.it('should handle empty poks array', () => {
        const score = ScoringService.getPlayerScore(PLAYERS.RED, [], false);
        assert.equal(score, 0);
    });

    runner.it('should respect isFlipped parameter', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 50, y: 19 }  // Circle 4 (4 pts) or Circle 5 (5 pts) when flipped
        ];

        const normalScore = ScoringService.getPlayerScore(PLAYERS.RED, poks, false);
        const flippedScore = ScoringService.getPlayerScore(PLAYERS.RED, poks, true);

        assert.equal(normalScore, 4);
        assert.equal(flippedScore, 5);
    });
});

runner.describe('ScoringService - getRoundDiff', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should calculate scores and diff when red wins', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 10, y: 50 },   // 3 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // 2 points
        ];

        const result = ScoringService.getRoundDiff(poks, false);

        assert.equal(result.redScore, 3);
        assert.equal(result.blueScore, 2);
        assert.equal(result.diff, 1);
    });

    runner.it('should calculate scores and diff when blue wins', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 10, y: 50 }  // 3 points
        ];

        const result = ScoringService.getRoundDiff(poks, false);

        assert.equal(result.redScore, 2);
        assert.equal(result.blueScore, 3);
        assert.equal(result.diff, 1);
    });

    runner.it('should handle tied scores', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // 2 points
        ];

        const result = ScoringService.getRoundDiff(poks, false);

        assert.equal(result.redScore, 2);
        assert.equal(result.blueScore, 2);
        assert.equal(result.diff, 0);
    });

    runner.it('should handle empty poks array', () => {
        const result = ScoringService.getRoundDiff([], false);

        assert.equal(result.redScore, 0);
        assert.equal(result.blueScore, 0);
        assert.equal(result.diff, 0);
    });
});

runner.describe('ScoringService - calculateRoundOutcome', () => {
    runner.afterEach(() => {
        restoreLogging();
    });

    runner.it('should award points to red winner', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 10, y: 50 },   // 3 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // 2 points
        ];

        const outcome = ScoringService.calculateRoundOutcome(poks, false);

        assert.equal(outcome.redScore, 3);
        assert.equal(outcome.blueScore, 2);
        assert.equal(outcome.redPointsAwarded, 1);
        assert.equal(outcome.bluePointsAwarded, 0);
        assert.equal(outcome.winner, PLAYERS.RED);
    });

    runner.it('should award points to blue winner', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 10, y: 50 }  // 3 points
        ];

        const outcome = ScoringService.calculateRoundOutcome(poks, false);

        assert.equal(outcome.redScore, 2);
        assert.equal(outcome.blueScore, 3);
        assert.equal(outcome.redPointsAwarded, 0);
        assert.equal(outcome.bluePointsAwarded, 1);
        assert.equal(outcome.winner, PLAYERS.BLUE);
    });

    runner.it('should award no points on tie', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // 2 points
        ];

        const outcome = ScoringService.calculateRoundOutcome(poks, false);

        assert.equal(outcome.redScore, 2);
        assert.equal(outcome.blueScore, 2);
        assert.equal(outcome.redPointsAwarded, 0);
        assert.equal(outcome.bluePointsAwarded, 0);
        assert.equal(outcome.winner, null);
    });

    runner.it('should handle large score differences', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 50, y: 19 },   // Circle 4: 4 points
            { id: 'red2', playerId: PLAYERS.RED, x: 10, y: 50 },   // Zone 3: 3 points
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 70, y: 50 }  // Zone 0: 0 points
        ];

        const outcome = ScoringService.calculateRoundOutcome(poks, false);

        assert.equal(outcome.redScore, 7);
        assert.equal(outcome.blueScore, 0);
        assert.equal(outcome.redPointsAwarded, 7);
        assert.equal(outcome.bluePointsAwarded, 0);
        assert.equal(outcome.winner, PLAYERS.RED);
    });

    runner.it('should respect isFlipped parameter', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 50, y: 19 },   // Circle 4 (4 pts) or Circle 5 (5 pts) when flipped
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // Zone 2: 2 points
        ];

        const normalOutcome = ScoringService.calculateRoundOutcome(poks, false);
        const flippedOutcome = ScoringService.calculateRoundOutcome(poks, true);

        assert.equal(normalOutcome.redScore, 4);
        assert.equal(normalOutcome.redPointsAwarded, 2); // 4 - 2 = 2

        assert.equal(flippedOutcome.redScore, 5);
        assert.equal(flippedOutcome.redPointsAwarded, 3); // 5 - 2 = 3
    });

    runner.it('should handle multiple poks per player', () => {
        const poks = [
            { id: 'red1', playerId: PLAYERS.RED, x: 10, y: 50 },   // 3 points
            { id: 'red2', playerId: PLAYERS.RED, x: 30, y: 50 },   // 2 points
            { id: 'red3', playerId: PLAYERS.RED, x: 50, y: 50 },   // 1 point
            { id: 'blue1', playerId: PLAYERS.BLUE, x: 10, y: 50 }, // 3 points
            { id: 'blue2', playerId: PLAYERS.BLUE, x: 30, y: 50 }  // 2 points
        ];

        const outcome = ScoringService.calculateRoundOutcome(poks, false);

        assert.equal(outcome.redScore, 6);   // 3 + 2 + 1
        assert.equal(outcome.blueScore, 5);  // 3 + 2
        assert.equal(outcome.redPointsAwarded, 1);
        assert.equal(outcome.bluePointsAwarded, 0);
        assert.equal(outcome.winner, PLAYERS.RED);
    });
});
