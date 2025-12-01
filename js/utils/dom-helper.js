// ============================================
// DOM HELPER
// Utility functions for DOM manipulation
// ============================================

/**
 * Helper utilities for common DOM operations
 * Provides null-safe, consistent DOM manipulation
 */
export class DOMHelper {
    /**
     * Get element by ID with null safety
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * Query selector with null safety
     * @param {string} selector - CSS selector
     * @param {Element|Document} context - Context to search within (default: document)
     * @returns {Element|null}
     */
    static querySelector(selector, context = document) {
        return context.querySelector(selector);
    }

    /**
     * Query selector all
     * @param {string} selector - CSS selector
     * @param {Element|Document} context - Context to search within (default: document)
     * @returns {NodeList}
     */
    static querySelectorAll(selector, context = document) {
        return context.querySelectorAll(selector);
    }

    /**
     * Add class to element by ID
     * @param {string} id - Element ID
     * @param {...string} classes - Classes to add
     * @returns {HTMLElement|null} - The element or null
     */
    static addClass(id, ...classes) {
        const el = this.getElementById(id);
        if (el && classes.length > 0) {
            el.classList.add(...classes);
        }
        return el;
    }

    /**
     * Remove class from element by ID
     * @param {string} id - Element ID
     * @param {...string} classes - Classes to remove
     * @returns {HTMLElement|null} - The element or null
     */
    static removeClass(id, ...classes) {
        const el = this.getElementById(id);
        if (el && classes.length > 0) {
            el.classList.remove(...classes);
        }
        return el;
    }

    /**
     * Toggle class on element by ID
     * @param {string} id - Element ID
     * @param {string} className - Class to toggle
     * @param {boolean} [force] - Force add (true) or remove (false)
     * @returns {HTMLElement|null} - The element or null
     */
    static toggleClass(id, className, force) {
        const el = this.getElementById(id);
        if (el) {
            el.classList.toggle(className, force);
        }
        return el;
    }

    /**
     * Check if element has class
     * @param {string} id - Element ID
     * @param {string} className - Class to check
     * @returns {boolean} - True if element has class
     */
    static hasClass(id, className) {
        const el = this.getElementById(id);
        return el ? el.classList.contains(className) : false;
    }

    /**
     * Set text content of element
     * @param {string} id - Element ID
     * @param {string} text - Text content
     * @returns {HTMLElement|null} - The element or null
     */
    static setText(id, text) {
        const el = this.getElementById(id);
        if (el) {
            el.textContent = text;
        }
        return el;
    }

    /**
     * Set HTML content of element
     * @param {string} id - Element ID
     * @param {string} html - HTML content
     * @returns {HTMLElement|null} - The element or null
     */
    static setHTML(id, html) {
        const el = this.getElementById(id);
        if (el) {
            el.innerHTML = html;
        }
        return el;
    }

    /**
     * Show element (add 'show' class)
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} - The element or null
     */
    static show(id) {
        return this.addClass(id, 'show');
    }

    /**
     * Hide element (remove 'show' class)
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} - The element or null
     */
    static hide(id) {
        return this.removeClass(id, 'show');
    }

    /**
     * Show element by reference (add 'show' class)
     * @param {HTMLElement} element - Element reference
     * @returns {HTMLElement|null} - The element or null
     */
    static showElement(element) {
        if (element) {
            element.classList.add('show');
        }
        return element;
    }

    /**
     * Hide element by reference (remove 'show' class)
     * @param {HTMLElement} element - Element reference
     * @returns {HTMLElement|null} - The element or null
     */
    static hideElement(element) {
        if (element) {
            element.classList.remove('show');
        }
        return element;
    }

    /**
     * Add event listener with null safety
     * @param {string} id - Element ID
     * @param {string} eventType - Event type (e.g., 'click')
     * @param {Function} handler - Event handler
     * @param {boolean} stopPropagation - Whether to stop event propagation
     * @returns {HTMLElement|null} - The element or null
     */
    static on(id, eventType, handler, stopPropagation = false) {
        const el = this.getElementById(id);
        if (el) {
            el.addEventListener(eventType, (e) => {
                if (stopPropagation) {
                    e.stopPropagation();
                }
                handler(e);
            });
        }
        return el;
    }

    /**
     * Get attribute value
     * @param {string} id - Element ID
     * @param {string} attribute - Attribute name
     * @returns {string|null} - Attribute value or null
     */
    static getAttribute(id, attribute) {
        const el = this.getElementById(id);
        return el ? el.getAttribute(attribute) : null;
    }

    /**
     * Set attribute value
     * @param {string} id - Element ID
     * @param {string} attribute - Attribute name
     * @param {string} value - Attribute value
     * @returns {HTMLElement|null} - The element or null
     */
    static setAttribute(id, attribute, value) {
        const el = this.getElementById(id);
        if (el) {
            el.setAttribute(attribute, value);
        }
        return el;
    }
}
