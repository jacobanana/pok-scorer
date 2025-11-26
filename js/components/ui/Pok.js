import { Component } from '../core/Component.js';

/**
 * Pok component - A draggable POK piece on the game board
 *
 * Props:
 * - id: string - POK ID
 * - playerId: string - Player ID ('red' or 'blue')
 * - points: number - Point value of this POK
 * - x: number - X position (percentage)
 * - y: number - Y position (percentage)
 * - isHigh: boolean - Whether this is a high-scoring POK
 * - boundaryZone: string|null - Boundary zone indicator
 * - isLastPlaced: boolean - Whether this is the last placed POK
 * - draggable: boolean - Whether the POK can be dragged (default true)
 */
export class Pok extends Component {
    template() {
        const {
            playerId = 'red',
            points = 0,
            isHigh = true,
            boundaryZone,
            isLastPlaced = false,
            draggable = true
        } = this.props;

        const classes = ['pok', playerId];
        if (!isHigh) classes.push('low-score');
        if (boundaryZone) classes.push('boundary-zone');
        if (isLastPlaced) classes.push('last-placed');

        const draggableAttr = draggable ? 'draggable="true"' : '';

        return `<div class="${classes.join(' ')}" ${draggableAttr}>${points}</div>`;
    }

    onCreate() {
        // Set initial position
        this.setPosition(this.props.x, this.props.y);
    }

    /**
     * Set the POK position
     * @param {number} x - X position (percentage)
     * @param {number} y - Y position (percentage)
     * @returns {Pok} this for chaining
     */
    setPosition(x, y) {
        if (x !== undefined) {
            this.props.x = x;
            this.css('left', `${x}%`);
        }
        if (y !== undefined) {
            this.props.y = y;
            this.css('top', `${y}%`);
        }
        return this;
    }

    /**
     * Get the POK position
     * @returns {{ x: number, y: number }}
     */
    getPosition() {
        return { x: this.props.x, y: this.props.y };
    }

    /**
     * Set as last placed (add highlight)
     * @returns {Pok} this for chaining
     */
    setLastPlaced() {
        this.addClass('last-placed');
        this.props.isLastPlaced = true;
        return this;
    }

    /**
     * Clear last placed highlight
     * @returns {Pok} this for chaining
     */
    clearLastPlaced() {
        this.removeClass('last-placed');
        this.props.isLastPlaced = false;
        return this;
    }

    /**
     * Set dragging state
     * @param {boolean} isDragging
     * @returns {Pok} this for chaining
     */
    setDragging(isDragging) {
        this.toggleClass('dragging', isDragging);
        return this;
    }

    /**
     * Check if POK is being dragged
     * @returns {boolean}
     */
    isDragging() {
        return this.hasClass('dragging');
    }

    /**
     * Update POK with new data
     * @param {Object} pokData - POK data object
     * @returns {Pok} this for chaining
     */
    updateFromData(pokData) {
        const { x, y, points, isHigh, boundaryZone } = pokData;

        this.setPosition(x, y);

        if (points !== undefined) {
            this.setText(points);
            this.props.points = points;
        }

        if (isHigh !== undefined) {
            this.toggleClass('low-score', !isHigh);
            this.props.isHigh = isHigh;
        }

        if (boundaryZone !== undefined) {
            this.toggleClass('boundary-zone', !!boundaryZone);
            this.props.boundaryZone = boundaryZone;
        }

        return this;
    }

    /**
     * Get POK ID
     * @returns {string}
     */
    getId() {
        return this.props.id;
    }

    /**
     * Get player ID
     * @returns {string}
     */
    getPlayerId() {
        return this.props.playerId;
    }

    /**
     * Get points value
     * @returns {number}
     */
    getPoints() {
        return this.props.points;
    }
}
