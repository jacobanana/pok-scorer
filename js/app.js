// ============================================
// ENTRY POINT
// ============================================

import { CONFIG } from './config.js';
import { PokScorerApp } from './pok-scorer-app.js';

const app = new PokScorerApp();

document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // Expose debug tools globally
    window.pokDebug = {
        app,
        eventStore: app.eventStore,
        gameState: app.gameState,
        commands: app.commands,

        // Helper functions
        log: () => app.eventStore.printEventLog(),
        stats: () => app.eventStore.printStats(),
        state: () => {
            console.group('%c🎮 Current Game State', 'color: #673AB7; font-size: 14px; font-weight: bold');
            console.log('Game State:', app.gameState.getState());
            console.log('Current Round:', app.gameState.getCurrentRound());
            console.log('Round Scores:', app.gameState.getRoundScores());
            console.log('Next Player:', app.gameState.getNextPlayer());
            console.groupEnd();
        },
        toggleLogging: () => {
            CONFIG.ENABLE_LOGGING = !CONFIG.ENABLE_LOGGING;
            console.log(`Event logging ${CONFIG.ENABLE_LOGGING ? 'enabled' : 'disabled'}`);
        },

        // Quick access to common actions
        events: () => app.eventStore.getAllEvents(),
        lastEvent: () => app.eventStore.events[app.eventStore.events.length - 1]
    };

    console.log('%c🎮 POK Score Counter - Event Sourced',
        'color: #2196F3; font-size: 16px; font-weight: bold');
    console.log('%cDebug tools available via: window.pokDebug',
        'color: #4CAF50; font-size: 12px');
    console.log('%cTry: pokDebug.log(), pokDebug.stats(), pokDebug.state()',
        'color: #666; font-size: 11px; font-style: italic');
});
