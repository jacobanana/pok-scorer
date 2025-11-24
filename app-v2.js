// ============================================
// POK Score Counter - Event Sourced Architecture
// ============================================
// Events are the single source of truth.
// All state is derived by replaying events.
// Events contain only raw facts (positions, IDs).
// Derived data (zones, points) calculated on-the-fly.
// ============================================

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    WINNING_SCORE: 21,
    POKS_PER_PLAYER: 5,
    AUTO_END_DELAY_MS: 5000,
    TURN_NOTIFICATION_MS: 1000,
    BOUNDARY_THRESHOLD_PERCENT: 2,
    TABLE_ASPECT_RATIO: 1.5,

    ZONE_BOUNDARIES: {
        // Horizontal (X-axis percentages)
        zone3Right: 20,   // Zone 3: 0-20%
        zone2Right: 40,   // Zone 2: 20-40%
        zone1Right: 60,   // Zone 1: 40-60%
        zone0Right: 100,  // Zone 0: 60-100%

        // Circular zones (within zone 1 area)
        circle4: { x: 50, y: 19, radius: 6 },  // Top circle
        circle5: { x: 50, y: 81, radius: 6 }   // Bottom circle
    },

    ZONE_POINTS: {
        'outer': 0, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5
    }
};

// ============================================
// EVENT DEFINITIONS (Minimal - Raw Facts Only)
// ============================================

class GameEvent {
    constructor(type, data) {
        this.type = type;
        this.data = data;
        this.timestamp = Date.now();
        this.version = null; // Set by EventStore
    }
}

// Only raw facts: who started
class GameStartedEvent extends GameEvent {
    constructor(startingPlayerId) {
        super('GAME_STARTED', { startingPlayerId });
    }
}

// Only raw facts: position (zone/points derived)
class PokPlacedEvent extends GameEvent {
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
class PokMovedEvent extends GameEvent {
    constructor(pokId, newX, newY) {
        super('POK_MOVED', {
            pokId,
            x: newX,
            y: newY
        });
    }
}

// Only raw facts: which POK removed
class PokRemovedEvent extends GameEvent {
    constructor(pokId) {
        super('POK_REMOVED', { pokId });
    }
}

// Derived event (generated when conditions met)
class RoundEndedEvent extends GameEvent {
    constructor(roundNumber, redScore, blueScore) {
        super('ROUND_ENDED', {
            roundNumber,
            redScore,
            blueScore
        });
    }
}

class RoundStartedEvent extends GameEvent {
    constructor(roundNumber, startingPlayerId) {
        super('ROUND_STARTED', {
            roundNumber,
            startingPlayerId
        });
    }
}

class TableFlippedEvent extends GameEvent {
    constructor(isFlipped) {
        super('TABLE_FLIPPED', { isFlipped });
    }
}

class GameResetEvent extends GameEvent {
    constructor() {
        super('GAME_RESET', {});
    }
}

// File operation events (for tracking load/import/export)
class GameLoadedEvent extends GameEvent {
    constructor(eventCount) {
        super('GAME_LOADED', { eventCount });
    }
}

class GameImportedEvent extends GameEvent {
    constructor(eventCount, filename) {
        super('GAME_IMPORTED', { eventCount, filename });
    }
}

class GameExportedEvent extends GameEvent {
    constructor(eventCount, filename) {
        super('GAME_EXPORTED', { eventCount, filename });
    }
}

// ============================================
// EVENT STORE (Single Source of Truth)
// ============================================

class EventStore {
    constructor() {
        this.events = [];
        this.version = 0;
        this.subscribers = new Map(); // eventType → Set<handler>
        this.enableLogging = true; // Set to false to disable logging
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
        // Specific handlers
        const handlers = this.subscribers.get(event.type) || new Set();
        // Wildcard handlers
        const wildcardHandlers = this.subscribers.get('*') || new Set();

        const allHandlers = [...handlers, ...wildcardHandlers];

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
        this.events = data.events;
        this.version = data.version;

        if (this.enableLogging) {
            console.log(`%c[EventStore] Loading ${this.events.length} events from LocalStorage`,
                'color: #4CAF50; font-weight: bold');
        }

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

                    this.clear();
                    this.events = data.events;
                    this.version = data.version;
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

// ============================================
// SCORING SERVICE (Pure Functions - No State)
// ============================================

class ScoringService {
    // Calculate zone and points from position
    static getZoneInfo(x, y) {
        const { ZONE_BOUNDARIES, ZONE_POINTS, BOUNDARY_THRESHOLD_PERCENT, TABLE_ASPECT_RATIO } = CONFIG;

        // Outside table
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { zoneId: 'outer', points: 0, isHigh: true, boundaryZone: null };
        }

        // Check circular zones first
        const circle4 = this.checkCircle(x, y, ZONE_BOUNDARIES.circle4, '4', '1');
        if (circle4) return circle4;

        const circle5 = this.checkCircle(x, y, ZONE_BOUNDARIES.circle5, '5', '1');
        if (circle5) return circle5;

        // Check rectangular zones
        if (x < ZONE_BOUNDARIES.zone3Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone3Right, '3', '2');
        } else if (x < ZONE_BOUNDARIES.zone2Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone2Right, '2', '1');
        } else if (x < ZONE_BOUNDARIES.zone1Right) {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone1Right, '1', '0');
        } else {
            return this.checkRectangle(x, ZONE_BOUNDARIES.zone0Right, '0', null);
        }
    }

    static checkCircle(x, y, circle, zoneId, boundaryZone) {
        const { TABLE_ASPECT_RATIO, BOUNDARY_THRESHOLD_PERCENT, ZONE_POINTS } = CONFIG;

        const dx = x - circle.x;
        const dy = (y - circle.y) / TABLE_ASPECT_RATIO;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= circle.radius) {
            const isNearBoundary = distance >= (circle.radius - BOUNDARY_THRESHOLD_PERCENT);

            if (isNearBoundary && boundaryZone) {
                return {
                    zoneId,
                    points: ZONE_POINTS[boundaryZone],
                    isHigh: false,
                    boundaryZone
                };
            }

            return {
                zoneId,
                points: ZONE_POINTS[zoneId],
                isHigh: true,
                boundaryZone: null
            };
        }

        return null;
    }

    static checkRectangle(x, rightBoundary, zoneId, boundaryZone) {
        const { BOUNDARY_THRESHOLD_PERCENT, ZONE_POINTS } = CONFIG;

        const isNearBoundary = boundaryZone && (x >= rightBoundary - BOUNDARY_THRESHOLD_PERCENT);

        if (isNearBoundary) {
            return {
                zoneId,
                points: ZONE_POINTS[boundaryZone],
                isHigh: false,
                boundaryZone
            };
        }

        return {
            zoneId,
            points: ZONE_POINTS[zoneId],
            isHigh: true,
            boundaryZone: null
        };
    }
}

