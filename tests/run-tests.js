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

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

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
    console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}  POK Score Counter - Test Suite${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // Start local server
    const PORT = 3847;
    const server = await createStaticServer(ROOT_DIR, PORT);
    console.log(`${colors.gray}Starting test server on port ${PORT}...${colors.reset}\n`);

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
                './unit/component.test.js',
                './integration/game-flow.test.js',
                './integration/ui-components.test.js'
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
            console.log(`${colors.bright}${colors.blue}${suite.name}${colors.reset}`);

            for (const test of suite.tests) {
                if (test.status === 'pass') {
                    console.log(`  ${colors.green}✓${colors.reset} ${test.name}`);
                } else if (test.status === 'fail') {
                    console.log(`  ${colors.red}✗ ${test.name}${colors.reset}`);
                    console.log(`    ${colors.red}${test.error}${colors.reset}`);
                } else if (test.status === 'skip') {
                    console.log(`  ${colors.yellow}○ ${test.name} (skipped)${colors.reset}`);
                }
            }
            console.log();
        }

        // Print summary
        const duration = performance.now() - startTime;
        console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

        if (results.failed === 0) {
            console.log(`${colors.green}${colors.bright}✓ All tests passed!${colors.reset}`);
        } else {
            console.log(`${colors.red}${colors.bright}✗ Some tests failed${colors.reset}`);
            exitCode = 1;
        }

        console.log();
        console.log(`  ${colors.green}Passed:${colors.reset}  ${results.passed}`);
        console.log(`  ${colors.red}Failed:${colors.reset}  ${results.failed}`);
        console.log(`  ${colors.yellow}Skipped:${colors.reset} ${results.skipped}`);
        console.log(`  Total:   ${totalTests}`);
        console.log(`  Time:    ${formatDuration(duration)}`);
        console.log();

    } catch (error) {
        console.error(`${colors.red}${colors.bright}Error running tests:${colors.reset}`);
        console.error(`${colors.red}${error.message}${colors.reset}`);
        if (error.stack) {
            console.error(`${colors.gray}${error.stack}${colors.reset}`);
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
