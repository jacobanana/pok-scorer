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
        this.setupDOMEventListeners();
        this.setupEventHandlers();

        // Flag to track if we're currently loading a game
        this.isLoading = false;

        // Set up subscriptions BEFORE loading saved game
        // Auto-save on every event
        this.eventStore.subscribe('*', () => {
            this.eventStore.save();
            // Only check round completion if we're not loading
            // This prevents auto-end timers from starting during event replay
            if (!this.isLoading) {
                this.checkRoundComplete();
            }
        });

        // Reset countdown timer when a POK is moved during round completion
        this.eventStore.subscribe('POK_MOVED', () => {
            if (!this.isLoading && this.autoEndTimer) {
                // Clear and restart the countdown to allow adjustments
                this.clearAutoEndTimer();
                this.checkRoundComplete();
            }
        });

        // Handle game reset to clear app state
        this.eventStore.subscribe('GAME_RESET', () => {
            this.clearAutoEndTimer();
            this.isDragging = false;
            this.draggedPokId = null;
            this.isLoading = false;
        });

        // Handle game loaded to clear any auto-end timers and check round state
        this.eventStore.subscribe('GAME_LOADED', () => {
            this.clearAutoEndTimer();
            this.isLoading = false;
            // Now that loading is complete, check if we need to start countdown
            this.checkRoundComplete();
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
        // Buttons
        const continueGameButton = document.getElementById('continueGameButton');
        if (continueGameButton) {
            continueGameButton.addEventListener('click', () => {
                // Load the saved game
                this.isLoading = true;
                const loaded = this.eventStore.load();
                if (loaded) {
                    // Game was loaded - hide start selector and show the game board
                    this.ui.hideStartSelector();
                    this.ui.updateScores();
                    this.ui.updateRoundsHistory();

                    // Update body class for current player
                    const round = this.gameState.getCurrentRound();
                    if (round) {
                        this.ui.updateBodyClass(round.currentPlayerId);
                    }
                    // isLoading flag will be cleared by GAME_LOADED event
                } else {
                    alert('Failed to load saved game');
                    this.isLoading = false;
                }
            });
        }

        const saveLatestGameButton = document.getElementById('saveLatestGameButton');
        if (saveLatestGameButton) {
            saveLatestGameButton.addEventListener('click', () => {
                this.eventStore.exportToFile();
            });
        }

        const importMatchButton = document.getElementById('importMatchButton');
        if (importMatchButton) {
            importMatchButton.addEventListener('click', () => {
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
            });
        }

        const flipTableButton = document.getElementById('flipTableButton');
        if (flipTableButton) {
            flipTableButton.addEventListener('click', () => {
                const state = this.gameState.getState();
                this.commands.flipTable(!state.isFlipped);
            });
        }

        const exportMatchButton = document.getElementById('exportMatchButton');
        if (exportMatchButton) {
            exportMatchButton.addEventListener('click', () => {
                this.eventStore.exportToFile();
            });
        }

        const newGameButton = document.getElementById('newGameButton');
        if (newGameButton) {
            newGameButton.addEventListener('click', () => {
                if (confirm('Start a new game? Current progress will be lost.')) {
                    this.commands.resetGame();
                }
            });
        }

        // Start game buttons
        const startRedButton = document.querySelector('.start-half.red');
        if (startRedButton) {
            startRedButton.addEventListener('click', () => {
                this.commands.startGame('red');
            });
        }

        const startBlueButton = document.querySelector('.start-half.blue');
        if (startBlueButton) {
            startBlueButton.addEventListener('click', () => {
                this.commands.startGame('blue');
            });
        }

        // Modal
        const roundEndModal = document.getElementById('roundEndModal');
        if (roundEndModal) {
            roundEndModal.addEventListener('click', () => {
                this.clearAutoEndTimer();

                // Check if game is over
                if (this.gameState.hasWinner()) {
                    this.commands.resetGame();
                } else {
                    this.commands.startNextRound();
                }
            });
        }

        // Show History button
        const showHistoryButton = document.getElementById('showHistoryButton');
        if (showHistoryButton) {
            showHistoryButton.addEventListener('click', () => {
                this.showHistoryModal();
            });
        }

        // Close History button
        const closeHistoryButton = document.getElementById('closeHistoryButton');
        if (closeHistoryButton) {
            closeHistoryButton.addEventListener('click', () => {
                this.hideHistoryModal();
            });
        }

        // Close history modal when clicking outside
        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    this.hideHistoryModal();
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

        // Determine the winner's color
        const round = this.gameState.getCurrentRound();
        if (round) {
            const redScore = round.poks
                .filter(p => p.playerId === 'red')
                .reduce((sum, p) => sum + p.points, 0);
            const blueScore = round.poks
                .filter(p => p.playerId === 'blue')
                .reduce((sum, p) => sum + p.points, 0);

            const winnerClass = redScore > blueScore ? 'red-winner' :
                               blueScore > redScore ? 'blue-winner' : 'tie-game';

            // Show loading bar and set up smooth animation
            if (this.ui.dom.loadingBar && this.ui.dom.loadingBarFill) {
                // Reset the bar
                this.ui.dom.loadingBarFill.style.width = '0%';
                this.ui.dom.loadingBarFill.style.transition = 'none';
                this.ui.dom.loadingBarFill.classList.remove('red-winner', 'blue-winner', 'tie-game');

                // Add winner class (or tie class)
                this.ui.dom.loadingBarFill.classList.add(winnerClass);

                // Force a reflow to ensure the reset takes effect
                void this.ui.dom.loadingBarFill.offsetWidth;

                // Show the loading bar
                this.ui.dom.loadingBar.classList.add('show');

                // Start the animation with a smooth transition
                this.ui.dom.loadingBarFill.style.transition = `width ${CONFIG.AUTO_END_DELAY_MS}ms linear`;
                this.ui.dom.loadingBarFill.style.width = '100%';
            }
        }

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

        // Hide loading bar and clean up classes
        if (this.ui.dom.loadingBar) {
            this.ui.dom.loadingBar.classList.remove('show');
        }
        if (this.ui.dom.loadingBarFill) {
            this.ui.dom.loadingBarFill.style.width = '0%';
            this.ui.dom.loadingBarFill.classList.remove('red-winner', 'blue-winner', 'tie-game');
        }
    }

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
            // Calculate scores
            const redScore = round.poks
                .filter(p => p.playerId === 'red')
                .reduce((sum, p) => sum + p.points, 0);
            const blueScore = round.poks
                .filter(p => p.playerId === 'blue')
                .reduce((sum, p) => sum + p.points, 0);

            const scores = { red: redScore, blue: blueScore };
            const diff = Math.abs(scores.red - scores.blue);

            // Determine winner
            let winner, winnerClass, rowClass;
            if (round.isComplete) {
                if (scores.red > scores.blue) {
                    winner = 'Red';
                    winnerClass = 'red-winner';
                    rowClass = 'red-round-row';
                } else if (scores.blue > scores.red) {
                    winner = 'Blue';
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

            // Round number
            const roundCell = document.createElement('td');
            roundCell.textContent = index + 1;
            roundCell.className = 'round-number';
            row.appendChild(roundCell);

            // Red score
            const redCell = document.createElement('td');
            redCell.textContent = scores.red;
            row.appendChild(redCell);

            // Blue score
            const blueCell = document.createElement('td');
            blueCell.textContent = scores.blue;
            row.appendChild(blueCell);

            // Winner
            const winnerCell = document.createElement('td');
            winnerCell.textContent = winner;
            winnerCell.className = winnerClass;
            row.appendChild(winnerCell);

            // Difference
            const diffCell = document.createElement('td');
            diffCell.textContent = round.isComplete ? diff : '-';
            row.appendChild(diffCell);

            tbody.appendChild(row);
        });

        // Show modal
        modal.classList.add('show');
    }

    hideHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
}
