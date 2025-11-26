import { Component } from '../core/Component.js';

/**
 * Notification component - Player turn notification overlay
 *
 * Props:
 * - id: string - Element ID
 * - message: string - Initial message
 * - duration: number - Auto-hide duration in ms (0 to disable)
 */
export class Notification extends Component {
    template() {
        const { id, message = '' } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `<div class="player-turn-notification" ${idAttr}>${message}</div>`;
    }

    /**
     * Show the notification with a message
     * @param {string} message
     * @param {string} playerClass - 'red-player' or 'blue-player' for styling
     * @returns {Notification} this for chaining
     */
    showMessage(message, playerClass = '') {
        this.setText(message);
        this.removeClass('red-player', 'blue-player', 'fade-in', 'fade-out');

        if (playerClass) {
            this.addClass(playerClass);
        }

        this.addClass('show');
        this.addClass('fade-in');

        return this;
    }

    /**
     * Show notification with auto-hide after duration
     * @param {string} message
     * @param {string} playerClass
     * @param {number} duration - Duration in ms before auto-hide
     * @returns {Notification} this for chaining
     */
    showTimed(message, playerClass = '', duration = 2000) {
        this.showMessage(message, playerClass);

        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
        }

        this._hideTimeout = setTimeout(() => {
            this.fadeOut();
        }, duration);

        return this;
    }

    /**
     * Fade out the notification
     * @returns {Notification} this for chaining
     */
    fadeOut() {
        this.removeClass('fade-in');
        this.addClass('fade-out');

        // Hide after animation completes
        setTimeout(() => {
            this.removeClass('show', 'fade-out', 'red-player', 'blue-player');
        }, 300);

        return this;
    }

    /**
     * Clear any pending auto-hide
     * @returns {Notification} this for chaining
     */
    clearTimeout() {
        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
            this._hideTimeout = null;
        }
        return this;
    }
}