// ============================================
// GAME STATE PROJECTION
// ============================================

class GameStateProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.state = this.initState();

        // Subscribe to events
        eventStore.subscribe('*', (e) => this.apply(e));
    }

    initState() {
        return {
            isStarted: false,
            players: {
                red: { totalScore: 0 },
                blue: { totalScore: 0 }
            },
            rounds: [],
            currentRoundIndex: -1,
            isFlipped: false
        };
    }

    apply(event) {
        switch (event.type) {
            case 'GAME_STARTED':
                this.onGameStarted(event);
                break;
            case 'POK_PLACED':
                this.onPokPlaced(event);
                break;
            case 'POK_MOVED':
                this.onPokMoved(event);
                break;
            case 'POK_REMOVED':
                this.onPokRemoved(event);
                break;
            case 'ROUND_ENDED':
                this.onRoundEnded(event);
                break;
            case 'ROUND_STARTED':
                this.onRoundStarted(event);
                break;
            case 'TABLE_FLIPPED':
                this.onTableFlipped(event);
                break;
            case 'GAME_RESET':
                this.onGameReset(event);
                break;
        }
    }

    onGameStarted(event) {
        this.state.isStarted = true;
        this.state.rounds.push({
            roundNumber: 0,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null
        });
        this.state.currentRoundIndex = 0;
    }

    onPokPlaced(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        // Calculate derived data from position
        const zoneInfo = ScoringService.getZoneInfo(event.data.x, event.data.y);

        round.poks.push({
            id: event.data.pokId,
            playerId: event.data.playerId,
            x: event.data.x,
            y: event.data.y,
            zoneId: zoneInfo.zoneId,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        });

        // Decrement POKs remaining
        if (event.data.playerId === 'red') {
            round.redPoksRemaining--;
        } else {
            round.bluePoksRemaining--;
        }

        round.lastPlacedPokId = event.data.pokId;

        // Mark complete if all POKs placed
        if (round.redPoksRemaining === 0 && round.bluePoksRemaining === 0) {
            round.isComplete = true;
        }
    }

    onPokMoved(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        const pok = round.poks.find(p => p.id === event.data.pokId);
        if (!pok) return;

        // Update position
        pok.x = event.data.x;
        pok.y = event.data.y;

        // Recalculate derived data
        const zoneInfo = ScoringService.getZoneInfo(pok.x, pok.y);
        pok.zoneId = zoneInfo.zoneId;
        pok.points = zoneInfo.points;
        pok.isHigh = zoneInfo.isHigh;
        pok.boundaryZone = zoneInfo.boundaryZone;
    }

    onPokRemoved(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        const index = round.poks.findIndex(p => p.id === event.data.pokId);
        if (index === -1) return;

        const pok = round.poks[index];
        round.poks.splice(index, 1);

        // Increment POKs remaining
        if (pok.playerId === 'red') {
            round.redPoksRemaining++;
        } else {
            round.bluePoksRemaining++;
        }

        // Update last placed
        round.lastPlacedPokId = round.poks.length > 0
            ? round.poks[round.poks.length - 1].id
            : null;

        // Mark incomplete
        round.isComplete = false;
    }

    onRoundEnded(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        // Calculate winner and points
        const redScore = event.data.redScore;
        const blueScore = event.data.blueScore;
        const diff = Math.abs(redScore - blueScore);

        if (redScore > blueScore) {
            this.state.players.red.totalScore += diff;
        } else if (blueScore > redScore) {
            this.state.players.blue.totalScore += diff;
        }
        // Tie: no points awarded
    }

    onRoundStarted(event) {
        this.state.rounds.push({
            roundNumber: event.data.roundNumber,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null
        });
        this.state.currentRoundIndex = event.data.roundNumber;
    }

    onTableFlipped(event) {
        this.state.isFlipped = event.data.isFlipped;
    }

    onGameReset(event) {
        this.state = this.initState();
    }

    // Query methods
    getState() {
        return this.state;
    }

    getCurrentRound() {
        if (this.state.currentRoundIndex === -1) return null;
        return this.state.rounds[this.state.currentRoundIndex];
    }

    getRoundScores() {
        const round = this.getCurrentRound();
        if (!round) return { red: 0, blue: 0 };

        const redScore = round.poks
            .filter(p => p.playerId === 'red')
            .reduce((sum, p) => sum + p.points, 0);

        const blueScore = round.poks
            .filter(p => p.playerId === 'blue')
            .reduce((sum, p) => sum + p.points, 0);

        return { red: redScore, blue: blueScore };
    }

    getNextPlayer() {
        const round = this.getCurrentRound();
        if (!round) return null;

        // If one player out of POKs, other continues
        if (round.redPoksRemaining === 0 && round.bluePoksRemaining > 0) {
            return 'blue';
        }
        if (round.bluePoksRemaining === 0 && round.redPoksRemaining > 0) {
            return 'red';
        }

        // Both have POKs: lower score goes first
        const scores = this.getRoundScores();
        if (scores.red < scores.blue) return 'red';
        if (scores.blue < scores.red) return 'blue';

        // Tied: alternate
        return round.currentPlayerId === 'red' ? 'blue' : 'red';
    }

    hasWinner() {
        return this.state.players.red.totalScore >= CONFIG.WINNING_SCORE ||
               this.state.players.blue.totalScore >= CONFIG.WINNING_SCORE;
    }
}

