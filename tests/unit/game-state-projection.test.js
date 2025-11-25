// ============================================
// GAME STATE PROJECTION UNIT TESTS
// ============================================

import { GameStartedEvent, PokPlacedEvent, PokMovedEvent, PokRemovedEvent, RoundEndedEvent, RoundStartedEvent, TableFlippedEvent, GameResetEvent } from '../../js/events.js';
import { CONFIG } from '../../js/config.js';
import {
    createTestContext,
    createStartedGameContext,
    cleanupTestContext,
    disableLogging,
    TEST_STORAGE_KEY
} from '../lib/fixtures.js';

const { describe, it, assert, beforeEach } = window;
const runner = window.testRunner;

runner.describe('GameStateProjection - Initialization', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should initialize with empty state', () => {
        const state = ctx.gameState.getState();

        assert.notOk(state.isStarted);
        assert.lengthOf(state.rounds, 0);
        assert.equal(state.currentRoundIndex, -1);
        assert.notOk(state.isFlipped);
    });

    runner.it('should have zero scores initially', () => {
        const state = ctx.gameState.getState();

        assert.equal(state.players.red.totalScore, 0);
        assert.equal(state.players.blue.totalScore, 0);
    });

    runner.it('should return null for current round when no game', () => {
        const round = ctx.gameState.getCurrentRound();
        assert.equal(round, null);
    });
});

runner.describe('GameStateProjection - Game Started', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should create first round when game starts', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));
        const state = ctx.gameState.getState();

        assert.ok(state.isStarted);
        assert.lengthOf(state.rounds, 1);
        assert.equal(state.currentRoundIndex, 0);
    });

    runner.it('should set starting player correctly', () => {
        ctx.eventStore.append(new GameStartedEvent('blue'));
        const round = ctx.gameState.getCurrentRound();

        assert.equal(round.startingPlayerId, 'blue');
        assert.equal(round.currentPlayerId, 'blue');
    });

    runner.it('should initialize round with correct pok counts', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));
        const round = ctx.gameState.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.lengthOf(round.poks, 0);
    });
});

runner.describe('GameStateProjection - Pok Placement', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createStartedGameContext('red');
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should add pok to round', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        const round = ctx.gameState.getCurrentRound();

        assert.lengthOf(round.poks, 1);
        assert.equal(round.poks[0].id, 'pok1');
        assert.equal(round.poks[0].playerId, 'red');
    });

    runner.it('should calculate zone and points for placed pok', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50)); // Zone 3
        const round = ctx.gameState.getCurrentRound();
        const pok = round.poks[0];

        assert.equal(pok.zoneId, '3');
        assert.equal(pok.points, 3);
    });

    runner.it('should decrement poks remaining', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        const round = ctx.gameState.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER - 1);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER);
    });

    runner.it('should mark round complete when all poks placed', () => {
        // Place 5 red and 5 blue poks
        for (let i = 0; i < 5; i++) {
            ctx.eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            ctx.eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }

        const round = ctx.gameState.getCurrentRound();
        assert.ok(round.isComplete);
        assert.lengthOf(round.poks, 10);
    });

    runner.it('should track last placed pok', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        ctx.eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));

        const round = ctx.gameState.getCurrentRound();
        assert.equal(round.lastPlacedPokId, 'pok2');
    });
});

runner.describe('GameStateProjection - Pok Movement', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createStartedGameContext('red');
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50)); // Zone 2
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should update pok position', () => {
        ctx.eventStore.append(new PokMovedEvent('pok1', 50, 60));
        const round = ctx.gameState.getCurrentRound();
        const pok = round.poks[0];

        assert.equal(pok.x, 50);
        assert.equal(pok.y, 60);
    });

    runner.it('should recalculate zone and points after move', () => {
        const beforeRound = ctx.gameState.getCurrentRound();
        const beforePok = beforeRound.poks[0];
        const beforeZone = beforePok.zoneId;

        ctx.eventStore.append(new PokMovedEvent('pok1', 10, 50)); // Move to zone 3

        const afterRound = ctx.gameState.getCurrentRound();
        const afterPok = afterRound.poks[0];

        assert.notEqual(afterPok.zoneId, beforeZone);
        assert.equal(afterPok.zoneId, '3');
        assert.equal(afterPok.points, 3);
    });

    runner.it('should handle move of non-existent pok gracefully', () => {
        ctx.eventStore.append(new PokMovedEvent('nonexistent', 50, 50));
        const round = ctx.gameState.getCurrentRound();

        // Should not crash, state should be unchanged
        assert.lengthOf(round.poks, 1);
    });
});

