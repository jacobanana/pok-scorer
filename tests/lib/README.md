# Test Framework Library

This directory contains the shared test framework components used by both CLI and browser-based test runners.

## Files

### mini-test.js
Core test framework providing:
- `TestRunner`: Test suite and test case runner
- `assert`: Assertion library (equal, notEqual, ok, throws, etc.)
- `HTMLReporter`: Browser-based visual test reporter
- `ConsoleReporter`: Console-based test reporter

### test-loader.js
Shared test loading and result collection logic used by both runners:
- `loadTestModules()`: Loads test modules with error tracking
- `createCollector()`: Creates standard result collector
- `createTestResults()`: Creates standard results object
- `TEST_MODULES`: Central definition of all test modules

## Benefits of Consolidation

### Before
- Duplicate test module paths in CLI and browser runners
- Duplicate collector implementation (58 lines each)
- Duplicate error handling logic
- Harder to maintain consistency

### After
- Single source of truth for test modules (`TEST_MODULES`)
- Shared collector creation logic
- Shared error tracking and reporting
- 100+ lines of duplication eliminated

## Usage

### CLI Runner (run-tests.js)
```javascript
import { loadTestModules, createCollector, createTestResults, TEST_MODULES } from './lib/test-loader.js';

const testResults = createTestResults();
const collector = createCollector(testResults);
await loadTestModules(TEST_MODULES.all(), collector.recordImportError, true);
```

### Browser Runner (index.html)
```javascript
import { loadTestModules, TEST_MODULES } from './lib/test-loader.js';

const result = await loadTestModules(TEST_MODULES.unit, null, true);
```

## Adding New Tests

To add a new test file, simply update `TEST_MODULES` in `test-loader.js`:

```javascript
export const TEST_MODULES = {
    unit: [
        '../unit/new-test.test.js',  // Add here
        // ...
    ],
    // ...
};
```

Both runners will automatically pick up the new test file.