// ============================================
// UI PROJECTION
// ============================================

class UIProjection {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;
        this.dom = {};
        this.pokElements = new Map();
        this.tableElement = null;

        // Subscribe to events
        eventStore.subscribe('GAME_STARTED', (e) => this.onGameStarted(e));
        eventStore.subscribe('POK_PLACED', (e) => this.onPokPlaced(e));
        eventStore.subscribe('POK_MOVED', (e) => this.onPokMoved(e));
        eventStore.subscribe('POK_REMOVED', (e) => this.onPokRemoved(e));
        eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
        eventStore.subscribe('ROUND_STARTED', (e) => this.onRoundStarted(e));
        eventStore.subscribe('TABLE_FLIPPED', (e) => this.onTableFlipped(e));
        eventStore.subscribe('GAME_RESET', (e) => this.onGameReset(e));
    }

    init() {
        this.dom = {
            startSelector: document.getElementById('gameStartSelector'),
            continueButton: document.getElementById('continueGameButton'),
            saveLatestButton: document.getElementById('saveLatestGameButton'),
            tableContainer: document.getElementById('gameBoardContainer'),
            table: document.querySelector('.table'),
            mainRedTotal: document.getElementById('totalScoreRed'),
            mainBlueTotal: document.getElementById('totalScoreBlue'),
            redRound: document.getElementById('currentRoundScoreRed'),
            blueRound: document.getElementById('currentRoundScoreBlue'),
            scoreDiff: document.getElementById('currentRoundScoreDifference'),
            redPoksInfo: document.getElementById('remainingPoksRed'),
            bluePoksInfo: document.getElementById('remainingPoksBlue'),
            roundModal: document.getElementById('roundEndModal'),
            modalWinner: document.getElementById('roundEndModalWinner'),
            modalRedScore: document.getElementById('roundEndModalRedScore'),
            modalBlueScore: document.getElementById('roundEndModalBlueScore'),
            modalScoreDiff: document.getElementById('roundEndModalScoreDiff'),
            modalTotalScores: document.getElementById('roundEndModalTotalScores'),
            modalRoundNumber: document.getElementById('roundEndModalRoundNumber'),
            historyTableBody: document.getElementById('roundsHistoryTableBody'),
            currentRoundScore: document.getElementById('currentRoundScoreDisplay'),
            turnNotification: document.getElementById('playerTurnNotification')
        };

        this.tableElement = this.dom.table;
    }

    onGameStarted(event) {
        this.hideStartSelector();
        this.updateScores();
        this.showTurnNotification(event.data.startingPlayerId);
    }

    onPokPlaced(event) {
        // Need to wait for game state projection to process first
        // Use setTimeout to defer to next tick
        setTimeout(() => {
            const pok = this.findPok(event.data.pokId);
            if (!pok) {
                console.error('POK not found in game state:', event.data.pokId);
                return;
            }

            // Create DOM element
            const pokEl = this.createPokElement(pok);
            this.pokElements.set(pok.id, pokEl);
            this.tableElement.appendChild(pokEl);

            // Highlight as last placed
            this.clearLastPlacedHighlight();
            pokEl.classList.add('last-placed');

            // Update UI
            this.updateScores();
            this.updateRoundsHistory(); // Update history to show current round progress

            // Switch player and show notification
            const nextPlayer = this.gameState.getNextPlayer();
            if (nextPlayer) {
                this.showTurnNotification(nextPlayer);
            }

            // Update current player in round
            const round = this.gameState.getCurrentRound();
            if (round) {
                round.currentPlayerId = nextPlayer;
                this.updateBodyClass(nextPlayer);
            }
        }, 0);
    }

    onPokMoved(event) {
        setTimeout(() => {
            const pok = this.findPok(event.data.pokId);
            const pokEl = this.pokElements.get(event.data.pokId);

            if (!pok || !pokEl) return;

            // Update position
            pokEl.style.left = `${pok.x}%`;
            pokEl.style.top = `${pok.y}%`;

            // Update points display
            pokEl.textContent = pok.points;

            // Update high/low score styling
            pokEl.classList.toggle('low-score', !pok.isHigh);

            // Update boundary zone styling
            pokEl.classList.toggle('boundary-zone', !!pok.boundaryZone);

            // Update scores
            this.updateScores();
            this.updateRoundsHistory(); // Update history to reflect new scores
        }, 0);
    }

    onPokRemoved(event) {
        setTimeout(() => {
            const pokEl = this.pokElements.get(event.data.pokId);
            if (!pokEl) return;

            pokEl.remove();
            this.pokElements.delete(event.data.pokId);

            // Highlight new last placed
            this.clearLastPlacedHighlight();
            const round = this.gameState.getCurrentRound();
            if (round && round.lastPlacedPokId) {
                const lastPokEl = this.pokElements.get(round.lastPlacedPokId);
                if (lastPokEl) {
                    lastPokEl.classList.add('last-placed');
                }
            }

            // Update UI
            this.updateScores();
            this.updateRoundsHistory(); // Update history after undo

            // Update player turn
            const nextPlayer = this.gameState.getNextPlayer();
            if (nextPlayer) {
                this.showTurnNotification(nextPlayer);
                const round = this.gameState.getCurrentRound();
                if (round) {
                    round.currentPlayerId = nextPlayer;
                    this.updateBodyClass(nextPlayer);
                }
            }
        }, 0);
    }

    onRoundEnded(event) {
        this.showRoundModal(event);
        this.updateScores();
        this.updateRoundsHistory();
    }

    onRoundStarted(event) {
        this.hideRoundModal();
        this.clearTable();
        this.updateScores();
        this.showTurnNotification(event.data.startingPlayerId);
        this.updateBodyClass(event.data.startingPlayerId);
        this.updateRoundsHistory();
    }

    onTableFlipped(event) {
        this.dom.tableContainer.classList.toggle('flipped', event.data.isFlipped);
    }

    onGameReset(event) {
        // Defer to next tick to ensure GameStateProjection processes reset first
        setTimeout(() => {
            this.clearTable();
            this.hideRoundModal();
            this.showStartSelector();
            this.updateScores();
            this.updateRoundsHistory();
            document.body.className = '';
        }, 0);
    }

    // UI Helper Methods

    findPok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return null;
        return round.poks.find(p => p.id === pokId);
    }

    createPokElement(pok) {
        const el = document.createElement('div');
        el.className = `pok ${pok.playerId}`;
        if (!pok.isHigh) {
            el.classList.add('low-score');
        }
        if (pok.boundaryZone) {
            el.classList.add('boundary-zone');
        }
        el.textContent = pok.points;
        el.style.left = `${pok.x}%`;
        el.style.top = `${pok.y}%`;
        el.style.transform = 'translate(-50%, -50%)';
        el.draggable = true;
        return el;
    }

    clearLastPlacedHighlight() {
        document.querySelectorAll('.pok.last-placed').forEach(el => {
            el.classList.remove('last-placed');
        });
    }

    updateScores() {
        const state = this.gameState.getState();
        const round = this.gameState.getCurrentRound();

        // Total scores
        this.dom.mainRedTotal.textContent = state.players.red.totalScore;
        this.dom.mainBlueTotal.textContent = state.players.blue.totalScore;

        if (round) {
            const scores = this.gameState.getRoundScores();

            // Round scores
            this.dom.redRound.textContent = scores.red;
            this.dom.blueRound.textContent = scores.blue;

            // POKs remaining
            this.dom.redPoksInfo.textContent = round.redPoksRemaining;
            this.dom.bluePoksInfo.textContent = round.bluePoksRemaining;

            // Score difference
            const diff = Math.abs(scores.red - scores.blue);
            this.dom.scoreDiff.textContent = diff > 0 ? '+' + diff : '0';

            // Background color
            this.dom.currentRoundScore.classList.remove('red-leading', 'blue-leading', 'tied');
            if (scores.red > scores.blue) {
                this.dom.currentRoundScore.classList.add('red-leading');
            } else if (scores.blue > scores.red) {
                this.dom.currentRoundScore.classList.add('blue-leading');
            } else {
                this.dom.currentRoundScore.classList.add('tied');
            }
        }
    }

    showTurnNotification(playerId) {
        if (!this.dom.turnNotification) return;

        const playerName = playerId === 'red' ? 'Red' : 'Blue';
        this.dom.turnNotification.textContent = `${playerName}'s turn`;

        this.dom.turnNotification.classList.remove('show', 'fade-out', 'red-player', 'blue-player');
        this.dom.turnNotification.classList.add(`${playerId}-player`);

        // Hide score display
        this.dom.currentRoundScore.classList.add('hidden');

        // Force reflow
        void this.dom.turnNotification.offsetWidth;

        // Fade in
        this.dom.turnNotification.classList.add('show');

        // Fade out after delay
        setTimeout(() => {
            this.dom.turnNotification.classList.remove('show');
            this.dom.turnNotification.classList.add('fade-out');

            setTimeout(() => {
                this.dom.currentRoundScore.classList.remove('hidden');
            }, 300);
        }, CONFIG.TURN_NOTIFICATION_MS);
    }

    updateBodyClass(playerId) {
        document.body.classList.remove('red-turn', 'blue-turn');
        document.body.classList.add(`${playerId}-turn`);
    }

    showRoundModal(event) {
        const state = this.gameState.getState();
        const scores = { red: event.data.redScore, blue: event.data.blueScore };
        const diff = Math.abs(scores.red - scores.blue);

        let winnerText, bgClass;
        if (scores.red > scores.blue) {
            winnerText = 'RED WINS!';
            bgClass = 'red-bg';
        } else if (scores.blue > scores.red) {
            winnerText = 'BLUE WINS!';
            bgClass = 'blue-bg';
        } else {
            winnerText = 'TIE!';
            bgClass = 'tie-bg';
        }

        this.dom.modalRoundNumber.textContent = `Round ${event.data.roundNumber + 1}`;
        this.dom.modalWinner.textContent = winnerText;
        this.dom.modalRedScore.textContent = scores.red;
        this.dom.modalBlueScore.textContent = scores.blue;
        this.dom.modalScoreDiff.textContent = diff > 0 ? '+' + diff : '0';
        this.dom.modalTotalScores.textContent =
            `Total: Red ${state.players.red.totalScore} - Blue ${state.players.blue.totalScore}`;

        this.dom.roundModal.classList.remove('red-bg', 'blue-bg', 'tie-bg');
        this.dom.roundModal.classList.add(bgClass, 'show');
    }

    hideRoundModal() {
        this.dom.roundModal.classList.remove('show');
    }

    updateRoundsHistory() {
        if (!this.dom.historyTableBody) return;

        const state = this.gameState.getState();
        this.dom.historyTableBody.innerHTML = '';

        state.rounds.forEach((round, index) => {
            const row = document.createElement('tr');

            const scores = this.calculateRoundScores(round);
            const diff = Math.abs(scores.red - scores.blue);

            let winner, winnerClass, rowClass;
            if (round.isComplete) {
                if (scores.red > scores.blue) {
                    winner = 'Red';
                    winnerClass = 'red-winner';
                    rowClass = 'red-round-row';
                } else if (scores.blue > scores.red) {
                    winner = 'Blue';
                    winnerClass = 'blue-winner';
                    rowClass = 'blue-round-row';
                } else {
                    winner = 'Tie';
                    winnerClass = 'winner-tie';
                    rowClass = '';
                }
            } else {
                winner = 'In progress';
                winnerClass = 'winner-current';
                rowClass = 'round-row-current';
            }

            row.className = rowClass;
            row.innerHTML = `
                <td class="round-number">${index + 1}</td>
                <td>${scores.red}</td>
                <td>${scores.blue}</td>
                <td class="${winnerClass}">${winner}</td>
                <td>${round.isComplete ? diff : '-'}</td>
            `;

            this.dom.historyTableBody.appendChild(row);
        });
    }

    calculateRoundScores(round) {
        const redScore = round.poks
            .filter(p => p.playerId === 'red')
            .reduce((sum, p) => sum + p.points, 0);

        const blueScore = round.poks
            .filter(p => p.playerId === 'blue')
            .reduce((sum, p) => sum + p.points, 0);

        return { red: redScore, blue: blueScore };
    }

    showStartSelector() {
        this.dom.startSelector.classList.remove('hidden');

        // Show continue button if saved game exists
        if (localStorage.getItem('pok-event-store')) {
            this.dom.continueButton.classList.add('show');
            this.dom.saveLatestButton.classList.add('show');
        } else {
            this.dom.continueButton.classList.remove('show');
            this.dom.saveLatestButton.classList.remove('show');
        }
    }

    hideStartSelector() {
        this.dom.startSelector.classList.add('hidden');
    }

    clearTable() {
        this.pokElements.forEach(el => el.remove());
        this.pokElements.clear();
    }
}

