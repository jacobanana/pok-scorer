import { Component } from '../core/Component.js';
import { PLAYERS } from '../../config.js';

/**
 * ScoreCircle component - Base circular score display
 *
 * Props:
 * - color: string - PLAYERS.RED or PLAYERS.BLUE
 * - score: number - Score to display
 * - id: string - Optional ID for the score span
 */
export class ScoreCircle extends Component {
    /** Base CSS class for the circle */
    get baseClass() {
        return 'score-circle';
    }

    /** Whether to use color as class directly (vs color-circle) */
    get useColorDirectly() {
        return false;
    }

    template() {
        const { color = PLAYERS.RED, score = 0, id } = this.props;
        const colorClass = this.useColorDirectly ? color : `${color}-circle`;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="${this.baseClass} ${colorClass}">
                <span ${idAttr}>${score}</span>
            </div>
        `.trim();
    }

    /**
     * Set the score value
     * @param {number} score
     * @returns {ScoreCircle} this for chaining
     */
    setScore(score) {
        const span = this.find('span');
        if (span) {
            span.textContent = score;
        }
        this.props.score = score;
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
     * Animate score change
     * @param {number} newScore
     * @param {number} duration - Animation duration in ms
     * @returns {ScoreCircle} this for chaining
     */
    animateScore(newScore, duration = 300) {
        const startScore = this.getScore();
        const diff = newScore - startScore;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + diff * eased);

            this.setScore(currentScore);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
        return this;
    }
}

/** Modal variant of score circle */
export class ModalScoreCircle extends ScoreCircle {
    get baseClass() {
        return 'modal-score-circle';
    }
}

/** POK-style number display */
export class PokStyleScore extends ScoreCircle {
    get baseClass() {
        return 'pok-style-number';
    }

    get useColorDirectly() {
        return true;
    }
}
