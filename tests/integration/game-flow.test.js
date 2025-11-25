// ============================================
// GAME FLOW INTEGRATION TESTS
// ============================================

import { EventStore } from '../../js/event-store.js';
import { GameStateProjection } from '../../js/game-state-projection.js';
import { CONFIG } from '../../js/config.js';
import {
    createTestContext,
    cleanupTestContext,
    disableLogging,
    TEST_STORAGE_KEY
} from '../lib/fixtures.js';

const { assert } = window;
const runner = window.testRunner;

runner.describe('Integration - Full Game Flow', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should start game and create first round', () => {
        ctx.commands.startGame('red');
        const state = ctx.gameState.getState();

        assert.ok(state.isStarted);
        assert.lengthOf(state.rounds, 1);
        assert.equal(state.rounds[0].startingPlayerId, 'red');
    });

    runner.it('should place poks and update state', () => {
        ctx.commands.startGame('red');
        ctx.commands.placePok('red', 30, 50);
        ctx.commands.placePok('blue', 10, 50);

        const round = ctx.gameState.getCurrentRound();

        assert.lengthOf(round.poks, 2);
        assert.equal(round.redPoksRemaining, 4);
        assert.equal(round.bluePoksRemaining, 4);
    });

    runner.it('should calculate scores correctly', () => {
        ctx.commands.startGame('red');
        ctx.commands.placePok('red', 10, 50);  // Zone 3 = 3 points
        ctx.commands.placePok('blue', 30, 50); // Zone 2 = 2 points

        const scores = ctx.gameState.getRoundScores();

        assert.equal(scores.red, 3);
        assert.equal(scores.blue, 2);
    });

    runner.it('should complete round and update total scores', () => {
        ctx.commands.startGame('red');

        // Place all poks - respecting turn order (lower score plays first)
        for (let i = 0; i < 5; i++) {
            let nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 30, 50);  // 2 points each

            nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 50, 50); // 1 point each
        }

        ctx.commands.endRound();

        const state = ctx.gameState.getState();

        // Winner gets the difference in points
        assert.ok(state.players.red.totalScore > 0 || state.players.blue.totalScore > 0);
    });

    runner.it('should start new round after previous ends', () => {
        ctx.commands.startGame('red');

        // Complete first round - respecting turn order
        for (let i = 0; i < 5; i++) {
            let nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 30, 50);

            nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 50, 50);
        }

        ctx.commands.endRound();

        // Start second round
        ctx.commands.startNextRound();

        const state = ctx.gameState.getState();

        assert.lengthOf(state.rounds, 2);
        assert.equal(state.currentRoundIndex, 1);
    });

    runner.it('should handle pok removal (undo)', () => {
        ctx.commands.startGame('red');

        let nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 30, 50);

        nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 30, 50);

        const beforeRound = ctx.gameState.getCurrentRound();
        const lastPokId = beforeRound.lastPlacedPokId;
        const lastPlayer = beforeRound.poks.find(p => p.id === lastPokId).playerId;

        ctx.commands.removePok(lastPokId);

        const afterRound = ctx.gameState.getCurrentRound();

        assert.lengthOf(afterRound.poks, 1);
        // Check that the removed player's poks were restored
        const poksRemaining = lastPlayer === 'red' ? afterRound.redPoksRemaining : afterRound.bluePoksRemaining;
        assert.equal(poksRemaining, 5);
    });

    runner.it('should handle table flip and recalculate zones', () => {
        ctx.commands.startGame('red');
        ctx.commands.placePok('red', 50, 19); // Circle 4

        const beforeRound = ctx.gameState.getCurrentRound();
        const beforePok = beforeRound.poks[0];

        assert.equal(beforePok.zoneId, '4');

        ctx.commands.flipTable(true);

        const afterRound = ctx.gameState.getCurrentRound();
        const afterPok = afterRound.poks[0];

        // Should swap to circle 5
        assert.equal(afterPok.zoneId, '5');
    });
});

