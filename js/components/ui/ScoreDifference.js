import { Component } from '../core/Component.js';

/**
 * ScoreDifference component - Displays score difference between players
 *
 * Props:
 * - id: string - Element ID
 * - difference: number - Score difference value
 * - variant: string - 'default' or 'modal'
 */
export class ScoreDifference extends Component {
    template() {
        const { id, difference = 0, variant = 'default' } = this.props;
        const idAttr = id ? `id="${id}"` : '';
        const className = variant === 'modal' ? 'modal-score-difference' : 'score-difference';

        return `<div class="${className}" ${idAttr}>${difference}</div>`;
    }

    /**
     * Set the difference value
     * @param {number} value
     * @returns {ScoreDifference} this for chaining
     */
    setDifference(value) {
        this.setText(value);
        this.props.difference = value;
        return this;
    }

    /**
     * Get the current difference value
     * @returns {number}
     */
    getDifference() {
        return this.props.difference || 0;
    }

    /**
     * Update from red and blue scores
     * @param {number} redScore
     * @param {number} blueScore
     * @returns {ScoreDifference} this for chaining
     */
    updateFromScores(redScore, blueScore) {
        const diff = Math.abs(redScore - blueScore);
        return this.setDifference(diff);
    }
}
