// ============================================
// SCORING SERVICE (Pure Functions - No State)
// ============================================

import { CONFIG } from './config.js';

export class ScoringService {
    // Calculate zone and points from position
    static getZoneInfo(x, y, isFlipped = false) {
        const { ZONES, CIRCLE_ZONES } = CONFIG;

        // Outside table
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { zoneId: 'outer', points: 0, isHigh: true, boundaryZone: null };
        }

        // Check circular zones first (swap zone IDs when flipped)
        for (const circle of CIRCLE_ZONES) {
            // When flipped, zone 4 (top) becomes zone 5, and zone 5 (bottom) becomes zone 4
            const actualZoneId = isFlipped
                ? (circle.id === '4' ? '5' : circle.id === '5' ? '4' : circle.id)
                : circle.id;

            const result = this.checkCircle(x, y, circle, actualZoneId, circle.boundaryZone);
            if (result) return result;
        }

        // Check rectangular zones (iterate from highest score to lowest)
        for (let i = ZONES.length - 1; i >= 0; i--) {
            const zone = ZONES[i];
            const boundaryZone = i > 0 ? ZONES[i - 1].id : null;

            if (x < zone.boundary) {
                return this.checkRectangle(x, zone.boundary, zone.id, boundaryZone);
            }
        }

        // Fallback (shouldn't reach here)
        return { zoneId: '0', points: 0, isHigh: true, boundaryZone: null };
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
