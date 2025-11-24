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

    ZONE_BOUNDARIES: {
        // Horizontal (X-axis percentages)
        zone3Right: 20,   // Zone 3: 0-20%
        zone2Right: 40,   // Zone 2: 20-40%
        zone1Right: 60,   // Zone 1: 40-60%
        zone0Right: 100,  // Zone 0: 60-100%

        // Circular zones (within zone 1 area)
        circle4: { x: 50, y: 19, radius: 6 },  // Top circle
        circle5: { x: 50, y: 81, radius: 6 }   // Bottom circle
    },

    ZONE_POINTS: {
        'outer': 0, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5
    }
};
