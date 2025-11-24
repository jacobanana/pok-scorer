// ============================================
// UI PROJECTION
// ============================================

import { CONFIG } from './config.js';

export class UIProjection {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;
        this.dom = {};
        this.pokElements = new Map();
        this.tableElement = null;

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
            currentRoundScore: document.getElementById('currentRoundScoreDisplay'),
            turnNotification: document.getElementById('playerTurnNotification')
        };

        this.tableElement = this.dom.table;
    }

    onGameStarted(event) {
        this.hideStartSelector();
        this.updateScores();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
    }

    onPokPlaced(event) {
        const pok = this.findPok(event.data.pokId);
        if (!pok) {
            console.error('POK not found in game state:', event.data.pokId);
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
        this.clearTable();
        this.updateScores();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
        this.updateRoundsHistory();
    }

    onTableFlipped(event) {
        this.dom.tableContainer.classList.toggle('flipped', event.data.isFlipped);
    }

    onGameReset(event) {
        this.clearTable();
        this.hideRoundModal();
        this.showStartSelector();
        this.updateScores();
        this.updateRoundsHistory();
        document.body.className = '';
    }

    // UI Helper Methods

    findPok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return null;
        return round.poks.find(p => p.id === pokId);
    }

    renderPoksForRound(round) {
        // Clear existing POKs
        this.pokElements.forEach(el => el.remove());
        this.pokElements.clear();

        // Render all POKs from the round
        round.poks.forEach(pok => {
            const pokEl = this.createPokElement(pok);
            this.pokElements.set(pok.id, pokEl);
            this.tableElement.appendChild(pokEl);
        });
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

        const playerName = playerId === 'red' ? 'Red' : 'Blue';
        this.dom.turnNotification.textContent = `${playerName}'s turn`;

        this.dom.turnNotification.classList.remove('show', 'fade-out', 'red-player', 'blue-player');
        this.dom.turnNotification.classList.add(`${playerId}-player`);

        // Hide score display
        this.dom.currentRoundScore.classList.add('hidden');

        // Force reflow
        void this.dom.turnNotification.offsetWidth;

        // Fade in
        this.dom.turnNotification.classList.add('show');

        // Fade out after delay
        setTimeout(() => {
            this.dom.turnNotification.classList.remove('show');
            this.dom.turnNotification.classList.add('fade-out');

            setTimeout(() => {
                this.dom.currentRoundScore.classList.remove('hidden');
            }, 300);
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

        let winnerText, bgClass;
        if (scores.red > scores.blue) {
            winnerText = 'RED WINS!';
            bgClass = 'red-bg';
        } else if (scores.blue > scores.red) {
            winnerText = 'BLUE WINS!';
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
            `Total: Red ${state.players.red.totalScore} - Blue ${state.players.blue.totalScore}`;

        this.dom.roundModal.classList.remove('red-bg', 'blue-bg', 'tie-bg');
        this.dom.roundModal.classList.add(bgClass, 'show');
    }

    hideRoundModal() {
        this.dom.roundModal.classList.remove('show');
    }

    updateRoundsHistory() {
        if (!this.dom.historyTableBody) return;

        const state = this.gameState.getState();
        this.dom.historyTableBody.innerHTML = '';

        state.rounds.forEach((round, index) => {
            const row = document.createElement('tr');

            const scores = this.calculateRoundScores(round);
            const diff = Math.abs(scores.red - scores.blue);

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
    }

    showStartSelector() {
        this.dom.startSelector.classList.remove('hidden');

        // Show continue button if saved game exists
        if (localStorage.getItem('pok-event-store')) {
            this.dom.continueButton.classList.add('show');
            this.dom.saveLatestButton.classList.add('show');
        } else {
            this.dom.continueButton.classList.remove('show');
            this.dom.saveLatestButton.classList.remove('show');
        }
    }

    hideStartSelector() {
        this.dom.startSelector.classList.add('hidden');
    }

    clearTable() {
        this.pokElements.forEach(el => el.remove());
        this.pokElements.clear();
    }
}
