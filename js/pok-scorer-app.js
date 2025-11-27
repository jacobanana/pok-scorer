// ============================================
// MAIN APPLICATION
// ============================================

import { EventStore } from './event-store.js';
import { GameService } from './game-service.js';
import { UIProjection } from './ui-projection.js';
import { CommandHandler } from './command-handler.js';
import { CONFIG, PLAYERS } from './config.js';

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
                const names = this.ui.getPlayerNames();
                this.commands.startGame(playerId, names.red, names.blue);
            },
            onContinueGame: () => {
                this.isLoading = true;
                const loaded = this.eventStore.load();
                if (!loaded) {
                    alert('Failed to load saved game');
                    this.isLoading = false;
                }
            },
            onSaveLatest: () => {
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
                if (this.gameState.hasWinner()) {
                    this.commands.resetGame();
                } else {
                    this.commands.startNextRound();
                }
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

        // Flag to track if we're currently loading a game
        this.isLoading = false;

        // Set up subscriptions BEFORE loading saved game
        // Auto-save on every event
        this.eventStore.subscribe('*', (event) => {
            this.eventStore.save();
            // Only check round completion if we're not loading
            // This prevents auto-end timers from starting during event replay
            // Also skip on ROUND_ENDED - the round has already ended, no need to start another countdown
            if (!this.isLoading && event.type !== 'ROUND_ENDED') {
                this.ui.checkRoundComplete();
            }
        });

        // Reset countdown timer when a POK is moved during round completion
        this.eventStore.subscribe('POK_MOVED', () => {
            if (!this.isLoading && this.ui.hasAutoEndTimer()) {
                // Clear and restart the countdown to allow adjustments
                this.ui.clearAutoEndTimer();
                this.ui.checkRoundComplete();
            }
        });

        // Handle game reset to clear app state
        this.eventStore.subscribe('GAME_RESET', () => {
            this.ui.clearAutoEndTimer();
            this.isLoading = false;
        });

        // Handle game loaded to clear any auto-end timers and check round state
        this.eventStore.subscribe('GAME_LOADED', () => {
            this.ui.clearAutoEndTimer();
            this.isLoading = false;
            // Now that loading is complete, check if we need to start countdown
            this.ui.checkRoundComplete();
        });

        // Check if there's a saved game and show appropriate UI
        this.isLoading = false;
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
