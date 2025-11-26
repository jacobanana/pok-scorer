// ============================================
// COMPONENT REGISTRY UNIT TESTS
// ============================================

import { Component } from '../../js/components/core/Component.js';
import { ComponentRegistry, globalRegistry } from '../../js/components/core/ComponentRegistry.js';

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
// Test Components
// ============================================

class TestButton extends Component {
    template() {
        return `<button class="btn">${this.props.label || 'Button'}</button>`;
    }
}

class TestCard extends Component {
    template() {
        return `<div class="card">${this.props.title || 'Card'}</div>`;
    }
}

class TestModal extends Component {
    template() {
        return `<div class="modal">${this.props.content || ''}</div>`;
    }
}

// ============================================
// TESTS
// ============================================

runner.describe('ComponentRegistry - Initialization', () => {
    runner.it('should create empty registry', () => {
        const registry = new ComponentRegistry();
        assert.deepEqual(registry.getRegisteredNames(), []);
        assert.deepEqual(registry.getInstanceIds(), []);
    });

    runner.it('should have global registry available', () => {
        assert.ok(globalRegistry instanceof ComponentRegistry);
    });
});

runner.describe('ComponentRegistry - Registration', () => {
    let registry;

    runner.beforeEach(() => {
        registry = new ComponentRegistry();
    });

    runner.it('should register a component', () => {
        registry.register('button', TestButton);
        assert.ok(registry.has('button'));
    });

    runner.it('should get registered component class', () => {
        registry.register('button', TestButton);
        const ComponentClass = registry.get('button');
        assert.equal(ComponentClass, TestButton);
    });

    runner.it('should return undefined for unregistered component', () => {
        const ComponentClass = registry.get('nonexistent');
        assert.equal(ComponentClass, undefined);
    });

    runner.it('should check if component is registered with has()', () => {
        registry.register('card', TestCard);
        assert.ok(registry.has('card'));
        assert.notOk(registry.has('nonexistent'));
    });

    runner.it('should register multiple components with registerAll()', () => {
        registry.registerAll({
            'button': TestButton,
            'card': TestCard,
            'modal': TestModal
        });

        assert.ok(registry.has('button'));
        assert.ok(registry.has('card'));
        assert.ok(registry.has('modal'));
    });

    runner.it('should return registry for chaining', () => {
        const result = registry.register('button', TestButton);
        assert.equal(result, registry);
    });

    runner.it('should allow overwriting existing registration', () => {
        registry.register('button', TestButton);
        registry.register('button', TestCard);

        const ComponentClass = registry.get('button');
        assert.equal(ComponentClass, TestCard);
    });

    runner.it('should list all registered names', () => {
        registry.register('button', TestButton);
        registry.register('card', TestCard);

        const names = registry.getRegisteredNames();
        assert.lengthOf(names, 2);
        assert.includes(names, 'button');
        assert.includes(names, 'card');
    });
});

runner.describe('ComponentRegistry - Creating Instances', () => {
    let registry;

    runner.beforeEach(() => {
        createTestContainer();
        registry = new ComponentRegistry();
        registry.registerAll({
            'button': TestButton,
            'card': TestCard
        });
    });

    runner.afterEach(() => {
        registry.clearInstances();
        cleanupTestContainer();
    });

    runner.it('should create component instance', () => {
        const button = registry.create('button', { label: 'Click Me' });

        assert.ok(button instanceof TestButton);
        assert.equal(button.props.label, 'Click Me');
    });

    runner.it('should return null for unregistered component', () => {
        const result = registry.create('nonexistent');
        assert.equal(result, null);
    });

    runner.it('should track created instances', () => {
        const button = registry.create('button');

        const ids = registry.getInstanceIds();
        assert.lengthOf(ids, 1);
        assert.ok(ids[0].startsWith('button-'));
    });

    runner.it('should auto-generate instance IDs', () => {
        const btn1 = registry.create('button');
        const btn2 = registry.create('button');
        const card = registry.create('card');

        const ids = registry.getInstanceIds();
        assert.lengthOf(ids, 3);

        // IDs should be unique
        const uniqueIds = new Set(ids);
        assert.equal(uniqueIds.size, 3);
    });

    runner.it('should allow custom instance ID', () => {
        const button = registry.create('button', {}, 'my-custom-id');

        assert.ok(registry.getInstanceIds().includes('my-custom-id'));
        assert.equal(registry.getInstance('my-custom-id'), button);
    });

    runner.it('should set _registryId on instance', () => {
        const button = registry.create('button', {}, 'custom-id');
        assert.equal(button._registryId, 'custom-id');
    });
});

