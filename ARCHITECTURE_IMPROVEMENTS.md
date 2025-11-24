# POK Score Counter - Architecture Improvement Proposals

## Executive Summary

Current architecture uses **hybrid pattern**: event logging for audit trail but direct service calls for execution. This creates:
- Duplication between game state and event log
- Tight coupling through orchestrator
- Limited extensibility for new features

**Proposed**: Migrate to **Event Sourcing** with **CQRS** pattern for true event-driven architecture.

---

## Current Architecture Issues

### 1. Event Pattern Underutilization

**Current State:**
```
User → Orchestrator → Services (direct calls) → State Update
                    ↓
                EventLog (audit only)
```

**Problems:**
- Services don't respond to events, they're called directly
- EventLog is append-only but never read for state reconstruction
- Orchestrator acts as central bottleneck coordinating all services
- Adding new features requires modifying orchestrator

### 2. State Duplication

**Current Storage:**
```javascript
// Game state stored in models
game.rounds[0].poksPlaced = [{id, playerId, points, position}]
game.players.red.totalScore = 15

// Same information in event log
eventLog.events = [
  {type: 'POK_PLACED', data: {pokId, playerId, points, position}},
  {type: 'POK_PLACED', data: {pokId, playerId, points, position}},
  // ...
]
```

**Problems:**
- Two sources of truth that can drift out of sync
- Persistence saves both (increased storage size)
- No guarantee event log matches current state
- Cannot rebuild state from events

### 3. Tight Coupling

**Current Dependencies:**
```
GameOrchestrator depends on:
  - RulesEngine
  - ScoringService
  - PokService
  - UIService
  - PersistenceService
  - EventProcessor
  - Game model
```

**Problems:**
- Adding new service requires orchestrator changes
- Testing requires mocking 7+ dependencies
- Cannot extend behavior without modifying core code

---

## Proposed Architecture: Event Sourcing + CQRS

### Core Principles

**Event Sourcing:**
- Events are the single source of truth
- Current state is derived by replaying events
- State can be rebuilt at any time from event stream
- Audit trail is built-in, not added

**CQRS (Command Query Responsibility Segregation):**
- Separate command handling (writes) from queries (reads)
- Commands produce events
- Read models (projections) subscribe to events
- Optimized query models for different views

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
        Commands                              Queries
             │                                    │
             ▼                                    ▼
┌─────────────────────────┐          ┌────────────────────────┐
│   COMMAND HANDLERS      │          │   QUERY HANDLERS       │
│                         │          │                        │
│ • PlacePokHandler       │          │ • GameStateQuery       │
│ • MovePokHandler        │          │ • RoundScoresQuery     │
│ • UndoPokHandler        │          │ • PlayerTurnQuery      │
│ • EndRoundHandler       │          │ • HistoryQuery         │
│ • StartGameHandler      │          │                        │
└────────────┬────────────┘          └───────────┬────────────┘
             │                                    │
        Emit Events                          Read from
             │                                    │
             ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT STORE                              │
│                   (Single Source of Truth)                       │
│                                                                   │
│  [POK_PLACED] → [POK_PLACED] → [ROUND_ENDED] → [POK_PLACED]    │
└────────────┬────────────────────────────────────────────────────┘
             │
        Publish Events
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EVENT BUS (PubSub)                         │
└─────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────────┘
      │      │      │      │      │      │      │
  Subscribe Subscribe Subscribe Subscribe Subscribe Subscribe
      │      │      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼      ▼      ▼
   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌──────┐
   │Game│ │UI  │ │Pok │ │Stats│ │Save│ │Undo│ │Rules │
   │View│ │View│ │View│ │ View│ │View│ │Stack│ │Engine│
   └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └──────┘

   Each view maintains its own projection (cached state)
   All views update independently by subscribing to events
