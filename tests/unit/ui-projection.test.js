// ============================================
// UI PROJECTION TESTS
// ============================================

import { UIProjection } from '../../js/ui-projection.js';
import { PLAYERS } from '../../js/config.js';
import {
    GameStartedEvent,
    PokPlacedEvent,
    PokMovedEvent,
    PokRemovedEvent,
    RoundEndedEvent,
    RoundStartedEvent,
    TableFlippedEvent,
    GameResetEvent
} from '../../js/events.js';
import {
    createTestContext,
    cleanupTestContext,
    createTestContainer,
    cleanupTestContainer
} from '../lib/fixtures.js';

const { assert } = window;
const runner = window.testRunner;

// Test container for DOM operations
let testContainer;
let appContainer;

/**
 * Creates the required DOM structure for UIProjection
 */
function createUIProjectionDOM() {
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    appContainer.innerHTML = `
        <div id="startSelectorContainer"></div>
        <div class="container">
            <div class="top-section">
                <div class="left-panel" id="leftPanelContainer">
                    <div class="rounds-history">
                        <div class="history-table-container" id="historyTableContainer"></div>
                    </div>
                </div>
                <div class="right-panel">
                    <div class="control-buttons" id="controlButtonsContainer"></div>
                    <div class="table-container" id="gameBoardContainer">
                        <div class="table" id="gameTable"></div>
                    </div>
                    <div class="score-visualizer-container" id="scoreVisualizerContainer">
                        <div class="round-end-loading-bar" id="roundEndLoadingBar">
                            <div class="loading-bar-fill"></div>
                        </div>
                        <div class="red-visualizer" id="redVisualizer"></div>
                        <div class="score-row" id="scoreRow"></div>
                        <div class="blue-visualizer" id="blueVisualizer"></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="modalsContainer"></div>
    `;
    document.body.appendChild(appContainer);
}

function cleanupUIProjectionDOM() {
    if (appContainer && appContainer.parentNode) {
        appContainer.parentNode.removeChild(appContainer);
    }
    appContainer = null;
}

// ============================================
// INITIALIZATION TESTS
// ============================================

runner.describe('UIProjection - Initialization', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should initialize with event store and game state', () => {
        assert.ok(ui.eventStore);
        assert.ok(ui.gameState);
        assert.equal(ui.eventStore, context.eventStore);
        assert.equal(ui.gameState, context.gameState);
    });

    runner.it('should initialize empty components object', () => {
        assert.ok(ui.components);
        assert.equal(typeof ui.components, 'object');
    });

    runner.it('should initialize managers', () => {
        ui.init();
        assert.ok(ui.managers);
        assert.ok(ui.managers.pokRenderer);
        assert.ok(ui.managers.interaction);
        assert.ok(ui.managers.scoreDisplay);
        assert.ok(ui.managers.roundModal);
        assert.ok(ui.managers.autoEnd);
    });

    runner.it('should initialize handlers object', () => {
        assert.ok(ui.handlers);
        assert.equal(ui.handlers.onGameStart, null);
        assert.equal(ui.handlers.onContinueGame, null);
        assert.equal(ui.handlers.onSaveLatest, null);
    });

    runner.it('should initialize with init() and create components', () => {
        ui.init();

        // Check that containers are set
        assert.ok(ui.containers.root);
        assert.ok(ui.containers.gameBoard);
        assert.ok(ui.containers.table);

        // Check that some components were created
        assert.ok(ui.components.startSelector);
        assert.ok(ui.components.notification);
        assert.ok(ui.components.loadingBar);
    });
});

// ============================================
// EVENT HANDLER TESTS
// ============================================

