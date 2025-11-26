/**
 * ComponentRegistry - A repository for component definitions.
 * Allows registering, retrieving, and creating component instances by name.
 *
 * Usage:
 *   const registry = new ComponentRegistry();
 *   registry.register('button', Button);
 *   const btn = registry.create('button', { text: 'Click me' });
 *   btn.mount(document.body);
 */
export class ComponentRegistry {
    constructor() {
        this._components = new Map();
        this._instances = new Map();
        this._instanceCounter = 0;
    }

    /**
     * Register a component class with a name
     * @param {string} name - Component name
     * @param {typeof Component} ComponentClass - Component class
     * @returns {ComponentRegistry} this for chaining
     */
    register(name, ComponentClass) {
        if (this._components.has(name)) {
            console.warn(`ComponentRegistry: Overwriting existing component "${name}"`);
        }
        this._components.set(name, ComponentClass);
        return this;
    }

    /**
     * Register multiple components at once
     * @param {Object} components - Object mapping names to component classes
     * @returns {ComponentRegistry} this for chaining
     */
    registerAll(components) {
        Object.entries(components).forEach(([name, ComponentClass]) => {
            this.register(name, ComponentClass);
        });
        return this;
    }

    /**
     * Get a component class by name
     * @param {string} name - Component name
     * @returns {typeof Component|undefined}
     */
    get(name) {
        return this._components.get(name);
    }

    /**
     * Check if a component is registered
     * @param {string} name - Component name
     * @returns {boolean}
     */
    has(name) {
        return this._components.has(name);
    }

    /**
     * Create a new instance of a registered component
     * @param {string} name - Component name
     * @param {Object} props - Component properties
     * @param {string} instanceId - Optional custom instance ID
     * @returns {Component|null}
     */
    create(name, props = {}, instanceId = null) {
        const ComponentClass = this._components.get(name);
        if (!ComponentClass) {
            console.error(`ComponentRegistry: Component "${name}" not found`);
            return null;
        }

        const instance = new ComponentClass(props);
        const id = instanceId || `${name}-${++this._instanceCounter}`;
        instance._registryId = id;
        this._instances.set(id, instance);
        return instance;
    }

    /**
     * Get a component instance by ID
     * @param {string} instanceId - Instance ID
     * @returns {Component|undefined}
     */
    getInstance(instanceId) {
        return this._instances.get(instanceId);
    }

    /**
     * Remove an instance from tracking (does not unmount)
     * @param {string} instanceId - Instance ID
     * @returns {ComponentRegistry} this for chaining
     */
    removeInstance(instanceId) {
        this._instances.delete(instanceId);
        return this;
    }

    /**
     * Unmount and remove an instance
     * @param {string} instanceId - Instance ID
     * @returns {ComponentRegistry} this for chaining
     */
    destroyInstance(instanceId) {
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.unmount();
            this._instances.delete(instanceId);
        }
        return this;
    }

    /**
     * Get all registered component names
     * @returns {string[]}
     */
    getRegisteredNames() {
        return Array.from(this._components.keys());
    }

    /**
     * Get all instance IDs
     * @returns {string[]}
     */
    getInstanceIds() {
        return Array.from(this._instances.keys());
    }

    /**
     * Get all instances of a specific component type
     * @param {string} name - Component name
     * @returns {Component[]}
     */
    getInstancesOf(name) {
        const ComponentClass = this._components.get(name);
        if (!ComponentClass) return [];

        return Array.from(this._instances.values()).filter(
            instance => instance instanceof ComponentClass
        );
    }

    /**
     * Clear all instances (unmounts them)
     * @returns {ComponentRegistry} this for chaining
     */
    clearInstances() {
        this._instances.forEach(instance => instance.unmount());
        this._instances.clear();
        return this;
    }

    /**
     * Unregister a component
     * @param {string} name - Component name
     * @returns {ComponentRegistry} this for chaining
     */
    unregister(name) {
        this._components.delete(name);
        return this;
    }

    /**
     * Clear all registrations and instances
     * @returns {ComponentRegistry} this for chaining
     */
    clear() {
        this.clearInstances();
        this._components.clear();
        return this;
    }
}

// Global registry instance for convenience
export const globalRegistry = new ComponentRegistry();
