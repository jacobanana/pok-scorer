// ============================================
// ROUND MODAL CONTROLLER
// Manages round end modal, round preview, and history modal
// ============================================

import { PLAYERS } from '../../config.js';

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
        const modal = this.components.roundModal;
        if (!modal) return;

        modal.find('#roundEndModalRoundNumber').textContent = `Round ${event.data.roundNumber + 1}`;
        modal.find('#roundEndModalWinner').textContent = winnerText;

        // Update modal scores
        this.scoreDisplayManager.updateModalScores(round, state);

        // Set background and show
        modal.removeClass('red-bg', 'blue-bg', 'tie-bg');
        modal.addClass(bgClass);
        modal.open();
    }

    /**
     * Hide the round end modal
     */
    hideRoundModal() {
        this.components.roundModal?.close();
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
