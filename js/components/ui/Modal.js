import { Component } from '../core/Component.js';

/**
 * Modal component - Base modal dialog
 *
 * Props:
 * - id: string - Modal ID
 * - content: string - HTML content for the modal body
 * - closable: boolean - Whether clicking backdrop closes modal
 */
export class Modal extends Component {
    /** CSS class for the modal wrapper */
    get modalClass() {
        return 'modal';
    }

    /** CSS class for the content wrapper */
    get contentClass() {
        return 'modal-content';
    }

    template() {
        const { id, content = '' } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="${this.modalClass}" ${idAttr}>
                <div class="${this.contentClass}">
                    ${content}
                </div>
            </div>
        `.trim();
    }

    onCreate() {
        if (this.props.closable) {
            this.on('click', (e) => {
                if (e.target === this.el) {
                    this.close();
                }
            });
        }
    }

    /**
     * Open the modal
     * @returns {Modal} this for chaining
     */
    open() {
        this.addClass('show');
        document.body.style.overflow = 'hidden';
        this.emit('modal:open');
        return this;
    }

    /**
     * Close the modal
     * @returns {Modal} this for chaining
     */
    close() {
        this.removeClass('show');
        document.body.style.overflow = '';
        this.emit('modal:close');
        return this;
    }

    /**
     * Toggle modal visibility
     * @param {boolean} show - Force show/hide
     * @returns {Modal} this for chaining
     */
    toggleModal(show) {
        if (show === undefined) {
            return this.hasClass('show') ? this.close() : this.open();
        }
        return show ? this.open() : this.close();
    }

    /**
     * Check if modal is open
     * @returns {boolean}
     */
    isOpen() {
        return this.hasClass('show');
    }

    /**
     * Set modal content
     * @param {string} html - HTML content
     * @returns {Modal} this for chaining
     */
    setContent(html) {
        const contentEl = this.find(`.${this.contentClass}`);
        if (contentEl) {
            contentEl.innerHTML = html;
        }
        return this;
    }

    /**
     * Get the content container element
     * @returns {HTMLElement|null}
     */
    getContentElement() {
        return this.find(`.${this.contentClass}`);
    }
}

/** History modal with different styling */
export class HistoryModal extends Modal {
    get modalClass() {
        return 'history-modal';
    }

    get contentClass() {
        return 'history-modal-content';
    }
}

/** Round end modal with predefined structure */
export class RoundEndModal extends Modal {
    get modalClass() {
        return 'modal';
    }

    template() {
        const { id } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="${this.modalClass}" ${idAttr}>
                <div class="${this.contentClass}">
                    <div class="modal-round-number" id="roundEndModalRoundNumber">Round 1</div>
                    <div class="winner" id="roundEndModalWinner"></div>
                    <div class="modal-score-display"></div>
                    <div class="modal-score-visualizer-container">
                        <div class="modal-red-markers"></div>
                        <div class="modal-center-pok-marker">
                            <img src="assets/pok-logo.svg" class="pok-svg" alt="Pok">
                            <div class="modal-center-pok-score">
                                <div class="pok-style-number red"><span id="modalCenterPokScoreRed">0</span></div>
                                <div class="pok-style-number blue"><span id="modalCenterPokScoreBlue">0</span></div>
                            </div>
                        </div>
                        <div class="modal-blue-markers"></div>
                    </div>
                    <button class="edit-board-button" id="editBoardButton">Edit Board</button>
                </div>
            </div>
        `.trim();
    }

    /** Get the score display container for mounting score components */
    getScoreDisplay() {
        return this.find('.modal-score-display');
    }

    /** Get the red markers container */
    getRedMarkersContainer() {
        return this.find('.modal-red-markers');
    }

    /** Get the blue markers container */
    getBlueMarkersContainer() {
        return this.find('.modal-blue-markers');
    }

    /** Set the round number text */
    setRoundNumber(round) {
        const el = this.find('#roundEndModalRoundNumber');
        if (el) el.textContent = `Round ${round}`;
        return this;
    }

    /** Set the winner text */
    setWinner(text) {
        const el = this.find('#roundEndModalWinner');
        if (el) el.textContent = text;
        return this;
    }

    /** Set the center pok scores */
    setCenterPokScores(red, blue) {
        const redEl = this.find('#modalCenterPokScoreRed');
        const blueEl = this.find('#modalCenterPokScoreBlue');
        if (redEl) redEl.textContent = red;
        if (blueEl) blueEl.textContent = blue;
        return this;
    }
}
