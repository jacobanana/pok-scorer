# POK Score Counter - Test Framework

A lightweight, zero-dependency testing framework built from scratch for vanilla JavaScript. Inspired by Mocha/Jest but designed to run natively in browsers without build tooling.

## Overview

**Two execution modes:**
- **Web UI**: Interactive browser test runner at `http://localhost:3000/tests/`
- **CLI**: Headless Playwright tests via `npm test`

**Stats**: ~600 lines of code, 150+ tests run in <100ms, zero dependencies.

## Architecture

### Core Components

**TestRunner** - Test orchestration engine. Manages suites, executes tests, handles lifecycle hooks, coordinates reporters.

**Assertion Library** - Expressive assertions that throw `AssertionError` on failure. Supports equality, truthiness, comparisons, arrays, and error handling.

**Reporters** - Transform results to output:
- `HTMLReporter`: Interactive browser UI with expandable tests and copy functionality
- `ConsoleReporter`: Structured console output

**Test Loader** - Dynamic module importing with cache-busting. Handles import errors, categorizes unit vs integration tests.

**Fixtures** - Factory functions for isolated test objects. Creates fresh instances of services, manages localStorage, provides DOM containers.

**CLI Runner** - Node script that launches headless Chromium, serves files, executes tests, reports with color output.

### Philosophy

**Zero Dependencies**: No npm packages needed. Runs in any modern browser.

**Browser-Native**: ES6 modules, native Promises, standard DOM APIs.

**Minimal**: Simple, readable code. Entire framework is a few hundred lines.

**Flexible**: Same tests run in browser and CI without modification.

## Running Tests

### Web UI

```bash
python serve.py 3000
# Navigate to: http://localhost:3000/tests/
```

Features: Run all/unit/integration tests, view test source on click, copy results to clipboard.

**Also deployed to GitHub Pages** at `/tests/` path.

### CLI

```bash
npm run test:install  # First time only
npm test              # Run all tests
```

Exits with code 0 (pass) or 1 (fail) for CI integration.

### CI/CD

GitHub Actions runs tests on every push. Deployment only happens if tests pass.

## API Reference

### Test Structure

```javascript
runner.describe('Feature', () => {
    runner.it('does something', () => {
        assert.equal(result, expected);
    });

    runner.skip('not ready', () => { /* ... */ });
});
```

### Lifecycle Hooks

```javascript
runner.beforeEach(() => {
    // Setup before each test
});

runner.afterEach(() => {
    // Cleanup after each test
});
```

### Assertions

**Equality**: `equal()`, `notEqual()`, `deepEqual()`

**Truthiness**: `ok()`, `notOk()`

**Comparisons**: `greaterThan()`, `lessThan()`

**Arrays**: `lengthOf()`, `includes()`

**Errors**: `throws()`, `asyncThrows()`

All accept optional message parameter.

### Fixtures

Import from `lib/fixtures.js`:

**`createTestContext(options)`** - Returns `{ eventStore, gameState, commands, storageKey }`

**`createStartedGameContext(player, options)`** - Context with game already started

**`cleanupTestContext(context)`** - Cleanup for afterEach

**`createTestContainer(id)`** - DOM container for component tests

**`cleanupTestContainer(id)`** - Remove test DOM

**Utilities**: `disableLogging()`, `restoreLogging()`, `clearTestStorage()`

## Writing Tests

### Basic Structure

```javascript
import { assert } from '../lib/mini-test.js';

const runner = window.testRunner;

runner.describe('Feature', () => {
    runner.it('works correctly', () => {
        assert.equal(doSomething(), expected);
    });
});
```

### With Fixtures

```javascript
import { createTestContext, cleanupTestContext } from '../lib/fixtures.js';

runner.describe('Game', () => {
    let context;

    runner.beforeEach(() => {
        context = createTestContext();
    });

    runner.afterEach(() => {
        cleanupTestContext(context);
    });

    runner.it('starts game', () => {
        context.commands.startGame('Red');
        assert.ok(context.gameState.isGameInProgress());
    });
});
```

