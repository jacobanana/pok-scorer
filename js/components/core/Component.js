/**
 * Base Component class for the lightweight component system.
 * Provides lifecycle management, DOM manipulation, and event handling.
 *
 * Features:
 * - Lifecycle: render(), mount(), unmount(), update()
 * - Actions: addClass(), removeClass(), setText(), setHTML(), show(), hide()
 * - Events: on(), off(), emit()
 * - All action methods are chainable
 */
export class Component {
    /**
     * Create a new component instance
     * @param {Object} props - Component properties
     */
    constructor(props = {}) {
        this.props = props;
        this.el = null;
        this._eventHandlers = new Map();
        this._children = new Map();
        this._parent = null;
        this._mounted = false;
    }

    /**
     * Template method - override in subclasses to define HTML structure
     * @returns {string} HTML template string
     */
    template() {
        return '<div></div>';
    }

    /**
     * Called after the element is created but before mounting
     * Override for initialization logic
     */
    onCreate() {}

    /**
     * Called after the component is mounted to the DOM
     * Override to set up event listeners, fetch data, etc.
     */
    onMount() {}

    /**
     * Called before the component is unmounted from the DOM
     * Override for cleanup logic
     */
    onUnmount() {}

    /**
     * Called after props are updated
     * @param {Object} prevProps - Previous props
     */
    onUpdate(prevProps) {}

    /**
     * Render the component and return the DOM element
     * @returns {HTMLElement} The rendered element
     */
    render() {
        const html = this.template();
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        this.el = temp.firstChild;
        this.onCreate();
        return this.el;
    }

    /**
     * Mount the component to a parent element
     * @param {HTMLElement|string} parent - Parent element or selector
     * @param {string} position - 'append' | 'prepend' | 'replace' | 'before' | 'after'
     * @returns {Component} this for chaining
     */
    mount(parent, position = 'append') {
        if (!this.el) {
            this.render();
        }

        const parentEl = typeof parent === 'string'
            ? document.querySelector(parent)
            : parent;

        if (!parentEl) {
            console.warn('Component.mount: parent element not found');
            return this;
        }

        switch (position) {
            case 'prepend':
                parentEl.insertBefore(this.el, parentEl.firstChild);
                break;
            case 'replace':
                parentEl.replaceChildren(this.el);
                break;
            case 'before':
                parentEl.parentNode.insertBefore(this.el, parentEl);
                break;
            case 'after':
                parentEl.parentNode.insertBefore(this.el, parentEl.nextSibling);
                break;
            case 'append':
            default:
                parentEl.appendChild(this.el);
        }

        this._parent = parentEl;
        this._mounted = true;
        this.onMount();
        return this;
    }

    /**
     * Unmount the component from the DOM
     * @returns {Component} this for chaining
     */
    unmount() {
        if (this.el && this.el.parentNode) {
            this.onUnmount();
            // Clean up all event handlers
            this._eventHandlers.forEach((handlers, event) => {
                handlers.forEach(handler => {
                    this.el.removeEventListener(event, handler);
                });
            });
            this._eventHandlers.clear();

            // Unmount children
            this._children.forEach(child => child.unmount());
            this._children.clear();

            this.el.parentNode.removeChild(this.el);
            this._mounted = false;
        }
        return this;
    }

