// ============================================
// MAIN APPLICATION
// ============================================

import { EventStore } from './event-store.js';
import { GameStateProjection } from './game-state-projection.js';
import { UIProjection } from './ui-projection-v2.js';
import { CommandHandler } from './command-handler.js';
import { ScoringService } from './scoring-service.js';

export class PokScorerApp {
    constructor() {
        this.eventStore = new EventStore();
        this.gameState = new GameStateProjection(this.eventStore);
        this.ui = new UIProjection(this.eventStore, this.gameState);
        this.commands = new CommandHandler(this.eventStore, this.gameState);

        this.isDragging = false;
        this.draggedPokId = null;
        this._dragImage = null;
    }

    init() {
        this.ui.init();
        this.setupDOMEventListeners();
        this.setupEventHandlers();

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
            onImport: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            await this.eventStore.importFromFile(file);
                        } catch (error) {
                            alert('Failed to import game: ' + error.message);
                        }
                    }
                };
                input.click();
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
            onAutoEndRound: () => this.commands.endRound()
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
            this.isDragging = false;
            this.draggedPokId = null;
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

    setupDOMEventListeners() {
        // Note: Most button event handlers are now set via ui.setHandlers()
        // and handled through the component event system.

        // Round End Modal - clicking advances the game
        const roundEndModal = document.getElementById('roundEndModal');
        if (roundEndModal) {
            roundEndModal.addEventListener('click', () => {
                this.ui.clearAutoEndTimer();

                // Check if game is over
                if (this.gameState.hasWinner()) {
                    this.commands.resetGame();
                } else {
                    this.commands.startNextRound();
                }
            });
        }

        // Game board - place POK
        const tableContainer = document.getElementById('gameBoardContainer');
        if (tableContainer) {
            tableContainer.addEventListener('click', (event) => {
                if (this.isDragging) return;

                // Don't place POK if we clicked on an existing POK element
                if (event.target.classList.contains('pok')) {
                    return;
                }

                const round = this.gameState.getCurrentRound();
                if (!round || round.isComplete) return;

                const pos = this.calculateTablePosition(event);
                const nextPlayer = this.gameState.getNextPlayer();

                try {
                    this.commands.placePok(nextPlayer, pos.x, pos.y);
                } catch (error) {
                    console.log(error.message);
                }
            });
        }
    }

    setupEventHandlers() {
        // Drag and drop
        this.setupDragAndDrop();

        // Boundary zone highlighting on mouse move
        this.setupBoundaryHighlight();
    }

    setupDragAndDrop() {
        const tableContainer = this.ui.dom.tableContainer;

        // Drag start
        tableContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('pok')) {
                this.isDragging = true;
                this.draggedPokId = this.findPokIdByElement(e.target);
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
                const pos = this.calculateTablePosition(e);
                const round = this.gameState.getCurrentRound();
                const isFlipped = round ? round.isFlipped : false;
                const zoneInfo = ScoringService.getZoneInfo(pos.x, pos.y, isFlipped);

                const zones = document.querySelectorAll('.zone, .circle-zone');
                zones.forEach(zone => {
                    const zoneId = zone.getAttribute('data-zone');
                    zone.classList.remove('boundary-highlight');

                    if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                        zone.classList.add('boundary-highlight');
                    }
                });
            }
        });

        // Drop
        tableContainer.addEventListener('drop', (e) => {
            e.preventDefault();

            if (this.draggedPokId) {
                const pos = this.calculateTablePosition(e);
                this.commands.movePok(this.draggedPokId, pos.x, pos.y);
            }
        });

        // Click on POK (undo) - only allow clicking on last-placed POK
        tableContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pok') && e.target.classList.contains('last-placed')) {
                e.stopPropagation(); // Prevent placePok from firing
                const pokId = this.findPokIdByElement(e.target);
                try {
                    this.commands.removePok(pokId);
                } catch (error) {
                    console.warn('Cannot remove POK:', error.message);
                }
            }
        });

        // Touch events for mobile
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        const tableContainer = this.ui.dom.tableContainer;
        let touchStartPos = null;
        let touchedPokId = null;
        let touchedElement = null;
        let hasMoved = false;

        tableContainer.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.pok');
            if (target) {
                e.preventDefault();
                touchedPokId = this.findPokIdByElement(target);
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
                    const pos = this.calculateTablePosition(e.touches[0]);
                    touchedElement.style.left = `${pos.x}%`;
                    touchedElement.style.top = `${pos.y}%`;

                    // Show boundary zone highlighting
                    const round = this.gameState.getCurrentRound();
                    const isFlipped = round ? round.isFlipped : false;
                    const zoneInfo = ScoringService.getZoneInfo(pos.x, pos.y, isFlipped);

                    const zones = document.querySelectorAll('.zone, .circle-zone');
                    zones.forEach(zone => {
                        const zoneId = zone.getAttribute('data-zone');
                        zone.classList.remove('boundary-highlight');

                        if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                            zone.classList.add('boundary-highlight');
                        }
                    });
                }
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                if (hasMoved) {
                    // Drag: move POK to final position
                    const pos = this.calculateTablePosition(e.changedTouches[0]);
                    touchedElement.classList.remove('dragging');
                    this.commands.movePok(touchedPokId, pos.x, pos.y);
                } else {
                    // Tap: undo if last placed
                    // Check if the touched element has last-placed class
                    const target = e.target.closest('.pok');
                    if (target && target.classList.contains('last-placed')) {
                        e.stopPropagation(); // Prevent placePok from firing
                        try {
                            this.commands.removePok(touchedPokId);
                        } catch (error) {
                            console.warn('Cannot remove POK:', error.message);
                        }
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

    setupBoundaryHighlight() {
        const tableContainer = this.ui.dom.tableContainer;

        tableContainer.addEventListener('mousemove', (e) => {
            // Don't show boundary highlight if dragging (handled in dragover)
            if (this.isDragging) return;

            // Don't show boundary highlight if clicking on existing POK
            if (e.target.classList.contains('pok')) return;

            const round = this.gameState.getCurrentRound();
            if (!round || round.isComplete) return;

            // Calculate position
            const pos = this.calculateTablePosition(e);

            // Get zone info to check if in boundary
            const isFlipped = round.isFlipped;
            const zoneInfo = ScoringService.getZoneInfo(pos.x, pos.y, isFlipped);

            // Highlight zones that are in boundary areas
            const zones = document.querySelectorAll('.zone, .circle-zone');
            zones.forEach(zone => {
                const zoneId = zone.getAttribute('data-zone');

                // Remove existing highlights
                zone.classList.remove('boundary-highlight');

                // Add highlight to the ADJACENT lower-scoring zone (boundaryZone)
                // not the current zone (zoneId)
                if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                    zone.classList.add('boundary-highlight');
                }
            });
        });

        tableContainer.addEventListener('mouseleave', () => {
            // Remove all boundary highlights when mouse leaves table
            const zones = document.querySelectorAll('.zone, .circle-zone');
            zones.forEach(zone => {
                zone.classList.remove('boundary-highlight');
            });
        });
    }

    calculateTablePosition(event) {
        const tableElement = this.ui.tableElement;
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

    findPokIdByElement(element) {
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
}
