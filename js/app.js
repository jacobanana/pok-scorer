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
        lastEvent: () => app.eventStore.events[app.eventStore.events.length - 1],

        // Display rounds info in a table
        rounds: () => {
            const state = app.gameState.getState();
            const roundsInfo = state.rounds.map((round, index) => {
                const scores = app.gameState.calculateRoundScores
                    ? app.gameState.calculateRoundScores(round)
                    : {
                        red: round.poks.filter(p => p.playerId === 'red').reduce((sum, p) => sum + p.points, 0),
                        blue: round.poks.filter(p => p.playerId === 'blue').reduce((sum, p) => sum + p.points, 0)
                    };

                return {
                    roundNumber: round.roundNumber,
                    isComplete: round.isComplete,
                    isFlipped: round.isFlipped,
                    startingPlayer: round.startingPlayerId,
                    currentPlayer: round.currentPlayerId,
                    redScore: scores.red,
                    blueScore: scores.blue,
                    redPoksLeft: round.redPoksRemaining,
                    bluePoksLeft: round.bluePoksRemaining,
                    totalPoks: round.poks.length
                };
            });
            console.table(roundsInfo);
            return roundsInfo;
        },

        // Show all TABLE_FLIPPED events
        flips: () => {
            const events = app.eventStore.getAllEvents();
            const flipEvents = events.filter(e => e.type === 'TABLE_FLIPPED');
            console.log(`Found ${flipEvents.length} TABLE_FLIPPED events:`);
            flipEvents.forEach((e, i) => {
                console.log(`  ${i + 1}. Event #${e.id}: isFlipped=${e.data.isFlipped} at ${new Date(e.timestamp).toLocaleString()}`);
            });
            return flipEvents;
        }
    };

    console.log('%c🎮 POK Score Counter - Event Sourced',
        'color: #2196F3; font-size: 16px; font-weight: bold');
    console.log('%cDebug tools available via: window.pokDebug',
        'color: #4CAF50; font-size: 12px');
    console.log('%cTry: pokDebug.log(), pokDebug.stats(), pokDebug.state(), pokDebug.rounds()',
        'color: #666; font-size: 11px; font-style: italic');
});