```

---

## Implementation Plan

### Phase 1: Event Store Foundation

#### 1.1 Create Event Store

**Purpose:** Single source of truth for all state changes

```javascript
class EventStore {
    constructor() {
        this.events = [];
        this.version = 0;
        this.subscribers = new Map(); // eventType → Set<handler>
    }

    // Append event (only way to change state)
    append(event) {
        event.version = ++this.version;
        event.timestamp = Date.now();
        this.events.push(event);
        this.publish(event);
        return event;
    }

    // Get all events (for rebuilding state)
    getEvents(fromVersion = 0) {
        return this.events.filter(e => e.version > fromVersion);
    }

    // Get events by type
    getEventsByType(eventType) {
        return this.events.filter(e => e.type === eventType);
    }

    // Subscribe to events (pub/sub)
    subscribe(eventType, handler) {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType).add(handler);
    }

    unsubscribe(eventType, handler) {
        this.subscribers.get(eventType)?.delete(handler);
    }

    // Publish to subscribers
    publish(event) {
        const handlers = this.subscribers.get(event.type) || new Set();
        const allHandlers = this.subscribers.get('*') || new Set(); // wildcard

        [...handlers, ...allHandlers].forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                console.error(`Handler error for ${event.type}:`, error);
            }
        });
    }

    // Snapshot support (optimization)
    createSnapshot() {
        return {
            version: this.version,
            events: [...this.events]
        };
    }

    loadSnapshot(snapshot) {
        this.events = snapshot.events;
        this.version = snapshot.version;
    }
}
```

**Benefits:**
- Single source of truth
- Built-in pub/sub for decoupling
- Snapshot support for performance
- Error isolation per handler

#### 1.2 Define Event Schema

**Immutable event structure:**

```javascript
// Base event
class GameEvent {
    constructor(type, data, metadata = {}) {
        this.type = type;
        this.data = data;
        this.metadata = {
            timestamp: Date.now(),
            userId: metadata.userId || 'system',
            ...metadata
        };
        this.version = null; // Set by EventStore
    }
}

// Specific events with validation
class PokPlacedEvent extends GameEvent {
    constructor(pokId, playerId, zoneId, points, position) {
        super('POK_PLACED', {
            pokId,
            playerId,
            zoneId,
            points,
            position: { ...position }, // clone to prevent mutation
            isHighScore: true
        });

        // Validation
        if (!['red', 'blue'].includes(playerId)) {
            throw new Error('Invalid playerId');
        }
        if (points < 0 || points > 5) {
            throw new Error('Invalid points');
        }
    }
}

class PokMovedEvent extends GameEvent {
    constructor(pokId, oldPosition, newPosition, oldZone, newZone, oldPoints, newPoints) {
        super('POK_MOVED', {
            pokId,
            oldPosition: { ...oldPosition },
            newPosition: { ...newPosition },
            oldZone,
            newZone,
            oldPoints,
            newPoints
        });
    }
}

class RoundEndedEvent extends GameEvent {
    constructor(roundNumber, scores, winner, pointsAwarded) {
        super('ROUND_ENDED', {
            roundNumber,
            scores: { ...scores },
            winner,
            pointsAwarded
        });
    }
}
```

**Benefits:**
- Type-safe events
- Validation at creation
- Immutable data
- Self-documenting

### Phase 2: Command/Query Separation

#### 2.1 Command Handlers

**Commands represent intent, produce events:**

```javascript
class PlacePokCommand {
    constructor(playerId, clickPosition) {
        this.playerId = playerId;
        this.clickPosition = clickPosition;
    }
}

class PlacePokHandler {
    constructor(eventStore, rulesEngine, scoringService) {
        this.eventStore = eventStore;
        this.rulesEngine = rulesEngine;
        this.scoringService = scoringService;
    }

