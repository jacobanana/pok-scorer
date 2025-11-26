import { Component } from '../core/Component.js';
import { ContinueButton, SaveLatestButton, ImportButton } from './Button.js';
import { PlayerInput } from './PlayerInput.js';

/**
 * StartSelector component - Game start screen with player inputs
 *
 * Props:
 * - id: string - Element ID
 * - onStart: Function - Callback when a player side is clicked (playerId)
 * - onContinue: Function - Callback for continue game
 * - onSaveLatest: Function - Callback for save latest game
 * - onImport: Function - Callback for import game
 * - showContinue: boolean - Whether to show continue button
 * - showSaveLatest: boolean - Whether to show save latest button
 */
export class StartSelector extends Component {
    template() {
        const { id } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        // Player inputs are mounted directly (not in a container) for proper CSS flex layout
        return `
            <div class="start-selector" ${idAttr}>
                <div class="start-selector-buttons"></div>
            </div>
        `.trim();
    }

    onCreate() {
        this._buttons = {};
        this._playerInputs = {};

        // Create action buttons
        this._createButtons();

        // Create player inputs (mounted directly to start-selector for flex layout)
        this._createPlayerInputs();
    }

    _createButtons() {
        const buttonsContainer = this.find('.start-selector-buttons');
        if (!buttonsContainer) return;

        // Continue button
        this._buttons.continue = new ContinueButton({
            id: 'continueGameButton',
            text: 'Resume Last Game'
        });
        if (this.props.onContinue) {
            this._buttons.continue.onClick(this.props.onContinue);
        }
        this._buttons.continue.mount(buttonsContainer);
        if (!this.props.showContinue) {
            this._buttons.continue.hide();
        }

        // Save latest button
        this._buttons.saveLatest = new SaveLatestButton({
            id: 'saveLatestGameButton',
            text: 'Save Latest Game'
        });
        if (this.props.onSaveLatest) {
            this._buttons.saveLatest.onClick(this.props.onSaveLatest);
        }
        this._buttons.saveLatest.mount(buttonsContainer);
        if (!this.props.showSaveLatest) {
            this._buttons.saveLatest.hide();
        }

        // Import button
        this._buttons.import = new ImportButton({
            id: 'importMatchButton',
            text: 'Load from File'
        });
        if (this.props.onImport) {
            this._buttons.import.onClick(this.props.onImport);
        }
        this._buttons.import.mount(buttonsContainer);
    }

    _createPlayerInputs() {
        // Mount directly to the start-selector element (this.el) for proper flex layout
        // CSS expects .start-half to be direct children of .start-selector

        // Red player input
        this._playerInputs.red = new PlayerInput({
            playerId: 'red',
            id: 'redPlayerName',
            placeholder: 'Red'
        });
        if (this.props.onStart) {
            this._playerInputs.red.onStart((e, playerId) => this.props.onStart(playerId));
        }
        this._playerInputs.red.mount(this.el);

        // Blue player input
        this._playerInputs.blue = new PlayerInput({
            playerId: 'blue',
            id: 'bluePlayerName',
            placeholder: 'Blue'
        });
        if (this.props.onStart) {
            this._playerInputs.blue.onStart((e, playerId) => this.props.onStart(playerId));
        }
        this._playerInputs.blue.mount(this.el);
    }

    /**
     * Get a player input component
     * @param {string} playerId - 'red' or 'blue'
     * @returns {PlayerInput|undefined}
     */
    getPlayerInput(playerId) {
        return this._playerInputs[playerId];
    }

    /**
     * Get player name
     * @param {string} playerId - 'red' or 'blue'
     * @returns {string}
     */
    getPlayerName(playerId) {
        const input = this._playerInputs[playerId];
        return input ? input.getPlayerName() : playerId;
    }

    /**
     * Set player name
     * @param {string} playerId - 'red' or 'blue'
     * @param {string} name
     * @returns {StartSelector} this for chaining
     */
    setPlayerName(playerId, name) {
        const input = this._playerInputs[playerId];
        if (input) {
            input.setValue(name);
        }
        return this;
    }

    /**
     * Get both player names
     * @returns {{ red: string, blue: string }}
     */
    getPlayerNames() {
        return {
            red: this.getPlayerName('red'),
            blue: this.getPlayerName('blue')
        };
    }

    /**
     * Prefill player names from saved data
     * @param {{ redPlayerName: string, bluePlayerName: string }} savedData
     * @returns {StartSelector} this for chaining
     */
    prefillNames(savedData) {
        if (savedData.redPlayerName) {
            this.setPlayerName('red', savedData.redPlayerName);
        }
        if (savedData.bluePlayerName) {
            this.setPlayerName('blue', savedData.bluePlayerName);
        }
        return this;
    }

    /**
     * Show continue button
     * @returns {StartSelector} this for chaining
     */
    showContinueButton() {
        if (this._buttons.continue) {
            this._buttons.continue.show();
        }
        return this;
    }

    /**
     * Hide continue button
     * @returns {StartSelector} this for chaining
     */
    hideContinueButton() {
        if (this._buttons.continue) {
            this._buttons.continue.hide();
        }
        return this;
    }

    /**
     * Show save latest button
     * @returns {StartSelector} this for chaining
     */
    showSaveLatestButton() {
        if (this._buttons.saveLatest) {
            this._buttons.saveLatest.show();
        }
        return this;
    }

    /**
     * Hide save latest button
     * @returns {StartSelector} this for chaining
     */
    hideSaveLatestButton() {
        if (this._buttons.saveLatest) {
            this._buttons.saveLatest.hide();
        }
        return this;
    }

    /**
     * Get a button component
     * @param {string} name - 'continue', 'saveLatest', 'import'
     * @returns {Button|undefined}
     */
    getButton(name) {
        return this._buttons[name];
    }
}
