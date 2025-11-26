import { Component } from '../core/Component.js';

/**
 * Modal component - A reusable modal dialog
 *
 * Props:
 * - id: string - Modal ID
 * - variant: string - Modal variant ('default', 'round-end', 'history')
 * - content: string - HTML content for the modal body
 * - closable: boolean - Whether clicking backdrop closes modal
 */
export class Modal extends Component {
    template() {
        const { id, variant = 'default', content = '' } = this.props;

        const variantClasses = {
            'default': 'modal',
            'round-end': 'modal',
            'history': 'history-modal'
        };

        const className = variantClasses[variant] || 'modal';
        const idAttr = id ? `id="${id}"` : '';

        if (variant === 'history') {
            return `
                <div class="${className}" ${idAttr}>
                    <div class="history-modal-content">
                        ${content}
                    </div>
                </div>
            `.trim();
        }

        return `
            <div class="${className}" ${idAttr}>
                <div class="modal-content">
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
        const contentEl = this.find('.modal-content') || this.find('.history-modal-content');
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
        return this.find('.modal-content') || this.find('.history-modal-content');
    }
}
