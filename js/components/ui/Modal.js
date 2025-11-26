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

/** Round end modal */
export class RoundEndModal extends Modal {
    get modalClass() {
        return 'modal';
    }
}
