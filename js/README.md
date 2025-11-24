# POK Scorer - Modular JavaScript Architecture

This folder contains the refactored, modular JavaScript codebase for the POK Score Counter application.

## Module Structure

The application follows an **Event Sourcing** architecture pattern with clear separation of concerns:

### Core Modules

1. **[config.js](config.js)** (925 bytes)
   - Game configuration constants
   - Scoring rules and boundaries
   - Timing settings
   - Enable/disable logging

2. **[events.js](events.js)** (2.6KB)
   - Event class definitions
   - All game events (GameStarted, PokPlaced, PokMoved, etc.)
   - Pure data structures with no business logic

3. **[event-store.js](event-store.js)** (7.4KB)
   - Central event store (single source of truth)
   - Event publishing and subscription
   - LocalStorage persistence
   - Import/export functionality
   - Debug helpers

### Business Logic

4. **[scoring-service.js](scoring-service.js)** (3.0KB)
   - Pure functions for scoring calculations
   - Zone detection (rectangular and circular)
   - Boundary detection
   - No state, fully reusable

5. **[game-state-projection.js](game-state-projection.js)** (7.2KB)
   - Game state management
   - Event handlers for state updates
   - Query methods (getRoundScores, getNextPlayer, etc.)
   - Rebuilds state from events

### Presentation Layer

6. **[ui-projection.js](ui-projection.js)** (17KB)
   - UI rendering and updates
   - DOM manipulation
   - Event handlers for UI events
   - Score displays, modals, history table
   - Round preview functionality

7. **[command-handler.js](command-handler.js)** (4.2KB)
   - Command/action handlers
   - Business rule validation
   - Event generation
   - Game flow control

### Application

8. **[pok-scorer-app.js](pok-scorer-app.js)** (15KB)
   - Main application class
   - Wires everything together
   - Drag & drop handlers
   - Touch event handlers
   - Boundary highlighting
   - Auto-end timer management

9. **[app.js](app.js)** (1.9KB)
   - Entry point
   - Application initialization
   - Debug tools exposure
   - DOMContentLoaded handler

## Architecture Benefits

### Event Sourcing
- **Complete audit trail**: Every action is recorded as an event
- **Time travel**: Can replay events to any point in time
- **Undo/Redo**: Natural implementation through event replay
- **Debugging**: Full visibility into what happened and when

### Modular Design
- **Separation of concerns**: Each module has a single responsibility
- **Testability**: Pure functions and isolated components
- **Maintainability**: Easy to locate and modify specific functionality
- **Reusability**: Modules can be used independently

### Clean Dependencies
```
app.js
  └─> pok-scorer-app.js
       ├─> config.js
       ├─> event-store.js
       │    ├─> config.js
       │    └─> events.js
       ├─> game-state-projection.js
       │    ├─> config.js
       │    ├─> events.js (implicit)
       │    └─> scoring-service.js
       ├─> ui-projection.js
       │    ├─> config.js
       │    └─> events.js (implicit)
       ├─> command-handler.js
       │    └─> events.js
       └─> scoring-service.js
            └─> config.js
```

## Usage

The application is loaded as an ES6 module in [index.html](../index.html):

```html
<script type="module" src="js/app.js"></script>
```

## Debug Tools

Access debug tools via the browser console:

```javascript
// View event log
pokDebug.log()

// View statistics
pokDebug.stats()

// View current state
pokDebug.state()

// Toggle logging
pokDebug.toggleLogging()

// Access all events
pokDebug.events()

// Get last event
pokDebug.lastEvent()
```

## Development

To modify the application:

1. **Game rules**: Edit [config.js](config.js)
2. **New events**: Add to [events.js](events.js)
3. **Scoring logic**: Update [scoring-service.js](scoring-service.js)
4. **State management**: Modify [game-state-projection.js](game-state-projection.js)
5. **UI changes**: Update [ui-projection.js](ui-projection.js)
6. **User actions**: Adjust [command-handler.js](command-handler.js)
7. **Interactions**: Modify [pok-scorer-app.js](pok-scorer-app.js)

## File Sizes

Total: ~65KB of clean, modular JavaScript

- app.js: 1.9KB
- command-handler.js: 4.2KB
- config.js: 925 bytes
- events.js: 2.6KB
- event-store.js: 7.4KB
- game-state-projection.js: 7.2KB
- pok-scorer-app.js: 15KB
- scoring-service.js: 3.0KB
- ui-projection.js: 17KB
