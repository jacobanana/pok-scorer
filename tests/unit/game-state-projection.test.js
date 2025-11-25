// ============================================
// GAME STATE PROJECTION UNIT TESTS
// ============================================

import { EventStore } from '../../js/event-store.js';
import { GameStateProjection } from '../../js/game-state-projection.js';
import { GameStartedEvent, PokPlacedEvent, PokMovedEvent, PokRemovedEvent, RoundEndedEvent, RoundStartedEvent, TableFlippedEvent, GameResetEvent } from '../../js/events.js';
import { CONFIG } from '../../js/config.js';

const { describe, it, assert, beforeEach } = window;
const runner = window.testRunner;

runner.describe('GameStateProjection - Initialization', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-test-event-store');
        eventStore = new EventStore('pok-test-event-store');
        projection = new GameStateProjection(eventStore);
    });

    runner.it('should initialize with empty state', () => {
        const state = projection.getState();

        assert.notOk(state.isStarted);
        assert.lengthOf(state.rounds, 0);
        assert.equal(state.currentRoundIndex, -1);
        assert.notOk(state.isFlipped);
    });

    runner.it('should have zero scores initially', () => {
        const state = projection.getState();

        assert.equal(state.players.red.totalScore, 0);
        assert.equal(state.players.blue.totalScore, 0);
    });

    runner.it('should return null for current round when no game', () => {
        const round = projection.getCurrentRound();
        assert.equal(round, null);
    });
});

runner.describe('GameStateProjection - Game Started', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-test-event-store');
        eventStore = new EventStore('pok-test-event-store');
        projection = new GameStateProjection(eventStore);
    });

    runner.it('should create first round when game starts', () => {
        eventStore.append(new GameStartedEvent('red'));
        const state = projection.getState();

        assert.ok(state.isStarted);
        assert.lengthOf(state.rounds, 1);
        assert.equal(state.currentRoundIndex, 0);
    });

    runner.it('should set starting player correctly', () => {
        eventStore.append(new GameStartedEvent('blue'));
        const round = projection.getCurrentRound();

        assert.equal(round.startingPlayerId, 'blue');
        assert.equal(round.currentPlayerId, 'blue');
    });

    runner.it('should initialize round with correct pok counts', () => {
        eventStore.append(new GameStartedEvent('red'));
        const round = projection.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.lengthOf(round.poks, 0);
    });
});

runner.describe('GameStateProjection - Pok Placement', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        projection = new GameStateProjection(eventStore);
        eventStore.append(new GameStartedEvent('red'));
    });

    runner.it('should add pok to round', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        const round = projection.getCurrentRound();

        assert.lengthOf(round.poks, 1);
        assert.equal(round.poks[0].id, 'pok1');
        assert.equal(round.poks[0].playerId, 'red');
    });

    runner.it('should calculate zone and points for placed pok', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50)); // Zone 3
        const round = projection.getCurrentRound();
        const pok = round.poks[0];

        assert.equal(pok.zoneId, '3');
        assert.equal(pok.points, 3);
    });

    runner.it('should decrement poks remaining', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        const round = projection.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER - 1);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER);
    });

    runner.it('should mark round complete when all poks placed', () => {
        // Place 5 red and 5 blue poks
        for (let i = 0; i < 5; i++) {
            eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }

        const round = projection.getCurrentRound();
        assert.ok(round.isComplete);
        assert.lengthOf(round.poks, 10);
    });

    runner.it('should track last placed pok', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));

        const round = projection.getCurrentRound();
        assert.equal(round.lastPlacedPokId, 'pok2');
    });
});

runner.describe('GameStateProjection - Pok Movement', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        projection = new GameStateProjection(eventStore);
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50)); // Zone 2
    });

    runner.it('should update pok position', () => {
        eventStore.append(new PokMovedEvent('pok1', 50, 60));
        const round = projection.getCurrentRound();
        const pok = round.poks[0];

        assert.equal(pok.x, 50);
        assert.equal(pok.y, 60);
    });

    runner.it('should recalculate zone and points after move', () => {
        const beforeRound = projection.getCurrentRound();
        const beforePok = beforeRound.poks[0];
        const beforeZone = beforePok.zoneId;

        eventStore.append(new PokMovedEvent('pok1', 10, 50)); // Move to zone 3

        const afterRound = projection.getCurrentRound();
        const afterPok = afterRound.poks[0];

        assert.notEqual(afterPok.zoneId, beforeZone);
        assert.equal(afterPok.zoneId, '3');
        assert.equal(afterPok.points, 3);
    });

    runner.it('should handle move of non-existent pok gracefully', () => {
        eventStore.append(new PokMovedEvent('nonexistent', 50, 50));
        const round = projection.getCurrentRound();

        // Should not crash, state should be unchanged
        assert.lengthOf(round.poks, 1);
    });
});

runner.describe('GameStateProjection - Pok Removal', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        projection = new GameStateProjection(eventStore);
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));
    });

    runner.it('should remove pok from round', () => {
        eventStore.append(new PokRemovedEvent('pok1'));
        const round = projection.getCurrentRound();

        assert.lengthOf(round.poks, 1);
        assert.equal(round.poks[0].id, 'pok2');
    });

    runner.it('should increment poks remaining', () => {
        eventStore.append(new PokRemovedEvent('pok1'));
        const round = projection.getCurrentRound();

        assert.equal(round.redPoksRemaining, CONFIG.POKS_PER_PLAYER);
        assert.equal(round.bluePoksRemaining, CONFIG.POKS_PER_PLAYER - 1);
    });

    runner.it('should update last placed pok', () => {
        eventStore.append(new PokRemovedEvent('pok2')); // Remove last one
        const round = projection.getCurrentRound();

        assert.equal(round.lastPlacedPokId, 'pok1');
    });

    runner.it('should mark round incomplete after removal', () => {
        // Complete round
        for (let i = 2; i < 5; i++) {
            eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }
        eventStore.append(new PokPlacedEvent('red4', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('blue4', 'blue', 30, 50));

        const completeRound = projection.getCurrentRound();
        assert.ok(completeRound.isComplete);

        // Remove a pok
        eventStore.append(new PokRemovedEvent('blue4'));
        const incompleteRound = projection.getCurrentRound();

        assert.notOk(incompleteRound.isComplete);
    });
});

