#!/usr/bin/env node
// ============================================
// TERMINAL TEST RUNNER
// ============================================
// Runs browser-based tests headlessly using Playwright

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Simple static file server
function createStaticServer(rootDir, port) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    const server = createServer((req, res) => {
        let filePath = join(rootDir, req.url === '/' ? 'index.html' : req.url);

        // Remove query string for file lookup
        filePath = filePath.split('?')[0];

        const ext = filePath.substring(filePath.lastIndexOf('.'));
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        try {
            if (existsSync(filePath)) {
                const content = readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        } catch (error) {
            res.writeHead(500);
            res.end('Server error');
        }
    });

    return new Promise((resolve) => {
        server.listen(port, () => resolve(server));
    });
}

// Format duration in ms
function formatDuration(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// Main test runner
async function runTests() {
    const startTime = performance.now();
    console.log('');
    console.log('========================================');
    console.log('  POK Score Counter - Test Suite');
    console.log('========================================');
    console.log('');

    // Start local server
    const PORT = 3847;
    const server = await createStaticServer(ROOT_DIR, PORT);
    console.log(`Starting test server on port ${PORT}...`);
    console.log('');

    let browser;
    let exitCode = 0;

    try {
        // Launch headless browser
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Collect console messages
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
        });

        // Navigate to test page
        await page.goto(`http://localhost:${PORT}/tests/index.html`);

        // Inject test runner that returns results
        const results = await page.evaluate(async () => {
            // Import test framework
            const { TestRunner, assert } = await import('./lib/mini-test.js');

            // Create fresh runner
            const runner = new TestRunner();
            window.testRunner = runner;
            window.assert = assert;

            // Test modules
            const testModules = [
                './unit/scoring-service.test.js',
                './unit/game-state-projection.test.js',
                './unit/event-store.test.js',
                './integration/game-flow.test.js'
            ];

            // Load all test modules with cache busting
            for (const module of testModules) {
                try {
                    const timestamp = Date.now();
                    await import(`${module}?t=${timestamp}`);
                } catch (error) {
                    console.error(`Failed to load ${module}:`, error.message);
                }
            }

            // Custom reporter that collects results
            const testResults = {
                suites: [],
                passed: 0,
                failed: 0,
                skipped: 0
            };

            let currentSuite = null;

            const collector = {
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
                onComplete() {}
            };

            // Run tests
            await runner.run(collector);

            return testResults;
        });

        // Print results
        const totalTests = results.passed + results.failed + results.skipped;

        for (const suite of results.suites) {
            console.log(suite.name);

            for (const test of suite.tests) {
                if (test.status === 'pass') {
                    console.log(`  [PASS] ${test.name}`);
                } else if (test.status === 'fail') {
                    console.log(`  [FAIL] ${test.name}`);
                    console.log(`         ${test.error}`);
                } else if (test.status === 'skip') {
                    console.log(`  [SKIP] ${test.name}`);
                }
            }
            console.log('');
        }

        // Print summary
        const duration = performance.now() - startTime;
        console.log('----------------------------------------');

        if (results.failed === 0) {
            console.log('All tests passed!');
        } else {
            console.log('Some tests failed');
            exitCode = 1;
        }

        console.log('');
        console.log(`  Passed:  ${results.passed}`);
        console.log(`  Failed:  ${results.failed}`);
        console.log(`  Skipped: ${results.skipped}`);
        console.log(`  Total:   ${totalTests}`);
        console.log(`  Time:    ${formatDuration(duration)}`);
        console.log('');

    } catch (error) {
        console.error('Error running tests:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        exitCode = 1;
    } finally {
        // Cleanup
        if (browser) {
            await browser.close();
        }
        server.close();
    }

    process.exit(exitCode);
}

// Run tests
runTests().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
