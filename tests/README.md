# POK Score Counter - Test Suite

Vanilla JavaScript testing framework with zero dependencies.

## Quick Start

1. Open `test-runner.html` in your browser:
   ```
   open tests/test-runner.html
   ```
   or
   ```
   http://localhost:8000/tests/test-runner.html
   ```

2. Click "▶️ Run All Tests" to execute the test suite

That's it! No build tools, no npm install, no setup required.

## Test Structure

```
tests/
├── lib/
│   └── mini-test.js           # Test framework (~250 lines)
├── test-runner.html            # Visual test UI
├── unit/
│   ├── scoring-service.test.js         # 40+ tests
│   ├── game-state-projection.test.js   # 60+ tests
│   └── event-store.test.js             # 30+ tests
└── integration/
    └── game-flow.test.js               # 20+ tests
```

**Total: 150+ tests**

## Test Framework API

### Defining Tests

```javascript
import { TestRunner, assert } from './lib/mini-test.js';

const runner = window.testRunner;

runner.describe('My Test Suite', () => {
    runner.it('should do something', () => {
        assert.equal(1 + 1, 2);
    });

    runner.skip('should skip this test', () => {
        // This won't run
    });
});
```

### Lifecycle Hooks

```javascript
runner.describe('With Hooks', () => {
    runner.beforeEach(() => {
        // Runs before each test
    });

    runner.afterEach(() => {
        // Runs after each test
    });

    runner.it('test 1', () => { ... });
    runner.it('test 2', () => { ... });
});
```

### Assertions

```javascript
// Equality
assert.equal(actual, expected, message);
assert.notEqual(actual, expected, message);
assert.deepEqual(obj1, obj2, message);

// Truthiness
assert.ok(value, message);
assert.notOk(value, message);

// Comparisons
assert.greaterThan(actual, expected, message);
assert.lessThan(actual, expected, message);

// Arrays
assert.lengthOf(array, length, message);
assert.includes(array, value, message);

// Errors
assert.throws(() => { throw new Error(); });
await assert.asyncThrows(async () => { ... });
```

## Test Categories

### Unit Tests

**ScoringService** - `unit/scoring-service.test.js`
- Zone detection (rectangular and circular)
- Boundary detection
- Table flip logic
- Score calculation

**GameStateProjection** - `unit/game-state-projection.test.js`
- State initialization
- Event handling (all event types)
- Calculated state (vs cached)
- Score calculations
- Immutability

**EventStore** - `unit/event-store.test.js`
- Event appending and versioning
- Pub/Sub system
- Event querying
- LocalStorage persistence

### Integration Tests

**Game Flow** - `integration/game-flow.test.js`
- Full game scenarios
- Multi-round games
- Event sourcing consistency
- Save/load functionality
- Complex operation sequences

## Running Tests

### All Tests
```javascript
// Click "Run All Tests" button
// or in console:
await runTests();
```

### Unit Tests Only
```javascript
// Click "Run Unit Tests" button
// or in console:
await runTests('unit');
```

### Integration Tests Only
```javascript
// Click "Run Integration Tests" button
// or in console:
await runTests('integration');
```

### From Console

The test runner exposes global variables:

```javascript
// Access test runner
window.testRunner

// Access assertion library
window.assert

// Run specific test manually
window.assert.equal(1 + 1, 2);
```

## Performance

The test framework is lightweight and fast:

- **Framework size:** ~250 lines of vanilla JS
- **Total test execution:** < 100ms for all 150+ tests
- **No dependencies:** Zero npm packages
- **Load time:** Instant (no build step)

## Writing New Tests

### 1. Create Test File

```javascript
// tests/unit/my-feature.test.js
import { MyFeature } from '../../js/my-feature.js';

const { describe, it, assert } = window;
const runner = window.testRunner;

runner.describe('MyFeature', () => {
    runner.it('should work correctly', () => {
        const result = MyFeature.doSomething();
        assert.equal(result, 'expected');
    });
});
```

### 2. Import in test-runner.html

```javascript
const testModules = [
    './unit/scoring-service.test.js',
    './unit/game-state-projection.test.js',
    './unit/event-store.test.js',
    './unit/my-feature.test.js',  // Add your test
    './integration/game-flow.test.js'
];
```

