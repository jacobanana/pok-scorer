// ============================================
// EVENT STORE (Single Source of Truth)
// ============================================

import { CONFIG } from './config.js';
import { GameLoadedEvent, GameImportedEvent, GameExportedEvent, GameResetEvent } from './events.js';

export class EventStore {
    constructor() {
        this.events = [];
        this.version = 0;
        this.subscribers = new Map(); // eventType → Set<handler>
    }

    get enableLogging() {
        return CONFIG.ENABLE_LOGGING;
    }

    append(event) {
        event.version = ++this.version;
        this.events.push(event);

        if (this.enableLogging) {
            console.log(`%c[Event #${event.version}] ${event.type}`,
                'color: #2196F3; font-weight: bold',
                event.data);
        }

        this.publish(event);
        return event;
    }

    getEvents(fromVersion = 0) {
        return this.events.filter(e => e.version > fromVersion);
    }

    getAllEvents() {
        return [...this.events];
    }

    subscribe(eventType, handler) {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType).add(handler);

        if (this.enableLogging && eventType !== '*') {
            const count = this.subscribers.get(eventType).size;
            console.log(`%c[Subscribe] ${eventType}`,
                'color: #4CAF50; font-style: italic',
                `(${count} subscriber${count !== 1 ? 's' : ''})`);
        }
    }

    unsubscribe(eventType, handler) {
        this.subscribers.get(eventType)?.delete(handler);
    }

    publish(event) {
        // Wildcard handlers (run first - typically projections that build state)
        const wildcardHandlers = this.subscribers.get('*') || new Set();
        // Specific handlers (run after - typically UI that reads state)
        const handlers = this.subscribers.get(event.type) || new Set();

        const allHandlers = [...wildcardHandlers, ...handlers];

        if (this.enableLogging && allHandlers.length > 0) {
            console.log(`%c[Publish] ${event.type} → ${allHandlers.length} handler(s)`,
                'color: #FF9800; font-size: 11px');
        }

        allHandlers.forEach((handler, index) => {
            try {
                const startTime = performance.now();
                handler(event);
                const duration = performance.now() - startTime;

                if (this.enableLogging && duration > 1) {
                    console.log(`  %c└─ Handler #${index + 1} took ${duration.toFixed(2)}ms`,
                        'color: #9E9E9E; font-size: 10px');
                }
            } catch (error) {
                console.error(`%c[Error] Handler #${index + 1} for ${event.type}`,
                    'color: #F44336; font-weight: bold',
                    error);
            }
        });
    }

    clear() {
        this.events = [];
        this.version = 0;
        if (this.enableLogging) {
            console.log('%c[EventStore] Cleared', 'color: #9C27B0; font-weight: bold');
        }
    }

    // Debug helpers
    printEventLog() {
        console.group(`%c📜 Event Log (${this.events.length} events)`,
            'color: #2196F3; font-size: 14px; font-weight: bold');

        this.events.forEach((event) => {
            const timestamp = new Date(event.timestamp).toLocaleTimeString();
            console.log(`%c#${event.version} [${timestamp}] ${event.type}`,
                'color: #666; font-weight: bold',
                event.data);
        });

        console.groupEnd();
    }

    printStats() {
        const eventCounts = {};
        this.events.forEach(e => {
            eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
        });

        console.group('%c📊 Event Statistics', 'color: #4CAF50; font-size: 14px; font-weight: bold');
        console.log(`Total events: ${this.events.length}`);
        console.log(`Current version: ${this.version}`);
        console.table(eventCounts);
        console.groupEnd();
    }

    // Persistence
    save() {
        localStorage.setItem('pok-event-store', JSON.stringify({
            events: this.events,
            version: this.version
        }));

        if (this.enableLogging) {
            console.log(`%c[EventStore] Saved ${this.events.length} events to LocalStorage`,
                'color: #9C27B0; font-size: 11px');
        }
    }

    load() {
        const saved = localStorage.getItem('pok-event-store');
        if (!saved) return false;

        const data = JSON.parse(saved);

        if (this.enableLogging) {
            console.log(`%c[EventStore] Loading ${data.events.length} events from LocalStorage`,
                'color: #4CAF50; font-weight: bold');
        }

        // Clear current state (events and projections)
        this.clear();

        // Publish reset event to clear projection state
        this.publish(new GameResetEvent(0));

        // Load events and version
        this.events = data.events;
        this.version = data.version;

        // Replay all events to rebuild projections
        this.events.forEach(event => this.publish(event));

        // Publish (not append) a GAME_LOADED event for tracking
        // This is metadata and not part of the game event log
        this.publish(new GameLoadedEvent(this.events.length));

        return true;
    }

    exportToFile() {
        const data = {
            events: this.events,
            version: this.version,
            exportedAt: new Date().toISOString()
        };

        const filename = `pok-game-${Date.now()}.json`;

        if (this.enableLogging) {
            console.log(`%c[EventStore] Exporting ${this.events.length} events to ${filename}`,
                'color: #00BCD4; font-weight: bold');
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        // Publish (not append) a GAME_EXPORTED event for tracking
        // This is metadata and not part of the game event log
        this.publish(new GameExportedEvent(this.events.length, filename));
    }

    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (this.enableLogging) {
                        console.log(`%c[EventStore] Importing ${data.events.length} events from ${file.name}`,
                            'color: #FF9800; font-weight: bold');
                    }

                    // Clear current state (events and projections)
                    this.clear();

                    // Publish reset event to clear projection state
                    this.publish(new GameResetEvent(0));

                    // Load events and version
                    this.events = data.events;
                    this.version = data.version;

                    // Replay all events to rebuild projections
                    this.events.forEach(event => this.publish(event));

                    // Publish (not append) a GAME_IMPORTED event for tracking
                    // This is metadata and not part of the game event log
                    this.publish(new GameImportedEvent(this.events.length, file.name));

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}
