import { Component } from '../core/Component.js';

/**
 * Button component - A reusable button with variants
 *
 * Props:
 * - text: string - Button text
 * - variant: string - Button variant ('primary', 'flip', 'history', 'new-game', 'save', 'import', 'continue', 'close')
 * - id: string - Optional ID
 * - disabled: boolean - Disabled state
 */
export class Button extends Component {
    template() {
        const { text = '', variant = 'primary', id, disabled } = this.props;

        const variantClasses = {
            'primary': 'primary-button',
            'flip': 'flip-table-button',
            'history': 'show-history-button',
            'new-game': 'new-game-button',
            'save': 'save-game-button',
            'import': 'import-match-button',
            'continue': 'continue-game-top-button',
            'save-latest': 'save-latest-game-button',
            'close': 'close-history-button'
        };

        const className = variantClasses[variant] || 'primary-button';
        const idAttr = id ? `id="${id}"` : '';
        const disabledAttr = disabled ? 'disabled' : '';

        return `<button class="${className}" ${idAttr} ${disabledAttr}>${text}</button>`;
    }

    /**
     * Set button text
     * @param {string} text
     * @returns {Button} this for chaining
     */
    setButtonText(text) {
        return this.setText(text);
    }

    /**
     * Enable the button
     * @returns {Button} this for chaining
     */
    enable() {
        if (this.el) {
            this.el.disabled = false;
            this.removeClass('disabled');
        }
        return this;
    }

    /**
     * Disable the button
     * @returns {Button} this for chaining
     */
    disable() {
        if (this.el) {
            this.el.disabled = true;
            this.addClass('disabled');
        }
        return this;
    }

    /**
     * Add click handler
     * @param {Function} handler
     * @returns {Button} this for chaining
     */
    onClick(handler) {
        return this.on('click', handler);
    }
}
