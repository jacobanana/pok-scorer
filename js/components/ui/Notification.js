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
     * Show notification without auto-hide (for edit mode)
     * @param {string} message
     * @param {string} styleClass - CSS class for styling
     * @returns {Notification} this for chaining
     */
    showPersistent(message, styleClass = '') {
        this.clearTimeouts();
        this.setText(message);
        this.removeClass('red-player', 'blue-player', 'edit-mode', 'fade-in', 'fade-out');

        if (styleClass) {
            this.addClass(styleClass);
        }

        this.addClass('show');
        this.addClass('fade-in');

        return this;
    }

    /**
     * Hide the notification immediately
     * @returns {Notification} this for chaining
     */
    hide() {
        this.clearTimeouts();
        this.removeClass('show', 'fade-in', 'fade-out', 'red-player', 'blue-player', 'edit-mode');
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
        this._fadeTimeout = setTimeout(() => {
            this.removeClass('show', 'fade-out', 'red-player', 'blue-player', 'edit-mode');
        }, 300);

        return this;
    }

    /**
     * Clear any pending timeouts
     * @returns {Notification} this for chaining
     */
    clearTimeouts() {
        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
            this._hideTimeout = null;
        }
        if (this._fadeTimeout) {
            clearTimeout(this._fadeTimeout);
            this._fadeTimeout = null;
        }
        return this;
    }

    onUnmount() {
        this.clearTimeouts();
    }
}
