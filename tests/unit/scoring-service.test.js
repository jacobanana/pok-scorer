// ============================================
// SCORING SERVICE UNIT TESTS
// ============================================

import { ScoringService } from '../../js/scoring-service.js';

const { describe, it, assert } = window;
const runner = window.testRunner;

runner.describe('ScoringService - Zone Detection', () => {
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