runner.describe('ComponentRegistry - Instance Management', () => {
    let registry;

    runner.beforeEach(() => {
        createTestContainer();
        registry = new ComponentRegistry();
        registry.register('button', TestButton);
    });

    runner.afterEach(() => {
        registry.clearInstances();
        cleanupTestContainer();
    });

    runner.it('should get instance by ID', () => {
        const button = registry.create('button', { label: 'Test' }, 'btn-1');

        const retrieved = registry.getInstance('btn-1');
        assert.equal(retrieved, button);
    });

    runner.it('should return undefined for non-existent instance', () => {
        const result = registry.getInstance('nonexistent');
        assert.equal(result, undefined);
    });

    runner.it('should remove instance from tracking', () => {
        registry.create('button', {}, 'btn-1');
        registry.removeInstance('btn-1');

        assert.equal(registry.getInstance('btn-1'), undefined);
        assert.notOk(registry.getInstanceIds().includes('btn-1'));
    });

    runner.it('should destroy instance (unmount and remove)', () => {
        const button = registry.create('button', {}, 'btn-1');
        button.mount(testContainer);

        registry.destroyInstance('btn-1');

        assert.notOk(button.isMounted());
        assert.equal(registry.getInstance('btn-1'), undefined);
    });

    runner.it('should clear all instances', () => {
        const btn1 = registry.create('button', {}, 'btn-1');
        const btn2 = registry.create('button', {}, 'btn-2');

        btn1.mount(testContainer);
        btn2.mount(testContainer);

        registry.clearInstances();

        assert.notOk(btn1.isMounted());
        assert.notOk(btn2.isMounted());
        assert.deepEqual(registry.getInstanceIds(), []);
    });
});

runner.describe('ComponentRegistry - Getting Instances Of Type', () => {
    let registry;

    runner.beforeEach(() => {
        createTestContainer();
        registry = new ComponentRegistry();
        registry.registerAll({
            'button': TestButton,
            'card': TestCard
        });
    });

    runner.afterEach(() => {
        registry.clearInstances();
        cleanupTestContainer();
    });

    runner.it('should get all instances of a type', () => {
        registry.create('button', { label: 'Btn1' });
        registry.create('button', { label: 'Btn2' });
        registry.create('card', { title: 'Card1' });

        const buttons = registry.getInstancesOf('button');
        assert.lengthOf(buttons, 2);
        assert.ok(buttons.every(b => b instanceof TestButton));
    });

    runner.it('should return empty array for type with no instances', () => {
        registry.create('button');

        const cards = registry.getInstancesOf('card');
        assert.lengthOf(cards, 0);
    });

    runner.it('should return empty array for unregistered type', () => {
        const result = registry.getInstancesOf('nonexistent');
        assert.lengthOf(result, 0);
    });
});

runner.describe('ComponentRegistry - Unregistration', () => {
    let registry;

    runner.beforeEach(() => {
        registry = new ComponentRegistry();
        registry.registerAll({
            'button': TestButton,
            'card': TestCard
        });
    });

    runner.it('should unregister a component', () => {
        registry.unregister('button');

        assert.notOk(registry.has('button'));
        assert.ok(registry.has('card'));
    });

    runner.it('should return registry for chaining', () => {
        const result = registry.unregister('button');
        assert.equal(result, registry);
    });
});

runner.describe('ComponentRegistry - Clear', () => {
    let registry;

    runner.beforeEach(() => {
        createTestContainer();
        registry = new ComponentRegistry();
        registry.registerAll({
            'button': TestButton,
            'card': TestCard
        });
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should clear all registrations and instances', () => {
        const btn = registry.create('button');
        btn.mount(testContainer);

        registry.clear();

        assert.notOk(registry.has('button'));
        assert.notOk(registry.has('card'));
        assert.deepEqual(registry.getRegisteredNames(), []);
        assert.deepEqual(registry.getInstanceIds(), []);
        assert.notOk(btn.isMounted());
    });

    runner.it('should return registry for chaining', () => {
        const result = registry.clear();
        assert.equal(result, registry);
    });
});

runner.describe('ComponentRegistry - Integration with Components', () => {
    let registry;

    runner.beforeEach(() => {
        createTestContainer();
        registry = new ComponentRegistry();
        registry.register('button', TestButton);
    });

    runner.afterEach(() => {
        registry.clear();
        cleanupTestContainer();
    });

    runner.it('should create and mount component in one flow', () => {
        const button = registry.create('button', { label: 'Test' });
        button.mount(testContainer);

        assert.ok(button.isMounted());
        assert.equal(testContainer.querySelector('.btn').textContent, 'Test');
    });

    runner.it('should create multiple independent instances', () => {
        const btn1 = registry.create('button', { label: 'First' });
        const btn2 = registry.create('button', { label: 'Second' });

        btn1.mount(testContainer);
        btn2.mount(testContainer);

        const buttons = testContainer.querySelectorAll('.btn');
        assert.equal(buttons.length, 2);
        assert.equal(buttons[0].textContent, 'First');
        assert.equal(buttons[1].textContent, 'Second');
    });

    runner.it('should allow updating created instances', () => {
        const button = registry.create('button', { label: 'Original' }, 'my-btn');
        button.mount(testContainer);

        // Retrieve and update
        const retrieved = registry.getInstance('my-btn');
        retrieved.update({ label: 'Updated' });

        assert.equal(testContainer.querySelector('.btn').textContent, 'Updated');
    });
});
