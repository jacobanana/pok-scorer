// ============================================
// UI PROJECTION
// ============================================

import { CONFIG } from './config.js';
import { ScoreVisualizerService } from './score-visualizer-service.js';

export class UIProjection {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;
        this.dom = {};
        this.pokElements = new Map();
        this.tableElement = null;
        this.scoreVisualizer = null;

        // Subscribe to events
        eventStore.subscribe('GAME_STARTED', (e) => this.onGameStarted(e));
        eventStore.subscribe('POK_PLACED', (e) => this.onPokPlaced(e));
        eventStore.subscribe('POK_MOVED', (e) => this.onPokMoved(e));
        eventStore.subscribe('POK_REMOVED', (e) => this.onPokRemoved(e));
        eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
        eventStore.subscribe('ROUND_STARTED', (e) => this.onRoundStarted(e));
        eventStore.subscribe('TABLE_FLIPPED', (e) => this.onTableFlipped(e));
        eventStore.subscribe('GAME_RESET', (e) => this.onGameReset(e));
    }

    init() {
        this.dom = {
            startSelector: document.getElementById('gameStartSelector'),
            continueButton: document.getElementById('continueGameButton'),
            saveLatestButton: document.getElementById('saveLatestGameButton'),
            tableContainer: document.getElementById('gameBoardContainer'),
            table: document.querySelector('.table'),
            mainRedTotal: document.getElementById('totalScoreRed'),
            mainBlueTotal: document.getElementById('totalScoreBlue'),
            redRound: document.getElementById('currentRoundScoreRed'),
            blueRound: document.getElementById('currentRoundScoreBlue'),
            scoreDiff: document.getElementById('currentRoundScoreDifference'),
            redPoksInfo: document.getElementById('remainingPoksRed'),
            bluePoksInfo: document.getElementById('remainingPoksBlue'),
            roundModal: document.getElementById('roundEndModal'),
            modalWinner: document.getElementById('roundEndModalWinner'),
            modalRedScore: document.getElementById('roundEndModalRedScore'),
            modalBlueScore: document.getElementById('roundEndModalBlueScore'),
            modalScoreDiff: document.getElementById('roundEndModalScoreDiff'),
            modalTotalScores: document.getElementById('roundEndModalTotalScores'),
            modalRoundNumber: document.getElementById('roundEndModalRoundNumber'),
            historyTableBody: document.getElementById('roundsHistoryTableBody'),
            historyHeaderRed: document.getElementById('historyHeaderRed'),
            historyHeaderBlue: document.getElementById('historyHeaderBlue'),
            historyModalHeaderRed: document.getElementById('historyModalHeaderRed'),
            historyModalHeaderBlue: document.getElementById('historyModalHeaderBlue'),
            currentRoundScore: document.getElementById('currentRoundScoreDisplay'),
            turnNotification: document.getElementById('playerTurnNotification'),
            redScoreMarkers: document.getElementById('redScoreMarkers'),
            blueScoreMarkers: document.getElementById('blueScoreMarkers'),
            loadingBar: document.getElementById('roundEndLoadingBar'),
            loadingBarFill: document.querySelector('#roundEndLoadingBar .loading-bar-fill')
        };

        this.tableElement = this.dom.table;

        // Initialize score visualizer service
        this.scoreVisualizer = new ScoreVisualizerService(
            this.dom.redScoreMarkers,
            this.dom.blueScoreMarkers
        );
    }

    onGameStarted(event) {
        this.hideStartSelector();
        this.updateScores();
        this.updateHistoryHeaders();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
    }

    updateHistoryHeaders() {
        const playerNames = this.gameState.getPlayerNames();
        if (this.dom.historyHeaderRed) {
            this.dom.historyHeaderRed.textContent = playerNames.red;
        }
        if (this.dom.historyHeaderBlue) {
            this.dom.historyHeaderBlue.textContent = playerNames.blue;
        }
        if (this.dom.historyModalHeaderRed) {
            this.dom.historyModalHeaderRed.textContent = playerNames.red;
        }
        if (this.dom.historyModalHeaderBlue) {
            this.dom.historyModalHeaderBlue.textContent = playerNames.blue;
        }
    }

    onPokPlaced(event) {
        const pok = this.findPok(event.data.pokId);
        if (!pok) {
            console.error('POK not found in game state:', event.data.pokId);
            return;
        }

        // Check if table element is initialized
        if (!this.tableElement) {
            console.error('Table element not initialized yet. Call ui.init() before loading events.');
            return;
        }

        // Check if POK already exists (prevent duplicates during replay)
        if (this.pokElements.has(pok.id)) {
            console.warn('POK element already exists:', pok.id);
            return;
        }

        // Create DOM element
        const pokEl = this.createPokElement(pok);
        this.pokElements.set(pok.id, pokEl);
        this.tableElement.appendChild(pokEl);

        // Highlight as last placed
        this.clearLastPlacedHighlight();
        pokEl.classList.add('last-placed');

        // Update UI
        this.updateScores();
        this.updateRoundsHistory();
        this.updateNextPlayerTurn();
    }

    onPokMoved(event) {
        const pok = this.findPok(event.data.pokId);
        const pokEl = this.pokElements.get(event.data.pokId);

        if (!pok || !pokEl) return;

        // Update position
        pokEl.style.left = `${pok.x}%`;
        pokEl.style.top = `${pok.y}%`;

        // Update points display
        pokEl.textContent = pok.points;

        // Update high/low score styling
        pokEl.classList.toggle('low-score', !pok.isHigh);

        // Update boundary zone styling
        pokEl.classList.toggle('boundary-zone', !!pok.boundaryZone);

        // Update UI
        this.updateScores();
        this.updateRoundsHistory();
        this.updateNextPlayerTurn();
    }

    onPokRemoved(event) {
        const pokEl = this.pokElements.get(event.data.pokId);
        if (!pokEl) return;

        pokEl.remove();
        this.pokElements.delete(event.data.pokId);

        // Highlight new last placed
        this.clearLastPlacedHighlight();
        const round = this.gameState.getCurrentRound();
        if (round && round.lastPlacedPokId) {
            const lastPokEl = this.pokElements.get(round.lastPlacedPokId);
            if (lastPokEl) {
                lastPokEl.classList.add('last-placed');
            }
        }

        // Update UI
        this.updateScores();
        this.updateRoundsHistory();
        this.updateNextPlayerTurn();
    }

    onRoundEnded(event) {
        this.showRoundModal(event);
        this.updateScores();
        this.updateRoundsHistory();
    }

    onRoundStarted(event) {
        this.hideRoundModal();

        // Clear the table BEFORE any new POKs might be added
        this.clearTable();

        // Update UI state
        this.updateScores();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
        this.updateRoundsHistory();
    }

    onTableFlipped(event) {
        this.dom.tableContainer.classList.toggle('flipped', event.data.isFlipped);
        this.swapCircleZoneDOMPositions(event.data.isFlipped);

        // Update all POK elements to reflect new zone calculations
        const round = this.gameState.getCurrentRound();
        if (round) {
            round.poks.forEach(pok => {
                const pokEl = this.pokElements.get(pok.id);
                if (pokEl) {
                    // Update points display
                    pokEl.textContent = pok.points;

                    // Update high/low score styling
                    pokEl.classList.toggle('low-score', !pok.isHigh);

                    // Update boundary zone styling
                    pokEl.classList.toggle('boundary-zone', !!pok.boundaryZone);
                }
            });
        }

        // Update scores as they may have changed due to zone recalculation
        this.updateScores();
        this.updateRoundsHistory();
    }

    swapCircleZoneDOMPositions(isFlipped) {
        const zone4Elements = document.querySelectorAll('[data-zone="4"]');
        const zone5Elements = document.querySelectorAll('[data-zone="5"]');

        zone4Elements.forEach(zone4 => {
            const zone5 = Array.from(zone5Elements).find(z => z.parentElement === zone4.parentElement);
            if (!zone5) return;

            const zone4Label = zone4.querySelector('.zone-label');
            const zone5Label = zone5.querySelector('.zone-label');

            if (isFlipped) {
                // Swap positions: zone 4 element moves to bottom, zone 5 element moves to top
                zone4.style.top = 'auto';
                zone4.style.bottom = '10%';
                zone5.style.bottom = 'auto';
                zone5.style.top = '10%';

                // When flipped: top scores 5 pts, bottom scores 4 pts
                // zone5 is now at top → display "5" (it scores 5 points)
                // zone4 is now at bottom → display "4" (it scores 4 points)
                if (zone4Label) zone4Label.textContent = '4';  // at bottom, scores 4
                if (zone5Label) zone5Label.textContent = '5';  // at top, scores 5
            } else {
                // Not flipped: zone 4 at top, zone 5 at bottom
                zone4.style.top = '10%';
                zone4.style.bottom = 'auto';
                zone5.style.bottom = '10%';
                zone5.style.top = 'auto';

                // When not flipped: top scores 4 pts, bottom scores 5 pts
                // zone4 is at top → display "4" (it scores 4 points)
                // zone5 is at bottom → display "5" (it scores 5 points)
                if (zone4Label) zone4Label.textContent = '4';  // at top, scores 4
                if (zone5Label) zone5Label.textContent = '5';  // at bottom, scores 5
            }
        });
    }

    onGameReset(event) {
        // Clear all UI elements - this must happen first
        this.clearTable();
        this.hideRoundModal();

        // Reset table flip state
        if (this.dom.tableContainer) {
            this.dom.tableContainer.classList.remove('flipped');
        }
        this.swapCircleZoneDOMPositions(false); // Reset to non-flipped state

        // Reset score visualizer
        if (this.scoreVisualizer) {
            this.scoreVisualizer.reset();
        }

        // Reset scores and history
        this.updateScores();
        this.updateRoundsHistory();

        // Reset body classes
        document.body.className = '';

        // Clear player name inputs
        const redNameInput = document.getElementById('redPlayerName');
        const blueNameInput = document.getElementById('bluePlayerName');
        if (redNameInput) redNameInput.value = '';
        if (blueNameInput) blueNameInput.value = '';

        // Reset history headers to defaults
        if (this.dom.historyHeaderRed) this.dom.historyHeaderRed.textContent = 'Red';
        if (this.dom.historyHeaderBlue) this.dom.historyHeaderBlue.textContent = 'Blue';
        if (this.dom.historyModalHeaderRed) this.dom.historyModalHeaderRed.textContent = 'Red';
        if (this.dom.historyModalHeaderBlue) this.dom.historyModalHeaderBlue.textContent = 'Blue';

        // Show start selector with updated button states
        this.showStartSelector();
    }

    // UI Helper Methods

    findPok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return null;
        return round.poks.find(p => p.id === pokId);
    }

    renderPoksForRound(round) {
        // Clear existing POKs
        this.pokElements.forEach(el => {
            if (el && el.parentNode) {
                el.remove();
            }
        });
        this.pokElements.clear();

        // Render all POKs from the round
        if (round && round.poks) {
            round.poks.forEach(pok => {
                const pokEl = this.createPokElement(pok);
                this.pokElements.set(pok.id, pokEl);
                if (this.tableElement) {
                    this.tableElement.appendChild(pokEl);
                }
            });
        }
    }

    updateRoundScoreDisplay(round) {
        const scores = this.calculateRoundScores(round);

        this.dom.redRound.textContent = scores.red;
        this.dom.blueRound.textContent = scores.blue;
        this.dom.redPoksInfo.textContent = round.redPoksRemaining;
        this.dom.bluePoksInfo.textContent = round.bluePoksRemaining;

        const diff = Math.abs(scores.red - scores.blue);
        this.dom.scoreDiff.textContent = diff > 0 ? '+' + diff : '0';

        // Update background color
        this.dom.currentRoundScore.classList.remove('red-leading', 'blue-leading', 'tied');
        if (scores.red > scores.blue) {
            this.dom.currentRoundScore.classList.add('red-leading');
        } else if (scores.blue > scores.red) {
            this.dom.currentRoundScore.classList.add('blue-leading');
        } else {
            this.dom.currentRoundScore.classList.add('tied');
        }
    }

    updateNextPlayerTurn() {
        const round = this.gameState.getCurrentRound();

        // Don't show turn notification if round is complete
        if (round && round.isComplete) {
            document.body.classList.remove('red-turn', 'blue-turn');
            return;
        }

        const nextPlayer = this.gameState.getNextPlayer();
        if (nextPlayer) {
            this.showTurnNotification(nextPlayer);
            this.updateBodyClass(nextPlayer);
        }
    }

    createPokElement(pok) {
        const el = document.createElement('div');
        el.className = `pok ${pok.playerId}`;
        if (!pok.isHigh) {
            el.classList.add('low-score');
        }
        if (pok.boundaryZone) {
            el.classList.add('boundary-zone');
        }
        el.textContent = pok.points;
        el.style.left = `${pok.x}%`;
        el.style.top = `${pok.y}%`;
        el.draggable = true;
        return el;
    }

    clearLastPlacedHighlight() {
        document.querySelectorAll('.pok.last-placed').forEach(el => {
            el.classList.remove('last-placed');
        });
    }

    updateScores() {
        const state = this.gameState.getState();
        const round = this.gameState.getCurrentRound();

        // Total scores
        this.dom.mainRedTotal.textContent = state.players.red.totalScore;
        this.dom.mainBlueTotal.textContent = state.players.blue.totalScore;

        // Update score visualizer
        if (this.scoreVisualizer) {
            this.scoreVisualizer.updateScores(
                state.players.red.totalScore,
                state.players.blue.totalScore
            );
        }

        if (round) {
            const scores = this.gameState.getRoundScores();

            // Round scores
            this.dom.redRound.textContent = scores.red;
            this.dom.blueRound.textContent = scores.blue;

            // POKs remaining
            this.dom.redPoksInfo.textContent = round.redPoksRemaining;
            this.dom.bluePoksInfo.textContent = round.bluePoksRemaining;

            // Score difference
            const diff = Math.abs(scores.red - scores.blue);
            this.dom.scoreDiff.textContent = diff > 0 ? '+' + diff : '0';

            // Background color
            this.dom.currentRoundScore.classList.remove('red-leading', 'blue-leading', 'tied');
            if (scores.red > scores.blue) {
                this.dom.currentRoundScore.classList.add('red-leading');
            } else if (scores.blue > scores.red) {
                this.dom.currentRoundScore.classList.add('blue-leading');
            } else {
                this.dom.currentRoundScore.classList.add('tied');
            }
        }
    }

    showTurnNotification(playerId) {
        if (!this.dom.turnNotification) return;

        const playerName = this.gameState.getPlayerName(playerId);
        this.dom.turnNotification.textContent = `${playerName}'s turn`;

        this.dom.turnNotification.classList.remove('show', 'fade-out', 'red-player', 'blue-player');
        this.dom.turnNotification.classList.add(`${playerId}-player`);

        // Force reflow
        void this.dom.turnNotification.offsetWidth;

        // Fade in
        this.dom.turnNotification.classList.add('show');

        // Fade out after delay
        setTimeout(() => {
            this.dom.turnNotification.classList.remove('show');
            this.dom.turnNotification.classList.add('fade-out');
        }, CONFIG.TURN_NOTIFICATION_MS);
    }

    updateBodyClass(playerId) {
        document.body.classList.remove('red-turn', 'blue-turn');
        document.body.classList.add(`${playerId}-turn`);
    }

    showRoundModal(event) {
        const state = this.gameState.getState();
        const scores = { red: event.data.redScore, blue: event.data.blueScore };
        const diff = Math.abs(scores.red - scores.blue);
        const playerNames = this.gameState.getPlayerNames();

        let winnerText, bgClass;
        if (scores.red > scores.blue) {
            winnerText = `${playerNames.red.toUpperCase()} WINS!`;
            bgClass = 'red-bg';
        } else if (scores.blue > scores.red) {
            winnerText = `${playerNames.blue.toUpperCase()} WINS!`;
            bgClass = 'blue-bg';
        } else {
            winnerText = 'TIE!';
            bgClass = 'tie-bg';
        }

        this.dom.modalRoundNumber.textContent = `Round ${event.data.roundNumber + 1}`;
        this.dom.modalWinner.textContent = winnerText;
        this.dom.modalRedScore.textContent = scores.red;
        this.dom.modalBlueScore.textContent = scores.blue;
        this.dom.modalScoreDiff.textContent = diff > 0 ? '+' + diff : '0';
        this.dom.modalTotalScores.textContent =
            `Total: ${playerNames.red} ${state.players.red.totalScore} - ${playerNames.blue} ${state.players.blue.totalScore}`;

        this.dom.roundModal.classList.remove('red-bg', 'blue-bg', 'tie-bg');
        this.dom.roundModal.classList.add(bgClass, 'show');
    }

    hideRoundModal() {
        this.dom.roundModal.classList.remove('show');
    }

    updateRoundsHistory() {
        if (!this.dom.historyTableBody) return;

        const state = this.gameState.getState();
        const playerNames = this.gameState.getPlayerNames();
        this.dom.historyTableBody.innerHTML = '';

        state.rounds.forEach((round, index) => {
            const row = document.createElement('tr');

            const scores = this.calculateRoundScores(round);
            const diff = Math.abs(scores.red - scores.blue);

            let winner, winnerClass, rowClass;
            if (round.isComplete) {
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
                winner = 'In progress';
                winnerClass = 'winner-current';
                rowClass = 'round-row-current';
            }

            row.className = rowClass;
            row.innerHTML = `
                <td class="round-number">${index + 1}</td>
                <td>${scores.red}</td>
                <td>${scores.blue}</td>
                <td class="${winnerClass}">${winner}</td>
                <td>${round.isComplete ? diff : '-'}</td>
            `;

            // Add hover functionality to temporarily show this round
            row.addEventListener('mouseenter', () => {
                this.showRoundPreview(index);
            });

            row.addEventListener('mouseleave', () => {
                this.hideRoundPreview();
            });

            this.dom.historyTableBody.appendChild(row);
        });
    }

    calculateRoundScores(round) {
        const redScore = round.poks
            .filter(p => p.playerId === 'red')
            .reduce((sum, p) => sum + p.points, 0);

        const blueScore = round.poks
            .filter(p => p.playerId === 'blue')
            .reduce((sum, p) => sum + p.points, 0);

        return { red: redScore, blue: blueScore };
    }

    showRoundPreview(roundIndex) {
        const state = this.gameState.getState();
        const round = state.rounds[roundIndex];
        if (!round) return;

        // Render POKs and update scores for the selected round
        this.renderPoksForRound(round);
        this.updateRoundScoreDisplay(round);

        // Restore table flip state for this round
        this.dom.tableContainer.classList.toggle('flipped', round.isFlipped);
        this.swapCircleZoneDOMPositions(round.isFlipped);
    }

    hideRoundPreview() {
        const currentRound = this.gameState.getCurrentRound();
        if (!currentRound) return;

        // Restore current round display
        this.renderPoksForRound(currentRound);

        // Re-highlight last placed POK
        this.clearLastPlacedHighlight();
        if (currentRound.lastPlacedPokId) {
            const lastPokEl = this.pokElements.get(currentRound.lastPlacedPokId);
            if (lastPokEl) {
                lastPokEl.classList.add('last-placed');
            }
        }

        // Restore current scores
        this.updateScores();

        // Restore current table flip state
        this.dom.tableContainer.classList.toggle('flipped', currentRound.isFlipped);
        this.swapCircleZoneDOMPositions(currentRound.isFlipped);
    }

    showStartSelector() {
        this.dom.startSelector.classList.remove('hidden');

        // Show continue button if saved game exists
        const savedData = localStorage.getItem('pok-event-store');
        if (savedData) {
            this.dom.continueButton.classList.add('show');
            this.dom.saveLatestButton.classList.add('show');

            // Prefill name inputs with saved player names
            this.prefillPlayerNames(savedData);
        } else {
            this.dom.continueButton.classList.remove('show');
            this.dom.saveLatestButton.classList.remove('show');
        }
    }

    prefillPlayerNames(savedData) {
        try {
            const data = JSON.parse(savedData);
            if (data && data.events) {
                // Find the most recent GAME_STARTED event
                const gameStartedEvents = data.events.filter(e => e.type === 'GAME_STARTED');
                if (gameStartedEvents.length > 0) {
                    const lastGameStarted = gameStartedEvents[gameStartedEvents.length - 1];
                    const redName = lastGameStarted.data.redName;
                    const blueName = lastGameStarted.data.blueName;

                    // Only prefill if names are non-default
                    const redNameInput = document.getElementById('redPlayerName');
                    const blueNameInput = document.getElementById('bluePlayerName');

                    if (redNameInput && redName && redName !== 'Red') {
                        redNameInput.value = redName;
                    }
                    if (blueNameInput && blueName && blueName !== 'Blue') {
                        blueNameInput.value = blueName;
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    showContinueButton() {
        this.dom.continueButton.classList.add('show');
        this.dom.saveLatestButton.classList.add('show');
    }

    hideStartSelector() {
        this.dom.startSelector.classList.add('hidden');
    }

    clearTable() {
        // Remove DOM elements first
        this.pokElements.forEach(el => {
            if (el && el.parentNode) {
                el.remove();
            }
        });
        // Clear the map
        this.pokElements.clear();
    }
}
