// ============================================
// COMPONENT CLASS UNIT TESTS (Slim Version)
// ============================================

import { Component } from '../../js/components/core/Component.js';

const { assert } = window;
const runner = window.testRunner;

// Test container for DOM operations
let testContainer;

function createTestContainer() {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
}

function cleanupTestContainer() {
    if (testContainer && testContainer.parentNode) {
        testContainer.parentNode.removeChild(testContainer);
    }
    testContainer = null;
}

// ============================================
// Custom Component for Testing
// ============================================

class TestComponent extends Component {
    template() {
        const { text = 'Hello', className = 'test-component' } = this.props;
        return `<div class="${className}">${text}</div>`;
    }
}

class ButtonComponent extends Component {
    template() {
        const { label = 'Click Me', disabled = false } = this.props;
        return `<button class="btn" ${disabled ? 'disabled' : ''}>${label}</button>`;
    }
}

class ContainerComponent extends Component {
    template() {
        return `<div class="container"><div class="inner"></div></div>`;
    }
}

// ============================================
// TESTS
// ============================================

runner.describe('Component - Initialization', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should initialize with default empty props', () => {
        const component = new Component();
        assert.deepEqual(component.props, {});
        assert.equal(component.el, null);
    });

    runner.it('should initialize with provided props', () => {
        const component = new Component({ text: 'Hello', count: 5 });
        assert.equal(component.props.text, 'Hello');
        assert.equal(component.props.count, 5);
    });

    runner.it('should not be mounted initially', () => {
        const component = new Component();
        assert.notOk(component._mounted);
    });
});

runner.describe('Component - Rendering', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render default template', () => {
        const component = new Component();
        const el = component.render();
        assert.ok(el instanceof HTMLElement);
        assert.equal(el.tagName, 'DIV');
    });

    runner.it('should render custom template with props', () => {
        const component = new TestComponent({ text: 'Custom Text' });
        const el = component.render();
        assert.equal(el.textContent, 'Custom Text');
        assert.ok(el.classList.contains('test-component'));
    });

    runner.it('should set el property after render', () => {
        const component = new TestComponent();
        assert.equal(component.el, null);
        component.render();
        assert.ok(component.el !== null);
    });

    runner.it('should call onCreate after render', () => {
        let createCalled = false;
        class TestCreate extends Component {
            onCreate() {
                createCalled = true;
            }
        }
        const component = new TestCreate();
        component.render();
        assert.ok(createCalled);
    });
});

runner.describe('Component - Mounting', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should mount to parent element', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        assert.ok(component._mounted);
        assert.equal(testContainer.children.length, 1);
    });

    runner.it('should mount using selector string', () => {
        const component = new TestComponent();
        component.mount('#test-container');
        assert.ok(component._mounted);
        assert.equal(testContainer.children.length, 1);
    });

    runner.it('should auto-render when mounting without prior render', () => {
        const component = new TestComponent({ text: 'Auto Rendered' });
        assert.equal(component.el, null);
        component.mount(testContainer);
        assert.ok(component.el !== null);
        assert.equal(component.el.textContent, 'Auto Rendered');
    });

    runner.it('should append by default', () => {
        testContainer.innerHTML = '<span>Existing</span>';
        const component = new TestComponent();
        component.mount(testContainer, 'append');
        assert.equal(testContainer.children.length, 2);
        assert.equal(testContainer.lastChild, component.el);
    });

    runner.it('should prepend when specified', () => {
        testContainer.innerHTML = '<span>Existing</span>';
        const component = new TestComponent();
        component.mount(testContainer, 'prepend');
        assert.equal(testContainer.children.length, 2);
        assert.equal(testContainer.firstChild, component.el);
    });

    runner.it('should replace when specified', () => {
        testContainer.innerHTML = '<span>Old1</span><span>Old2</span>';
        const component = new TestComponent();
        component.mount(testContainer, 'replace');
        assert.equal(testContainer.children.length, 1);
        assert.equal(testContainer.firstChild, component.el);
    });

    runner.it('should call onMount after mounting', () => {
        let mountCalled = false;
        class TestMount extends Component {
            onMount() {
                mountCalled = true;
            }
        }
        const component = new TestMount();
        component.mount(testContainer);
        assert.ok(mountCalled);
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        const result = component.mount(testContainer);
        assert.equal(result, component);
    });
});

runner.describe('Component - Unmounting', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should unmount from DOM', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        assert.equal(testContainer.children.length, 1);

        component.unmount();
        assert.equal(testContainer.children.length, 0);
        assert.notOk(component._mounted);
    });

    runner.it('should call onUnmount before removal', () => {
        let unmountCalled = false;
        class TestUnmount extends Component {
            onUnmount() {
                unmountCalled = true;
            }
        }
        const component = new TestUnmount();
        component.mount(testContainer);
        component.unmount();
        assert.ok(unmountCalled);
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.unmount();
        assert.equal(result, component);
    });
});

