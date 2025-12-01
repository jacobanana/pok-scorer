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