runner.describe('GameStateProjection - Calculated State', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-test-event-store');
        eventStore = new EventStore('pok-test-event-store');
        projection = new GameStateProjection(eventStore);
    });

    runner.it('should recalculate state on every query', () => {
        eventStore.append(new GameStartedEvent('red'));

        const state1 = projection.getState();
        const state2 = projection.getState();

        // Should be different objects (not cached)
        assert.notEqual(state1, state2, 'States should be different objects');

        // But with same content
        assert.deepEqual(state1, state2);
    });

    runner.it('should always match event log', () => {
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));

        const state = projection.getState();
        const events = eventStore.getAllEvents();

        // Count POK_PLACED events
        const pokPlacedEvents = events.filter(e => e.type === 'POK_PLACED');

        // State should reflect event count
        assert.lengthOf(state.rounds[0].poks, pokPlacedEvents.length);
    });

    runner.it('should handle many recalculations efficiently', () => {
        eventStore.append(new GameStartedEvent('red'));

        for (let i = 0; i < 10; i++) {
            eventStore.append(new PokPlacedEvent(`pok${i}`, i % 2 === 0 ? 'red' : 'blue', 30, 50));
        }

        const startTime = performance.now();

        // Calculate state 100 times
        for (let i = 0; i < 100; i++) {
            projection.getState();
        }

        const duration = performance.now() - startTime;

        // Should complete in reasonable time (< 50ms for 100 calculations)
        assert.lessThan(duration, 50, `100 calculations took ${duration.toFixed(2)}ms`);
    });
});

runner.describe('GameStateProjection - Score Calculation', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        projection = new GameStateProjection(eventStore);
        eventStore.append(new GameStartedEvent('red'));
    });

    runner.it('should calculate round scores correctly', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50));   // Zone 3 = 3 points
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));  // Zone 2 = 2 points

        const scores = projection.getRoundScores();

        assert.equal(scores.red, 3);
        assert.equal(scores.blue, 2);
    });

    runner.it('should return zero scores for empty round', () => {
        const scores = projection.getRoundScores();

        assert.equal(scores.red, 0);
        assert.equal(scores.blue, 0);
    });

    runner.it('should update total scores after round ends', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 10, 50));   // 3 points
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));  // 2 points

        const scores = projection.getRoundScores();
        eventStore.append(new RoundEndedEvent(0, scores.red, scores.blue));

        const state = projection.getState();

        // Red won by 1 point
        assert.equal(state.players.red.totalScore, 1);
        assert.equal(state.players.blue.totalScore, 0);
    });
});

runner.describe('GameStateProjection - Table Flip', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        projection = new GameStateProjection(eventStore);
        eventStore.append(new GameStartedEvent('red'));
    });

    runner.it('should update flip state', () => {
        eventStore.append(new TableFlippedEvent(true));
        const state = projection.getState();

        assert.ok(state.isFlipped);
    });

    runner.it('should recalculate pok zones after flip', () => {
        eventStore.append(new PokPlacedEvent('pok1', 'red', 50, 19)); // Circle 4
        const beforeRound = projection.getCurrentRound();
        const beforePok = beforeRound.poks[0];

        assert.equal(beforePok.zoneId, '4');

        eventStore.append(new TableFlippedEvent(true));
        const afterRound = projection.getCurrentRound();
        const afterPok = afterRound.poks[0];

        // Circle 4 becomes circle 5 when flipped
        assert.equal(afterPok.zoneId, '5');
        assert.equal(afterPok.points, 5);
    });

    runner.it('should not affect completed rounds', () => {
        // Place all poks and complete round
        for (let i = 0; i < 5; i++) {
            eventStore.append(new PokPlacedEvent(`red${i}`, 'red', 30, 50));
            eventStore.append(new PokPlacedEvent(`blue${i}`, 'blue', 30, 50));
        }

        const scores = projection.getRoundScores();
        eventStore.append(new RoundEndedEvent(0, scores.red, scores.blue));

        // Start new round and flip
        eventStore.append(new RoundStartedEvent(1, 'red'));
        eventStore.append(new TableFlippedEvent(true));

        const state = projection.getState();

        // Old round should not be flipped
        assert.notOk(state.rounds[0].isFlipped);
        // New round should be flipped
        assert.ok(state.rounds[1].isFlipped);
    });
});

runner.describe('GameStateProjection - Game Reset', () => {
    let eventStore, projection;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-test-event-store');
        eventStore = new EventStore('pok-test-event-store');
        projection = new GameStateProjection(eventStore);
    });

    runner.it('should reset to initial state', () => {
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new GameResetEvent());

        const state = projection.getState();

        assert.notOk(state.isStarted);
        assert.lengthOf(state.rounds, 0);
        assert.equal(state.currentRoundIndex, -1);
        assert.equal(state.players.red.totalScore, 0);
        assert.equal(state.players.blue.totalScore, 0);
    });
});