runner.describe('Integration - Event Sourcing Consistency', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should maintain consistency across multiple calculations', () => {
        ctx.commands.startGame('red');
        ctx.commands.placePok('red', 30, 50);
        ctx.commands.placePok('blue', 10, 50);

        const state1 = ctx.gameState.getState();
        const state2 = ctx.gameState.getState();
        const state3 = ctx.gameState.getState();

        // All calculations should produce same result
        assert.deepEqual(state1, state2);
        assert.deepEqual(state2, state3);
    });

    runner.it('should produce same state from event replay', () => {
        // Do some operations
        ctx.commands.startGame('red');
        ctx.commands.placePok('red', 30, 50);
        ctx.commands.placePok('blue', 10, 50);
        ctx.commands.movePok('pok-1', 50, 50);

        const state1 = ctx.gameState.getState();

        // Create new projection with same event store (uses same test storage key)
        const newProjection = new GameStateProjection(ctx.eventStore);
        const state2 = newProjection.getState();

        // Should produce identical state
        assert.deepEqual(state1, state2);
    });

    runner.it('should handle complex sequence of operations', () => {
        ctx.commands.startGame('red');

        // Place some poks - respecting turn order
        let nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 30, 50);

        nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 10, 50);

        nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 50, 19); // Circle 4

        // Move a pok
        const round1 = ctx.gameState.getCurrentRound();
        ctx.commands.movePok(round1.poks[0].id, 10, 50);

        // Flip table
        ctx.commands.flipTable(true);

        // Remove a pok
        const round2 = ctx.gameState.getCurrentRound();
        ctx.commands.removePok(round2.lastPlacedPokId);

        // Place more poks
        nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 30, 50);

        // State should still be consistent
        const state = ctx.gameState.getState();
        const events = ctx.eventStore.getAllEvents();

        // Verify event count matches state
        const pokPlaced = events.filter(e => e.type === 'POK_PLACED').length;
        const pokRemoved = events.filter(e => e.type === 'POK_REMOVED').length;
        const expectedPoks = pokPlaced - pokRemoved;

        assert.equal(state.rounds[0].poks.length, expectedPoks);
    });
});

runner.describe('Integration - Multi-Round Game', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should play multiple rounds correctly', () => {
        ctx.commands.startGame('red');

        // Round 1 - respecting turn order
        for (let i = 0; i < 5; i++) {
            let nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 10, 50);  // 3 points each

            nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 50, 50); // 1 point each
        }

        ctx.commands.endRound();

        let state = ctx.gameState.getState();

        // Round 2
        ctx.commands.startNextRound();

        for (let i = 0; i < 5; i++) {
            let nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 50, 50);  // 1 point each

            nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 10, 50); // 3 points each
        }

        ctx.commands.endRound();

        state = ctx.gameState.getState();
        // Verify that rounds were played
        assert.lengthOf(state.rounds, 2);
        assert.ok(state.rounds[0].isComplete);
        assert.ok(state.rounds[1].isComplete);
    });

    runner.it('should determine winner correctly', () => {
        ctx.commands.startGame('red');

        // Play rounds where red consistently scores higher
        // Red gets high-scoring poks (zone 3 = 3 points)
        // Blue gets low-scoring poks (zone 1 = 1 point)
        for (let round = 0; round < 15; round++) {
            if (round > 0) {
                ctx.commands.startNextRound();
            }

            // Place all poks for this round
            for (let i = 0; i < 10; i++) {
                const currentRound = ctx.gameState.getCurrentRound();
                if (currentRound.isComplete) break;

                let nextPlayer = ctx.gameState.getNextPlayer();

                // Red plays in zone 3 (x=10), Blue plays in zone 1 (x=50)
                // This creates consistent 10-point difference per round (15-5 = 10)
                const position = nextPlayer === 'red' ? 10 : 50;
                ctx.commands.placePok(nextPlayer, position, 50);
            }

            ctx.commands.endRound();

            if (ctx.gameState.hasWinner()) {
                break;
            }
        }

        const state = ctx.gameState.getState();

        // After enough rounds, red should have won
        assert.ok(ctx.gameState.hasWinner());
        const maxScore = Math.max(state.players.red.totalScore, state.players.blue.totalScore);
        assert.greaterThan(maxScore, CONFIG.WINNING_SCORE);
    });
});

runner.describe('Integration - Persistence', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should save and restore game state', () => {
        // Play some of the game
        ctx.commands.startGame('red');

        let nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 30, 50);

        nextPlayer = ctx.gameState.getNextPlayer();
        ctx.commands.placePok(nextPlayer, 10, 50);

        const stateBefore = ctx.gameState.getState();

        // Save
        ctx.eventStore.save();

        // Create new instances and load (use same test storage key)
        const newEventStore = new EventStore(TEST_STORAGE_KEY);
        const newGameState = new GameStateProjection(newEventStore);

        newEventStore.load();

        const stateAfter = newGameState.getState();

        // Should have restored exactly
        assert.deepEqual(stateAfter, stateBefore);
    });

    runner.it('should handle save/load with many events', () => {
        ctx.commands.startGame('red');

        // Generate many events - respecting turn order
        for (let i = 0; i < 10; i++) {  // Reduced from 20 to 10 (each player has 5 poks)
            const round = ctx.gameState.getCurrentRound();
            if (round.isComplete) break;

            const nextPlayer = ctx.gameState.getNextPlayer();
            ctx.commands.placePok(nextPlayer, 30 + i, 50);
        }

        ctx.eventStore.save();

        const newEventStore = new EventStore(TEST_STORAGE_KEY);
        const newGameState = new GameStateProjection(newEventStore);
        newEventStore.load();

        // Should have loaded all events
        assert.lengthOf(newEventStore.events, ctx.eventStore.events.length);

        // States should match
        assert.deepEqual(newGameState.getState(), ctx.gameState.getState());
    });
});
