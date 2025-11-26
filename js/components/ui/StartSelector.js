import { Component } from '../core/Component.js';
import { ContinueButton, SaveLatestButton, ImportButton } from './Button.js';
import { PlayerInput } from './PlayerInput.js';

/**
 * StartSelector component - Game start screen with player inputs
 *
 * Events emitted:
 * - 'start' - When a player side is clicked, detail: { playerId }
 * - 'continue' - When continue button clicked
 * - 'saveLatest' - When save latest button clicked
 * - 'import' - When import button clicked
 *
 * Props:
 * - id: string - Element ID
 * - showContinue: boolean - Whether to show continue button
 * - showSaveLatest: boolean - Whether to show save latest button
 */
export class StartSelector extends Component {
    template() {
        const { id } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="start-selector" ${idAttr}>
                <div class="start-selector-buttons"></div>
            </div>
        `.trim();
    }

    onCreate() {
        this._buttons = {};
        this._playerInputs = {};

        this._createButtons();
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
        this._buttons.continue.onClick(() => this.emit('continue'));
        this._buttons.continue.mount(buttonsContainer);
        if (!this.props.showContinue) {
            this._buttons.continue.hide();
        }

        // Save latest button
        this._buttons.saveLatest = new SaveLatestButton({
            id: 'saveLatestGameButton',
            text: 'Save Latest Game'
        });
        this._buttons.saveLatest.onClick(() => this.emit('saveLatest'));
        this._buttons.saveLatest.mount(buttonsContainer);
        if (!this.props.showSaveLatest) {
            this._buttons.saveLatest.hide();
        }

        // Import button
        this._buttons.import = new ImportButton({
            id: 'importMatchButton',
            text: 'Load from File'
        });
        this._buttons.import.onClick(() => this.emit('import'));
        this._buttons.import.mount(buttonsContainer);
    }

    _createPlayerInputs() {
        // Red player input
        this._playerInputs.red = new PlayerInput({
            playerId: 'red',
            id: 'redPlayerName',
            placeholder: 'Red'
        });
        this._playerInputs.red.onStart(() => this.emit('start', { playerId: 'red' }));
        this._playerInputs.red.mount(this.el);

        // Blue player input
        this._playerInputs.blue = new PlayerInput({
            playerId: 'blue',
            id: 'bluePlayerName',
            placeholder: 'Blue'
        });
        this._playerInputs.blue.onStart(() => this.emit('start', { playerId: 'blue' }));
        this._playerInputs.blue.mount(this.el);
    }

    /** Get a player input component */
    getPlayerInput(playerId) {
        return this._playerInputs[playerId];
    }

    /** Get player name */
    getPlayerName(playerId) {
        const input = this._playerInputs[playerId];
        return input ? input.getPlayerName() : playerId;
    }

    /** Set player name */
    setPlayerName(playerId, name) {
        const input = this._playerInputs[playerId];
        if (input) input.setValue(name);
        return this;
    }

    /** Get both player names */
    getPlayerNames() {
        return {
            red: this.getPlayerName('red'),
            blue: this.getPlayerName('blue')
        };
    }

    /** Prefill player names from saved data */
    prefillNames(savedData) {
        if (savedData.redPlayerName) this.setPlayerName('red', savedData.redPlayerName);
        if (savedData.bluePlayerName) this.setPlayerName('blue', savedData.bluePlayerName);
        return this;
    }

    showContinueButton() {
        this._buttons.continue?.show();
        return this;
    }

    hideContinueButton() {
        this._buttons.continue?.hide();
        return this;
    }

    showSaveLatestButton() {
        this._buttons.saveLatest?.show();
        return this;
    }

    hideSaveLatestButton() {
        this._buttons.saveLatest?.hide();
        return this;
    }

    /** Get a button component */
    getButton(name) {
        return this._buttons[name];
    }
}