### Async Tests

```javascript
runner.it('handles async', async () => {
    const result = await fetchData();
    assert.ok(result);
});

runner.it('handles errors', async () => {
    await assert.asyncThrows(() => failingOperation());
});
```

### DOM Tests

```javascript
import { createTestContainer, cleanupTestContainer } from '../lib/fixtures.js';

runner.describe('UI', () => {
    let container;

    runner.beforeEach(() => {
        container = createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('renders', () => {
        container.innerHTML = '<div>Test</div>';
        assert.equal(container.textContent, 'Test');
    });
});
```

## Test Strategy

### Unit Tests (`unit/`)
- Test individual functions/classes in isolation
- Focus on input/output behavior
- Test edge cases and error conditions
- Mock external dependencies

### Integration Tests (`integration/`)
- Test component interactions
- End-to-end workflows
- State consistency across operations
- Event sourcing patterns

### Test Isolation
- Each test runs independently
- Use fixtures for fresh state
- Clean up localStorage, DOM, subscriptions
- No shared state between tests

### Test Quality
- **Focused**: One behavior per test
- **Readable**: Clear descriptive names
- **Fast**: Execute in milliseconds
- **Deterministic**: Same result every time
- **Maintainable**: Easy to update

## Debugging

### Browser DevTools
1. Open tests at `http://localhost:3000/tests/`
2. Open DevTools (F12) → Sources
3. Set breakpoints in test files
4. Click "Run All Tests"

### Console Access
```javascript
window.testRunner  // Test runner instance
window.assert      // Assertion library
```

### View Test Code
Click any test in the Web UI to view its source inline.

### Skip Tests
```javascript
runner.skip('not ready', () => { /* ... */ });
```

## Adding Tests

**1. Create file** in `tests/unit/` or `tests/integration/`

**2. Register** in `tests/lib/test-loader.js`:
```javascript
export const TEST_MODULES = {
    unit: ['./unit/my-test.test.js', /* ... */],
    integration: [/* ... */]
};
```

**3. Run** via browser or `npm test`

## Troubleshooting

**Tests don't run**: Check console for import errors, ensure HTTP serving (not `file://`), verify registration in test-loader.js

**Import errors**: Use `type="module"` in scripts, serve over HTTP, include `.js` extensions

**Browser/CLI differences**: Check timing (use `await`), verify cleanup in `afterEach`, avoid manual setup

**LocalStorage conflicts**: Use test-specific keys (fixtures handle this), clear in hooks

**Slow execution**: Disable logging with `CONFIG.ENABLE_LOGGING = false`, use fixtures, minimize DOM operations

## Extending

**Add assertions**: Edit `assert` object in `lib/mini-test.js`

**Custom reporters**: Implement reporter interface (onStart, onSuiteStart, onTestPass, etc.)

**New fixtures**: Add factory functions to `lib/fixtures.js`

**Test categories**: Edit `TEST_MODULES` in `lib/test-loader.js`

## Current Test Suite

- `unit/scoring-service.test.js` - Zone detection, scores (~40 tests)
- `unit/game-state-projection.test.js` - Event handling (~60 tests)
- `unit/event-store.test.js` - Persistence, pub/sub (~30 tests)
- `unit/storage-service.test.js` - LocalStorage (~5 tests)
- `unit/dom-helper.test.js` - DOM utilities (~5 tests)
- `integration/game-flow.test.js` - End-to-end scenarios (~20 tests)

**Total**: 150+ tests, ~50-80ms execution, 100% pass rate (CI enforced)

## Resources

- [mini-test.js](lib/mini-test.js) - Framework source
- [fixtures.js](lib/fixtures.js) - Test fixtures
- [test-loader.js](lib/test-loader.js) - Module loader
- [run-tests.js](run-tests.js) - CLI runner
- [index.html](index.html) - Web UI runner

---

**Happy Testing!** 🧪