// ============================================
// COMMAND HANDLERS
// ============================================

class CommandHandler {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;
        this.pokIdCounter = 0;
    }

    startGame(startingPlayerId) {
        const state = this.gameState.getState();
        if (state.isStarted) {
            throw new Error('Game already started');
        }

        this.eventStore.append(new GameStartedEvent(startingPlayerId));
    }

    placePok(playerId, x, y) {
        const round = this.gameState.getCurrentRound();
        if (!round) {
            throw new Error('No active round');
        }

        if (round.isComplete) {
            throw new Error('Round is complete');
        }

        // Check if player has POKs remaining
        const poksRemaining = playerId === 'red'
            ? round.redPoksRemaining
            : round.bluePoksRemaining;

        if (poksRemaining === 0) {
            throw new Error('No POKs remaining for player');
        }

        // Check if it's the correct player's turn
        const nextPlayer = this.gameState.getNextPlayer();
        if (playerId !== nextPlayer) {
            throw new Error(`Not ${playerId}'s turn`);
        }

        const pokId = `pok-${this.pokIdCounter++}`;
        this.eventStore.append(new PokPlacedEvent(pokId, playerId, x, y));
    }

    movePok(pokId, newX, newY) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        const pok = round.poks.find(p => p.id === pokId);
        if (!pok) return;

        this.eventStore.append(new PokMovedEvent(pokId, newX, newY));
    }

    removePok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        // Only allow removing last placed POK
        if (pokId !== round.lastPlacedPokId) {
            throw new Error('Can only remove last placed POK');
        }

        this.eventStore.append(new PokRemovedEvent(pokId));
    }

    endRound() {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        if (!round.isComplete) {
            throw new Error('Round not complete');
        }

        const scores = this.gameState.getRoundScores();
        this.eventStore.append(new RoundEndedEvent(
            round.roundNumber,
            scores.red,
            scores.blue
        ));
    }

    startNextRound() {
        const state = this.gameState.getState();
        const prevRound = this.gameState.getCurrentRound();

        if (!prevRound || !prevRound.isComplete) {
            throw new Error('Cannot start next round');
        }

        // Determine starter: winner of previous round, or alternate if tie
        const scores = this.gameState.getRoundScores();
        let starter;
        if (scores.red > scores.blue) {
            starter = 'red';
        } else if (scores.blue > scores.red) {
            starter = 'blue';
        } else {
            // Tie: alternate
            starter = prevRound.startingPlayerId === 'red' ? 'blue' : 'red';
        }

        const nextRoundNumber = state.rounds.length;
        this.eventStore.append(new RoundStartedEvent(nextRoundNumber, starter));
    }

    flipTable(isFlipped) {
        this.eventStore.append(new TableFlippedEvent(isFlipped));
    }

    resetGame() {
        // Clear all events and localStorage to completely reset the game
        this.eventStore.clear();
        localStorage.removeItem('pok-event-store');

        // Manually trigger a special reset event that won't be stored
        // This allows projections to reset their state properly
        this.eventStore.publish(new GameResetEvent());
    }
}

