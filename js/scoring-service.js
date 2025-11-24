// ============================================
// SCORING SERVICE (Pure Functions - No State)
// ============================================

import { CONFIG } from './config.js';

export class ScoringService {
    // Lookup score by zone ID
    static lookupScore(zoneId, onBoundary = false) {
        const { ZONES, CIRCLE_ZONES, OUTER_ZONE_SCORE } = CONFIG;

        // Handle outer zone
        if (zoneId === 'outer') {
            return OUTER_ZONE_SCORE;
        }

        // Check circular zones
        const circle = CIRCLE_ZONES.find(c => c.id === zoneId);
        if (circle) {
            return onBoundary && circle.boundaryScore !== null && circle.boundaryScore !== undefined
                ? circle.boundaryScore
                : circle.score;
        }

        // Check rectangular zones
        const zone = ZONES.find(z => z.id === zoneId);
        if (zone) {
            return onBoundary && zone.boundaryScore !== null && zone.boundaryScore !== undefined
                ? zone.boundaryScore
                : zone.score;
        }

        // Fallback
        return 0;
    }

    // Calculate zone and points from position
    static getZoneInfo(x, y, isFlipped = false) {
        const { ZONES, CIRCLE_ZONES } = CONFIG;

        // Outside table
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { zoneId: 'outer', points: this.lookupScore('outer'), isHigh: true, boundaryZone: null };
        }

        // Check circular zones first (swap zone IDs when flipped)
        for (const circle of CIRCLE_ZONES) {
            // When flipped, zone 4 (top) becomes zone 5, and zone 5 (bottom) becomes zone 4
            const actualZoneId = isFlipped
                ? (circle.id === '4' ? '5' : circle.id === '5' ? '4' : circle.id)
                : circle.id;

            const result = this.checkCircle(x, y, circle, actualZoneId);
            if (result) return result;
        }

        // Check rectangular zones (iterate from highest score to lowest)
        for (let i = ZONES.length - 1; i >= 0; i--) {
            const zone = ZONES[i];

            if (x < zone.boundary) {
                return this.checkRectangle(x, zone);
            }
        }

        // Fallback (shouldn't reach here)
        return { zoneId: '0', points: 0, isHigh: true, boundaryZone: null };
    }

    static checkCircle(x, y, circle, zoneId) {
        const { TABLE_ASPECT_RATIO, BOUNDARY_THRESHOLD_PERCENT } = CONFIG;

        const dx = x - circle.x;
        const dy = (y - circle.y) / TABLE_ASPECT_RATIO;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= circle.radius) {
            const isNearBoundary = distance >= (circle.radius - BOUNDARY_THRESHOLD_PERCENT);

            // Use lookupScore with the actual zone ID (already adjusted for flip)
            const points = this.lookupScore(zoneId, isNearBoundary);

            if (isNearBoundary) {
                return {
                    zoneId,
                    points,
                    isHigh: false,
                    boundaryZone: points.toString()
                };
            }

            return {
                zoneId,
                points,
                isHigh: true,
                boundaryZone: null
            };
        }

        return null;
    }

    static checkRectangle(x, zone) {
        const { BOUNDARY_THRESHOLD_PERCENT } = CONFIG;

        const isNearBoundary = (zone.boundaryScore !== null && zone.boundaryScore !== undefined)
            && (x >= zone.boundary - BOUNDARY_THRESHOLD_PERCENT);

        // Use lookupScore for consistency
        const points = this.lookupScore(zone.id, isNearBoundary);

        if (isNearBoundary) {
            return {
                zoneId: zone.id,
                points,
                isHigh: false,
                boundaryZone: points.toString()
            };
        }

        return {
            zoneId: zone.id,
            points,
            isHigh: true,
            boundaryZone: null
        };
    }
}