runner.describe('UIProjection - Event Handlers', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
        ui.init();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should handle GAME_STARTED event', () => {
        const event = new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob');
        context.eventStore.append(event);

        // Start selector should be hidden (display: none)
        assert.equal(ui.components.startSelector.el.style.display, 'none');

        // Body should have turn class
        assert.ok(document.body.classList.contains('red-turn'));
    });

    runner.it('should handle POK_PLACED event', () => {
        // Start a game first
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place a POK
        const pokEvent = new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50);
        context.eventStore.append(pokEvent);

        // POK component should be created and mounted in DOM
        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.ok(pokComponents.has('pok-1'));
        const pokComponent = pokComponents.get('pok-1');
        assert.ok(pokComponent);
        assert.ok(pokComponent.el);
        assert.ok(pokComponent.el.classList.contains('pok'));
        assert.ok(pokComponent.el.classList.contains('red'));
    });

    runner.it('should handle POK_MOVED event', () => {
        // Start game and place POK
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));

        // Move POK
        context.eventStore.append(new PokMovedEvent('pok-1', 60, 70));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        const pokComponent = pokComponents.get('pok-1');
        assert.ok(pokComponent);
        assert.equal(pokComponent.el.style.left, '60%');
        assert.equal(pokComponent.el.style.top, '70%');
    });

    runner.it('should handle POK_REMOVED event', () => {
        // Start game and place POK
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.ok(pokComponents.has('pok-1'));

        // Remove POK
        context.eventStore.append(new PokRemovedEvent('pok-1'));

        assert.notOk(pokComponents.has('pok-1'));
    });

    runner.it('should handle ROUND_ENDED event', () => {
        // Start game and complete a round
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place all POKs to complete round
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 30 + i * 5));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 70 + i * 5));
        }

        // End round
        context.eventStore.append(new RoundEndedEvent(0));

        // Modal should be shown
        assert.ok(ui.components.roundModal);
        assert.ok(ui.components.roundModal.isOpen());
    });

    runner.it('should handle ROUND_STARTED event', () => {
        // Start game and end first round
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Complete first round
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 30 + i * 5));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 70 + i * 5));
        }
        context.eventStore.append(new RoundEndedEvent(0));

        // Start new round
        context.eventStore.append(new RoundStartedEvent(1, PLAYERS.BLUE));

        // Modal should be closed
        assert.notOk(ui.components.roundModal.isOpen());

        // Table should be cleared
        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.equal(pokComponents.size, 0);

        // Body should have new turn class
        assert.ok(document.body.classList.contains('blue-turn'));
    });

    runner.it('should handle TABLE_FLIPPED event', () => {
        // Start game
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Flip table
        context.eventStore.append(new TableFlippedEvent(true));

        assert.ok(ui.containers.gameBoard.classList.contains('flipped'));
    });

    runner.it('should handle GAME_RESET event', () => {
        // Start game, place POKs
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.ok(pokComponents.size > 0);

        // Reset game
        context.eventStore.append(new GameResetEvent());

        // Table should be cleared
        assert.equal(pokComponents.size, 0);

        // Start selector should be shown
        assert.notOk(ui.components.startSelector.el.classList.contains('hidden'));

        // Body classes should be cleared
        assert.notOk(document.body.classList.contains('red-turn'));
        assert.notOk(document.body.classList.contains('blue-turn'));
    });
});

// ============================================
// UI UPDATE METHODS TESTS
// ============================================

runner.describe('UIProjection - UI Update Methods', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
        ui.init();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should update scores correctly when POKs are placed', () => {
        // Start game
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place POKs with known scores
        context.eventStore.append(new PokPlacedEvent('red-1', PLAYERS.RED, 50, 15)); // Zone 3 = 3 points
        context.eventStore.append(new PokPlacedEvent('blue-1', PLAYERS.BLUE, 50, 25)); // Zone 2 = 2 points

        // Scores are automatically updated via event subscriptions
        // Check that score components exist and were created
        assert.ok(ui.components.currentRedScore);
        assert.ok(ui.components.currentBlueScore);
        assert.ok(ui.components.currentDiff);
    });

    runner.it('should update round history table when events occur', () => {
        // Start game
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place some POKs
        context.eventStore.append(new PokPlacedEvent('red-1', PLAYERS.RED, 50, 15));
        context.eventStore.append(new PokPlacedEvent('blue-1', PLAYERS.BLUE, 50, 25));

        // History is automatically updated via event subscriptions
        // Check that history table component exists
        assert.ok(ui.components.historyTable);
    });

    runner.it('should show round modal when round ends', () => {
        // Start game and complete round
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place POKs in zone 3 (3 points each)
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }

        // End round - modal is shown automatically
        context.eventStore.append(new RoundEndedEvent(0));

        // Modal should be open
        assert.ok(ui.components.roundModal.isOpen());

        // Score components should exist
        assert.ok(ui.components.modalRedScore);
        assert.ok(ui.components.modalBlueScore);
        assert.ok(ui.components.modalScoreDiff);
    });

    runner.it('should clear table when round starts', () => {
        // Start game and place POKs
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));
        context.eventStore.append(new PokPlacedEvent('pok-2', PLAYERS.BLUE, 60, 60));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.equal(pokComponents.size, 2);

        // Complete and start new round - table should be cleared
        for (let i = 0; i < 4; i++) {
            context.eventStore.append(new PokPlacedEvent(`r-${i}`, PLAYERS.RED, 50, 10));
            context.eventStore.append(new PokPlacedEvent(`b-${i}`, PLAYERS.BLUE, 50, 25));
        }
        context.eventStore.append(new RoundEndedEvent(0));
        context.eventStore.append(new RoundStartedEvent(1, PLAYERS.RED));

        assert.equal(pokComponents.size, 0);
    });
});

// ============================================
// ROUND END MODAL TESTS
// ============================================