// ============================================
// MAIN APPLICATION
// ============================================

class PokScorerApp {
    constructor() {
        this.eventStore = new EventStore();
        this.gameState = new GameStateProjection(this.eventStore);
        this.ui = new UIProjection(this.eventStore, this.gameState);
        this.commands = new CommandHandler(this.eventStore, this.gameState);

        this.autoEndTimer = null;
        this.countdownInterval = null;
        this.countdownEndTime = null;
        this.isDragging = false;
        this.draggedPokId = null;
    }

    init() {
        this.ui.init();
        this.setupEventHandlers();

        // Try to load saved game
        const loaded = this.eventStore.load();
        if (loaded) {
            this.ui.updateScores();
            this.ui.updateRoundsHistory();
        } else {
            this.ui.showStartSelector();
        }

        // Auto-save on every event
        this.eventStore.subscribe('*', () => {
            this.eventStore.save();
            this.checkRoundComplete();
        });
    }

    setupEventHandlers() {
        // Start game
        window.startGame = (playerId) => {
            this.commands.startGame(playerId);
        };

        // Continue game
        window.continueLastGame = () => {
            this.ui.hideStartSelector();
            const round = this.gameState.getCurrentRound();
            if (round) {
                this.ui.updateBodyClass(round.currentPlayerId);
            }
        };

        // Save game to file
        window.saveLatestGame = () => {
            this.eventStore.exportToFile();
        };

        // Import game
        window.importMatch = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await this.eventStore.importFromFile(file);
                        this.ui.hideStartSelector();
                        this.ui.updateScores();
                        this.ui.updateRoundsHistory();
                    } catch (error) {
                        alert('Failed to import game: ' + error.message);
                    }
                }
            };
            input.click();
        };

        // New game
        window.confirmNewGame = () => {
            if (confirm('Start a new game? Current progress will be lost.')) {
                this.commands.resetGame();
            }
        };

        // Flip table
        window.flipTable = () => {
            const state = this.gameState.getState();
            this.commands.flipTable(!state.isFlipped);
        };

        // Export game
        window.exportMatch = () => {
            this.eventStore.exportToFile();
        };

        // Place POK
        window.placePok = (event) => {
            if (this.isDragging) return;

            // Don't place POK if we clicked on an existing POK element
            if (event.target.classList.contains('pok')) {
                return;
            }

            const round = this.gameState.getCurrentRound();
            if (!round || round.isComplete) return;

            const pos = this.calculateTablePosition(event);
            const nextPlayer = this.gameState.getNextPlayer();

            try {
                this.commands.placePok(nextPlayer, pos.x, pos.y);
            } catch (error) {
                console.log(error.message);
            }
        };

        // Continue to next round
        window.continueToNextRound = () => {
            this.clearAutoEndTimer();

            // Check if game is over
            if (this.gameState.hasWinner()) {
                this.commands.resetGame();
            } else {
                this.commands.startNextRound();
            }
        };

        // Drag and drop
        this.setupDragAndDrop();

        // Boundary zone highlighting on mouse move
        this.setupBoundaryHighlight();
    }

    setupDragAndDrop() {
        const tableContainer = this.ui.dom.tableContainer;

        // Drag start
        tableContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('pok')) {
                this.isDragging = true;
                this.draggedPokId = this.findPokIdByElement(e.target);
                e.target.classList.add('dragging');

                // Create a cleaner drag image (clone the element)
                const dragImage = e.target.cloneNode(true);
                dragImage.style.opacity = '0.8';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage,
                    e.target.offsetWidth / 2,
                    e.target.offsetHeight / 2);

                // Clean up the drag image after a short delay
                setTimeout(() => dragImage.remove(), 0);

                // Set effect to move (not copy)
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        // Drag end
        tableContainer.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('pok')) {
                e.target.classList.remove('dragging');
                this.isDragging = false;
                this.draggedPokId = null;

                // Clear boundary highlights
                const zones = document.querySelectorAll('.zone, .circle-zone');
                zones.forEach(zone => {
                    zone.classList.remove('boundary-highlight');
                });
            }
        });

        // Drag over
        tableContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move'; // Show move cursor, not copy

            // Show boundary highlighting while dragging
            if (this.isDragging) {
                const pos = this.calculateTablePosition(e);
                const zoneInfo = ScoringService.getZoneInfo(pos.x, pos.y);

                const zones = document.querySelectorAll('.zone, .circle-zone');
                zones.forEach(zone => {
                    const zoneId = zone.getAttribute('data-zone');
                    zone.classList.remove('boundary-highlight');

                    if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                        zone.classList.add('boundary-highlight');
                    }
                });
            }
        });

        // Drop
        tableContainer.addEventListener('drop', (e) => {
            e.preventDefault();

            if (this.draggedPokId) {
                const pos = this.calculateTablePosition(e);
                this.commands.movePok(this.draggedPokId, pos.x, pos.y);
            }
        });

        // Click on POK (undo) - only allow clicking on last-placed POK
        tableContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pok') && e.target.classList.contains('last-placed')) {
                e.stopPropagation(); // Prevent placePok from firing
                const pokId = this.findPokIdByElement(e.target);
                try {
                    this.commands.removePok(pokId);
                } catch (error) {
                    console.warn('Cannot remove POK:', error.message);
                }
            }
        });

        // Touch events for mobile
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        const tableContainer = this.ui.dom.tableContainer;
        let touchStartPos = null;
        let touchedPokId = null;
        let hasMoved = false;

        tableContainer.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.pok');
            if (target) {
                e.preventDefault();
                touchedPokId = this.findPokIdByElement(target);
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });

        tableContainer.addEventListener('touchmove', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);

                if (dx > 5 || dy > 5) {
                    hasMoved = true;
                    this.isDragging = true;
                }
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                if (hasMoved) {
                    // Drag: move POK
                    const pos = this.calculateTablePosition(e.changedTouches[0]);
                    this.commands.movePok(touchedPokId, pos.x, pos.y);
                } else {
                    // Tap: undo if last placed
                    // Check if the touched element has last-placed class
                    const target = e.target.closest('.pok');
                    if (target && target.classList.contains('last-placed')) {
                        e.stopPropagation(); // Prevent placePok from firing
                        try {
                            this.commands.removePok(touchedPokId);
                        } catch (error) {
                            console.warn('Cannot remove POK:', error.message);
                        }
                    }
                }

                touchedPokId = null;
                touchStartPos = null;
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });
    }

    setupBoundaryHighlight() {
        const tableContainer = this.ui.dom.tableContainer;

        tableContainer.addEventListener('mousemove', (e) => {
            // Don't show boundary highlight if dragging (handled in dragover)
            if (this.isDragging) return;

            // Don't show boundary highlight if clicking on existing POK
            if (e.target.classList.contains('pok')) return;

            const round = this.gameState.getCurrentRound();
            if (!round || round.isComplete) return;

            // Calculate position
            const pos = this.calculateTablePosition(e);

            // Get zone info to check if in boundary
            const zoneInfo = ScoringService.getZoneInfo(pos.x, pos.y);

            // Highlight zones that are in boundary areas
            const zones = document.querySelectorAll('.zone, .circle-zone');
            zones.forEach(zone => {
                const zoneId = zone.getAttribute('data-zone');

                // Remove existing highlights
                zone.classList.remove('boundary-highlight');

                // Add highlight to the ADJACENT lower-scoring zone (boundaryZone)
                // not the current zone (zoneId)
                if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                    zone.classList.add('boundary-highlight');
                }
            });
        });

        tableContainer.addEventListener('mouseleave', () => {
            // Remove all boundary highlights when mouse leaves table
            const zones = document.querySelectorAll('.zone, .circle-zone');
            zones.forEach(zone => {
                zone.classList.remove('boundary-highlight');
            });
        });
    }

    calculateTablePosition(event) {
        const tableElement = this.ui.tableElement;
        const rect = tableElement.getBoundingClientRect();

        const clientX = event.clientX !== undefined ? event.clientX : event.changedTouches?.[0]?.clientX;
        const clientY = event.clientY !== undefined ? event.clientY : event.changedTouches?.[0]?.clientY;

        let x = clientX - rect.left;
        const y = clientY - rect.top;

        // Account for table flip
        const state = this.gameState.getState();
        if (state.isFlipped) {
            x = rect.width - x;
        }

        return {
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100
        };
    }

    findPokIdByElement(element) {
        // Find pokId by matching position (hacky but works)
        const left = parseFloat(element.style.left);
        const top = parseFloat(element.style.top);

        const round = this.gameState.getCurrentRound();
        if (!round) return null;

        const pok = round.poks.find(p =>
            Math.abs(p.x - left) < 0.1 && Math.abs(p.y - top) < 0.1
        );

        return pok?.id;
    }

    checkRoundComplete() {
        const round = this.gameState.getCurrentRound();
        if (!round || !round.isComplete) {
            this.clearAutoEndTimer();
            return;
        }

        // Round just completed: start countdown
        if (!this.autoEndTimer) {
            this.startAutoEndCountdown();
        }
    }

    startAutoEndCountdown() {
        this.countdownEndTime = Date.now() + CONFIG.AUTO_END_DELAY_MS;

        // Update countdown display
        this.countdownInterval = setInterval(() => {
            const remaining = Math.max(0, this.countdownEndTime - Date.now()) / 1000;
            this.ui.dom.turnNotification.textContent =
                `All POKs played! Round ending in ${Math.ceil(remaining)}s...`;
            this.ui.dom.turnNotification.classList.add('show', 'round-complete');
            this.ui.dom.turnNotification.classList.remove('red-player', 'blue-player');
            this.ui.dom.currentRoundScore.classList.add('hidden');
        }, 100);

        // Auto-end after delay
        this.autoEndTimer = setTimeout(() => {
            this.commands.endRound();
            this.clearAutoEndTimer();
        }, CONFIG.AUTO_END_DELAY_MS);
    }

    clearAutoEndTimer() {
        if (this.autoEndTimer) {
            clearTimeout(this.autoEndTimer);
            this.autoEndTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdownEndTime = null;

        if (this.ui.dom.turnNotification) {
            this.ui.dom.turnNotification.classList.remove('show', 'round-complete');
        }
    }
}

