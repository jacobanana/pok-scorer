// ============================================
// GAME FLOW INTEGRATION TESTS
// ============================================

import { EventStore } from '../../js/event-store.js';
import { GameStateProjection } from '../../js/game-state-projection.js';
import { CommandHandler } from '../../js/command-handler.js';
import { CONFIG } from '../../js/config.js';

const { assert } = window;
const runner = window.testRunner;

runner.describe('Integration - Full Game Flow', () => {
    let eventStore, gameState, commands;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        gameState = new GameStateProjection(eventStore);
        commands = new CommandHandler(eventStore, gameState);
    });

    runner.it('should start game and create first round', () => {
        commands.startGame('red');
        const state = gameState.getState();

        assert.ok(state.isStarted);
        assert.lengthOf(state.rounds, 1);
        assert.equal(state.rounds[0].startingPlayerId, 'red');
    });

    runner.it('should place poks and update state', () => {
        commands.startGame('red');
        commands.placePok('red', 30, 50);
        commands.placePok('blue', 10, 50);

        const round = gameState.getCurrentRound();

        assert.lengthOf(round.poks, 2);
        assert.equal(round.redPoksRemaining, 4);
        assert.equal(round.bluePoksRemaining, 4);
    });

    runner.it('should calculate scores correctly', () => {
        commands.startGame('red');
        commands.placePok('red', 10, 50);  // Zone 3 = 3 points
        commands.placePok('blue', 30, 50); // Zone 2 = 2 points

        const scores = gameState.getRoundScores();

        assert.equal(scores.red, 3);
        assert.equal(scores.blue, 2);
    });

    runner.it('should complete round and update total scores', () => {
        commands.startGame('red');

        // Place all poks - respecting turn order (lower score plays first)
        for (let i = 0; i < 5; i++) {
            let nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 30, 50);  // 2 points each

            nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 50, 50); // 1 point each
        }

        commands.endRound();

        const state = gameState.getState();

        // Winner gets the difference in points
        assert.ok(state.players.red.totalScore > 0 || state.players.blue.totalScore > 0);
    });

    runner.it('should start new round after previous ends', () => {
        commands.startGame('red');

        // Complete first round - respecting turn order
        for (let i = 0; i < 5; i++) {
            let nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 30, 50);

            nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 50, 50);
        }

        commands.endRound();

        // Start second round
        commands.startNextRound();

        const state = gameState.getState();

        assert.lengthOf(state.rounds, 2);
        assert.equal(state.currentRoundIndex, 1);
    });

    runner.it('should handle pok removal (undo)', () => {
        commands.startGame('red');

        let nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 30, 50);

        nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 30, 50);

        const beforeRound = gameState.getCurrentRound();
        const lastPokId = beforeRound.lastPlacedPokId;
        const lastPlayer = beforeRound.poks.find(p => p.id === lastPokId).playerId;

        commands.removePok(lastPokId);

        const afterRound = gameState.getCurrentRound();

        assert.lengthOf(afterRound.poks, 1);
        // Check that the removed player's poks were restored
        const poksRemaining = lastPlayer === 'red' ? afterRound.redPoksRemaining : afterRound.bluePoksRemaining;
        assert.equal(poksRemaining, 5);
    });

    runner.it('should handle table flip and recalculate zones', () => {
        commands.startGame('red');
        commands.placePok('red', 50, 19); // Circle 4

        const beforeRound = gameState.getCurrentRound();
        const beforePok = beforeRound.poks[0];

        assert.equal(beforePok.zoneId, '4');

        commands.flipTable(true);

        const afterRound = gameState.getCurrentRound();
        const afterPok = afterRound.poks[0];

        // Should swap to circle 5
        assert.equal(afterPok.zoneId, '5');
    });
});

runner.describe('Integration - Event Sourcing Consistency', () => {
    let eventStore, gameState;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        gameState = new GameStateProjection(eventStore);
    });

    runner.it('should maintain consistency across multiple calculations', () => {
        const commands = new CommandHandler(eventStore, gameState);

        commands.startGame('red');
        commands.placePok('red', 30, 50);
        commands.placePok('blue', 10, 50);

        const state1 = gameState.getState();
        const state2 = gameState.getState();
        const state3 = gameState.getState();

        // All calculations should produce same result
        assert.deepEqual(state1, state2);
        assert.deepEqual(state2, state3);
    });

    runner.it('should produce same state from event replay', () => {
        const commands = new CommandHandler(eventStore, gameState);

        // Do some operations
        commands.startGame('red');
        commands.placePok('red', 30, 50);
        commands.placePok('blue', 10, 50);
        commands.movePok('pok-1', 50, 50);

        const state1 = gameState.getState();

        // Create new projection with same events
        const newProjection = new GameStateProjection(eventStore);
        const state2 = newProjection.getState();

        // Should produce identical state
        assert.deepEqual(state1, state2);
    });

    runner.it('should handle complex sequence of operations', () => {
        const commands = new CommandHandler(eventStore, gameState);

        commands.startGame('red');

        // Place some poks - respecting turn order
        let nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 30, 50);

        nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 10, 50);

        nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 50, 19); // Circle 4

        // Move a pok
        const round1 = gameState.getCurrentRound();
        commands.movePok(round1.poks[0].id, 10, 50);

        // Flip table
        commands.flipTable(true);

        // Remove a pok
        const round2 = gameState.getCurrentRound();
        commands.removePok(round2.lastPlacedPokId);

        // Place more poks
        nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 30, 50);

        // State should still be consistent
        const state = gameState.getState();
        const events = eventStore.getAllEvents();

        // Verify event count matches state
        const pokPlaced = events.filter(e => e.type === 'POK_PLACED').length;
        const pokRemoved = events.filter(e => e.type === 'POK_REMOVED').length;
        const expectedPoks = pokPlaced - pokRemoved;

        assert.equal(state.rounds[0].poks.length, expectedPoks);
    });
});