runner.describe('Component - bindTo', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should bind to existing element', () => {
        testContainer.innerHTML = '<div id="existing" class="target">Content</div>';
        const component = new Component();
        component.bindTo('#existing');

        assert.ok(component.el);
        assert.equal(component.el.id, 'existing');
        assert.ok(component._mounted);
    });

    runner.it('should call onCreate and onMount', () => {
        testContainer.innerHTML = '<div id="existing"></div>';
        let createCalled = false;
        let mountCalled = false;

        class TestBind extends Component {
            onCreate() { createCalled = true; }
            onMount() { mountCalled = true; }
        }

        const component = new TestBind();
        component.bindTo('#existing');

        assert.ok(createCalled);
        assert.ok(mountCalled);
    });

    runner.it('should return this for chaining', () => {
        testContainer.innerHTML = '<div id="existing"></div>';
        const component = new Component();
        const result = component.bindTo('#existing');
        assert.equal(result, component);
    });
});

runner.describe('Component - Event Handling', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should add event listener with on()', () => {
        let clicked = false;
        const component = new ButtonComponent();
        component.mount(testContainer);
        component.on('click', () => { clicked = true; });

        component.el.click();
        assert.ok(clicked);
    });

    runner.it('should support multiple handlers for same event', () => {
        let count = 0;
        const component = new ButtonComponent();
        component.mount(testContainer);
        component.on('click', () => count++);
        component.on('click', () => count++);

        component.el.click();
        assert.equal(count, 2);
    });

    runner.it('should emit custom events', () => {
        let receivedDetail = null;
        const component = new TestComponent();
        component.mount(testContainer);

        component.el.addEventListener('custom-event', (e) => {
            receivedDetail = e.detail;
        });

        component.emit('custom-event', { foo: 'bar' });
        assert.deepEqual(receivedDetail, { foo: 'bar' });
    });

    runner.it('should return this for chaining', () => {
        const component = new ButtonComponent();
        component.mount(testContainer);

        const result = component.on('click', () => {});
        assert.equal(result, component);
    });
});

runner.describe('Component - CSS Class Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should add class with addClass()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.addClass('new-class');
        assert.ok(component.el.classList.contains('new-class'));
    });

    runner.it('should add multiple classes', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.addClass('class1', 'class2', 'class3');
        assert.ok(component.el.classList.contains('class1'));
        assert.ok(component.el.classList.contains('class2'));
        assert.ok(component.el.classList.contains('class3'));
    });

    runner.it('should remove class with removeClass()', () => {
        const component = new TestComponent({ className: 'test-component remove-me' });
        component.mount(testContainer);
        component.removeClass('remove-me');
        assert.notOk(component.el.classList.contains('remove-me'));
    });

    runner.it('should toggle class with toggleClass()', () => {
        const component = new TestComponent();
        component.mount(testContainer);

        component.toggleClass('toggled');
        assert.ok(component.el.classList.contains('toggled'));

        component.toggleClass('toggled');
        assert.notOk(component.el.classList.contains('toggled'));
    });

    runner.it('should force toggle with second parameter', () => {
        const component = new TestComponent();
        component.mount(testContainer);

        component.toggleClass('forced', true);
        assert.ok(component.el.classList.contains('forced'));

        component.toggleClass('forced', true);
        assert.ok(component.el.classList.contains('forced'));

        component.toggleClass('forced', false);
        assert.notOk(component.el.classList.contains('forced'));
    });

    runner.it('should check class with hasClass()', () => {
        const component = new TestComponent({ className: 'test-component' });
        component.mount(testContainer);
        assert.ok(component.hasClass('test-component'));
        assert.notOk(component.hasClass('nonexistent'));
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.addClass('a').removeClass('a').toggleClass('b');
        assert.equal(result, component);
    });
});

runner.describe('Component - Content Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should set text content with setText()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setText('New Text');
        assert.equal(component.el.textContent, 'New Text');
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.setText('a');
        assert.equal(result, component);
    });
});

runner.describe('Component - Style Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should set single style with css()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.css('backgroundColor', 'blue');
        assert.equal(component.el.style.backgroundColor, 'blue');
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.css('margin', '10px');
        assert.equal(result, component);
    });
});

runner.describe('Component - Visibility Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should hide element with hide()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.hide();
        assert.equal(component.el.style.display, 'none');
    });

    runner.it('should show element with show()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.hide();
        component.show();
        assert.notEqual(component.el.style.display, 'none');
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.hide().show();
        assert.equal(result, component);
    });
});

runner.describe('Component - Query Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should find child element with find()', () => {
        const component = new ContainerComponent();
        component.mount(testContainer);
        const inner = component.find('.inner');
        assert.ok(inner !== null);
        assert.ok(inner.classList.contains('inner'));
    });

    runner.it('should find all matching children with findAll()', () => {
        class MultiChild extends Component {
            template() {
                return `<div><span class="item">1</span><span class="item">2</span><span class="item">3</span></div>`;
            }
        }
        const component = new MultiChild();
        component.mount(testContainer);
        const items = component.findAll('.item');
        assert.equal(items.length, 3);
    });

    runner.it('should return null for non-existent selector', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.find('.nonexistent');
        assert.equal(result, null);
    });
});

runner.describe('Component - Focus', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should focus element with focus()', () => {
        const component = new ButtonComponent();
        component.mount(testContainer);
        component.focus();
        assert.equal(document.activeElement, component.el);
    });

    runner.it('should return this for chaining', () => {
        const component = new ButtonComponent();
        component.mount(testContainer);
        const result = component.focus();
        assert.equal(result, component);
    });
});
