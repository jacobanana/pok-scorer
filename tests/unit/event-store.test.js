// ============================================
// EVENT STORE UNIT TESTS
// ============================================

import { EventStore } from '../../js/event-store.js';
import { GameStartedEvent, PokPlacedEvent } from '../../js/events.js';
import { CONFIG } from '../../js/config.js';

const { describe, it, assert, beforeEach } = window;
const runner = window.testRunner;

runner.describe('EventStore - Initialization', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
    });

    runner.it('should initialize with empty events', () => {
        assert.lengthOf(eventStore.events, 0);
        assert.equal(eventStore.version, 0);
    });

    runner.it('should have subscribers map', () => {
        assert.ok(eventStore.subscribers instanceof Map);
    });
});

runner.describe('EventStore - Event Appending', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
    });

    runner.it('should append event and assign version', () => {
        const event = new GameStartedEvent('red');
        eventStore.append(event);

        assert.lengthOf(eventStore.events, 1);
        assert.equal(event.version, 1);
        assert.equal(eventStore.version, 1);
    });

    runner.it('should increment version for each event', () => {
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));

        assert.equal(eventStore.version, 3);
        assert.equal(eventStore.events[0].version, 1);
        assert.equal(eventStore.events[1].version, 2);
        assert.equal(eventStore.events[2].version, 3);
    });

    runner.it('should add timestamp to events', () => {
        const before = Date.now();
        const event = new GameStartedEvent('red');
        const after = Date.now();

        assert.greaterThan(event.timestamp, before - 1);
        assert.lessThan(event.timestamp, after + 1);
    });

    runner.it('should store event data correctly', () => {
        const event = new GameStartedEvent('blue');
        eventStore.append(event);

        const storedEvent = eventStore.events[0];
        assert.equal(storedEvent.type, 'GAME_STARTED');
        assert.equal(storedEvent.data.startingPlayerId, 'blue');
    });
});

runner.describe('EventStore - Pub/Sub', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
    });

    runner.it('should allow subscription to specific event type', () => {
        let called = false;
        const handler = () => { called = true; };

        eventStore.subscribe('GAME_STARTED', handler);
        eventStore.append(new GameStartedEvent('red'));

        assert.ok(called, 'Handler should have been called');
    });

    runner.it('should allow subscription to all events with wildcard', () => {
        let callCount = 0;
        const handler = () => { callCount++; };

        eventStore.subscribe('*', handler);
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));

        assert.equal(callCount, 2, 'Wildcard handler should be called for all events');
    });

    runner.it('should pass event to handler', () => {
        let receivedEvent = null;
        const handler = (event) => { receivedEvent = event; };

        eventStore.subscribe('GAME_STARTED', handler);
        const event = new GameStartedEvent('red');
        eventStore.append(event);

        assert.equal(receivedEvent, event);
    });

    runner.it('should call wildcard handlers before specific handlers', () => {
        const callOrder = [];

        eventStore.subscribe('*', () => callOrder.push('wildcard'));
        eventStore.subscribe('GAME_STARTED', () => callOrder.push('specific'));

        eventStore.append(new GameStartedEvent('red'));

        assert.deepEqual(callOrder, ['wildcard', 'specific']);
    });

    runner.it('should support multiple handlers for same event', () => {
        let count1 = 0;
        let count2 = 0;

        eventStore.subscribe('GAME_STARTED', () => count1++);
        eventStore.subscribe('GAME_STARTED', () => count2++);

        eventStore.append(new GameStartedEvent('red'));

        assert.equal(count1, 1);
        assert.equal(count2, 1);
    });

    runner.it('should allow unsubscribing', () => {
        let called = false;
        const handler = () => { called = true; };

        eventStore.subscribe('GAME_STARTED', handler);
        eventStore.unsubscribe('GAME_STARTED', handler);
        eventStore.append(new GameStartedEvent('red'));

        assert.notOk(called, 'Handler should not be called after unsubscribe');
    });
});

runner.describe('EventStore - Querying Events', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.append(new PokPlacedEvent('pok2', 'blue', 30, 50));
    });

    runner.it('should get all events', () => {
        const events = eventStore.getAllEvents();

        assert.lengthOf(events, 3);
        assert.equal(events[0].type, 'GAME_STARTED');
        assert.equal(events[1].type, 'POK_PLACED');
        assert.equal(events[2].type, 'POK_PLACED');
    });

    runner.it('should get events from version', () => {
        const events = eventStore.getEvents(1);

        assert.lengthOf(events, 2);
        assert.equal(events[0].version, 2);
        assert.equal(events[1].version, 3);
    });

    runner.it('should return empty array when no new events', () => {
        const events = eventStore.getEvents(3);
        assert.lengthOf(events, 0);
    });
});

runner.describe('EventStore - Clear', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        eventStore = new EventStore();
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
    });

    runner.it('should clear all events', () => {
        eventStore.clear();

        assert.lengthOf(eventStore.events, 0);
        assert.equal(eventStore.version, 0);
    });
});

runner.describe('EventStore - Persistence (LocalStorage)', () => {
    let eventStore;

    runner.beforeEach(() => {
        CONFIG.ENABLE_LOGGING = false;
        localStorage.removeItem('pok-event-store');
        eventStore = new EventStore();
    });

    runner.it('should save events to LocalStorage', () => {
        eventStore.append(new GameStartedEvent('red'));
        eventStore.save();

        const saved = localStorage.getItem('pok-event-store');
        assert.ok(saved, 'Should have saved to LocalStorage');

        const data = JSON.parse(saved);
        assert.lengthOf(data.events, 1);
        assert.equal(data.version, 1);
    });

    runner.it('should load events from LocalStorage', () => {
        // Save some events
        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.save();

        // Create new store and load
        const newStore = new EventStore();
        const loaded = newStore.load();

        assert.ok(loaded, 'Should have loaded successfully');
        assert.lengthOf(newStore.events, 2);
        assert.equal(newStore.version, 2);
    });

    runner.it('should return false when no saved data', () => {
        const loaded = eventStore.load();
        assert.notOk(loaded);
    });

    runner.it('should replay events after load', () => {
        let eventCount = 0;
        eventStore.subscribe('*', () => eventCount++);

        eventStore.append(new GameStartedEvent('red'));
        eventStore.append(new PokPlacedEvent('pok1', 'red', 30, 50));
        eventStore.save();

        // Create new store with subscriber
        const newStore = new EventStore();
        let replayCount = 0;
        newStore.subscribe('*', () => replayCount++);

        newStore.load();

        // Should have published: GAME_RESET + 2 replayed events + GAME_LOADED = 4 events
        assert.equal(replayCount, 4);
    });
});