    /**
     * Update component with new props and re-render
     * @param {Object} newProps - New properties to merge
     * @returns {Component} this for chaining
     */
    update(newProps = {}) {
        const prevProps = { ...this.props };
        this.props = { ...this.props, ...newProps };

        if (this._mounted && this.el) {
            const parent = this.el.parentNode;
            const nextSibling = this.el.nextSibling;

            // Store old handlers to reattach
            const oldHandlers = new Map(this._eventHandlers);

            // Remove old element
            this.el.parentNode.removeChild(this.el);

            // Re-render
            this.render();

            // Reattach event handlers
            oldHandlers.forEach((handlers, event) => {
                handlers.forEach(handler => {
                    this.el.addEventListener(event, handler);
                });
            });
            this._eventHandlers = oldHandlers;

            // Re-insert
            if (nextSibling) {
                parent.insertBefore(this.el, nextSibling);
            } else {
                parent.appendChild(this.el);
            }
        }

        this.onUpdate(prevProps);
        return this;
    }

    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - addEventListener options
     * @returns {Component} this for chaining
     */
    on(event, handler, options = {}) {
        if (!this.el) {
            this.render();
        }

        if (!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, new Set());
        }
        this._eventHandlers.get(event).add(handler);
        this.el.addEventListener(event, handler, options);
        return this;
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler to remove (optional, removes all if not specified)
     * @returns {Component} this for chaining
     */
    off(event, handler = null) {
        if (!this.el) return this;

        if (handler && this._eventHandlers.has(event)) {
            this._eventHandlers.get(event).delete(handler);
            this.el.removeEventListener(event, handler);
        } else if (!handler && this._eventHandlers.has(event)) {
            this._eventHandlers.get(event).forEach(h => {
                this.el.removeEventListener(event, h);
            });
            this._eventHandlers.delete(event);
        }
        return this;
    }

    /**
     * Emit a custom event
     * @param {string} eventName - Event name
     * @param {*} detail - Event detail data
     * @returns {Component} this for chaining
     */
    emit(eventName, detail = null) {
        if (!this.el) return this;

        const event = new CustomEvent(eventName, {
            bubbles: true,
            cancelable: true,
            detail
        });
        this.el.dispatchEvent(event);
        return this;
    }

    /**
     * Add one or more CSS classes
     * @param {...string} classes - Class names to add
     * @returns {Component} this for chaining
     */
    addClass(...classes) {
        if (!this.el) this.render();
        this.el.classList.add(...classes.filter(Boolean));
        return this;
    }

    /**
     * Remove one or more CSS classes
     * @param {...string} classes - Class names to remove
     * @returns {Component} this for chaining
     */
    removeClass(...classes) {
        if (!this.el) this.render();
        this.el.classList.remove(...classes.filter(Boolean));
        return this;
    }

    /**
     * Toggle a CSS class
     * @param {string} className - Class name to toggle
     * @param {boolean} force - Force add (true) or remove (false)
     * @returns {Component} this for chaining
     */
    toggleClass(className, force) {
        if (!this.el) this.render();
        this.el.classList.toggle(className, force);
        return this;
    }

    /**
     * Check if element has a CSS class
     * @param {string} className - Class name to check
     * @returns {boolean}
     */
    hasClass(className) {
        if (!this.el) return false;
        return this.el.classList.contains(className);
    }

    /**
     * Set text content
     * @param {string} text - Text content
     * @returns {Component} this for chaining
     */
    setText(text) {
        if (!this.el) this.render();
        this.el.textContent = text;
        return this;
    }

    /**
     * Get text content
     * @returns {string}
     */
    getText() {
        return this.el ? this.el.textContent : '';
    }

    /**
     * Set inner HTML
     * @param {string} html - HTML content
     * @returns {Component} this for chaining
     */
    setHTML(html) {
        if (!this.el) this.render();
        this.el.innerHTML = html;
        return this;
    }

    /**
     * Get inner HTML
     * @returns {string}
     */
    getHTML() {
        return this.el ? this.el.innerHTML : '';
    }

    /**
     * Set inline styles
     * @param {Object} styles - Style properties and values
     * @returns {Component} this for chaining
     */
    setStyle(styles) {
        if (!this.el) this.render();
        Object.assign(this.el.style, styles);
        return this;
    }

    /**
     * Set a single style property
     * @param {string} property - CSS property name
     * @param {string} value - CSS value
     * @returns {Component} this for chaining
     */
    css(property, value) {
        if (!this.el) this.render();
        this.el.style[property] = value;
        return this;
    }

    /**
     * Set an attribute
     * @param {string} name - Attribute name
     * @param {string} value - Attribute value
     * @returns {Component} this for chaining
     */
    setAttr(name, value) {
        if (!this.el) this.render();
        this.el.setAttribute(name, value);
        return this;
    }

    /**
     * Get an attribute value
     * @param {string} name - Attribute name
     * @returns {string|null}
     */
    getAttr(name) {
        return this.el ? this.el.getAttribute(name) : null;
    }

