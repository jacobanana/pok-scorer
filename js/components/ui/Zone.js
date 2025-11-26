import { Component } from '../core/Component.js';

/**
 * Zone component - Base game scoring zone
 *
 * Props:
 * - zone: number - Zone number (0-5)
 * - showLabel: boolean - Whether to show the zone label (default true)
 */
export class Zone extends Component {
    /** CSS class for the zone */
    get zoneClass() {
        return 'zone';
    }

    template() {
        const { zone = 0, showLabel = true } = this.props;
        const label = showLabel && zone > 0 ? `<div class="zone-label">${zone}</div>` : '';

        return `
            <div class="${this.zoneClass}" data-zone="${zone}">
                ${label}
            </div>
        `.trim();
    }

    /**
     * Highlight the zone (e.g., on hover)
     * @returns {Zone} this for chaining
     */
    highlight() {
        this.addClass('boundary-highlight');
        return this;
    }

    /**
     * Remove highlight
     * @returns {Zone} this for chaining
     */
    unhighlight() {
        this.removeClass('boundary-highlight');
        return this;
    }

    /**
     * Toggle highlight state
     * @param {boolean} state - Force state
     * @returns {Zone} this for chaining
     */
    toggleHighlight(state) {
        this.toggleClass('boundary-highlight', state);
        return this;
    }

    /**
     * Check if zone is highlighted
     * @returns {boolean}
     */
    isHighlighted() {
        return this.hasClass('boundary-highlight');
    }

    /**
     * Get the zone number
     * @returns {number}
     */
    getZoneNumber() {
        return this.props.zone;
    }
}

/**
 * CircleZone component - Circular scoring zone
 *
 * Props:
 * - zone: number - Zone number (4 or 5)
 * - position: string - 'top' or 'bottom'
 * - showLabel: boolean - Whether to show the zone label (default true)
 */
export class CircleZone extends Zone {
    get zoneClass() {
        const { position } = this.props;
        return position ? `circle-zone ${position}` : 'circle-zone';
    }
}

/**
 * ZoneColumn component - Wrapper for zones in a column
 *
 * Props:
 * - isZeroColumn: boolean - Whether this is the zero column
 */
export class ZoneColumn extends Component {
    template() {
        const { isZeroColumn } = this.props;
        const className = isZeroColumn ? 'column zero-column' : 'column';
        return `<div class="${className}"></div>`;
    }
}