// ============================================
// INITIALIZE
// ============================================

const app = new PokScorerApp();

document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // Expose debug tools globally
    window.pokDebug = {
        app,
        eventStore: app.eventStore,
        gameState: app.gameState,
        commands: app.commands,

        // Helper functions
        log: () => app.eventStore.printEventLog(),
        stats: () => app.eventStore.printStats(),
        state: () => {
            console.group('%c🎮 Current Game State', 'color: #673AB7; font-size: 14px; font-weight: bold');
            console.log('Game State:', app.gameState.getState());
            console.log('Current Round:', app.gameState.getCurrentRound());
            console.log('Round Scores:', app.gameState.getRoundScores());
            console.log('Next Player:', app.gameState.getNextPlayer());
            console.groupEnd();
        },
        toggleLogging: () => {
            app.eventStore.enableLogging = !app.eventStore.enableLogging;
            console.log(`Event logging ${app.eventStore.enableLogging ? 'enabled' : 'disabled'}`);
        },

        // Quick access to common actions
        events: () => app.eventStore.getAllEvents(),
        lastEvent: () => app.eventStore.events[app.eventStore.events.length - 1]
    };

    console.log('%c🎮 POK Score Counter - Event Sourced',
        'color: #2196F3; font-size: 16px; font-weight: bold');
    console.log('%cDebug tools available via: window.pokDebug',
        'color: #4CAF50; font-size: 12px');
    console.log('%cTry: pokDebug.log(), pokDebug.stats(), pokDebug.state()',
        'color: #666; font-size: 11px; font-style: italic');
});
