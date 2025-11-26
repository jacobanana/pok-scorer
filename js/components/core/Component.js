/**
 * Minimal Component class - lightweight base for UI components.
 * Only includes methods that are actually used in the application.
 */
export class Component {
    constructor(props = {}) {
        this.props = props;
        this.el = null;
        this._mounted = false;
    }

    // Override in subclasses
    template() { return '<div></div>'; }
    onCreate() {}
    onMount() {}
    onUnmount() {}

    /**
     * Render the component from template
     */
    render() {
        const temp = document.createElement('div');
        temp.innerHTML = this.template().trim();
        this.el = temp.firstChild;
        this.onCreate();
        return this.el;
    }

    /**
     * Mount component to a parent element
     */
    mount(parent, position = 'append') {
        if (!this.el) this.render();
        const parentEl = typeof parent === 'string' ? document.querySelector(parent) : parent;
        if (!parentEl) return this;

        if (position === 'prepend') {
            parentEl.insertBefore(this.el, parentEl.firstChild);
        } else if (position === 'replace') {
            parentEl.replaceChildren(this.el);
        } else {
            parentEl.appendChild(this.el);
        }

        this._mounted = true;
        this.onMount();
        return this;
    }

    /**
     * Bind to an existing DOM element
     */
    bindTo(element) {
        this.el = typeof element === 'string' ? document.querySelector(element) : element;
        if (!this.el) return this;
        this._mounted = true;
        this.onCreate();
        this.onMount();
        return this;
    }

    /**
     * Unmount from DOM
     */
    unmount() {
        if (this.el?.parentNode) {
            this.onUnmount();
            this.el.parentNode.removeChild(this.el);
            this._mounted = false;
        }
        return this;
    }

    // Class manipulation
    addClass(...classes) {
        this.el?.classList.add(...classes.filter(Boolean));
        return this;
    }

    removeClass(...classes) {
        this.el?.classList.remove(...classes.filter(Boolean));
        return this;
    }

    toggleClass(className, force) {
        this.el?.classList.toggle(className, force);
        return this;
    }

    hasClass(className) {
        return this.el?.classList.contains(className) || false;
    }

    // Content
    setText(text) {
        if (this.el) this.el.textContent = text;
        return this;
    }

    // Visibility
    show() {
        if (this.el) {
            this.el.style.display = '';
            this.el.hidden = false;
        }
        return this;
    }

    hide() {
        if (this.el) this.el.style.display = 'none';
        return this;
    }

    // DOM queries
    find(selector) {
        return this.el?.querySelector(selector) || null;
    }

    findAll(selector) {
        return this.el?.querySelectorAll(selector) || [];
    }

    // Events
    on(event, handler, options = {}) {
        if (!this.el) this.render();
        this.el.addEventListener(event, handler, options);
        return this;
    }

    emit(eventName, detail = null) {
        this.el?.dispatchEvent(new CustomEvent(eventName, { bubbles: true, cancelable: true, detail }));
        return this;
    }

    // Style (used by Pok for positioning)
    css(property, value) {
        if (this.el) this.el.style[property] = value;
        return this;
    }

    // Focus (used by PlayerInput)
    focus() {
        if (this.el?.focus) this.el.focus();
        return this;
    }
}
