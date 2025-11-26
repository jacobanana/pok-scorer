import { Component } from '../core/Component.js';

/**
 * ScoreCircle component - Circular score display
 *
 * Props:
 * - color: string - 'red' or 'blue'
 * - score: number - Score to display
 * - variant: string - 'default', 'modal', 'pok-style'
 * - id: string - Optional ID for the score span
 */
export class ScoreCircle extends Component {
    template() {
        const { color = 'red', score = 0, variant = 'default', id } = this.props;

        const colorClass = `${color}-circle`;
        const idAttr = id ? `id="${id}"` : '';

        if (variant === 'modal') {
            return `
                <div class="modal-score-circle ${colorClass}">
                    <span ${idAttr}>${score}</span>
                </div>
            `.trim();
        }

        if (variant === 'pok-style') {
            return `
                <div class="pok-style-number ${color}">
                    <span ${idAttr}>${score}</span>
                </div>
            `.trim();
        }

        return `
            <div class="score-circle ${colorClass}">
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
