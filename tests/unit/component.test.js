// ============================================
// COMPONENT CLASS UNIT TESTS
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
        assert.notOk(component.isMounted());
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
        assert.ok(component.isMounted());
        assert.equal(testContainer.children.length, 1);
    });

    runner.it('should mount using selector string', () => {
        const component = new TestComponent();
        component.mount('#test-container');
        assert.ok(component.isMounted());
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
        assert.notOk(component.isMounted());
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

    runner.it('should clear event handlers on unmount', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.on('click', () => {});
        component.on('mouseover', () => {});

        component.unmount();
        assert.equal(component._eventHandlers.size, 0);
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.unmount();
        assert.equal(result, component);
    });
});

runner.describe('Component - Update', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should update props', () => {
        const component = new TestComponent({ text: 'Original' });
        component.mount(testContainer);

        component.update({ text: 'Updated' });
        assert.equal(component.props.text, 'Updated');
    });

    runner.it('should merge props', () => {
        const component = new TestComponent({ text: 'Hello', className: 'original' });
        component.mount(testContainer);

        component.update({ text: 'Updated' });
        assert.equal(component.props.text, 'Updated');
        assert.equal(component.props.className, 'original');
    });

    runner.it('should re-render with updated props', () => {
        const component = new TestComponent({ text: 'Original' });
        component.mount(testContainer);
        assert.equal(component.el.textContent, 'Original');

        component.update({ text: 'Updated' });
        assert.equal(component.el.textContent, 'Updated');
    });

    runner.it('should call onUpdate with previous props', () => {
        let prevPropsReceived = null;
        class TestUpdate extends TestComponent {
            onUpdate(prevProps) {
                prevPropsReceived = prevProps;
            }
        }
        const component = new TestUpdate({ text: 'Original' });
        component.mount(testContainer);
        component.update({ text: 'Updated' });

        assert.equal(prevPropsReceived.text, 'Original');
    });

    runner.it('should preserve event handlers after update', () => {
        let clickCount = 0;
        const component = new TestComponent({ text: 'Original' });
        component.mount(testContainer);
        component.on('click', () => clickCount++);

        component.update({ text: 'Updated' });
        component.el.click();

        assert.equal(clickCount, 1);
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

    runner.it('should remove event listener with off()', () => {
        let clicked = false;
        const handler = () => { clicked = true; };

        const component = new ButtonComponent();
        component.mount(testContainer);
        component.on('click', handler);
        component.off('click', handler);

        component.el.click();
        assert.notOk(clicked);
    });

    runner.it('should remove all handlers for event when no handler specified', () => {
        let count = 0;
        const component = new ButtonComponent();
        component.mount(testContainer);
        component.on('click', () => count++);
        component.on('click', () => count++);
        component.off('click');

        component.el.click();
        assert.equal(count, 0);
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

    runner.it('should get text content with getText()', () => {
        const component = new TestComponent({ text: 'Original' });
        component.mount(testContainer);
        assert.equal(component.getText(), 'Original');
    });

    runner.it('should set HTML with setHTML()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setHTML('<span>Inner HTML</span>');
        assert.equal(component.el.innerHTML, '<span>Inner HTML</span>');
    });

    runner.it('should get HTML with getHTML()', () => {
        const component = new TestComponent({ text: 'Plain' });
        component.mount(testContainer);
        assert.equal(component.getHTML(), 'Plain');
    });

    runner.it('should return this for chaining', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        const result = component.setText('a').setHTML('b');
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

    runner.it('should set inline styles with setStyle()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setStyle({ color: 'red', fontSize: '20px' });
        assert.equal(component.el.style.color, 'red');
        assert.equal(component.el.style.fontSize, '20px');
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
        const result = component.setStyle({ color: 'red' }).css('margin', '10px');
        assert.equal(result, component);
    });
});

runner.describe('Component - Attribute Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should set attribute with setAttr()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setAttr('data-id', '123');
        assert.equal(component.el.getAttribute('data-id'), '123');
    });

    runner.it('should get attribute with getAttr()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setAttr('title', 'Test Title');
        assert.equal(component.getAttr('title'), 'Test Title');
    });

    runner.it('should remove attribute with removeAttr()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setAttr('data-temp', 'value');
        component.removeAttr('data-temp');
        assert.equal(component.getAttr('data-temp'), null);
    });

    runner.it('should set data attribute with setData()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setData('userId', '456');
        assert.equal(component.el.dataset.userId, '456');
    });

    runner.it('should get data attribute with getData()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        component.setData('status', 'active');
        assert.equal(component.getData('status'), 'active');
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

    runner.it('should toggle visibility with toggle()', () => {
        const component = new TestComponent();
        component.mount(testContainer);

        component.toggle();
        assert.equal(component.el.style.display, 'none');

        component.toggle();
        assert.notEqual(component.el.style.display, 'none');
    });

    runner.it('should force visibility with toggle(boolean)', () => {
        const component = new TestComponent();
        component.mount(testContainer);

        component.toggle(false);
        assert.equal(component.el.style.display, 'none');

        component.toggle(true);
        assert.notEqual(component.el.style.display, 'none');
    });

    runner.it('should check visibility with isVisible()', () => {
        const component = new TestComponent();
        component.mount(testContainer);

        assert.ok(component.isVisible());
        component.hide();
        assert.notOk(component.isVisible());
    });
});

