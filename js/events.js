// ============================================
// EVENT DEFINITIONS (Minimal - Raw Facts Only)
// ============================================

import { PLAYERS } from './config.js';

export class GameEvent {
    constructor(type, data) {
        this.type = type;
        this.data = data;
        this.timestamp = Date.now();
        this.version = null; // Set by EventStore
    }
}

// Only raw facts: who started, player names (optional)
export class GameStartedEvent extends GameEvent {
    constructor(startingPlayerId, redName = PLAYERS.RED, blueName = PLAYERS.BLUE) {
        super('GAME_STARTED', {
            startingPlayerId,
            redName: redName || PLAYERS.RED,
            blueName: blueName || PLAYERS.BLUE
        });
    }
}

// Only raw facts: position (zone/points derived)
export class PokPlacedEvent extends GameEvent {
    constructor(pokId, playerId, x, y) {
        super('POK_PLACED', {
            pokId,
            playerId,
            x, // Table X percentage
            y  // Table Y percentage
        });
    }
}

// Only raw facts: new position (zone/points derived)
export class PokMovedEvent extends GameEvent {
    constructor(pokId, newX, newY) {
        super('POK_MOVED', {
            pokId,
            x: newX,
            y: newY
        });
    }
}

// Only raw facts: which POK removed
export class PokRemovedEvent extends GameEvent {
    constructor(pokId) {
        super('POK_REMOVED', { pokId });
    }
}

// Derived event (generated when conditions met)
// Scores are recalculated from poks, not stored in event
export class RoundEndedEvent extends GameEvent {
    constructor(roundNumber) {
        super('ROUND_ENDED', {
            roundNumber
        });
    }
}

export class RoundStartedEvent extends GameEvent {
    constructor(roundNumber, startingPlayerId) {
        super('ROUND_STARTED', {
            roundNumber,
            startingPlayerId
        });
    }
}

export class TableFlippedEvent extends GameEvent {
    constructor(isFlipped) {
        super('TABLE_FLIPPED', { isFlipped });
    }
}

export class GameResetEvent extends GameEvent {
    constructor() {
        super('GAME_RESET', {});
    }
}

// File operation events (for tracking load/import/export)
export class GameLoadedEvent extends GameEvent {
    constructor(eventCount) {
        super('GAME_LOADED', { eventCount });
    }
}

export class GameImportedEvent extends GameEvent {
    constructor(eventCount, filename) {
        super('GAME_IMPORTED', { eventCount, filename });
    }
}

export class GameExportedEvent extends GameEvent {
    constructor(eventCount, filename) {
        super('GAME_EXPORTED', { eventCount, filename });
    }
}