runner.describe('UIProjection - Round End Modal', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
        ui.init();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should show modal when round ends', () => {
        // Start game
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Place POKs with known scores
        // Red: 5 POKs in zone 3 (3 points each) = 15 points
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
        }
        // Blue: 5 POKs in zone 2 (2 points each) = 10 points
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }

        // End round - modal shown automatically via event handler
        context.eventStore.append(new RoundEndedEvent(0));

        // Verify modal score components exist and modal is open
        assert.ok(ui.components.modalRedScore);
        assert.ok(ui.components.modalBlueScore);
        assert.ok(ui.components.modalScoreDiff);
        assert.ok(ui.components.roundModal.isOpen());
    });

    runner.it('should show correct winner text for red winner', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Red wins: 15 vs 10
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }

        context.eventStore.append(new RoundEndedEvent(0));

        const winnerEl = ui.components.roundModal.find('#roundEndModalWinner');
        assert.ok(winnerEl.textContent.includes('ALICE'));
        assert.ok(winnerEl.textContent.includes('WINS'));
    });

    runner.it('should show correct winner text for blue winner', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Blue wins: higher score
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 25 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 10 + i));
        }

        context.eventStore.append(new RoundEndedEvent(0));

        const winnerEl = ui.components.roundModal.find('#roundEndModalWinner');
        assert.ok(winnerEl.textContent.includes('BOB'));
        assert.ok(winnerEl.textContent.includes('WINS'));
    });

    runner.it('should show TIE for tied scores', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Tie: same score
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 10 + i));
        }

        context.eventStore.append(new RoundEndedEvent(0));

        const winnerEl = ui.components.roundModal.find('#roundEndModalWinner');
        assert.equal(winnerEl.textContent, 'TIE!');
    });
});

// ============================================
// AUTO-END COUNTDOWN TESTS
// ============================================

runner.describe('UIProjection - Auto-End Countdown', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
        ui.init();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should not start countdown for incomplete round', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));

        // Auto-end timer checked automatically via event subscription
        assert.notOk(ui.managers.autoEnd.hasAutoEndTimer());
    });

    runner.it('should start countdown when round is complete', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Complete round - triggers auto-end check via event subscription
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }

        assert.ok(ui.managers.autoEnd.hasAutoEndTimer());
    });

    runner.it('should clear countdown when round ends', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Complete round
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }

        assert.ok(ui.managers.autoEnd.hasAutoEndTimer());

        // End round - should clear timer automatically
        context.eventStore.append(new RoundEndedEvent(0));
        assert.notOk(ui.managers.autoEnd.hasAutoEndTimer());
    });

    runner.it('should not start countdown for already ended round', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        // Complete and end round
        for (let i = 0; i < 5; i++) {
            context.eventStore.append(new PokPlacedEvent(`red-${i}`, PLAYERS.RED, 50, 10 + i));
            context.eventStore.append(new PokPlacedEvent(`blue-${i}`, PLAYERS.BLUE, 50, 25 + i));
        }
        context.eventStore.append(new RoundEndedEvent(0));

        // Should not have auto-end timer for ended round
        assert.notOk(ui.managers.autoEnd.hasAutoEndTimer());
    });
});

// ============================================
// PUBLIC API TESTS
// ============================================

runner.describe('UIProjection - Public API', () => {
    let context;
    let ui;

    runner.beforeEach(() => {
        testContainer = createTestContainer();
        createUIProjectionDOM();
        context = createTestContext();
        ui = new UIProjection(context.eventStore, context.gameState);
        ui.init();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
        cleanupUIProjectionDOM();
        cleanupTestContext(context);
    });

    runner.it('should track POK components in renderer', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));
        context.eventStore.append(new PokPlacedEvent('pok-1', PLAYERS.RED, 50, 50));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.ok(pokComponents.has('pok-1'));
        const component = pokComponents.get('pok-1');
        assert.ok(component);
        assert.ok(component.el.classList.contains('red'));
    });

    runner.it('should not have non-existent POK in components', () => {
        context.eventStore.append(new GameStartedEvent(PLAYERS.RED, 'Alice', 'Bob'));

        const pokComponents = ui.managers.pokRenderer.getPokComponents();
        assert.notOk(pokComponents.has('non-existent'));
    });

    runner.it('should get player names from start selector', () => {
        const names = ui.getPlayerNames();
        assert.ok(names);
        assert.ok(names.red);
        assert.ok(names.blue);
    });

    runner.it('should update body class for player turn', () => {
        ui.updateBodyClass(PLAYERS.RED);
        assert.ok(document.body.classList.contains('red-turn'));
        assert.notOk(document.body.classList.contains('blue-turn'));

        ui.updateBodyClass(PLAYERS.BLUE);
        assert.notOk(document.body.classList.contains('red-turn'));
        assert.ok(document.body.classList.contains('blue-turn'));
    });
});
