import { Component } from '../core/Component.js';

/**
 * PlayerInput component - Player name input with start functionality
 *
 * Props:
 * - playerId: string - 'red' or 'blue'
 * - placeholder: string - Input placeholder
 * - value: string - Initial value
 * - maxLength: number - Max input length (default 20)
 * - id: string - Input element ID
 * - startLabel: string - Label text for start button (default 'TAP TO START')
 */
export class PlayerInput extends Component {
    template() {
        const {
            playerId = 'red',
            placeholder,
            value = '',
            maxLength = 20,
            id,
            startLabel = 'TAP TO START'
        } = this.props;

        const idAttr = id ? `id="${id}"` : '';
        const placeholderText = placeholder || (playerId.charAt(0).toUpperCase() + playerId.slice(1));

        return `
            <div class="start-half ${playerId}">
                <input type="text"
                    ${idAttr}
                    class="player-name-input"
                    placeholder="${placeholderText}"
                    maxlength="${maxLength}"
                    value="${value}"
                >
                <span class="start-label">${startLabel}</span>
            </div>
        `.trim();
    }

    onCreate() {
        // Prevent click propagation on input to allow typing
        const input = this.find('input');
        if (input) {
            input.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    /**
     * Get the input element
     * @returns {HTMLInputElement|null}
     */
    getInput() {
        return this.find('input');
    }

    /**
     * Get the input value
     * @returns {string}
     */
    getValue() {
        const input = this.getInput();
        return input ? input.value : '';
    }

    /**
     * Set the input value
     * @param {string} value
     * @returns {PlayerInput} this for chaining
     */
    setValue(value) {
        const input = this.getInput();
        if (input) {
            input.value = value;
        }
        return this;
    }

    /**
     * Get the player name (value or placeholder)
     * @returns {string}
     */
    getPlayerName() {
        const value = this.getValue().trim();
        return value || this.props.placeholder || this.props.playerId;
    }

    /**
     * Focus the input
     * @returns {PlayerInput} this for chaining
     */
    focusInput() {
        const input = this.getInput();
        if (input) {
            input.focus();
        }
        return this;
    }

    /**
     * Add change handler
     * @param {Function} handler
     * @returns {PlayerInput} this for chaining
     */
    onChange(handler) {
        const input = this.getInput();
        if (input) {
            input.addEventListener('input', handler);
        }
        return this;
    }

    /**
     * Add click handler for the start area (not the input)
     * @param {Function} handler
     * @returns {PlayerInput} this for chaining
     */
    onStart(handler) {
        return this.on('click', (e) => {
            // Only trigger if not clicking the input
            if (!e.target.matches('input')) {
                handler(e, this.props.playerId);
            }
        });
    }
}
