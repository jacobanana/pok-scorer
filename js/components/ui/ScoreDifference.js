import { Component } from '../core/Component.js';

/**
 * ScoreDifference component - Displays score difference between players
 *
 * Props:
 * - id: string - Element ID
 * - difference: number - Score difference value
 */
export class ScoreDifference extends Component {
    /** CSS class for the difference display */
    get differenceClass() {
        return 'score-difference';
    }

    template() {
        const { id, difference = 0 } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `<div class="${this.differenceClass}" ${idAttr}>${difference}</div>`;
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

/** Modal variant of score difference */
export class ModalScoreDifference extends ScoreDifference {
    get differenceClass() {
        return 'modal-score-difference';
    }
}