### 3. Run Tests

Refresh `test-runner.html` and click "Run All Tests".

## Debugging Tests

### Browser DevTools

1. Open DevTools (F12)
2. Set breakpoints in test files
3. Run tests
4. Step through test execution

### Console Logging

```javascript
runner.it('debug test', () => {
    const value = someFunction();
    console.log('Debug:', value);
    assert.equal(value, expected);
});
```

### Console Reporter

Tests automatically log to console:

```
🧪 Running tests...

📦 ScoringService - Zone Detection
  ✅ should return zone 3 for x < 20
  ✅ should return zone 2 for 20 <= x < 40
  ...

📊 Test Results:
  ✅ Passed: 150
  ❌ Failed: 0
  ⏭️  Skipped: 0
  ⏱️  Duration: 45.23ms
```

## CI/CD Integration (Optional)

While designed for browser testing, you can add Playwright for automation:

```bash
npm install -D @playwright/test
```

```javascript
// playwright.config.js
export default {
  testDir: './tests-playwright',
  use: {
    baseURL: 'http://localhost:8000',
  },
};
```

```javascript
// tests-playwright/e2e.spec.js
import { test, expect } from '@playwright/test';

test('all tests pass', async ({ page }) => {
  await page.goto('/tests/test-runner.html');

  await page.click('#runAll');

  await page.waitForSelector('.summary');

  const failed = await page.textContent('.stat.fail strong');
  expect(failed).toBe('0');
});
```

## Best Practices

### ✅ DO

- Write descriptive test names
- Test one thing per test
- Use `beforeEach` for setup
- Keep tests isolated (no shared state)
- Test edge cases
- Test error conditions

### ❌ DON'T

- Test implementation details
- Use magic numbers (use constants)
- Write dependent tests
- Mock unnecessarily (test real behavior)
- Skip tests without good reason

## Examples

### Testing Pure Functions

```javascript
runner.describe('Pure Function', () => {
    runner.it('should calculate correctly', () => {
        const result = calculate(2, 3);
        assert.equal(result, 5);
    });
});
```

### Testing with Setup

```javascript
runner.describe('With Setup', () => {
    let instance;

    runner.beforeEach(() => {
        instance = new MyClass();
    });

    runner.it('should work', () => {
        assert.ok(instance.method());
    });
});
```

### Testing Async Code

```javascript
runner.describe('Async Tests', () => {
    runner.it('should handle promises', async () => {
        const result = await asyncFunction();
        assert.equal(result, 'done');
    });
});
```

### Testing Errors

```javascript
runner.describe('Error Handling', () => {
    runner.it('should throw error', () => {
        assert.throws(() => {
            riskyFunction();
        });
    });
});
```

## Test Coverage

While this framework doesn't generate coverage reports, you can manually verify coverage:

**Current Coverage:**
- ✅ ScoringService: ~100% (all public methods)
- ✅ GameStateProjection: ~95% (all event handlers)
- ✅ EventStore: ~90% (core functionality)
- ✅ Game Flow: ~80% (main scenarios)

**Areas to Expand:**
- Command validation edge cases
- UI interaction testing (would require Playwright)
- Performance testing with large event counts

## Troubleshooting

### Tests Don't Run

- Check browser console for import errors
- Verify all test files are in correct locations
- Ensure test-runner.html is served from web server (not file://)

### Import Errors

```
Failed to load module script: Expected a JavaScript module script
```

**Solution:** Serve via HTTP server:
```bash
python3 serve.py
```

### Tests Timeout

```javascript
// Disable logging for performance
CONFIG.ENABLE_LOGGING = false;
```

### LocalStorage Tests Fail

```javascript
runner.beforeEach(() => {
    localStorage.clear(); // Clear before each test
});
```

## Resources

- [Mini-Test Framework](lib/mini-test.js) - Source code with inline docs
- [Test Strategy](../TESTING-STRATEGY.md) - Full testing strategy document
- [Calculated State Tests](../test-calculated-state.html) - Example test file

## Contributing

When adding new features to POK Score Counter:

1. Write tests first (TDD)
2. Run existing tests to ensure nothing breaks
3. Add new test file if needed
4. Update this README if adding new test patterns

---

**Happy Testing! 🧪**