    /**
     * Remove an attribute
     * @param {string} name - Attribute name
     * @returns {Component} this for chaining
     */
    removeAttr(name) {
        if (!this.el) this.render();
        this.el.removeAttribute(name);
        return this;
    }

    /**
     * Set a data attribute
     * @param {string} key - Data key (without 'data-' prefix)
     * @param {string} value - Data value
     * @returns {Component} this for chaining
     */
    setData(key, value) {
        if (!this.el) this.render();
        this.el.dataset[key] = value;
        return this;
    }

    /**
     * Get a data attribute value
     * @param {string} key - Data key (without 'data-' prefix)
     * @returns {string|undefined}
     */
    getData(key) {
        return this.el ? this.el.dataset[key] : undefined;
    }

    /**
     * Show the element
     * @returns {Component} this for chaining
     */
    show() {
        if (!this.el) this.render();
        this.el.style.display = '';
        this.el.hidden = false;
        return this;
    }

    /**
     * Hide the element
     * @returns {Component} this for chaining
     */
    hide() {
        if (!this.el) this.render();
        this.el.style.display = 'none';
        return this;
    }

    /**
     * Toggle visibility
     * @param {boolean} visible - Force visible (true) or hidden (false)
     * @returns {Component} this for chaining
     */
    toggle(visible) {
        if (visible === undefined) {
            return this.el && this.el.style.display === 'none' ? this.show() : this.hide();
        }
        return visible ? this.show() : this.hide();
    }

    /**
     * Check if element is visible
     * @returns {boolean}
     */
    isVisible() {
        return this.el && this.el.style.display !== 'none' && !this.el.hidden;
    }

    /**
     * Enable the element (remove disabled attribute)
     * @returns {Component} this for chaining
     */
    enable() {
        if (!this.el) this.render();
        this.el.disabled = false;
        this.el.removeAttribute('disabled');
        return this;
    }

    /**
     * Disable the element
     * @returns {Component} this for chaining
     */
    disable() {
        if (!this.el) this.render();
        this.el.disabled = true;
        this.el.setAttribute('disabled', 'disabled');
        return this;
    }

    /**
     * Find a child element by selector
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    find(selector) {
        return this.el ? this.el.querySelector(selector) : null;
    }

    /**
     * Find all child elements by selector
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    findAll(selector) {
        return this.el ? this.el.querySelectorAll(selector) : [];
    }

    /**
     * Add a child component
     * @param {string} key - Unique key for the child
     * @param {Component} child - Child component instance
     * @param {string} selector - Optional selector to mount child to (defaults to this.el)
     * @returns {Component} this for chaining
     */
    addChild(key, child, selector = null) {
        if (!this.el) this.render();
        const parent = selector ? this.find(selector) : this.el;
        if (parent) {
            child.mount(parent);
            this._children.set(key, child);
        }
        return this;
    }

    /**
     * Get a child component by key
     * @param {string} key - Child key
     * @returns {Component|undefined}
     */
    getChild(key) {
        return this._children.get(key);
    }

    /**
     * Remove a child component by key
     * @param {string} key - Child key
     * @returns {Component} this for chaining
     */
    removeChild(key) {
        const child = this._children.get(key);
        if (child) {
            child.unmount();
            this._children.delete(key);
        }
        return this;
    }

    /**
     * Remove all children
     * @returns {Component} this for chaining
     */
    clearChildren() {
        this._children.forEach(child => child.unmount());
        this._children.clear();
        return this;
    }

    /**
     * Check if the component is mounted
     * @returns {boolean}
     */
    isMounted() {
        return this._mounted;
    }

    /**
     * Get the DOM element
     * @returns {HTMLElement|null}
     */
    getElement() {
        return this.el;
    }

    /**
     * Focus the element
     * @returns {Component} this for chaining
     */
    focus() {
        if (this.el && typeof this.el.focus === 'function') {
            this.el.focus();
        }
        return this;
    }

    /**
     * Blur the element
     * @returns {Component} this for chaining
     */
    blur() {
        if (this.el && typeof this.el.blur === 'function') {
            this.el.blur();
        }
        return this;
    }
}
