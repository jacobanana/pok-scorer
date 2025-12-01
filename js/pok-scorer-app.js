// ============================================
// MAIN APPLICATION
// ============================================

import { EventStore } from './event-store.js';
import { GameService } from './game-service.js';
import { UIProjection } from './ui-projection.js';
import { CommandHandler } from './command-handler.js';

export class PokScorerApp {
    constructor() {
        this.eventStore = new EventStore();
        this.gameState = new GameService(this.eventStore);
        this.ui = new UIProjection(this.eventStore, this.gameState);
        this.commands = new CommandHandler(this.eventStore, this.gameState);
    }

    init() {
        this.ui.init();

        // Set up all UI handlers
        this.ui.setHandlers({
            onGameStart: (playerId) => {
                // Only allow starting a new game if no game is currently active
                // If there's an active game, we need to reset first
                const state = this.gameState.getState();
                if (state.isStarted) {
                    // There's already a game in progress
                    if (!confirm('A game is already in progress. Start a new game? Current progress will be lost.')) {
                        return;
                    }
                    // User confirmed - reset first
                    this.commands.resetGame();
                }

                const names = this.ui.getPlayerNames();
                this.commands.startGame(playerId, names.red, names.blue);
            },
            onContinueGame: () => {
                const loaded = this.eventStore.load();
                if (!loaded) {
                    alert('Failed to load saved game');
                    this.ui.isLoading = false;
                }
            },
            onSaveLatest: () => {
                // If the in-memory store is empty (e.g., after page refresh),
                // load from localStorage first, then export
                if (this.eventStore.getAllEvents().length === 0) {
                    const saved = localStorage.getItem('pok-event-store');
                    if (!saved) {
                        alert('No saved game found');
                        return;
                    }
                    // Temporarily load into memory just for export
                    const data = JSON.parse(saved);
                    this.eventStore.events = data.events;
                    this.eventStore.version = data.version;
                }

                // Use the standard export method
                this.eventStore.exportToFile();
            },
            onImportFile: async (file) => {
                try {
                    await this.eventStore.importFromFile(file);
                } catch (error) {
                    alert('Failed to import game: ' + error.message);
                }
            },
            onFlipTable: () => {
                const state = this.gameState.getState();
                this.commands.flipTable(!state.isFlipped);
            },
            onNewGame: () => {
                if (confirm('Start a new game? Current progress will be lost.')) {
                    this.commands.resetGame();
                }
            },
            onExportMatch: () => {
                this.eventStore.exportToFile();
            },
            onAutoEndRound: () => this.commands.endRound(),
            onAdvanceGame: () => {
                // Only auto-advance if the game is NOT finished
                // When there's a winner, the user must explicitly click "New Game" to reset
                if (!this.gameState.hasWinner()) {
                    this.commands.startNextRound();
                }
                // If there's a winner, do nothing - keep the modal open
                // User can save the game or start a new game via the menu
            },
            onEditBoard: () => {
                this.commands.undoRoundEnd();
            },
            onPlacePok: (x, y) => {
                const nextPlayer = this.gameState.getNextPlayer();
                try {
                    this.commands.placePok(nextPlayer, x, y);
                } catch (error) {
                    console.log(error.message);
                }
            },
            onMovePok: (pokId, x, y) => {
                this.commands.movePok(pokId, x, y);
            },
            onRemovePok: (pokId) => {
                try {
                    this.commands.removePok(pokId);
                } catch (error) {
                    console.warn('Cannot remove POK:', error.message);
                }
            }
        });

        // Auto-save on every event
        this.eventStore.subscribe('*', () => {
            this.eventStore.save();
        });

        // Check if there's a saved game and show appropriate UI
        const hasSavedGame = localStorage.getItem('pok-event-store');

        if (hasSavedGame) {
            // Show start selector with Resume button visible
            this.ui.showStartSelector();
            this.ui.showContinueButton();
        } else {
            // No saved game - show normal start selector
            this.ui.showStartSelector();
        }
    }
}
