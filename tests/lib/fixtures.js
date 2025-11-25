// ============================================
// TEST FIXTURES
// ============================================
// Factory functions for creating isolated test objects
// Ensures each test runs with fresh state

import { EventStore } from '../../js/event-store.js';
import { GameStateProjection } from '../../js/game-state-projection.js';
import { CommandHandler } from '../../js/command-handler.js';
import { CONFIG } from '../../js/config.js';

// Storage key used for all tests - isolated from production
const TEST_STORAGE_KEY = 'pok-test-event-store';

// Store original CONFIG values for restoration
const ORIGINAL_CONFIG = {
    ENABLE_LOGGING: CONFIG.ENABLE_LOGGING
};

/**
 * Creates a fresh EventStore for testing
 * @param {string} [storageKey] - Optional custom storage key
 * @returns {EventStore} Fresh EventStore instance
 */
export function createEventStore(storageKey = TEST_STORAGE_KEY) {
    localStorage.removeItem(storageKey);
    return new EventStore(storageKey);
}

/**
 * Creates a fresh GameStateProjection connected to the provided EventStore
 * @param {EventStore} eventStore - The EventStore to project from
 * @returns {GameStateProjection} Fresh GameStateProjection instance
 */
export function createGameStateProjection(eventStore) {
    return new GameStateProjection(eventStore);
}

/**
 * Creates a fresh CommandHandler for the provided EventStore and GameStateProjection
 * @param {EventStore} eventStore - The EventStore to send commands to
 * @param {GameStateProjection} gameState - The GameStateProjection for state queries
 * @returns {CommandHandler} Fresh CommandHandler instance
 */
export function createCommandHandler(eventStore, gameState) {
    return new CommandHandler(eventStore, gameState);
}

/**
 * Creates a complete test context with all objects needed for testing
 * @param {Object} [options] - Configuration options
 * @param {string} [options.storageKey] - Custom storage key
 * @param {boolean} [options.enableLogging] - Enable logging (default: false)
 * @returns {TestContext} Object containing eventStore, gameState, and commands
 */
export function createTestContext(options = {}) {
    const {
        storageKey = TEST_STORAGE_KEY,
        enableLogging = false
    } = options;

    CONFIG.ENABLE_LOGGING = enableLogging;

    const eventStore = createEventStore(storageKey);
    const gameState = createGameStateProjection(eventStore);
    const commands = createCommandHandler(eventStore, gameState);

    return {
        eventStore,
        gameState,
        commands,
        storageKey
    };
}

/**
 * Creates a test context with a game already started
 * @param {string} startingPlayer - 'red' or 'blue'
 * @param {Object} [options] - Configuration options (same as createTestContext)
 * @returns {TestContext} Object containing eventStore, gameState, and commands
 */
export function createStartedGameContext(startingPlayer = 'red', options = {}) {
    const context = createTestContext(options);
    context.commands.startGame(startingPlayer);
    return context;
}

/**
 * Cleans up test state - call in afterEach
 * @param {Object} [context] - Optional test context to clean up
 */
export function cleanupTestContext(context = {}) {
    const { storageKey = TEST_STORAGE_KEY, eventStore } = context;

    // Clear localStorage
    localStorage.removeItem(storageKey);

    // Clear eventStore subscribers if provided
    if (eventStore && eventStore.subscribers) {
        eventStore.subscribers.clear();
    }

    // Restore original CONFIG values
    CONFIG.ENABLE_LOGGING = ORIGINAL_CONFIG.ENABLE_LOGGING;
}

/**
 * Disables logging for tests - call in beforeEach
 */
export function disableLogging() {
    CONFIG.ENABLE_LOGGING = false;
}

/**
 * Restores logging to original state - call in afterEach
 */
export function restoreLogging() {
    CONFIG.ENABLE_LOGGING = ORIGINAL_CONFIG.ENABLE_LOGGING;
}

/**
 * Clears test storage - call in beforeEach or afterEach
 * @param {string} [storageKey] - Storage key to clear
 */
export function clearTestStorage(storageKey = TEST_STORAGE_KEY) {
    localStorage.removeItem(storageKey);
}

// Export constants for direct use
export { TEST_STORAGE_KEY };