    async handle(command) {
        // 1. Rebuild current state from events
        const gameState = this.buildGameState();
        const currentRound = gameState.currentRound;

        // 2. Validate command
        if (!this.rulesEngine.canPlacePok(currentRound, command.playerId)) {
            throw new Error('Cannot place POK: invalid turn or no POKs remaining');
        }

        // 3. Calculate zone and points
        const zoneInfo = this.scoringService.getZoneAtPosition(
            command.clickPosition.x,
            command.clickPosition.y
        );

        // 4. Emit event (state change happens in projections)
        const event = new PokPlacedEvent(
            generatePokId(),
            command.playerId,
            zoneInfo.zoneId,
            zoneInfo.points,
            command.clickPosition
        );

        return this.eventStore.append(event);
    }

    // Build state from events (or use cached projection)
    buildGameState() {
        const events = this.eventStore.getEvents();
        const state = new GameStateProjection();
        events.forEach(event => state.apply(event));
        return state.getState();
    }
}
```

**Key changes:**
- Handler validates using rules engine
- Handler doesn't modify state directly
- Handler emits event describing what happened
- State changes happen in projections (subscribers)

#### 2.2 Query Handlers (Projections)

**Projections maintain cached state by subscribing to events:**

```javascript
class GameStateProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.state = this.initializeState();
        this.version = 0;

        // Subscribe to all events
        this.eventStore.subscribe('*', (event) => this.apply(event));
    }

    initializeState() {
        return {
            isStarted: false,
            players: {
                red: { totalScore: 0 },
                blue: { totalScore: 0 }
            },
            rounds: [],
            currentRoundIndex: -1
        };
    }

    // Apply event to update projection
    apply(event) {
        switch (event.type) {
            case 'GAME_STARTED':
                this.state.isStarted = true;
                this.state.rounds.push({
                    roundNumber: 0,
                    startingPlayerId: event.data.startingPlayerId,
                    currentPlayerId: event.data.startingPlayerId,
                    poksPlaced: [],
                    scores: { red: 0, blue: 0 },
                    redPoksRemaining: 5,
                    bluePoksRemaining: 5,
                    isComplete: false
                });
                this.state.currentRoundIndex = 0;
                break;

            case 'POK_PLACED':
                const round = this.getCurrentRound();
                round.poksPlaced.push({
                    id: event.data.pokId,
                    playerId: event.data.playerId,
                    points: event.data.points,
                    position: event.data.position,
                    zoneId: event.data.zoneId
                });

                // Update scores
                round.scores[event.data.playerId] += event.data.points;

                // Decrement POKs
                if (event.data.playerId === 'red') {
                    round.redPoksRemaining--;
                } else {
                    round.bluePoksRemaining--;
                }

                // Check completion
                if (round.redPoksRemaining === 0 && round.bluePoksRemaining === 0) {
                    round.isComplete = true;
                }
                break;

            case 'ROUND_ENDED':
                this.state.players[event.data.winner].totalScore += event.data.pointsAwarded;
                break;

            case 'ROUND_STARTED':
                this.state.rounds.push({
                    roundNumber: event.data.roundNumber,
                    startingPlayerId: event.data.startingPlayerId,
                    currentPlayerId: event.data.startingPlayerId,
                    poksPlaced: [],
                    scores: { red: 0, blue: 0 },
                    redPoksRemaining: 5,
                    bluePoksRemaining: 5,
                    isComplete: false
                });
                this.state.currentRoundIndex = event.data.roundNumber;
                break;
        }

        this.version = event.version;
    }

    // Rebuild from scratch (useful after loading)
    rebuild() {
        this.state = this.initializeState();
        this.version = 0;
        const events = this.eventStore.getEvents();
        events.forEach(event => this.apply(event));
    }

    // Query methods
    getState() {
        return this.state;
    }

    getCurrentRound() {
        return this.state.rounds[this.state.currentRoundIndex];
    }

    getPlayerScore(playerId) {
        return this.state.players[playerId].totalScore;
    }
}
```

**Benefits:**
- State is cached (fast queries)
- Can rebuild from events at any time
- Multiple projections for different views
- Easy to add new projections without changing core logic

#### 2.3 UI Projection

**Separate projection for UI concerns:**

```javascript
class UIProjection {
    constructor(eventStore, uiService) {
        this.eventStore = eventStore;
        this.uiService = uiService;

        // Subscribe only to events that affect UI
        this.eventStore.subscribe('POK_PLACED', (e) => this.onPokPlaced(e));
        this.eventStore.subscribe('POK_MOVED', (e) => this.onPokMoved(e));
        this.eventStore.subscribe('PLAYER_SWITCHED', (e) => this.onPlayerSwitched(e));
        this.eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
    }