runner.describe('GameStateProjection - Pok Removal', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createStartedGameContext('red');
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        ctx.eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should remove pok from round', () => {
        ctx.eventStore.append(new PokRemovedEvent('pok1'));
        const round = ctx.gameState.getCurrentRound();

        assert.lengthOf(round.poks, 1);
        assert.equal(round.poks[0].id, 'pok2');
    });

    runner.it('should increment poks remaining', () => {
        ctx.eventStore.append(new PokRemovedEvent('pok1'));
        const round = ctx.gameState.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER - 1);
    });

    runner.it('should update last placed pok', () => {
        ctx.eventStore.append(new PokRemovedEvent('pok2')); // Remove last one
        const round = ctx.gameState.getCurrentRound();

        assert.equal(round.lastPlacedPokId, 'pok1');
    });

    runner.it('should mark round incomplete after removal', () => {
        // Complete round
        for (let i = 2; i < 5; i++) {
            ctx.eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            ctx.eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }
        ctx.eventStore.append(new PokPlacedEvent('red4', 'red', 30, 50));
        ctx.eventStore.append(new PokPlacedEvent('blue4', 'blue', 30, 50));

        const completeRound = ctx.gameState.getCurrentRound();
        assert.ok(completeRound.isComplete);

        // Remove a pok
        ctx.eventStore.append(new PokRemovedEvent('blue4'));
        const incompleteRound = ctx.gameState.getCurrentRound();

        assert.notOk(incompleteRound.isComplete);
    });
});

runner.describe('GameStateProjection - Calculated State', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should recalculate state on every query', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));

        const state1 = ctx.gameState.getState();
        const state2 = ctx.gameState.getState();

        // Should be different objects (not cached)
        assert.notEqual(state1, state2, 'States should be different objects');

        // But with same content
        assert.deepEqual(state1, state2);
    });

    runner.it('should always match event log', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        ctx.eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));

        const state = ctx.gameState.getState();
        const events = ctx.eventStore.getAllEvents();

        // Count POK_PLACED events
        const pokPlacedEvents = events.filter(e => e.type === 'POK_PLACED');

        // State should reflect event count
        assert.lengthOf(state.rounds[0].poks, pokPlacedEvents.length);
    });

    runner.it('should handle many recalculations efficiently', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));

        for (let i = 0; i < 10; i++) {
            ctx.eventStore.append(new PokPlacedEvent(`pok${i}`, i % 2 === 0 ? 'red' : 'blue', 30, 50));
        }

        const startTime = performance.now();

        // Calculate state 100 times
        for (let i = 0; i < 100; i++) {
            ctx.gameState.getState();
        }

        const duration = performance.now() - startTime;

        // Should complete in reasonable time (< 50ms for 100 calculations)
        assert.lessThan(duration, 50, `100 calculations took ${duration.toFixed(2)}ms`);
    });
});

runner.describe('GameStateProjection - Score Calculation', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createStartedGameContext('red');
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should calculate round scores correctly', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50));   // Zone 3 = 3 points
        ctx.eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));  // Zone 2 = 2 points

        const scores = ctx.gameState.getRoundScores();

        assert.equal(scores.red, 3);
        assert.equal(scores.blue, 2);
    });

    runner.it('should return zero scores for empty round', () => {
        const scores = ctx.gameState.getRoundScores();

        assert.equal(scores.red, 0);
        assert.equal(scores.blue, 0);
    });

    runner.it('should update total scores after round ends', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50));   // 3 points
        ctx.eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));  // 2 points

        const scores = ctx.gameState.getRoundScores();
        ctx.eventStore.append(new RoundEndedEvent(0, scores.red, scores.blue));

        const state = ctx.gameState.getState();

        // Red won by 1 point
        assert.equal(state.players.red.totalScore, 1);
        assert.equal(state.players.blue.totalScore, 0);
    });
});

runner.describe('GameStateProjection - Table Flip', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createStartedGameContext('red');
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should update flip state', () => {
        ctx.eventStore.append(new TableFlippedEvent(true));
        const state = ctx.gameState.getState();

        assert.ok(state.isFlipped);
    });

    runner.it('should recalculate pok zones after flip', () => {
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 50, 19)); // Circle 4
        const beforeRound = ctx.gameState.getCurrentRound();
        const beforePok = beforeRound.poks[0];

        assert.equal(beforePok.zoneId, '4');

        ctx.eventStore.append(new TableFlippedEvent(true));
        const afterRound = ctx.gameState.getCurrentRound();
        const afterPok = afterRound.poks[0];

        // Circle 4 becomes circle 5 when flipped
        assert.equal(afterPok.zoneId, '5');
        assert.equal(afterPok.points, 5);
    });

    runner.it('should not affect completed rounds', () => {
        // Place all poks and complete round
        for (let i = 0; i < 5; i++) {
            ctx.eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            ctx.eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }

        const scores = ctx.gameState.getRoundScores();
        ctx.eventStore.append(new RoundEndedEvent(0, scores.red, scores.blue));

        // Start new round and flip
        ctx.eventStore.append(new RoundStartedEvent(1, 'red'));
        ctx.eventStore.append(new TableFlippedEvent(true));

        const state = ctx.gameState.getState();

        // Old round should not be flipped
        assert.notOk(state.rounds[0].isFlipped);
        // New round should be flipped
        assert.ok(state.rounds[1].isFlipped);
    });
});

runner.describe('GameStateProjection - Game Reset', () => {
    let ctx;

    runner.beforeEach(() => {
        disableLogging();
        ctx = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(ctx);
    });

    runner.it('should reset to initial state', () => {
        ctx.eventStore.append(new GameStartedEvent('red'));
        ctx.eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        ctx.eventStore.append(new GameResetEvent());

        const state = ctx.gameState.getState();

        assert.notOk(state.isStarted);
        assert.lengthOf(state.rounds, 0);
        assert.equal(state.currentRoundIndex, -1);
        assert.equal(state.players.red.totalScore, 0);
        assert.equal(state.players.blue.totalScore, 0);
    });
});
