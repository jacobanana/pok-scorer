// Core
export { Component } from './core/Component.js';
export { ComponentRegistry, globalRegistry } from './core/ComponentRegistry.js';

// UI Components
import {
    Button,
    Modal,
    ScoreCircle,
    ScoreMarkers,
    ScoreDifference,
    Zone,
    ZoneColumn,
    Pok,
    PlayerInput,
    HistoryTable,
    Notification,
    LoadingBar,
    StartSelector
} from './ui/index.js';

export {
    Button,
    Modal,
    ScoreCircle,
    ScoreMarkers,
    ScoreDifference,
    Zone,
    ZoneColumn,
    Pok,
    PlayerInput,
    HistoryTable,
    Notification,
    LoadingBar,
    StartSelector
};

/**
 * Initialize the global component registry with all UI components
 * @param {ComponentRegistry} registry - Registry to initialize (defaults to globalRegistry)
 * @returns {ComponentRegistry}
 */
export function initializeRegistry(registry = globalRegistry) {
    registry.registerAll({
        'button': Button,
        'modal': Modal,
        'score-circle': ScoreCircle,
        'score-markers': ScoreMarkers,
        'score-difference': ScoreDifference,
        'zone': Zone,
        'zone-column': ZoneColumn,
        'pok': Pok,
        'player-input': PlayerInput,
        'history-table': HistoryTable,
        'notification': Notification,
        'loading-bar': LoadingBar,
        'start-selector': StartSelector
    });

    return registry;
}
