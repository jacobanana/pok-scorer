// ============================================
// UI PROJECTION V2 - Component-based Architecture
// ============================================

import { CONFIG, PLAYERS } from './config.js';
import { ScoringService } from './scoring-service.js';
import {
    FlipButton,
    HistoryButton,
    NewGameButton,
    SaveButton,
    RoundEndModal,
    ScoreCircle,
    ModalScoreCircle,
    ScoreMarkers,
    ModalScoreMarkers,
    ScoreDifference,
    ModalScoreDifference,
    Pok,
    HistoryTable,
    Notification,
    LoadingBar,
    StartSelector
} from './components/index.js';

// Event categories for automatic UI updates
const EVENT_CATEGORIES = {
    // Events that affect score display
    SCORE: ['POK_PLACED', 'POK_MOVED', 'POK_REMOVED', 'ROUND_ENDED', 'ROUND_STARTED', 'TABLE_FLIPPED', 'GAME_RESET', 'GAME_STARTED', 'GAME_LOADED'],
    // Events that affect round history
    HISTORY: ['POK_PLACED', 'POK_MOVED', 'POK_REMOVED', 'ROUND_ENDED', 'ROUND_STARTED', 'TABLE_FLIPPED', 'GAME_RESET', 'GAME_STARTED', 'GAME_LOADED'],
    // Events that affect turn indicator
    TURN: ['POK_PLACED', 'POK_MOVED', 'POK_REMOVED'],
    // Events that affect history table headers (player names)
    HEADERS: ['GAME_STARTED', 'GAME_LOADED']
};

/**
 * UIProjection V2 - Refactored to use the component system
 *
 * This class orchestrates UI components instead of directly manipulating DOM.
 * Components handle their own rendering and state management.
 */
export class UIProjection {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;

        // Event handlers (set by main app via setHandlers)
        this.handlers = {
            onGameStart: null,
            onContinueGame: null,
            onSaveLatest: null,
            onImport: null,
            onFlipTable: null,
            onNewGame: null,
            onExportMatch: null,
            onAutoEndRound: null,  // Called when auto-end countdown completes
            onAdvanceGame: null,   // Called when modal is clicked to advance the game
            onPlacePok: null,      // Called when user clicks to place a POK
            onMovePok: null,       // Called when user drags a POK
            onRemovePok: null      // Called when user clicks to remove a POK
        };

        // Auto-end timer state
        this._autoEndTimer = null;

        // Drag/drop state
        this.isDragging = false;
        this.draggedPokId = null;
        this._dragImage = null;

        // Component references
        this.components = {
            startSelector: null,
            historyTable: null,
            historyModalTable: null,
            notification: null,
            loadingBar: null,
            roundModal: null,
            historyModal: null,
            redScoreMarkers: null,
            blueScoreMarkers: null,
            modalRedMarkers: null,
            modalBlueMarkers: null,
            modalRedScore: null,
            modalBlueScore: null,
            modalScoreDiff: null,
            currentRedScore: null,
            currentBlueScore: null,
            currentDiff: null,
            buttons: {}
        };

        // POK components map (pokId -> Pok component)
        this.pokComponents = new Map();

        // DOM container references (minimal)
        this.containers = {};

        // Subscribe to specific event handlers
        eventStore.subscribe('GAME_STARTED', (e) => this.onGameStarted(e));
        eventStore.subscribe('GAME_LOADED', (e) => this.onGameLoaded(e));
        eventStore.subscribe('POK_PLACED', (e) => this.onPokPlaced(e));
        eventStore.subscribe('POK_MOVED', (e) => this.onPokMoved(e));
        eventStore.subscribe('POK_REMOVED', (e) => this.onPokRemoved(e));
        eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
        eventStore.subscribe('ROUND_STARTED', (e) => this.onRoundStarted(e));
        eventStore.subscribe('TABLE_FLIPPED', (e) => this.onTableFlipped(e));
        eventStore.subscribe('GAME_RESET', (e) => this.onGameReset(e));

