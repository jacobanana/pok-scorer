import { Component } from '../core/Component.js';

/**
 * Button component - Base button class
 *
 * Props:
 * - text: string - Button text
 * - id: string - Optional ID
 * - disabled: boolean - Disabled state
 */
export class Button extends Component {
    /** CSS class for this button type */
    get buttonClass() {
        return 'button';
    }

    template() {
        const { text = '', id, disabled } = this.props;
        const idAttr = id ? `id="${id}"` : '';
        const disabledAttr = disabled ? 'disabled' : '';

        return `<button class="${this.buttonClass}" ${idAttr} ${disabledAttr}>${text}</button>`;
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

/** Primary action button */
export class PrimaryButton extends Button {
    get buttonClass() {
        return 'primary-button';
    }
}

/** Flip table button */
export class FlipButton extends Button {
    get buttonClass() {
        return 'flip-table-button';
    }
}

/** Show history button */
export class HistoryButton extends Button {
    get buttonClass() {
        return 'show-history-button';
    }
}

/** New game button */
export class NewGameButton extends Button {
    get buttonClass() {
        return 'new-game-button';
    }
}

/** Save game button */
export class SaveButton extends Button {
    get buttonClass() {
        return 'save-game-button';
    }
}

/** Import match button */
export class ImportButton extends Button {
    get buttonClass() {
        return 'import-match-button';
    }
}

/** Continue game button */
export class ContinueButton extends Button {
    get buttonClass() {
        return 'continue-game-top-button';
    }
}

/** Save latest game button */
export class SaveLatestButton extends Button {
    get buttonClass() {
        return 'save-latest-game-button';
    }
}

/** Close button */
export class CloseButton extends Button {
    get buttonClass() {
        return 'close-history-button';
    }
}
