import { Component } from '../core/Component.js';

/**
 * ScoreMarkers component - Marble scoreboard visualization
 *
 * Props:
 * - color: string - 'red' or 'blue'
 * - score: number - Current score (0-21)
 * - totalMarkers: number - Total markers to display (default 21)
 * - id: string - Optional ID for the markers container
 */
export class ScoreMarkers extends Component {
    /** CSS class for the container */
    get containerClass() {
        return 'score-visualizer';
    }

    template() {
        const { color = 'red', id } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="${this.containerClass} ${color}-visualizer">
                <div class="score-bar">
                    <div class="score-track"></div>
                    <div class="score-markers" ${idAttr}></div>
                </div>
            </div>
        `.trim();
    }

    onCreate() {
        this.totalMarkers = this.props.totalMarkers || 21;
        this._createMarkers();

        // Set initial score if provided
        if (this.props.score !== undefined) {
            this.setScore(this.props.score);
        }
    }

    /**
     * Create marker elements
     * @private
     */
    _createMarkers() {
        const container = this.find('.score-markers');
        if (!container) return;

        const { color = 'red' } = this.props;

        container.innerHTML = '';
        for (let i = 0; i < this.totalMarkers; i++) {
            const marker = document.createElement('div');
            marker.className = 'score-marker';
            marker.dataset.position = i;
            marker.dataset.color = color;

            // Position evenly across the bar
            // Red: start from right (100%) and go left
            // Blue: start from left (0%) and go right
            let position;
            if (color === 'red') {
                position = 100 - (i / (this.totalMarkers - 1)) * 100;
            } else {
                position = (i / (this.totalMarkers - 1)) * 100;
            }
            marker.style.left = `${position}%`;

            container.appendChild(marker);
        }
    }

    /**
     * Set the score and update marker states
     * @param {number} score - Score value (0-21)
     * @returns {ScoreMarkers} this for chaining
     */
    setScore(score) {
        const container = this.find('.score-markers');
        if (!container) return this;

        // Clamp score between 0 and totalMarkers
        const clampedScore = Math.max(0, Math.min(this.totalMarkers, score));
        this.props.score = clampedScore;

        const markers = container.querySelectorAll('.score-marker');
        markers.forEach((marker, index) => {
            if (index < clampedScore) {
                marker.classList.add('scored');
            } else {
                marker.classList.remove('scored');
            }
        });

        return this;
    }

    /**
     * Get the current score
     * @returns {number}
     */
    getScore() {
        return this.props.score || 0;
    }

    /**
     * Reset score to 0
     * @returns {ScoreMarkers} this for chaining
     */
    reset() {
        return this.setScore(0);
    }

    /**
     * Animate score change
     * @param {number} newScore
     * @param {number} duration - Animation duration in ms
     * @returns {ScoreMarkers} this for chaining
     */
    animateScore(newScore, duration = 500) {
        const startScore = this.getScore();
        const diff = newScore - startScore;

        if (diff === 0) return this;

        const step = diff > 0 ? 1 : -1;
        const stepDuration = duration / Math.abs(diff);
        let currentStep = 0;

        const animate = () => {
            currentStep++;
            const currentScore = startScore + (step * currentStep);
            this.setScore(currentScore);

            if (currentStep < Math.abs(diff)) {
                setTimeout(animate, stepDuration);
            }
        };

        animate();
        return this;
    }
}

/** Modal variant of score markers */
export class ModalScoreMarkers extends ScoreMarkers {
    get containerClass() {
        return 'modal-score-visualizer';
    }
}
