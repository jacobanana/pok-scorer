// ============================================
// SHARED TEST LOADER
// ============================================
// Common test loading and error tracking logic used by both CLI and browser runners

/**
 * Loads test modules and tracks import errors
 * @param {string[]} testModules - Array of test module paths
 * @param {Function} recordError - Callback to record import errors
 * @param {boolean} cacheBusting - Whether to add timestamp for cache busting
 * @returns {Promise<{importErrors: Array}>}
 */
export async function loadTestModules(testModules, recordError, cacheBusting = true) {
    const importErrors = [];

    for (const module of testModules) {
        try {
            const timestamp = cacheBusting ? Date.now() : '';
            const moduleUrl = cacheBusting ? `${module}?t=${timestamp}` : module;
            await import(moduleUrl);
        } catch (error) {
            const errorInfo = {
                module,
                error: error.message || String(error)
            };
            importErrors.push(errorInfo);

            // Log to console
            console.error(`Failed to load ${module}:`, error.message, error);

            // Call the provided error recorder
            if (recordError) {
                recordError(module, error);
            }
        }
    }

    return { importErrors };
}

/**
 * Creates a standard test result collector
 * @param {Object} testResults - The results object to populate
 * @returns {Object} Collector object with standard reporter interface
 */
export function createCollector(testResults) {
    let currentSuite = null;

    return {
        onStart() {},

        onSuiteStart(name) {
            currentSuite = { name, tests: [] };
        },

        onTestStart() {},

        onTestPass(name) {
            currentSuite.tests.push({ name, status: 'pass' });
            testResults.passed++;
        },

        onTestFail(name, error) {
            currentSuite.tests.push({
                name,
                status: 'fail',
                error: error.message || String(error)
            });
            testResults.failed++;
        },

        onTestSkip(name) {
            currentSuite.tests.push({ name, status: 'skip' });
            testResults.skipped++;
        },

        onSuiteEnd() {
            testResults.suites.push(currentSuite);
            currentSuite = null;
        },

        onComplete() {},

        recordImportError(module, error) {
            testResults.importErrors.push({
                module,
                error: error.message || String(error)
            });
            testResults.failed++;
        }
    };
}

/**
 * Creates a standard test results object
 * @returns {Object} Test results object
 */
export function createTestResults() {
    return {
        suites: [],
        passed: 0,
        failed: 0,
        skipped: 0,
        importErrors: []
    };
}

/**
 * Standard test module paths (relative to tests/ directory)
 */
export const TEST_MODULES = {
    unit: [
        '../unit/scoring-service.test.js',
        '../unit/game-service.test.js',
        '../unit/event-store.test.js',
        '../unit/component.test.js',
        '../unit/ui-projection.test.js',
        '../unit/storage-service.test.js',
        '../unit/dom-helper.test.js'
    ],
    integration: [
        '../integration/game-flow.test.js',
        '../integration/ui-components.test.js'
    ],
    all() {
        return [...this.unit, ...this.integration];
    }
};
