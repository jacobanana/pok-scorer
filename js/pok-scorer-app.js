// ============================================
// MAIN APPLICATION
// ============================================

import { CONFIG } from './config.js';
import { EventStore } from './event-store.js';
import { GameStateProjection } from './game-state-projection.js';
import { UIProjection } from './ui-projection.js';
import { CommandHandler } from './command-handler.js';
import { ScoringService } from './scoring-service.js';

export class PokScorerApp {
    constructor() {
        this.eventStore = new EventStore();
        this.gameState = new GameStateProjection(this.eventStore);
        this.ui = new UIProjection(this.eventStore, this.gameState);
        this.commands = new CommandHandler(this.eventStore, this.gameState);

        this.autoEndTimer = null;
        this.countdownInterval = null;
        this.countdownEndTime = null;
        this.isDragging = false;
        this.draggedPokId = null;
    }

    init() {
        this.ui.init();
        this.setupEventHandlers();

        // Try to load saved game
        const loaded = this.eventStore.load();
        if (loaded) {
            this.ui.updateScores();
            this.ui.updateRoundsHistory();
        } else {
            this.ui.showStartSelector();
        }

        // Auto-save on every event
        this.eventStore.subscribe('*', () => {
            this.eventStore.save();
            this.checkRoundComplete();
        });
    }

    setupEventHandlers() {
        // Start game
        window.startGame = (playerId) => {
            this.commands.startGame(playerId);
        };

        // Continue game
        window.continueLastGame = () => {
            this.ui.hideStartSelector();
            const round = this.gameState.getCurrentRound();
            if (round) {
                this.ui.updateBodyClass(round.currentPlayerId);
            }
        };

        // Save game to file
        window.saveLatestGame = () => {
            this.eventStore.exportToFile();
        };

        // Import game
        window.importMatch = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await this.eventStore.importFromFile(file);
                        this.ui.hideStartSelector();
                        this.ui.updateScores();
                        this.ui.updateRoundsHistory();
                    } catch (error) {
                        alert('Failed to import game: ' + error.message);
                    }
                }
            };
            input.click();
        };

        // New game
        window.confirmNewGame = () => {
            if (confirm('Start a new game? Current progress will be lost.')) {
                this.commands.resetGame();
            }
        };

        // Flip table
        window.flipTable = () => {
            const state = this.gameState.getState();
            this.commands.flipTable(!state.isFlipped);
        };

        // Export game
        window.exportMatch = () => {
            this.eventStore.exportToFile();
        };

        // Place POK
        window.placePok = (event) => {
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
        };

        // Continue to next round
        window.continueToNextRound = () => {
            this.clearAutoEndTimer();

            // Check if game is over
            if (this.gameState.hasWinner()) {
                this.commands.resetGame();
            } else {
                this.commands.startNextRound();
            }
        };

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

                // Create a cleaner drag image (clone the element)
                const dragImage = e.target.cloneNode(true);
                dragImage.style.opacity = '0.8';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage,
                    e.target.offsetWidth / 2,
                    e.target.offsetHeight / 2);

                // Clean up the drag image after a short delay
                setTimeout(() => dragImage.remove(), 0);

                // Set effect to move (not copy)
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        // Drag end
        tableContainer.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('pok')) {
                e.target.classList.remove('dragging');
                this.isDragging = false;
                this.draggedPokId = null;

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
        let hasMoved = false;

        tableContainer.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.pok');
            if (target) {
                e.preventDefault();
                touchedPokId = this.findPokIdByElement(target);
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });

        tableContainer.addEventListener('touchmove', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);

                if (dx > 5 || dy > 5) {
                    hasMoved = true;
                    this.isDragging = true;
                }
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                if (hasMoved) {
                    // Drag: move POK
                    const pos = this.calculateTablePosition(e.changedTouches[0]);
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

                touchedPokId = null;
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

    checkRoundComplete() {
        const round = this.gameState.getCurrentRound();
        if (!round || !round.isComplete) {
            this.clearAutoEndTimer();
            return;
        }

        // Round just completed: start countdown
        if (!this.autoEndTimer) {
            this.startAutoEndCountdown();
        }
    }

    startAutoEndCountdown() {
        this.countdownEndTime = Date.now() + CONFIG.AUTO_END_DELAY_MS;

        // Update countdown display
        this.countdownInterval = setInterval(() => {
            const remaining = Math.max(0, this.countdownEndTime - Date.now()) / 1000;
            this.ui.dom.turnNotification.textContent =
                `All POKs played! Round ending in ${Math.ceil(remaining)}s...`;
            this.ui.dom.turnNotification.classList.add('show', 'round-complete');
            this.ui.dom.turnNotification.classList.remove('red-player', 'blue-player');
            this.ui.dom.currentRoundScore.classList.add('hidden');
        }, 100);

        // Auto-end after delay
        this.autoEndTimer = setTimeout(() => {
            this.commands.endRound();
            this.clearAutoEndTimer();
        }, CONFIG.AUTO_END_DELAY_MS);
    }

    clearAutoEndTimer() {
        if (this.autoEndTimer) {
            clearTimeout(this.autoEndTimer);
            this.autoEndTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdownEndTime = null;

        if (this.ui.dom.turnNotification) {
            this.ui.dom.turnNotification.classList.remove('show', 'round-complete');
        }
    }
}