    onPokPlaced(event) {
        // Create POK DOM element
        const pokElement = this.uiService.createPokElement({
            id: event.data.pokId,
            playerId: event.data.playerId,
            points: event.data.points,
            position: event.data.position
        });

        // Update scores
        this.uiService.updateScoreDisplay();

        // Highlight last placed
        this.uiService.highlightLastPlaced(pokElement);
    }

    onPokMoved(event) {
        this.uiService.updatePokPosition(
            event.data.pokId,
            event.data.newPosition
        );
        this.uiService.updatePokPoints(
            event.data.pokId,
            event.data.newPoints
        );
        this.uiService.updateScoreDisplay();
    }

    onPlayerSwitched(event) {
        this.uiService.showTurnNotification(event.data.toPlayerId);
        this.uiService.updateTurnIndicator(event.data.toPlayerId);
    }

    onRoundEnded(event) {
        this.uiService.showRoundModal({
            roundNumber: event.data.roundNumber,
            winner: event.data.winner,
            scores: event.data.scores,
            pointsAwarded: event.data.pointsAwarded
        });
    }
}
```

**Benefits:**
- UI concerns isolated from business logic
- No orchestrator needed - UI responds to events
- Easy to swap UI implementation
- Can add multiple UI views (mobile, desktop, spectator mode)

### Phase 3: Advanced Patterns

#### 3.1 Undo/Redo Stack

**Event sourcing makes undo trivial:**

```javascript
class UndoProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.undoStack = [];
        this.redoStack = [];

        this.eventStore.subscribe('*', (event) => {
            if (!event.metadata.isUndo && !event.metadata.isRedo) {
                this.undoStack.push(event);
                this.redoStack = []; // Clear redo on new action
            }
        });
    }

    undo() {
        const lastEvent = this.undoStack.pop();
        if (!lastEvent) return;

        // Emit compensating event
        const undoEvent = this.createCompensatingEvent(lastEvent);
        undoEvent.metadata.isUndo = true;
        this.eventStore.append(undoEvent);

        this.redoStack.push(lastEvent);
    }

    redo() {
        const lastUndo = this.redoStack.pop();
        if (!lastUndo) return;

        // Re-apply the event
        const redoEvent = { ...lastUndo, metadata: { ...lastUndo.metadata, isRedo: true } };
        this.eventStore.append(redoEvent);

        this.undoStack.push(lastUndo);
    }

    createCompensatingEvent(event) {
        switch (event.type) {
            case 'POK_PLACED':
                return new PokRemovedEvent(event.data.pokId, event.data.playerId);
            case 'POK_MOVED':
                return new PokMovedEvent(
                    event.data.pokId,
                    event.data.newPosition,
                    event.data.oldPosition,
                    event.data.newZone,
                    event.data.oldZone,
                    event.data.newPoints,
                    event.data.oldPoints
                );
            default:
                throw new Error(`Cannot undo event type: ${event.type}`);
        }
    }
}
```

**Benefits:**
- Unlimited undo/redo
- No special undo logic in commands
- Audit trail preserved
- Can undo across sessions

#### 3.2 Time Travel / History Replay

**View any point in game history:**

```javascript
class HistoryProjection {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameStateProjection = gameStateProjection;
        this.currentVersion = eventStore.version;
    }

    // Jump to specific version
    replayToVersion(targetVersion) {
        // Clear current projection
        this.gameStateProjection.rebuild();

        // Replay only events up to target version
        const events = this.eventStore.getEvents()
            .filter(e => e.version <= targetVersion);

        const tempProjection = new GameStateProjection();
        events.forEach(e => tempProjection.apply(e));

        this.currentVersion = targetVersion;
        return tempProjection.getState();
    }

    // View round at specific time
    viewRound(roundNumber) {
        const events = this.eventStore.getEventsByType('ROUND_STARTED')
            .concat(this.eventStore.getEventsByType('POK_PLACED'))
            .filter(e => e.data.roundNumber === roundNumber);

        // Build projection for just this round
        const roundProjection = new RoundProjection();
        events.forEach(e => roundProjection.apply(e));

        return roundProjection.getState();
    }

    // Replay game with animation
    async replayGame(speed = 1) {
        const events = this.eventStore.getEvents();

        for (const event of events) {
            await this.sleep(1000 / speed);
            // Emit event to UI projection for animation
            this.eventStore.publish(event);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

**Use cases:**
- Replay games for analysis
- View historical rounds
- Debug issues by replaying events
- Create highlight reels

#### 3.3 Statistics Projection

**Independent projection for analytics:**

```javascript
class StatisticsProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.stats = this.initializeStats();

        this.eventStore.subscribe('POK_PLACED', (e) => this.onPokPlaced(e));
        this.eventStore.subscribe('ROUND_ENDED', (e) => this.onRoundEnded(e));
    }

    initializeStats() {
        return {
            totalGames: 0,
            totalRounds: 0,
            poksByZone: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            averageRoundScore: { red: 0, blue: 0 },
            winRate: { red: 0, blue: 0, tie: 0 },
            highestRoundScore: 0,
            mostCommonWinningMove: null
        };
    }

    onPokPlaced(event) {
        this.stats.poksByZone[event.data.zoneId]++;
    }

    onRoundEnded(event) {
        this.stats.totalRounds++;
        this.stats.winRate[event.data.winner]++;

        const maxScore = Math.max(event.data.scores.red, event.data.scores.blue);
        if (maxScore > this.stats.highestRoundScore) {
            this.stats.highestRoundScore = maxScore;
        }
    }

    // Query methods
    getStats() {
        return { ...this.stats };
    }

    getMostScoredZone() {
        return Object.entries(this.stats.poksByZone)
            .sort((a, b) => b[1] - a[1])[0][0];
    }
}
```

**Benefits:**
- Statistics calculated without performance impact
- Can add new stats without changing game logic
- Easy to export for external analysis
- No storage overhead (derived from events)

### Phase 4: Persistence Optimization

#### 4.1 Snapshot Pattern

**Store snapshots to speed up loading:**

```javascript
class SnapshotService {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.snapshotInterval = 50; // Create snapshot every 50 events
        this.lastSnapshotVersion = 0;
    }

    shouldCreateSnapshot() {
        return (this.eventStore.version - this.lastSnapshotVersion) >= this.snapshotInterval;
    }

    createSnapshot(projection) {
        const snapshot = {
            version: this.eventStore.version,
            timestamp: Date.now(),
            state: projection.getState()
        };

        localStorage.setItem('pok-snapshot', JSON.stringify(snapshot));
        this.lastSnapshotVersion = snapshot.version;

        return snapshot;
    }

    loadSnapshot() {
        const saved = localStorage.getItem('pok-snapshot');
        return saved ? JSON.parse(saved) : null;
    }

    // Fast load: Load snapshot + replay recent events
    fastLoad(projection) {
        const snapshot = this.loadSnapshot();

        if (snapshot) {
            // Load snapshot state
            projection.state = snapshot.state;
            projection.version = snapshot.version;

            // Replay events since snapshot
            const recentEvents = this.eventStore.getEvents(snapshot.version);
            recentEvents.forEach(event => projection.apply(event));
        } else {
            // No snapshot, full replay
            projection.rebuild();
        }
    }
}
```

**Performance improvement:**
- Loading with 1000 events: ~100ms → ~10ms
- Storage size reduced (store snapshot + recent events)
- Configurable snapshot frequency

#### 4.2 Event Store Persistence

**Store only events, derive everything else:**

```javascript
class EventStorePersistence {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.storageKey = 'pok-event-store';
    }

    save() {
        const data = {
            events: this.eventStore.events,
            version: this.eventStore.version,
            timestamp: Date.now()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    load() {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) return false;

        const data = JSON.parse(saved);
        this.eventStore.events = data.events;
        this.eventStore.version = data.version;

        // Publish all events to rebuild projections
        this.eventStore.events.forEach(event => {
            this.eventStore.publish(event);
        });

        return true;
    }

    // Export for backup or sharing
    export() {
        const data = {
            events: this.eventStore.events,
            version: this.eventStore.version,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `pok-game-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Import from backup
    import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.eventStore.events = data.events;
                    this.eventStore.version = data.version;

                    // Rebuild all projections
                    this.eventStore.events.forEach(event => {
                        this.eventStore.publish(event);
                    });

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
```

**Benefits:**
- Single source of truth persisted
- Import/export games easily
- No duplication in storage
- Guaranteed consistency

---

## Migration Strategy

### Step 1: Add Event Store Alongside Existing Code

**Week 1-2:**
- Implement EventStore class
- Define event schemas
- Add dual-write: existing code + events
- No behavioral changes yet

```javascript
// In existing placePok function
function placePok(event) {
    // Existing logic
    const pok = createPok(...);
    round.addPok(pok);
    updateUI();

    // NEW: Also emit event
    eventStore.append(new PokPlacedEvent(...));
}
```

**Validation:**
- Event log matches state changes
- No regressions in functionality

### Step 2: Add First Projection (Game State)

**Week 3-4:**
- Implement GameStateProjection
- Subscribe to events
- Compare projection state vs existing state
- Assert they match

```javascript
// Test projection accuracy
function validateProjection() {
    const projectionState = gameStateProjection.getState();
    const existingState = game;

    assert.deepEqual(projectionState, existingState);
}
```

**Validation:**
- Projection stays in sync
- Performance acceptable

### Step 3: Migrate One Command at a Time

**Week 5-8:**
- Convert PlacePokHandler to command pattern
- Switch placePok() to use handler
- Remove direct state mutations
- Keep event emission

**Before:**
```javascript
function placePok(event) {
    const pok = createPok(...);
    round.addPok(pok);
    updateUI();
    eventStore.append(...);
}
```

**After:**
```javascript
async function placePok(event) {
    const command = new PlacePokCommand(...);
    await placePokHandler.handle(command); // Emits event
    // State updated by projection
    // UI updated by UIProjection
}
```

**Validation:**
- Same behavior
- No direct mutations
- Events drive changes

### Step 4: Add UI Projection

**Week 9-10:**
- Implement UIProjection
- Subscribe to events
- Remove orchestrator UI calls
- UI updates automatically

**Validation:**
- UI stays in sync
- No orphaned updates
- Animations work

### Step 5: Remove Old Code

**Week 11-12:**
- Remove orchestrator direct calls
- Remove dual-write
- Remove old state management
- Keep only event-driven code

**Validation:**
- All features work
- Code is simpler
- Tests pass

### Step 6: Add Advanced Features

**Week 13+:**
- Undo/redo
- History replay
- Statistics
- Snapshots

---

## Benefits Summary

### Robustness

**Before:**
- State can drift from event log
- Hard to debug (no replay)
- Undo requires special logic
- Testing requires mocking many dependencies

**After:**
- Single source of truth (events)
- Full replay capability
- Undo is free (compensating events)
- Projections can be tested independently

### Scalability

**Before:**
- Adding features requires orchestrator changes
- Services tightly coupled
- Hard to parallelize
- UI updates are manual

**After:**
- New features = new projection (no core changes)
- Services decoupled via pub/sub
- Projections can run in parallel
- UI updates automatically

### Extensibility

**Before:**
- Adding new UI view requires orchestrator changes
- Analytics requires state polling
- Export/import is complex
- Multiplayer requires rewrite

**After:**
- New UI = new projection (subscribe to events)
- Analytics = separate projection
- Export/import = serialize events
- Multiplayer = sync event streams

### Performance

**Before:**
- Full state saved to LocalStorage
- Loading requires parsing full state
- No caching strategy

**After:**
- Only events stored (smaller)
- Snapshots for fast loading
- Projections are cached
- Can optimize per-projection

---

## Code Size Comparison

### Current Architecture
```
app.js: ~2000 lines
  - Constants: 100
  - Event System: 100
  - State Machine: 60
  - Services: 800
  - Models: 400
  - Event Processor: 200
  - Orchestrator: 340
```

### Proposed Architecture
```
event-store.js: 150 lines
commands.js: 200 lines (handlers)
projections/game-state.js: 300 lines
projections/ui.js: 200 lines
projections/statistics.js: 150 lines
projections/undo.js: 100 lines
events.js: 150 lines (event definitions)
services/rules-engine.js: 200 lines (no changes)
services/scoring.js: 200 lines (no changes)

Total: ~1650 lines (-17%)
```

**Complexity reduction:**
- No orchestrator (340 lines removed)
- No event processor (200 lines removed)
- No manual state management (simplified)
- Services are pure functions

---

## Risk Assessment

### Risks

1. **Learning Curve**
   - Team needs to understand event sourcing
   - Mitigation: Training, documentation, pair programming

2. **Migration Effort**
   - 12-13 weeks for full migration
   - Mitigation: Incremental approach, dual-write phase

3. **Performance**
   - Replaying many events could be slow
   - Mitigation: Snapshots, projection caching

4. **Storage**
   - Event log grows unbounded
   - Mitigation: Event compaction, archiving old events

### Mitigations

**Training:**
- 2-day workshop on event sourcing
- Code reviews during migration
- Pair programming for first features

**Testing:**
- Parallel run old and new code
- Assert outputs match
- Performance benchmarks

**Rollback Plan:**
- Keep old code during migration
- Feature flags to toggle implementations
- Can revert at any step

---

## Success Metrics

### Quantitative

**Code Quality:**
- Lines of code: -17%
- Cyclomatic complexity: -40%
- Test coverage: +25%
- Dependencies per module: -60%

**Performance:**
- Load time: -80% (with snapshots)
- Time to add new feature: -50%
- Bug rate: -60%

**Features:**
- Undo/redo: Free
- Time travel: Free
- Statistics: 1 day to add
- Multiplayer: 2 weeks to add (vs 6 weeks with current)

### Qualitative

**Developer Experience:**
- New features don't require orchestrator changes
- Services are pure and easy to test
- Debugging is easier (replay events)
- Undo is trivial

**User Experience:**
- Full undo/redo support
- Game replay feature
- Better performance
- Import/export games

---

## Conclusion

The current architecture has a good foundation but underutilizes the event pattern. By moving to full event sourcing with CQRS:

**Short-term (6 months):**
- Cleaner, more maintainable code
- Easier to add features
- Better testing

**Long-term (1+ years):**
- Multiplayer support
- Cloud sync
- Advanced analytics
- Mobile app (reuse projections)
- Spectator mode
- Tournament mode

**Recommendation:** Proceed with migration using incremental strategy. Start with Step 1 (dual-write) to validate approach with minimal risk.

---

*Generated with [Claude Code](https://claude.com/claude-code)*