        // Subscribe to category-based automatic updates
        this._subscribeToCategories(eventStore);
    }

    /**
     * Subscribe to event categories for automatic UI updates
     * @private
     */
    _subscribeToCategories(eventStore) {
        EVENT_CATEGORIES.SCORE.forEach(eventType => {
            eventStore.subscribe(eventType, () => this.updateScores());
        });

        EVENT_CATEGORIES.HISTORY.forEach(eventType => {
            eventStore.subscribe(eventType, () => this.updateRoundsHistory());
        });

        EVENT_CATEGORIES.TURN.forEach(eventType => {
            eventStore.subscribe(eventType, () => this.updateNextPlayerTurn());
        });

        EVENT_CATEGORIES.HEADERS.forEach(eventType => {
            eventStore.subscribe(eventType, () => this.updateHistoryHeaders());
        });
    }

    /**
     * Initialize the UI - create all components and mount them
     */
    init() {
        // Get container references
        this.containers = {
            root: document.getElementById('app'),
            startSelector: document.getElementById('startSelectorContainer'),
            gameBoard: document.getElementById('gameBoardContainer'),
            table: document.querySelector('.table'),
            scoreVisualizer: document.getElementById('scoreVisualizerContainer'),
            leftPanel: document.getElementById('leftPanelContainer'),
            modals: document.getElementById('modalsContainer')
        };

        // Create components
        this._createComponents();

        // Set up interaction handlers
        this._setupInteractionHandlers();
    }

    /**
     * Create all UI components
     * @private
     */
    _createComponents() {
        // Start Selector
        this.components.startSelector = new StartSelector({
            id: 'gameStartSelector'
        });

        if (this.containers.startSelector) {
            this.components.startSelector.mount(this.containers.startSelector);
            // Listen to component events
            this.components.startSelector
                .on('start', (e) => this._handleGameStart(e.detail.playerId))
                .on('continue', () => this._handleContinueGame())
                .on('saveLatest', () => this._handleSaveLatest())
                .on('import', () => this._handleImport());
        }

        // History Table (main panel)
        this.components.historyTable = new HistoryTable({
            id: 'roundsHistoryTable',
            bodyId: 'roundsHistoryTableBody',
            redHeaderId: 'historyHeaderRed',
            blueHeaderId: 'historyHeaderBlue'
        });

        const historyContainer = this.containers.leftPanel?.querySelector('.history-table-container');
        if (historyContainer) {
            this.components.historyTable.mount(historyContainer);
            // Listen to component events
            this.components.historyTable
                .on('rowHover', (e) => this.showRoundPreview(e.detail.index))
                .on('rowLeave', () => this.hideRoundPreview());
        }

        // Turn Notification
        this.components.notification = new Notification({
            id: 'playerTurnNotification'
        });

        if (this.containers.gameBoard) {
            this.components.notification.mount(this.containers.gameBoard, 'prepend');
        }

        // Score Markers - bind to existing DOM elements (already in HTML)
        this.components.redScoreMarkers = new ScoreMarkers({
            color: PLAYERS.RED,
            id: 'redScoreMarkers'
        });

        this.components.blueScoreMarkers = new ScoreMarkers({
            color: PLAYERS.BLUE,
            id: 'blueScoreMarkers'
        });

        // Bind to existing score visualizer elements in the HTML
        const redVisualizer = this.containers.scoreVisualizer?.querySelector('.red-visualizer');
        const blueVisualizer = this.containers.scoreVisualizer?.querySelector('.blue-visualizer');

        if (redVisualizer) this.components.redScoreMarkers.bindTo(redVisualizer);
        if (blueVisualizer) this.components.blueScoreMarkers.bindTo(blueVisualizer);

        // Current Round Score Display
        this.components.currentRedScore = new ScoreCircle({
            color: PLAYERS.RED,
            id: 'currentRoundScoreRed'
        });

        this.components.currentBlueScore = new ScoreCircle({
            color: PLAYERS.BLUE,
            id: 'currentRoundScoreBlue'
        });

        this.components.currentDiff = new ScoreDifference({
            id: 'currentRoundScoreDifference'
        });

        // Mount current round score components
        const scoreRow = this.containers.scoreVisualizer?.querySelector('.score-row');
        if (scoreRow) {
            this.components.currentRedScore.mount(scoreRow);
            this.components.currentDiff.mount(scoreRow);
            this.components.currentBlueScore.mount(scoreRow);
        }

        // Loading Bar - bind to existing DOM element
        this.components.loadingBar = new LoadingBar({
            id: 'roundEndLoadingBar'
        });

        // Bind to existing loading bar element in HTML
        const loadingBarEl = this.containers.scoreVisualizer?.querySelector('.round-end-loading-bar');
        if (loadingBarEl) {
            this.components.loadingBar.bindTo(loadingBarEl);
        }

        // Control Buttons
        this._createControlButtons();

        // Round End Modal
        this._createRoundModal();

        // History Modal event listeners
        this._setupHistoryModal();
    }

    /**
     * Set up history modal close handlers
     * @private
     */
    _setupHistoryModal() {
        const closeButton = document.getElementById('closeHistoryButton');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.hideHistoryModal());
        }

        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    this.hideHistoryModal();
                }
            });
        }
    }

    /**
     * Set up round end modal click handler to advance the game
     * @private
     */
    _setupRoundModalAdvance() {
        const roundEndModal = document.getElementById('roundEndModal');
        if (roundEndModal) {
            roundEndModal.addEventListener('click', () => {
                this.clearAutoEndTimer();
                this.handlers.onAdvanceGame?.();
            });
        }
    }

    /**
     * Create control buttons
     * @private
     */
    _createControlButtons() {
        // Control buttons are siblings of gameBoardContainer, inside right-panel
        const buttonContainer = document.querySelector('.right-panel .control-buttons');
        if (!buttonContainer) return;

        this.components.buttons.flip = new FlipButton({
            id: 'flipTableButton',
            text: 'Flip Table'
        }).onClick(() => this._handleFlipTable());

        this.components.buttons.history = new HistoryButton({
            id: 'showHistoryButton',
            text: 'Show History'
        }).onClick(() => this._handleShowHistory());

        this.components.buttons.newGame = new NewGameButton({
            id: 'newGameButton',
            text: 'New Game'
        }).onClick(() => this._handleNewGame());

        this.components.buttons.save = new SaveButton({
            id: 'exportMatchButton',
            text: 'Save Game'
        }).onClick(() => this._handleExportMatch());

        // Mount all buttons
        Object.values(this.components.buttons).forEach(btn => {
            btn.mount(buttonContainer);
        });
    }

    /**
     * Create the round end modal
     * @private
     */
    _createRoundModal() {
        this.components.roundModal = new RoundEndModal({ id: 'roundEndModal' });

        if (this.containers.modals) {
            this.components.roundModal.mount(this.containers.modals);

            // Create modal score components
            const modalScoreDisplay = this.components.roundModal.getScoreDisplay();
            if (modalScoreDisplay) {
                this.components.modalRedScore = new ModalScoreCircle({ color: PLAYERS.RED, id: 'roundEndModalRedScore' });
                this.components.modalRedScore.mount(modalScoreDisplay);

                this.components.modalScoreDiff = new ModalScoreDifference({ id: 'roundEndModalScoreDiff' });
                this.components.modalScoreDiff.mount(modalScoreDisplay);

                this.components.modalBlueScore = new ModalScoreCircle({ color: PLAYERS.BLUE, id: 'roundEndModalBlueScore' });
                this.components.modalBlueScore.mount(modalScoreDisplay);
            }

            // Create modal score markers
            this.components.modalRedMarkers = new ModalScoreMarkers({ color: PLAYERS.RED, id: 'modalRedScoreMarkers' });
            this.components.modalBlueMarkers = new ModalScoreMarkers({ color: PLAYERS.BLUE, id: 'modalBlueScoreMarkers' });

            const redContainer = this.components.roundModal.getRedMarkersContainer();
            const blueContainer = this.components.roundModal.getBlueMarkersContainer();

            if (redContainer) this.components.modalRedMarkers.mount(redContainer);
            if (blueContainer) this.components.modalBlueMarkers.mount(blueContainer);

            // Set up modal click handler to advance the game
            this._setupRoundModalAdvance();
        }
    }

    // ==========================================
    // Interaction Handlers
    // ==========================================

    /**
     * Set up all user interaction handlers (drag/drop, click, touch, etc.)
     * @private
     */
    _setupInteractionHandlers() {
        this._setupClickToPlace();
        this._setupDragAndDrop();
        this._setupTouchEvents();
        this._setupBoundaryHighlight();
    }

    /**
     * Set up click-to-place POK functionality
     * @private
     */
    _setupClickToPlace() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        tableContainer.addEventListener('click', (event) => {
            if (this.isDragging) return;

            // Don't place POK if we clicked on an existing POK element
            if (event.target.classList.contains('pok')) {
                return;
            }

            const round = this.gameState.getCurrentRound();
            if (!round || this.gameState.isRoundComplete(round)) return;

            const pos = this._calculateTablePosition(event);
            this.handlers.onPlacePok?.(pos.x, pos.y);
        });
    }

    /**
     * Set up drag and drop for POKs
     * @private
     */
    _setupDragAndDrop() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        // Drag start
        tableContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('pok')) {
                this.isDragging = true;
                this.draggedPokId = this._findPokIdByElement(e.target);
                e.target.classList.add('dragging');

                // Create a custom drag image (clone positioned off-screen)
                this._dragImage = e.target.cloneNode(true);
                this._dragImage.style.opacity = '0.8';
                this._dragImage.style.position = 'absolute';
                this._dragImage.style.top = '-1000px';
                document.body.appendChild(this._dragImage);
                e.dataTransfer.setDragImage(this._dragImage,
                    e.target.offsetWidth / 2,
                    e.target.offsetHeight / 2);

                e.dataTransfer.effectAllowed = 'move';
            }
        });

        // Drag end
        tableContainer.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('pok')) {
                e.target.classList.remove('dragging');
                this.isDragging = false;
                this.draggedPokId = null;

                // Clean up drag image
                this._dragImage?.remove();
                this._dragImage = null;

                // Clear boundary highlights
                const zones = document.querySelectorAll('.zone, .circle-zone');
                zones.forEach(zone => {
                    zone.classList.remove('boundary-highlight');
                });
            }
        });

        // Drag over
        tableContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move'; // Show move cursor, not copy

            // Show boundary highlighting while dragging
            if (this.isDragging) {
                const pos = this._calculateTablePosition(e);
                this._highlightBoundaryZone(pos.x, pos.y);
            }
        });

        // Drop
        tableContainer.addEventListener('drop', (e) => {
            e.preventDefault();

            if (this.draggedPokId) {
                const pos = this._calculateTablePosition(e);
                this.handlers.onMovePok?.(this.draggedPokId, pos.x, pos.y);
            }
        });

        // Click on POK (undo) - only allow clicking on last-placed POK
        tableContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pok') && e.target.classList.contains('last-placed')) {
                e.stopPropagation(); // Prevent placePok from firing
                const pokId = this._findPokIdByElement(e.target);
                this.handlers.onRemovePok?.(pokId);
            }
        });
    }

    /**
     * Set up touch events for mobile
     * @private
     */
    _setupTouchEvents() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        let touchStartPos = null;
        let touchedPokId = null;
        let touchedElement = null;
        let hasMoved = false;

        tableContainer.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.pok');
            if (target) {
                e.preventDefault();
                touchedPokId = this._findPokIdByElement(target);
                touchedElement = target;
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });

        tableContainer.addEventListener('touchmove', (e) => {
            if (touchedPokId && touchedElement) {
                e.preventDefault();

                const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);

                if (dx > 5 || dy > 5) {
                    hasMoved = true;
                    this.isDragging = true;
                    touchedElement.classList.add('dragging');

                    // Update POK visual position during drag
                    const pos = this._calculateTablePosition(e.touches[0]);
                    touchedElement.style.left = `${pos.x}%`;
                    touchedElement.style.top = `${pos.y}%`;

                    // Show boundary zone highlighting
                    this._highlightBoundaryZone(pos.x, pos.y);
                }
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                if (hasMoved) {
                    // Drag: move POK to final position
                    const pos = this._calculateTablePosition(e.changedTouches[0]);
                    touchedElement.classList.remove('dragging');
                    this.handlers.onMovePok?.(touchedPokId, pos.x, pos.y);
                } else {
                    // Tap: undo if last placed
                    const target = e.target.closest('.pok');
                    if (target && target.classList.contains('last-placed')) {
                        e.stopPropagation(); // Prevent placePok from firing
                        this.handlers.onRemovePok?.(touchedPokId);
                    }
                }

                // Clear boundary highlights
                const zones = document.querySelectorAll('.zone, .circle-zone');
                zones.forEach(zone => {
                    zone.classList.remove('boundary-highlight');
                });

                touchedPokId = null;
                touchedElement = null;
                touchStartPos = null;
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });
    }

    /**
     * Set up boundary zone highlighting on mouse move
     * @private
     */
    _setupBoundaryHighlight() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        tableContainer.addEventListener('mousemove', (e) => {
            // Don't show boundary highlight if dragging (handled in dragover)
            if (this.isDragging) return;

            // Don't show boundary highlight if clicking on existing POK
            if (e.target.classList.contains('pok')) return;

            const round = this.gameState.getCurrentRound();
            if (!round || round.isComplete) return;

            // Calculate position
            const pos = this._calculateTablePosition(e);

            // Highlight boundary zone
            this._highlightBoundaryZone(pos.x, pos.y);
        });

        tableContainer.addEventListener('mouseleave', () => {
            // Remove all boundary highlights when mouse leaves table
            const zones = document.querySelectorAll('.zone, .circle-zone');
            zones.forEach(zone => {
                zone.classList.remove('boundary-highlight');
            });
        });
    }

    /**
     * Highlight the boundary zone at a given position
     * @private
     */
    _highlightBoundaryZone(x, y) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        const isFlipped = round.isFlipped;
        const zoneInfo = ScoringService.getZoneInfo(x, y, isFlipped);

        const zones = document.querySelectorAll('.zone, .circle-zone');
        zones.forEach(zone => {
            const zoneId = zone.getAttribute('data-zone');
            zone.classList.remove('boundary-highlight');

            if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                zone.classList.add('boundary-highlight');
            }
        });
    }

    /**
     * Calculate table position from event
     * @private
     */
    _calculateTablePosition(event) {
        const tableElement = this.containers.table;
        if (!tableElement) return { x: 0, y: 0 };

        const rect = tableElement.getBoundingClientRect();

        const clientX = event.clientX !== undefined ? event.clientX : event.changedTouches?.[0]?.clientX;
        const clientY = event.clientY !== undefined ? event.clientY : event.changedTouches?.[0]?.clientY;

        let x = clientX - rect.left;
        const y = clientY - rect.top;

        // Account for table flip
        const state = this.gameState.getState();
        if (state.isFlipped) {
            x = rect.width - x;
        }

        return {
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100
        };
    }

    /**
     * Find POK ID by DOM element
     * @private
     */
    _findPokIdByElement(element) {
        // Find pokId by matching position (hacky but works)
        const left = parseFloat(element.style.left);
        const top = parseFloat(element.style.top);

        const round = this.gameState.getCurrentRound();
        if (!round) return null;

        const pok = round.poks.find(p =>
            Math.abs(p.x - left) < 0.1 && Math.abs(p.y - top) < 0.1
        );

        return pok?.id;
    }

    // ==========================================
    // Event Handlers
    // ==========================================

    onGameStarted(event) {
        this.hideStartSelector();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
    }

    onGameLoaded(event) {
        this.hideStartSelector();
        // Update body class for current player
        const round = this.gameState.getCurrentRound();
        if (round) {
            this.updateBodyClass(round.currentPlayerId);
        }
    }

    onPokPlaced(event) {
        const pok = this.findPok(event.data.pokId);
        if (!pok) return;

        // Check if POK already exists
        if (this.pokComponents.has(pok.id)) return;

        // Calculate zone info on-demand
        const round = this.gameState.getCurrentRound();
        const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);

        // Create POK component
        const pokComponent = new Pok({
            id: pok.id,
            playerId: pok.playerId,
            points: zoneInfo.points,
            x: pok.x,
            y: pok.y,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone,
            isLastPlaced: true
        });

        // Clear previous last-placed highlights
        this._clearLastPlacedHighlight();

        // Mount and track
        if (this.containers.table) {
            pokComponent.mount(this.containers.table);
        }
        this.pokComponents.set(pok.id, pokComponent);
    }

    onPokMoved(event) {
        const pok = this.findPok(event.data.pokId);
        const pokComponent = this.pokComponents.get(event.data.pokId);

        if (!pok || !pokComponent) return;

        // Calculate zone info on-demand
        const round = this.gameState.getCurrentRound();
        const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);

        // Update component with new data
        pokComponent.updateFromData({
            x: pok.x,
            y: pok.y,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        });
    }

    onPokRemoved(event) {
        const pokComponent = this.pokComponents.get(event.data.pokId);
        if (!pokComponent) return;

        pokComponent.unmount();
        this.pokComponents.delete(event.data.pokId);

        // Highlight new last placed
        this._updateLastPlacedHighlight();
    }

    onRoundEnded(event) {
        // Clear any auto-end timer/loading bar since the round has ended
        this.clearAutoEndTimer();
        this.showRoundModal(event);
    }

    onRoundStarted(event) {
        this.hideRoundModal();
        this.clearTable();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
    }

    onTableFlipped(event) {
        this.containers.gameBoard?.classList.toggle('flipped', event.data.isFlipped);
        this._swapCircleZoneDOMPositions(event.data.isFlipped);

        // Update all POK components with recalculated zone info
        const round = this.gameState.getCurrentRound();
        if (round) {
            round.poks.forEach(pok => {
                const pokComponent = this.pokComponents.get(pok.id);
                if (pokComponent) {
                    const zoneInfo = this.gameState.getPokZoneInfo(pok, event.data.isFlipped);
                    pokComponent.updateFromData({
                        points: zoneInfo.points,
                        isHigh: zoneInfo.isHigh,
                        boundaryZone: zoneInfo.boundaryZone
                    });
                }
            });
        }
    }

    onGameReset(event) {
        this.clearTable();
        this.hideRoundModal();

        // Reset flip state
        this.containers.gameBoard?.classList.remove('flipped');
        this._swapCircleZoneDOMPositions(false);

        // Reset score markers
        this.components.redScoreMarkers?.reset();
        this.components.blueScoreMarkers?.reset();

        // Reset body classes
        document.body.className = '';

        // Clear and reset start selector
        this.components.startSelector?.setPlayerName(PLAYERS.RED, '');
        this.components.startSelector?.setPlayerName(PLAYERS.BLUE, '');

        // Reset history headers
        this.components.historyTable?.setPlayerNames(PLAYERS.RED, PLAYERS.BLUE);

        // Reset drag state
        this.isDragging = false;
        this.draggedPokId = null;
        this._dragImage?.remove();
        this._dragImage = null;

        this.showStartSelector();
    }

    // ==========================================
    // UI Update Methods
    // ==========================================

    updateScores() {
        const state = this.gameState.getState();
        const round = this.gameState.getCurrentRound();

        // Update score markers
        this.components.redScoreMarkers?.setScore(state.players.red.totalScore);
        this.components.blueScoreMarkers?.setScore(state.players.blue.totalScore);

        // Update end POK indicators
        const endPokRed = document.getElementById('endPokScoreRed');
        const endPokBlue = document.getElementById('endPokScoreBlue');
        if (endPokRed) endPokRed.textContent = state.players.red.totalScore;
        if (endPokBlue) endPokBlue.textContent = state.players.blue.totalScore;

        if (round) {
            const scores = this.gameState.getRoundScores();

            // Update current round score display
            this.components.currentRedScore?.setScore(scores.red);
            this.components.currentBlueScore?.setScore(scores.blue);

            const diff = Math.abs(scores.red - scores.blue);
            this.components.currentDiff?.setDifference(diff > 0 ? `+${diff}` : '0');

            // Update background color class
            const scoreDisplay = document.getElementById('currentRoundScoreDisplay');
            if (scoreDisplay) {
                scoreDisplay.classList.remove('red-leading', 'blue-leading', 'tied');
                if (scores.red > scores.blue) {
                    scoreDisplay.classList.add('red-leading');
                } else if (scores.blue > scores.red) {
                    scoreDisplay.classList.add('blue-leading');
                } else {
                    scoreDisplay.classList.add('tied');
                }
            }
        }
    }

    updateHistoryHeaders() {
        const state = this.gameState.getState();
        this.components.historyTable?.setPlayerNames(state.playerNames.red, state.playerNames.blue);
        this.components.historyModalTable?.setPlayerNames(state.playerNames.red, state.playerNames.blue);
    }

    updateRoundsHistory() {
        const state = this.gameState.getState();
        this.components.historyTable?.setRounds(
            state.rounds,
            (round) => this._calculateRoundScores(round),
            (round) => this.gameState.isRoundComplete(round)
        );
    }

    updateNextPlayerTurn() {
        const round = this.gameState.getCurrentRound();

        if (round && this.gameState.isRoundComplete(round)) {
            document.body.classList.remove('red-turn', 'blue-turn');
            return;
        }

        const nextPlayer = this.gameState.getNextPlayer();
        if (nextPlayer) {
            this.showTurnNotification(nextPlayer);
            this.updateBodyClass(nextPlayer);
        }
    }

    showTurnNotification(playerId) {
        const state = this.gameState.getState();
        const playerName = state.playerNames[playerId] || playerId;
        const round = this.gameState.getCurrentRound();

        let message = `${playerName}'s turn`;
        if (round) {
            const poksRemaining = this.gameState.getPoksRemaining(round, playerId);
            message = `${playerName}'s turn (${poksRemaining} POKs left)`;
        }

        this.components.notification?.showTimed(message, `${playerId}-player`, CONFIG.TURN_NOTIFICATION_MS);
    }

    updateBodyClass(playerId) {
        document.body.classList.remove('red-turn', 'blue-turn');
        document.body.classList.add(`${playerId}-turn`);
    }

    showRoundModal(event) {
        const state = this.gameState.getState();
        const round = state.rounds[event.data.roundNumber];
        if (!round) return;

        // Calculate scores from the round's poks
        const scores = this.gameState.getRoundScores(round);
        const diff = Math.abs(scores.red - scores.blue);

        let winnerText, bgClass;
        if (scores.red > scores.blue) {
            winnerText = `${state.playerNames.red.toUpperCase()} WINS!`;
            bgClass = 'red-bg';
        } else if (scores.blue > scores.red) {
            winnerText = `${state.playerNames.blue.toUpperCase()} WINS!`;
            bgClass = 'blue-bg';
        } else {
            winnerText = 'TIE!';
            bgClass = 'tie-bg';
        }

        // Update modal content
        const modal = this.components.roundModal;
        if (!modal) return;

        modal.find('#roundEndModalRoundNumber').textContent = `Round ${event.data.roundNumber + 1}`;
        modal.find('#roundEndModalWinner').textContent = winnerText;

        // Update modal score circle components
        this.components.modalRedScore?.setScore(scores.red);
        this.components.modalBlueScore?.setScore(scores.blue);
        this.components.modalScoreDiff?.setDifference(diff > 0 ? `+${diff}` : '0');

        // Update modal score visualizers
        this.components.modalRedMarkers?.setScore(state.players.red.totalScore);
        this.components.modalBlueMarkers?.setScore(state.players.blue.totalScore);

        // Update center POK scores
        modal.find('#modalCenterPokScoreRed').textContent = state.players.red.totalScore;
        modal.find('#modalCenterPokScoreBlue').textContent = state.players.blue.totalScore;

        // Set background and show
        modal.removeClass('red-bg', 'blue-bg', 'tie-bg');
        modal.addClass(bgClass);
        modal.open();
    }

    hideRoundModal() {
        this.components.roundModal?.close();
    }

    showStartSelector() {
        this.components.startSelector?.show();

        // Check for saved game
        const savedData = localStorage.getItem('pok-event-store');
        if (savedData) {
            this.components.startSelector?.showContinueButton();
            this.components.startSelector?.showSaveLatestButton();
            this._prefillPlayerNames(savedData);
        } else {
            this.components.startSelector?.hideContinueButton();
            this.components.startSelector?.hideSaveLatestButton();
        }
    }

    hideStartSelector() {
        this.components.startSelector?.hide();
    }

    showRoundPreview(roundIndex) {
        const state = this.gameState.getState();
        const round = state.rounds[roundIndex];
        if (!round) return;

        this._renderPoksForRound(round);
        this._updateRoundScoreDisplay(round);

        this.containers.gameBoard?.classList.toggle('flipped', round.isFlipped);
        this._swapCircleZoneDOMPositions(round.isFlipped);
    }

    hideRoundPreview() {
        const currentRound = this.gameState.getCurrentRound();
        if (!currentRound) return;

        this._renderPoksForRound(currentRound);
        this._updateLastPlacedHighlight();
        this.updateScores();

        this.containers.gameBoard?.classList.toggle('flipped', currentRound.isFlipped);
        this._swapCircleZoneDOMPositions(currentRound.isFlipped);
    }

    clearTable() {
        this.pokComponents.forEach(component => component.unmount());
        this.pokComponents.clear();
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    findPok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return null;
        return round.poks.find(p => p.id === pokId);
    }

    _clearLastPlacedHighlight() {
        this.pokComponents.forEach(component => {
            component.clearLastPlaced();
        });
    }

    _updateLastPlacedHighlight() {
        this._clearLastPlacedHighlight();
        const round = this.gameState.getCurrentRound();
        if (round && round.lastPlacedPokId) {
            const lastComponent = this.pokComponents.get(round.lastPlacedPokId);
            lastComponent?.setLastPlaced();
        }
    }

    _renderPoksForRound(round) {
        this.clearTable();

        if (round && round.poks) {
            round.poks.forEach(pok => {
                const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);
                const pokComponent = new Pok({
                    id: pok.id,
                    playerId: pok.playerId,
                    points: zoneInfo.points,
                    x: pok.x,
                    y: pok.y,
                    isHigh: zoneInfo.isHigh,
                    boundaryZone: zoneInfo.boundaryZone
                });

                if (this.containers.table) {
                    pokComponent.mount(this.containers.table);
                }
                this.pokComponents.set(pok.id, pokComponent);
            });
        }
    }

    _calculateRoundScores(round) {
        return this.gameState.getRoundScores(round);
    }

    _updateRoundScoreDisplay(round) {
        const scores = this._calculateRoundScores(round);

        this.components.currentRedScore?.setScore(scores.red);
        this.components.currentBlueScore?.setScore(scores.blue);

        const diff = Math.abs(scores.red - scores.blue);
        this.components.currentDiff?.setDifference(diff > 0 ? `+${diff}` : '0');
    }

    _swapCircleZoneDOMPositions(isFlipped) {
        const zone4Elements = document.querySelectorAll('[data-zone="4"]');
        const zone5Elements = document.querySelectorAll('[data-zone="5"]');

        zone4Elements.forEach(zone4 => {
            const zone5 = Array.from(zone5Elements).find(z => z.parentElement === zone4.parentElement);
            if (!zone5) return;

            const zone4Label = zone4.querySelector('.zone-label');
            const zone5Label = zone5.querySelector('.zone-label');

            if (isFlipped) {
                zone4.style.top = 'auto';
                zone4.style.bottom = '10%';
                zone5.style.bottom = 'auto';
                zone5.style.top = '10%';
                if (zone4Label) zone4Label.textContent = '4';
                if (zone5Label) zone5Label.textContent = '5';
            } else {
                zone4.style.top = '10%';
                zone4.style.bottom = 'auto';
                zone5.style.bottom = '10%';
                zone5.style.top = 'auto';
                if (zone4Label) zone4Label.textContent = '4';
                if (zone5Label) zone5Label.textContent = '5';
            }
        });
    }

    _prefillPlayerNames(savedData) {
        try {
            const data = JSON.parse(savedData);
            if (data && data.events) {
                const gameStartedEvents = data.events.filter(e => e.type === 'GAME_STARTED');
                if (gameStartedEvents.length > 0) {
                    const lastGameStarted = gameStartedEvents[gameStartedEvents.length - 1];
                    const redName = lastGameStarted.data.redName;
                    const blueName = lastGameStarted.data.blueName;

                    if (redName && redName !== PLAYERS.RED) {
                        this.components.startSelector?.setPlayerName(PLAYERS.RED, redName);
                    }
                    if (blueName && blueName !== PLAYERS.BLUE) {
                        this.components.startSelector?.setPlayerName(PLAYERS.BLUE, blueName);
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    // ==========================================
    // Event Handlers - call registered handlers
    // ==========================================

    /**
     * Register event handlers from main app
     * @param {Object} handlers - Handler functions
     */
    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    }

    _handleGameStart(playerId) {
        this.handlers.onGameStart?.(playerId);
    }

    _handleContinueGame() {
        this.handlers.onContinueGame?.();
    }

    _handleSaveLatest() {
        this.handlers.onSaveLatest?.();
    }

    _handleImport() {
        this.handlers.onImport?.();
    }

    _handleFlipTable() {
        this.handlers.onFlipTable?.();
    }

    _handleShowHistory() {
        this.showHistoryModal();
    }

    _handleNewGame() {
        this.handlers.onNewGame?.();
    }

    _handleExportMatch() {
        this.handlers.onExportMatch?.();
    }

    // ==========================================
    // Auto-End Countdown
    // ==========================================

    /**
     * Check if round is complete and start countdown if needed
     */
    checkRoundComplete() {
        const round = this.gameState.getCurrentRound();
        if (!round || !this.gameState.isRoundComplete(round)) {
            this.clearAutoEndTimer();
            return;
        }

        // Check if this round has already been ended (ROUND_ENDED event exists)
        const events = this.eventStore.getAllEvents();
        const roundAlreadyEnded = events.some(e =>
            e.type === 'ROUND_ENDED' && e.data.roundNumber === round.roundNumber
        );
        if (roundAlreadyEnded) {
            return; // Don't start countdown for already-ended round
        }

        // Round just completed: start countdown
        if (!this._autoEndTimer) {
            this.startAutoEndCountdown();
        }
    }

    /**
     * Start the auto-end countdown with loading bar animation
     */
    startAutoEndCountdown() {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        // Calculate winner for styling
        const scores = this.gameState.getRoundScores(round);

        const winnerClass = scores.red > scores.blue ? 'red-winner' :
                           scores.blue > scores.red ? 'blue-winner' : 'tie-game';

        // Start loading bar animation
        const loadingBar = this.components.loadingBar;
        if (loadingBar) {
            loadingBar.setWinnerClass(winnerClass);
            loadingBar.props.duration = CONFIG.AUTO_END_DELAY_MS;
            loadingBar.start(() => {
                // Animation complete - trigger auto-end
                this._autoEndTimer = null;
                this.handlers.onAutoEndRound?.();
            });
            // Track that we've started (the LoadingBar handles its own timeout)
            this._autoEndTimer = true;
        }
    }

    /**
     * Clear the auto-end countdown timer
     */
    clearAutoEndTimer() {
        if (this._autoEndTimer) {
            this._autoEndTimer = null;
        }
        this.components.loadingBar?.reset();
    }

    /**
     * Check if auto-end timer is currently running
     * @returns {boolean}
     */
    hasAutoEndTimer() {
        return !!this._autoEndTimer;
    }

    // ==========================================
    // History Modal
    // ==========================================

    /**
     * Show the history modal with all rounds
     */
    showHistoryModal() {
        const modal = document.getElementById('historyModal');
        const tbody = document.getElementById('historyModalTableBody');

        if (!modal || !tbody) return;

        // Clear existing rows
        tbody.innerHTML = '';

        // Get rounds from game state
        const state = this.gameState.getState();
        const rounds = state.rounds;

        // Populate table
        rounds.forEach((round, index) => {
            const scores = this.gameState.getRoundScores(round);
            const diff = Math.abs(scores.red - scores.blue);

            // Determine winner
            let winner, winnerClass, rowClass;
            if (this.gameState.isRoundComplete(round)) {
                if (scores.red > scores.blue) {
                    winner = playerNames.red;
                    winnerClass = 'red-winner';
                    rowClass = 'red-round-row';
                } else if (scores.blue > scores.red) {
                    winner = playerNames.blue;
                    winnerClass = 'blue-winner';
                    rowClass = 'blue-round-row';
                } else {
                    winner = 'Tie';
                    winnerClass = 'winner-tie';
                    rowClass = '';
                }
            } else {
                winner = 'In Progress';
                winnerClass = 'winner-current';
                rowClass = 'round-row-current';
            }

            const row = document.createElement('tr');
            row.className = rowClass;

            row.innerHTML = `
                <td class="round-number">${index + 1}</td>
                <td>${scores.red}</td>
                <td>${scores.blue}</td>
                <td class="${winnerClass}">${winner}</td>
                <td>${round.isComplete ? diff : '-'}</td>
            `;

            tbody.appendChild(row);
        });

        // Show modal
        modal.classList.add('show');
    }

    /**
     * Hide the history modal
     */
    hideHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // ==========================================
    // Backward Compatibility
    // ==========================================

    /**
     * Get DOM cache (for backward compatibility)
     * Returns an object that mimics the old this.dom structure
     */
    get dom() {
        return {
            startSelector: this.components.startSelector?.el,
            continueButton: this.components.startSelector?.getButton('continue')?.el,
            saveLatestButton: this.components.startSelector?.getButton('saveLatest')?.el,
            tableContainer: this.containers.gameBoard,
            table: this.containers.table,
            roundModal: this.components.roundModal?.el,
            historyTableBody: this.components.historyTable?.getBody(),
            turnNotification: this.components.notification?.el,
            loadingBar: this.components.loadingBar?.el,
            loadingBarFill: this.components.loadingBar?.getFill()
        };
    }

    /**
     * Get table element (for backward compatibility)
     */
    get tableElement() {
        return this.containers.table;
    }

    /**
     * Get POK elements map (for backward compatibility)
     */
    get pokElements() {
        const map = new Map();
        this.pokComponents.forEach((component, id) => {
            map.set(id, component.el);
        });
        return map;
    }

    /**
     * Legacy method for showing continue button
     */
    showContinueButton() {
        this.components.startSelector?.showContinueButton();
        this.components.startSelector?.showSaveLatestButton();
    }

    /**
     * Legacy method for prefilling player names
     */
    prefillPlayerNames(savedData) {
        this._prefillPlayerNames(savedData);
    }

    /**
     * Get player names from the start selector
     * @returns {{red: string, blue: string}}
     */
    getPlayerNames() {
        return this.components.startSelector?.getPlayerNames() || { red: PLAYERS.RED, blue: PLAYERS.BLUE };
    }
}
