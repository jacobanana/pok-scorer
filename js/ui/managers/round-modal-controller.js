// ============================================
// ROUND MODAL CONTROLLER
// Manages round end modal, round preview, and history modal
// ============================================

import { PLAYERS, CONFIG } from '../../config.js';
import { startConfetti, destroyConfetti } from '../../effects/index.js';
import { DOMHelper } from '../../utils/dom-helper.js';

/**
 * Controls modal displays: round end, round preview, history
 */
export class RoundModalController {
    constructor(gameState, components, containers, pokRenderer, scoreDisplayManager) {
        this.gameState = gameState;
        this.components = components;
        this.containers = containers;
        this.pokRenderer = pokRenderer;
        this.scoreDisplayManager = scoreDisplayManager;
        this.confettiActive = false;

        // Event handlers
        this.handlers = {
            onEditBoard: null,
            onSaveGame: null
        };
    }

    /**
     * Set event handlers
     */
    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    }

    /**
     * Initialize the edit board button
     */
    initEditBoardButton() {
        DOMHelper.on('editBoardButton', 'click', () => this._handleEditBoardClick(), true);
    }

    /**
     * Initialize the save game button
     */
    initSaveGameButton() {
        DOMHelper.on('saveGameButton', 'click', () => this._handleSaveGameClick(), true);
    }

    /**
     * Handle edit board button click
     * @private
     */
    _handleEditBoardClick() {
        this.hideRoundModal();
        this.handlers.onEditBoard?.();
    }

    /**
     * Handle save game button click
     * @private
     */
    _handleSaveGameClick() {
        this.handlers.onSaveGame?.();
    }

    /**
     * Show the edit board button
     * @private
     */
    _showEditBoardButton() {
        DOMHelper.show('editBoardButton');
    }

    /**
     * Hide the edit board button
     * @private
     */
    _hideEditBoardButton() {
        DOMHelper.hide('editBoardButton');
    }

    /**
     * Show the save game button
     * @private
     */
    _showSaveGameButton() {
        DOMHelper.show('saveGameButton');
    }

    /**
     * Hide the save game button
     * @private
     */
    _hideSaveGameButton() {
        DOMHelper.hide('saveGameButton');
    }

    /**
     * Check if the game has a winner after this round
     * @private
     */
    _checkForGameWinner(state) {
        const redTotal = state.players[PLAYERS.RED].totalScore;
        const blueTotal = state.players[PLAYERS.BLUE].totalScore;

        if (redTotal >= CONFIG.WINNING_SCORE) {
            return { winner: PLAYERS.RED, name: state.playerNames.red, redScore: redTotal, blueScore: blueTotal };
        }
        if (blueTotal >= CONFIG.WINNING_SCORE) {
            return { winner: PLAYERS.BLUE, name: state.playerNames.blue, redScore: redTotal, blueScore: blueTotal };
        }
        return null;
    }

    /**
     * Show the round end modal
     */
    showRoundModal(event) {
        const state = this.gameState.getState();
        const round = state.rounds[event.data.roundNumber];
        if (!round) return;

        // Calculate scores from the round's poks
        const scores = this.gameState.getRoundScores(round);

        // Check if this round ends the game
        const gameWinner = this._checkForGameWinner(state);

        if (gameWinner) {
            this._showGameWinnerModal(gameWinner, state, event.data.roundNumber);
        } else {
            this._showRoundEndModal(scores, state, event.data.roundNumber);
        }
    }

    /**
     * Show the game winner celebration modal
     * @private
     */
    _showGameWinnerModal(gameWinner, state, roundNumber) {
        const modal = this.components.roundModal;
        if (!modal) return;

        // Update header to show "GAME OVER"
        const headerEl = modal.find('#roundEndModalRoundNumber');
        if (headerEl) {
            headerEl.innerHTML = `<span class="winner-trophy">🏆</span><br>GAME OVER`;
        }

        // Show champion name
        const winnerEl = modal.find('#roundEndModalWinner');
        if (winnerEl) {
            winnerEl.textContent = `${gameWinner.name.toUpperCase()} IS THE CHAMPION!`;
        }

        // Update center POK scores to show final total scores
        const redScoreEl = modal.find('#modalCenterPokScoreRed');
        const blueScoreEl = modal.find('#modalCenterPokScoreBlue');
        if (redScoreEl) redScoreEl.textContent = gameWinner.redScore;
        if (blueScoreEl) blueScoreEl.textContent = gameWinner.blueScore;

        // Update modal score circles to show final totals
        if (this.components.modalRedScore) {
            this.components.modalRedScore.setScore(gameWinner.redScore);
        }
        if (this.components.modalBlueScore) {
            this.components.modalBlueScore.setScore(gameWinner.blueScore);
        }
        if (this.components.modalScoreDiff) {
            const diff = Math.abs(gameWinner.redScore - gameWinner.blueScore);
            this.components.modalScoreDiff.setDifference(diff);
        }

        // Update modal score markers to show final totals
        if (this.components.modalRedMarkers) {
            this.components.modalRedMarkers.setScore(gameWinner.redScore);
        }
        if (this.components.modalBlueMarkers) {
            this.components.modalBlueMarkers.setScore(gameWinner.blueScore);
        }

        // Apply game winner styling (gold celebration theme)
        modal.removeClass('red-bg', 'blue-bg', 'tie-bg');
        modal.addClass('game-winner');

        // Hide edit board button and show save game button for game winner modal
        this._hideEditBoardButton();
        this._showSaveGameButton();

        modal.open();

        // Start the confetti celebration!
        this._startConfetti(modal.el);
    }

    /**
     * Start the confetti effect
     * @private
     */
    _startConfetti(container) {
        if (!container || this.confettiActive) return;

        this.confettiActive = true;
        startConfetti(container, { burstCount: 200 });
    }

    /**
     * Stop and clean up confetti
     * @private
     */
    _stopConfetti() {
        if (!this.confettiActive) return;

        this.confettiActive = false;
        destroyConfetti();
    }

    /**
     * Show regular round end modal
     * @private
     */
    _showRoundEndModal(scores, state, roundNumber) {
        const modal = this.components.roundModal;
        if (!modal) return;

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
        const headerEl = modal.find('#roundEndModalRoundNumber');
        if (headerEl) {
            headerEl.textContent = `Round ${roundNumber + 1}`;
        }

        const winnerEl = modal.find('#roundEndModalWinner');
        if (winnerEl) {
            winnerEl.textContent = winnerText;
        }

        // Update modal scores
        const round = state.rounds[roundNumber];
        this.scoreDisplayManager.updateModalScores(round, state);

        // Set background and show
        modal.removeClass('red-bg', 'blue-bg', 'tie-bg', 'game-winner');
        modal.addClass(bgClass);

        // Show edit board button and hide save button for regular round ends
        this._showEditBoardButton();
        this._hideSaveGameButton();

        modal.open();
    }

    /**
     * Hide the round end modal
     */
    hideRoundModal() {
        // Stop confetti if active
        this._stopConfetti();

        // Hide both buttons
        this._hideEditBoardButton();
        this._hideSaveGameButton();

        const modal = this.components.roundModal;
        if (modal) {
            // Clean up game winner styling when hiding
            modal.removeClass('game-winner');
            modal.close();
        }
    }

    /**
     * Show preview of a specific round (on history table hover)
     */
    showRoundPreview(roundIndex) {
        const state = this.gameState.getState();
        const round = state.rounds[roundIndex];
        if (!round) return;

        // Render POKs for this round
        this.pokRenderer.renderRoundPoks(round);

        // Update score display
        this.scoreDisplayManager.updateCurrentRoundScores(round);

        // Update table flip state
        this.containers.gameBoard?.classList.toggle('flipped', round.isFlipped);
        this._swapCircleZoneDOMPositions(round.isFlipped);
    }

    /**
     * Hide round preview and return to current round
     */
    hideRoundPreview() {
        const currentRound = this.gameState.getCurrentRound();
        if (!currentRound) return;

        // Restore current round POKs
        this.pokRenderer.renderRoundPoks(currentRound);
        this.pokRenderer.updateLastPlacedHighlight();

        // Restore current scores
        this.scoreDisplayManager.updateScores();

        // Restore table flip state
        this.containers.gameBoard?.classList.toggle('flipped', currentRound.isFlipped);
        this._swapCircleZoneDOMPositions(currentRound.isFlipped);
    }

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
        const playerNames = state.playerNames;

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

    /**
     * Swap circle zone positions for table flip
     * @private
     */
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
}
