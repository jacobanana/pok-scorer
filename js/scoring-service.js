// ============================================
// SCORING SERVICE (Pure Functions - No State)
// ============================================

import { CONFIG } from './config.js';

export class ScoringService {
    // Calculate zone and points from position
    static getZoneInfo(x, y) {
        const { ZONE_BOUNDARIES, ZONE_POINTS, BOUNDARY_THRESHOLD_PERCENT, TABLE_ASPECT_RATIO } = CONFIG;

        // Outside table
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { zoneId: 'outer', points: 0, isHigh: true, boundaryZone: null };
        }

        // Check circular zones first
        const circle4 = this.checkCircle(x, y, ZONE_BOUNDARIES.circle4, '4', '1');
        if (circle4) return circle4;

        const circle5 = this.checkCircle(x, y, ZONE_BOUNDARIES.circle5, '5', '1');
        if (circle5) return circle5;

        // Check rectangular zones
        if (x < ZONE_BOUNDARIES.zone3Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone3Right, '3', '2');
        } else if (x < ZONE_BOUNDARIES.zone2Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone2Right, '2', '1');
        } else if (x < ZONE_BOUNDARIES.zone1Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone1Right, '1', '0');
        } else {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone0Right, '0', null);
        }
    }

    static checkCircle(x, y, circle, zoneId, boundaryZone) {
        const { TABLE_ASPECT_RATIO, BOUNDARY_THRESHOLD_PERCENT, ZONE_POINTS } = CONFIG;

        const dx = x - circle.x;
        const dy = (y - circle.y) / TABLE_ASPECT_RATIO;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= circle.radius) {
            const isNearBoundary = distance >= (circle.radius - BOUNDARY_THRESHOLD_PERCENT);

            if (isNearBoundary && boundaryZone) {
                return {
                    zoneId,
                    points: ZONE_POINTS[boundaryZone],
                    isHigh: false,
                    boundaryZone
                };
            }

            return {
                zoneId,
                points: ZONE_POINTS[zoneId],
                isHigh: true,
                boundaryZone: null
            };
        }

        return null;
    }

    static checkRectangle(x, rightBoundary, zoneId, boundaryZone) {
        const { BOUNDARY_THRESHOLD_PERCENT, ZONE_POINTS } = CONFIG;

        const isNearBoundary = boundaryZone && (x >= rightBoundary - BOUNDARY_THRESHOLD_PERCENT);

        if (isNearBoundary) {
            return {
                zoneId,
                points: ZONE_POINTS[boundaryZone],
                isHigh: false,
                boundaryZone
            };
        }

        return {
            zoneId,
            points: ZONE_POINTS[zoneId],
            isHigh: true,
            boundaryZone: null
        };
    }
}