runner.describe('Component - Enable/Disable', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should disable element with disable()', () => {
        const component = new ButtonComponent();
        component.mount(testContainer);
        component.disable();
        assert.ok(component.el.disabled);
        assert.ok(component.el.hasAttribute('disabled'));
    });

    runner.it('should enable element with enable()', () => {
        const component = new ButtonComponent({ disabled: true });
        component.mount(testContainer);
        component.enable();
        assert.notOk(component.el.disabled);
        assert.notOk(component.el.hasAttribute('disabled'));
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

runner.describe('Component - Child Management', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should add child component with addChild()', () => {
        const parent = new ContainerComponent();
        const child = new TestComponent({ text: 'Child' });

        parent.mount(testContainer);
        parent.addChild('testChild', child, '.inner');

        assert.ok(child.isMounted());
        assert.equal(parent.find('.inner').children.length, 1);
    });

    runner.it('should get child component with getChild()', () => {
        const parent = new ContainerComponent();
        const child = new TestComponent({ text: 'Child' });

        parent.mount(testContainer);
        parent.addChild('testChild', child);

        const retrieved = parent.getChild('testChild');
        assert.equal(retrieved, child);
    });

    runner.it('should remove child component with removeChild()', () => {
        const parent = new ContainerComponent();
        const child = new TestComponent({ text: 'Child' });

        parent.mount(testContainer);
        parent.addChild('testChild', child, '.inner');

        parent.removeChild('testChild');
        assert.notOk(child.isMounted());
        assert.equal(parent.getChild('testChild'), undefined);
    });

    runner.it('should clear all children with clearChildren()', () => {
        const parent = new ContainerComponent();
        const child1 = new TestComponent({ text: 'Child 1' });
        const child2 = new TestComponent({ text: 'Child 2' });

        parent.mount(testContainer);
        parent.addChild('child1', child1, '.inner');
        parent.addChild('child2', child2, '.inner');

        parent.clearChildren();

        assert.notOk(child1.isMounted());
        assert.notOk(child2.isMounted());
        assert.equal(parent.getChild('child1'), undefined);
    });

    runner.it('should unmount children when parent unmounts', () => {
        const parent = new ContainerComponent();
        const child = new TestComponent({ text: 'Child' });

        parent.mount(testContainer);
        parent.addChild('child', child, '.inner');
        assert.ok(child.isMounted());

        parent.unmount();
        assert.notOk(child.isMounted());
    });
});

runner.describe('Component - Utility Methods', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should return element with getElement()', () => {
        const component = new TestComponent();
        component.mount(testContainer);
        assert.equal(component.getElement(), component.el);
    });

    runner.it('should return mounted state with isMounted()', () => {
        const component = new TestComponent();
        assert.notOk(component.isMounted());

        component.mount(testContainer);
        assert.ok(component.isMounted());

        component.unmount();
        assert.notOk(component.isMounted());
    });
});
