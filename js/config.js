// ============================================
// CONFIGURATION
// ============================================

export const CONFIG = {
    WINNING_SCORE: 21,
    POKS_PER_PLAYER: 5,
    AUTO_END_DELAY_MS: 5000,
    TURN_NOTIFICATION_MS: 1000,
    BOUNDARY_THRESHOLD_PERCENT: 2,
    TABLE_ASPECT_RATIO: 1.5,
    ENABLE_LOGGING: true, // Set to false to disable event logging

    // Zone definitions (from lowest to highest score)
    ZONES: [
        { id: '0', boundary: 100, score: 0, boundaryScore: null },   // Zone 0: 60-100%, no boundary (outer edge)
        { id: '1', boundary: 60, score: 1, boundaryScore: 0 },       // Zone 1: 40-60%, boundary with zone 0
        { id: '2', boundary: 40, score: 2, boundaryScore: 1 },       // Zone 2: 20-40%, boundary with zone 1
        { id: '3', boundary: 20, score: 3, boundaryScore: 2 }        // Zone 3: 0-20%, boundary with zone 2
    ],

    // Circular zones (within zone 1 area)
    CIRCLE_ZONES: [
        { id: '4', x: 50, y: 19, radius: 6, score: 4, boundaryScore: 1 },  // Top circle, boundary with zone 1
        { id: '5', x: 50, y: 81, radius: 6, score: 5, boundaryScore: 1 }   // Bottom circle, boundary with zone 1
    ],

    // Outer zone (off table) score
    OUTER_ZONE_SCORE: 0,

    // Legacy zone points mapping (deprecated - use zone definitions above)
    ZONE_POINTS: {
        'outer': 0, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5
    },

    // Legacy compatibility (deprecated - use ZONES and CIRCLE_ZONES)
    ZONE_BOUNDARIES: {
        zone3Right: 20,
        zone2Right: 40,
        zone1Right: 60,
        zone0Right: 100,
        circle4: { x: 50, y: 19, radius: 6 },
        circle5: { x: 50, y: 81, radius: 6 }
    }
};