runner.describe('Integration - Multi-Round Game', () => {
    let eventStore, gameState, commands;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        gameState = new GameStateProjection(eventStore);
        commands = new CommandHandler(eventStore, gameState);
    });

    runner.it('should play multiple rounds correctly', () => {
        commands.startGame('red');

        // Round 1 - respecting turn order
        for (let i = 0; i < 5; i++) {
            let nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 10, 50);  // 3 points each

            nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 50, 50); // 1 point each
        }

        commands.endRound();

        let state = gameState.getState();

        // Round 2
        commands.startNextRound();

        for (let i = 0; i < 5; i++) {
            let nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 50, 50);  // 1 point each

            nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 10, 50); // 3 points each
        }

        commands.endRound();

        state = gameState.getState();
        // Verify that rounds were played
        assert.lengthOf(state.rounds, 2);
        assert.ok(state.rounds[0].isComplete);
        assert.ok(state.rounds[1].isComplete);
    });

    runner.it('should determine winner correctly', () => {
        commands.startGame('red');

        // Play rounds where red consistently scores higher
        // Red gets high-scoring poks (zone 3 = 3 points)
        // Blue gets low-scoring poks (zone 1 = 1 point)
        for (let round = 0; round < 15; round++) {
            if (round > 0) {
                commands.startNextRound();
            }

            // Place all poks for this round
            for (let i = 0; i < 10; i++) {
                const currentRound = gameState.getCurrentRound();
                if (currentRound.isComplete) break;

                let nextPlayer = gameState.getNextPlayer();

                // Red plays in zone 3 (x=10), Blue plays in zone 1 (x=50)
                // This creates consistent 10-point difference per round (15-5 = 10)
                const position = nextPlayer === 'red' ? 10 : 50;
                commands.placePok(nextPlayer, position, 50);
            }

            commands.endRound();

            if (gameState.hasWinner()) {
                break;
            }
        }

        const state = gameState.getState();

        // After enough rounds, red should have won
        assert.ok(gameState.hasWinner());
        const maxScore = Math.max(state.players.red.totalScore, state.players.blue.totalScore);
        assert.greaterThan(maxScore, CONFIG.WINNING_SCORE);
    });
});

runner.describe('Integration - Persistence', () => {
    let eventStore, gameState, commands;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-event-store');
        eventStore = new EventStore();
        gameState = new GameStateProjection(eventStore);
        commands = new CommandHandler(eventStore, gameState);
    });

    runner.it('should save and restore game state', () => {
        // Play some of the game
        commands.startGame('red');

        let nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 30, 50);

        nextPlayer = gameState.getNextPlayer();
        commands.placePok(nextPlayer, 10, 50);

        const stateBefore = gameState.getState();

        // Save
        eventStore.save();

        // Create new instances and load
        const newEventStore = new EventStore();
        const newGameState = new GameStateProjection(newEventStore);

        newEventStore.load();

        const stateAfter = newGameState.getState();

        // Should have restored exactly
        assert.deepEqual(stateAfter, stateBefore);
    });

    runner.it('should handle save/load with many events', () => {
        commands.startGame('red');

        // Generate many events - respecting turn order
        for (let i = 0; i < 10; i++) {  // Reduced from 20 to 10 (each player has 5 poks)
            const round = gameState.getCurrentRound();
            if (round.isComplete) break;

            const nextPlayer = gameState.getNextPlayer();
            commands.placePok(nextPlayer, 30 + i, 50);
        }

        eventStore.save();

        const newEventStore = new EventStore();
        const newGameState = new GameStateProjection(newEventStore);
        newEventStore.load();

        // Should have loaded all events
        assert.lengthOf(newEventStore.events, eventStore.events.length);

        // States should match
        assert.deepEqual(newGameState.getState(), gameState.getState());
    });
});
