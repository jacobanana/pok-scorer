import { Component } from '../core/Component.js';

/**
 * PlayerInput component - Player name input with start functionality
 *
 * Events emitted:
 * - 'start' - When the start area (not input) is clicked, detail: { playerId }
 * - 'change' - When input value changes, detail: { value, playerId }
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
        const input = this.find('input');
        if (input) {
            // Prevent click propagation on input to allow typing
            input.addEventListener('click', (e) => e.stopPropagation());
            // Emit change event on input
            input.addEventListener('input', () => {
                this.emit('change', { value: this.getValue(), playerId: this.props.playerId });
            });
        }

        // Emit start event when clicking outside the input
        this.on('click', (e) => {
            if (!e.target.matches('input')) {
                this.emit('start', { playerId: this.props.playerId });
            }
        });
    }

    /** Get the input element */
    getInput() {
        return this.find('input');
    }

    /** Get the input value */
    getValue() {
        const input = this.getInput();
        return input ? input.value : '';
    }

    /** Set the input value */
    setValue(value) {
        const input = this.getInput();
        if (input) input.value = value;
        return this;
    }

    /** Get the player name (value or placeholder) */
    getPlayerName() {
        const value = this.getValue().trim();
        return value || this.props.placeholder || this.props.playerId;
    }

    /** Focus the input */
    focusInput() {
        const input = this.getInput();
        if (input) input.focus();
        return this;
    }

    /** Convenience: add start handler (listens to 'start' event) */
    onStart(handler) {
        return this.on('start', (e) => handler(e, e.detail.playerId));
    }

    /** Convenience: add change handler (listens to 'change' event) */
    onChange(handler) {
        return this.on('change', (e) => handler(e, e.detail));
    }
}
