// ============================================
// UI PROJECTION V3 - Manager-based Architecture
// ============================================

import { CONFIG, PLAYERS } from './config.js';
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
    LoadingBar,
    Notification,
    HistoryTable,
    StartSelector
} from './components/index.js';
import {
    InteractionManager,
    PokRenderer,
    ScoreDisplayManager,
    RoundModalController,
    AutoEndManager
} from './ui/managers/index.js';

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
 * UIProjection V3 - Refactored to use specialized managers
 *
 * This class orchestrates UI managers that handle specific concerns.
 * Managers handle their own logic and communicate via events.
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
            onImportFile: null,
            onFlipTable: null,
            onNewGame: null,
            onExportMatch: null,
            onAutoEndRound: null,
            onAdvanceGame: null,
            onEditBoard: null,
            onPlacePok: null,
            onMovePok: null,
            onRemovePok: null
        };

        // Component references
        this.components = {
            startSelector: null,
            historyTable: null,
            notification: null,
            loadingBar: null,
            roundModal: null,
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

        // DOM container references
        this.containers = {};

        // Managers (initialized in init())
        this.managers = {
            interaction: null,
            pokRenderer: null,
            scoreDisplay: null,
            roundModal: null,
            autoEnd: null
        };

        // Subscribe to event handlers
        this._subscribeToEvents(eventStore);
    }

    /**
     * Subscribe to all necessary events
     * @private
     */
    _subscribeToEvents(eventStore) {
        // Specific event handlers
        eventStore.subscribe('GAME_STARTED', (e) => this.onGameStarted(e));
        eventStore.subscribe('GAME_LOADED', (e) => this.onGameLoaded(e));
        eventStore.subscribe('POK_PLACED', (e) => this.managers.pokRenderer?.onPokPlaced(e));
        eventStore.subscribe('POK_MOVED', (e) => this.managers.pokRenderer?.onPokMoved(e));
        eventStore.subscribe('POK_REMOVED', (e) => this.managers.pokRenderer?.onPokRemoved(e));
        eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
        eventStore.subscribe('ROUND_STARTED', (e) => this.onRoundStarted(e));
        eventStore.subscribe('TABLE_FLIPPED', (e) => this.onTableFlipped(e));
        eventStore.subscribe('GAME_RESET', (e) => this.onGameReset(e));

        // Category-based automatic updates
        EVENT_CATEGORIES.SCORE.forEach(eventType => {
            eventStore.subscribe(eventType, () => this.managers.scoreDisplay?.updateScores());
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
     * Initialize the UI - create all components and managers
     */
    init() {
        // Get container references
        this.containers = {
            root: document.getElementById('app'),
            startSelector: document.getElementById('startSelectorContainer'),
            gameBoard: document.getElementById('gameBoardContainer'),
            table: document.getElementById('gameTable'),
            scoreVisualizer: document.getElementById('scoreVisualizerContainer'),
            leftPanel: document.getElementById('leftPanelContainer'),
            modals: document.getElementById('modalsContainer')
        };

        // Create components
        this._createComponents();

        // Initialize managers
        this._initializeManagers();
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
            this.components.startSelector
                .on('start', (e) => this._handleGameStart(e.detail.playerId))
                .on('continue', () => this._handleContinueGame())
                .on('saveLatest', () => this._handleSaveLatest())
                .on('import', () => this._handleImport());
        }

        // History Table
        this.components.historyTable = new HistoryTable({
            id: 'roundsHistoryTable',
            bodyId: 'roundsHistoryTableBody',
            redHeaderId: 'historyHeaderRed',
            blueHeaderId: 'historyHeaderBlue'
        });

        const historyContainer = document.getElementById('historyTableContainer');
        if (historyContainer) {
            this.components.historyTable.mount(historyContainer);
            this.components.historyTable
                .on('rowHover', (e) => this.managers.roundModal?.showRoundPreview(e.detail.index))
                .on('rowLeave', () => this.managers.roundModal?.hideRoundPreview());
        }

        // Turn Notification
        this.components.notification = new Notification({
            id: 'playerTurnNotification'
        });

        if (this.containers.gameBoard) {
            this.components.notification.mount(this.containers.gameBoard, 'prepend');
        }

        // Score Markers
        this.components.redScoreMarkers = new ScoreMarkers({
            color: PLAYERS.RED,
            id: 'redScoreMarkers'
        });

        this.components.blueScoreMarkers = new ScoreMarkers({
            color: PLAYERS.BLUE,
            id: 'blueScoreMarkers'
        });

        const redVisualizer = document.getElementById('redVisualizer');
        const blueVisualizer = document.getElementById('blueVisualizer');

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

        const scoreRow = document.getElementById('scoreRow');
        if (scoreRow) {
            this.components.currentRedScore.mount(scoreRow);
            this.components.currentDiff.mount(scoreRow);
            this.components.currentBlueScore.mount(scoreRow);
        }

        // Loading Bar
        this.components.loadingBar = new LoadingBar({
            id: 'roundEndLoadingBar'
        });

        const loadingBarEl = document.getElementById('roundEndLoadingBar');
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
     * Create control buttons
     * @private
     */
    _createControlButtons() {
        const buttonContainer = document.getElementById('controlButtonsContainer');
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

    /**
     * Set up history modal close handlers
     * @private
     */
    _setupHistoryModal() {
        const closeButton = document.getElementById('closeHistoryButton');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.managers.roundModal?.hideHistoryModal());
        }

        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    this.managers.roundModal?.hideHistoryModal();
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
                this.managers.autoEnd?.clearAutoEndTimer();

                // If there's a winner, just close the modal (don't reset the game)
                // User must explicitly choose to save or start new game
                if (this.gameState.hasWinner()) {
                    this.managers.roundModal?.hideRoundModal();
                } else {
                    // For regular round ends, advance to next round
                    this.handlers.onAdvanceGame?.();
                }
            });
        }
    }

    /**
     * Initialize all managers
     * @private
     */
    _initializeManagers() {
        // POK Renderer
        this.managers.pokRenderer = new PokRenderer(this.gameState, this.containers);

        // Interaction Manager
        this.managers.interaction = new InteractionManager(this.gameState, this.containers);
        this.managers.interaction.setPokComponents(this.managers.pokRenderer.getPokComponents());
        this.managers.interaction.setHandlers({
            onPlacePok: (x, y) => this.handlers.onPlacePok?.(x, y),
            onMovePok: (id, x, y) => this.handlers.onMovePok?.(id, x, y),
            onRemovePok: (id) => this.handlers.onRemovePok?.(id)
        });
        this.managers.interaction.init();

        // Score Display Manager
        this.managers.scoreDisplay = new ScoreDisplayManager(this.gameState, this.components);

        // Round Modal Controller
        this.managers.roundModal = new RoundModalController(
            this.gameState,
            this.components,
            this.containers,
            this.managers.pokRenderer,
            this.managers.scoreDisplay
        );
        this.managers.roundModal.setHandlers({
            onEditBoard: () => {
                // First undo the round end (this triggers rebuild which resets edit mode)
                this.handlers.onEditBoard?.();
                // Then enter edit mode AFTER the rebuild completes
                this.managers.autoEnd?.enterEditMode();
            },
            onSaveGame: () => this.handlers.onExportMatch?.()
        });
        this.managers.roundModal.initEditBoardButton();
        this.managers.roundModal.initSaveGameButton();

        // Auto-End Manager
        this.managers.autoEnd = new AutoEndManager(this.eventStore, this.gameState, this.components);
        this.managers.autoEnd.setHandlers({
            onAutoEndRound: () => this.handlers.onAutoEndRound?.()
        });
        this.managers.autoEnd.initEndRoundButton();
        this.managers.autoEnd.subscribeToEvents();
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
        const round = this.gameState.getCurrentRound();
        if (round) {
            this.updateBodyClass(round.currentPlayerId);
        }
    }

    onRoundEnded(event) {
        this.managers.autoEnd?.clearAutoEndTimer();
        this.managers.roundModal?.showRoundModal(event);
    }

    onRoundStarted(event) {
        this.managers.roundModal?.hideRoundModal();
        this.managers.pokRenderer?.clearTable();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
    }

    onTableFlipped(event) {
        this.containers.gameBoard?.classList.toggle('flipped', event.data.isFlipped);
        this.managers.roundModal?._swapCircleZoneDOMPositions(event.data.isFlipped);
        this.managers.pokRenderer?.onTableFlipped(event.data.isFlipped);
    }

    onGameReset(event) {
        this.managers.pokRenderer?.clearTable();
        this.managers.roundModal?.hideRoundModal();

        // Reset flip state
        this.containers.gameBoard?.classList.remove('flipped');
        this.managers.roundModal?._swapCircleZoneDOMPositions(false);

        // Reset score markers
        this.managers.scoreDisplay?.resetScores();

        // Reset body classes
        document.body.className = '';

        // Clear and reset start selector
        this.components.startSelector?.setPlayerName(PLAYERS.RED, '');
        this.components.startSelector?.setPlayerName(PLAYERS.BLUE, '');

        // Reset history headers
        this.components.historyTable?.setPlayerNames(PLAYERS.RED, PLAYERS.BLUE);

        // Reset interaction state
        this.managers.interaction?.reset();

        this.showStartSelector();
    }

    // ==========================================
    // UI Update Methods
    // ==========================================

    updateHistoryHeaders() {
        const state = this.gameState.getState();
        this.components.historyTable?.setPlayerNames(state.playerNames.red, state.playerNames.blue);
    }

    updateRoundsHistory() {
        const state = this.gameState.getState();
        this.components.historyTable?.setRounds(
            state.rounds,
            (round) => this.gameState.getRoundScores(round),
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

    showStartSelector() {
        this.components.startSelector?.show();

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

    showContinueButton() {
        this.components.startSelector?.showContinueButton();
    }

    hideContinueButton() {
        this.components.startSelector?.hideContinueButton();
    }

    // Expose isLoading property for external access
    get isLoading() {
        return this.managers.autoEnd?.isLoading || false;
    }

    set isLoading(value) {
        if (this.managers.autoEnd) {
            this.managers.autoEnd.isLoading = value;
        }
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

    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    }

    _handleGameStart(playerId) {
        this.handlers.onGameStart?.(playerId);
    }

    _handleContinueGame() {
        this.managers.autoEnd?.setLoading(true);
        this.handlers.onContinueGame?.();
    }

    _handleSaveLatest() {
        this.handlers.onSaveLatest?.();
    }

    _handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handlers.onImportFile?.(file);
            }
        };
        input.click();
    }

    _handleFlipTable() {
        this.handlers.onFlipTable?.();
    }

    _handleShowHistory() {
        this.managers.roundModal?.showHistoryModal();
    }

    _handleNewGame() {
        this.handlers.onNewGame?.();
    }

    _handleExportMatch() {
        this.handlers.onExportMatch?.();
    }

    // ==========================================
    // Backward Compatibility
    // ==========================================

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

    get tableElement() {
        return this.containers.table;
    }

    get pokElements() {
        const map = new Map();
        this.managers.pokRenderer?.getPokComponents().forEach((component, id) => {
            map.set(id, component.el);
        });
        return map;
    }

    getPlayerNames() {
        return this.components.startSelector?.getPlayerNames() || { red: PLAYERS.RED, blue: PLAYERS.BLUE };
    }
}
