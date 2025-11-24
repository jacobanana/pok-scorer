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
        { id: '0', boundary: 100 },   // Zone 0: 60-100%
        { id: '1', boundary: 60 },    // Zone 1: 40-60%
        { id: '2', boundary: 40 },    // Zone 2: 20-40%
        { id: '3', boundary: 20 }     // Zone 3: 0-20%
    ],

    // Circular zones (within zone 1 area)
    CIRCLE_ZONES: [
        { id: '4', x: 50, y: 19, radius: 6, boundaryZone: '1' },  // Top circle
        { id: '5', x: 50, y: 81, radius: 6, boundaryZone: '1' }   // Bottom circle
    ],

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
