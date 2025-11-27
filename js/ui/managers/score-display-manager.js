// ============================================
// SCORE DISPLAY MANAGER
// Updates all score-related displays
// ============================================

/**
 * Manages all score display updates across the UI
 */
export class ScoreDisplayManager {
    constructor(gameState, components) {
        this.gameState = gameState;
        this.components = components;
    }

    /**
     * Update all score displays (main visualizer and markers)
     */
    updateScores() {
        const state = this.gameState.getState();
        const round = this.gameState.getCurrentRound();

        // Update score markers
        this.components.redScoreMarkers?.setScore(state.players.red.totalScore);
        this.components.blueScoreMarkers?.setScore(state.players.blue.totalScore);

        // Update end POK indicators
        const endPokRed = document.getElementById('endPokScoreRed');
        const endPokBlue = document.getElementById('endPokScoreBlue');
        if (endPokRed) endPokRed.textContent = state.players.red.totalScore;
        if (endPokBlue) endPokBlue.textContent = state.players.blue.totalScore;

        if (round) {
            this.updateCurrentRoundScores(round);
        }
    }

    /**
     * Update current round score display
     */
    updateCurrentRoundScores(round) {
        const scores = this.gameState.getRoundScores(round);

        // Update current round score display
        this.components.currentRedScore?.setScore(scores.red);
        this.components.currentBlueScore?.setScore(scores.blue);

        const diff = Math.abs(scores.red - scores.blue);
        this.components.currentDiff?.setDifference(diff > 0 ? `+${diff}` : '0');

        // Update background color class
        const scoreDisplay = document.getElementById('currentRoundScoreDisplay');
        if (scoreDisplay) {
            scoreDisplay.classList.remove('red-leading', 'blue-leading', 'tied');
            if (scores.red > scores.blue) {
                scoreDisplay.classList.add('red-leading');
            } else if (scores.blue > scores.red) {
                scoreDisplay.classList.add('blue-leading');
            } else {
                scoreDisplay.classList.add('tied');
            }
        }
    }

    /**
     * Update modal score displays
     */
    updateModalScores(round, state) {
        const scores = this.gameState.getRoundScores(round);
        const diff = Math.abs(scores.red - scores.blue);

        // Update modal score circle components
        this.components.modalRedScore?.setScore(scores.red);
        this.components.modalBlueScore?.setScore(scores.blue);
        this.components.modalScoreDiff?.setDifference(diff > 0 ? `+${diff}` : '0');

        // Update modal score visualizers
        this.components.modalRedMarkers?.setScore(state.players.red.totalScore);
        this.components.modalBlueMarkers?.setScore(state.players.blue.totalScore);

        // Update center POK scores
        const modal = this.components.roundModal;
        if (modal) {
            modal.find('#modalCenterPokScoreRed').textContent = state.players.red.totalScore;
            modal.find('#modalCenterPokScoreBlue').textContent = state.players.blue.totalScore;
        }
    }

    /**
     * Reset all score displays
     */
    resetScores() {
        this.components.redScoreMarkers?.reset();
        this.components.blueScoreMarkers?.reset();
    }
}
