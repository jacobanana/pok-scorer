// ============================================
// MINI TEST FRAMEWORK (Dependency-Free)
// ============================================
// Inspired by Mocha/Jest but zero dependencies

export class TestRunner {
    constructor() {
        this.suites = [];
        this.currentSuite = null;
        this.beforeEachHooks = [];
        this.afterEachHooks = [];
        this.results = { passed: 0, failed: 0, skipped: 0 };
    }

    describe(suiteName, fn) {
        const suite = { name: suiteName, tests: [], beforeEach: [], afterEach: [] };
        this.currentSuite = suite;

        // Execute suite definition
        fn();

        this.suites.push(suite);
        this.currentSuite = null;
    }

    it(testName, fn) {
        if (!this.currentSuite) {
            throw new Error('it() must be inside describe()');
        }
        this.currentSuite.tests.push({ name: testName, fn, skip: false });
    }

    skip(testName, fn) {
        if (!this.currentSuite) {
            throw new Error('skip() must be inside describe()');
        }
        this.currentSuite.tests.push({ name: testName, fn, skip: true });
    }

    beforeEach(fn) {
        if (!this.currentSuite) {
            throw new Error('beforeEach() must be inside describe()');
        }
        this.currentSuite.beforeEach.push(fn);
    }

    afterEach(fn) {
        if (!this.currentSuite) {
            throw new Error('afterEach() must be inside describe()');
        }
        this.currentSuite.afterEach.push(fn);
    }

    async run(reporter) {
        this.results = { passed: 0, failed: 0, skipped: 0 };
        reporter.onStart(this.suites);

        for (const suite of this.suites) {
            reporter.onSuiteStart(suite.name);

            for (const test of suite.tests) {
                if (test.skip) {
                    reporter.onTestSkip(test.name, test.fn);
                    this.results.skipped++;
                    continue;
                }

                reporter.onTestStart(test.name);

                try {
                    // Run beforeEach hooks
                    for (const hook of suite.beforeEach) {
                        await hook();
                    }

                    // Run test
                    await test.fn();

                    // Run afterEach hooks
                    for (const hook of suite.afterEach) {
                        await hook();
                    }

                    reporter.onTestPass(test.name, test.fn);
                    this.results.passed++;
                } catch (error) {
                    reporter.onTestFail(test.name, error, test.fn);
                    this.results.failed++;
                }
            }

            reporter.onSuiteEnd(suite.name);
        }

        reporter.onComplete(this.results);
        return this.results;
    }

    reset() {
        this.suites = [];
        this.currentSuite = null;
        this.results = { passed: 0, failed: 0, skipped: 0 };
    }
}

// ============================================
// ASSERTION LIBRARY
// ============================================

export const assert = {
    equal(actual, expected, message) {
        if (actual !== expected) {
            throw new AssertionError(
                message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
        }
    },

    notEqual(actual, expected, message) {
        if (actual === expected) {
            throw new AssertionError(
                message || `Expected values to not be equal`
            );
        }
    },

    deepEqual(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new AssertionError(
                message || `Objects not equal:\nExpected: ${expectedStr}\nActual: ${actualStr}`
            );
        }
    },

    ok(value, message) {
        if (!value) {
            throw new AssertionError(message || `Expected truthy value, got ${value}`);
        }
    },

    notOk(value, message) {
        if (value) {
            throw new AssertionError(message || `Expected falsy value, got ${value}`);
        }
    },

    throws(fn, expectedError, message) {
        try {
            fn();
            throw new AssertionError(message || 'Expected function to throw');
        } catch (e) {
            if (e instanceof AssertionError && !message) throw e;
            if (expectedError && !e.message.includes(expectedError)) {
                throw new AssertionError(`Expected error containing "${expectedError}", got "${e.message}"`);
            }
            // Function threw as expected
        }
    },

    async asyncThrows(fn, expectedError, message) {
        try {
            await fn();
            throw new AssertionError(message || 'Expected async function to throw');
        } catch (e) {
            if (e instanceof AssertionError && !message) throw e;
            if (expectedError && !e.message.includes(expectedError)) {
                throw new AssertionError(`Expected error containing "${expectedError}", got "${e.message}"`);
            }
            // Function threw as expected
        }
    },

    greaterThan(actual, expected, message) {
        if (actual <= expected) {
            throw new AssertionError(
                message || `Expected ${actual} to be greater than ${expected}`
            );
        }
    },

    lessThan(actual, expected, message) {
        if (actual >= expected) {
            throw new AssertionError(
                message || `Expected ${actual} to be less than ${expected}`
            );
        }
    },

    includes(array, value, message) {
        if (!array.includes(value)) {
            throw new AssertionError(
                message || `Expected array to include ${JSON.stringify(value)}`
            );
        }
    },

    lengthOf(array, length, message) {
        if (array.length !== length) {
            throw new AssertionError(
                message || `Expected array length ${length}, got ${array.length}`
            );
        }
    }
};

class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
    }
}

// ============================================
// HTML REPORTER
// ============================================

export class HTMLReporter {
    constructor(container) {
        this.container = container;
        this.startTime = 0;
        this.currentSuite = null;
    }

    onStart(suites) {
        this.startTime = performance.now();
        this.container.innerHTML = '<div class="running">⏳ Running tests...</div>';
    }

    onSuiteStart(name) {
        const suite = document.createElement('div');
        suite.className = 'suite';
        suite.innerHTML = `
            <h3>
                <span>${this.escapeHtml(name)}</span>
                <button class="copy-button" data-suite="${this.escapeHtml(name)}">📋 Copy</button>
            </h3>
            <div class="tests"></div>
        `;
        suite.dataset.suiteName = name;
        this.container.appendChild(suite);
        this.currentSuite = suite;

        // Add copy button handler
        const copyButton = suite.querySelector('.copy-button');
        copyButton.addEventListener('click', () => this.copySuite(suite, copyButton));
    }

    copySuite(suiteElement, button) {
        const suiteName = suiteElement.dataset.suiteName;
        const tests = suiteElement.querySelectorAll('.test');

        let output = `${suiteName}\n${'='.repeat(suiteName.length)}\n\n`;

        tests.forEach((test, index) => {
            const text = test.textContent.trim();
            const icon = test.classList.contains('pass') ? '✅' :
                        test.classList.contains('fail') ? '❌' : '⏭️';

            // Extract just the test name (without the icon at the start)
            const testName = text.replace(/^[✅❌⏭️]\s*/, '').split('\n')[0];
            output += `${icon} ${testName}\n`;

            // If it's a failure, include the error
            if (test.classList.contains('fail')) {
                const error = test.querySelector('.error');
                if (error) {
                    output += `   Error: ${error.textContent.trim().split('\n')[0]}\n`;
                }
            }
        });

        output += `\nTotal: ${tests.length} tests`;

        // Copy to clipboard
        navigator.clipboard.writeText(output).then(() => {
            button.classList.add('copied');
            button.textContent = '✓ Copied';
            setTimeout(() => {
                button.classList.remove('copied');
                button.textContent = '📋 Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            button.textContent = '❌ Failed';
            setTimeout(() => {
                button.textContent = '📋 Copy';
            }, 2000);
        });
    }

    showTestCode(testElement, name, fn) {
        // Check if code is already shown
        const existingCode = testElement.querySelector('.test-code');
        if (existingCode) {
            // Toggle visibility
            existingCode.remove();
            return;
        }

        // Create code block
        const codeBlock = document.createElement('pre');
        codeBlock.className = 'test-code';
        codeBlock.textContent = fn.toString();
        testElement.appendChild(codeBlock);
    }

    copyAllResults(button) {
        const suites = this.container.querySelectorAll('.suite');
        let output = '🧪 POK Score Counter - Test Results\n';
        output += '='.repeat(50) + '\n\n';

        // Add summary
        const summary = this.container.querySelector('.summary');
        if (summary) {
            const stats = summary.querySelectorAll('.stat');
            stats.forEach(stat => {
                output += stat.textContent.trim() + '\n';
            });
            output += '\n' + '='.repeat(50) + '\n\n';
        }

        // Add all suites
        suites.forEach((suite, index) => {
            const suiteName = suite.dataset.suiteName;
            const tests = suite.querySelectorAll('.test');

            output += `${suiteName}\n`;
            output += '-'.repeat(suiteName.length) + '\n';

            tests.forEach(test => {
                const text = test.textContent.trim();
                const icon = test.classList.contains('pass') ? '✅' :
                            test.classList.contains('fail') ? '❌' : '⏭️';
                const testName = text.replace(/^[✅❌⏭️]\s*/, '').split('\n')[0];
                output += `${icon} ${testName}\n`;

                if (test.classList.contains('fail')) {
                    const error = test.querySelector('.error');
                    if (error) {
                        output += `   Error: ${error.textContent.trim().split('\n')[0]}\n`;
                    }
                }
            });

            output += `\nTotal: ${tests.length} tests\n\n`;
        });

        // Copy to clipboard
        navigator.clipboard.writeText(output).then(() => {
            button.classList.add('copied');
            button.textContent = '✓ Copied All';
            setTimeout(() => {
                button.classList.remove('copied');
                button.textContent = '📋 Copy All Results';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            button.textContent = '❌ Failed';
            setTimeout(() => {
                button.textContent = '📋 Copy All Results';
            }, 2000);
        });
    }

    onTestStart(name) {
        // Optional: could show spinner
    }

    onTestPass(name, fn) {
        const testsContainer = this.currentSuite.querySelector('.tests');
        const test = document.createElement('div');
        test.className = 'test pass';
        test.innerHTML = `
            <span class="test-name">✅ ${this.escapeHtml(name)}</span>
        `;
        test.style.cursor = 'pointer';
        test.addEventListener('click', (e) => {
            // Don't toggle if clicking on the code block itself
            if (e.target.classList.contains('test-code')) return;
            this.showTestCode(test, name, fn);
        });
        testsContainer.appendChild(test);
    }

    onTestFail(name, error, fn) {
        const testsContainer = this.currentSuite.querySelector('.tests');
        const test = document.createElement('div');
        test.className = 'test fail';
        test.innerHTML = `
            <span class="test-name">❌ ${this.escapeHtml(name)}</span>
            <pre class="error">${this.escapeHtml(error.stack || error.message)}</pre>
        `;
        test.style.cursor = 'pointer';
        test.querySelector('.test-name').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTestCode(test, name, fn);
        });
        testsContainer.appendChild(test);
    }

    onTestSkip(name, fn) {
        const testsContainer = this.currentSuite.querySelector('.tests');
        const test = document.createElement('div');
        test.className = 'test skip';
        test.innerHTML = `
            <span class="test-name">⏭️  ${this.escapeHtml(name)}</span>
        `;
        test.style.cursor = 'pointer';
        test.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-code')) return;
            this.showTestCode(test, name, fn);
        });
        testsContainer.appendChild(test);
    }

    onSuiteEnd(name) {
        // Optional: add suite summary
    }

    onComplete(results) {
        const duration = (performance.now() - this.startTime).toFixed(2);
        const running = this.container.querySelector('.running');
        if (running) running.remove();

        const summary = document.createElement('div');
        summary.className = results.failed > 0 ? 'summary fail' : 'summary pass';

        const total = results.passed + results.failed + results.skipped;
        const emoji = results.failed > 0 ? '❌' : '✅';

        summary.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>${emoji} Test Results</h2>
                <button class="copy-button copy-all-button">📋 Copy All Results</button>
            </div>
            <div class="stats">
                <div class="stat pass">✅ Passed: <strong>${results.passed}</strong></div>
                <div class="stat fail">❌ Failed: <strong>${results.failed}</strong></div>
                <div class="stat skip">⏭️  Skipped: <strong>${results.skipped}</strong></div>
                <div class="stat total">📊 Total: <strong>${total}</strong></div>
                <div class="stat time">⏱️  Duration: <strong>${duration}ms</strong></div>
            </div>
        `;
        this.container.insertBefore(summary, this.container.firstChild);

        // Add copy all button handler
        const copyAllButton = summary.querySelector('.copy-all-button');
        copyAllButton.addEventListener('click', () => this.copyAllResults(copyAllButton));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// CONSOLE REPORTER
// ============================================

export class ConsoleReporter {
    constructor() {
        this.startTime = 0;
    }

    onStart(suites) {
        this.startTime = performance.now();
        console.log('\n🧪 Running tests...\n');
    }

    onSuiteStart(name) {
        console.group(`📦 ${name}`);
    }

    onTestStart(name) {
        // Optional
    }

    onTestPass(name) {
        console.log(`  ✅ ${name}`);
    }

    onTestFail(name, error) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${error.message}`);
    }

    onTestSkip(name) {
        console.log(`  ⏭️  ${name}`);
    }

    onSuiteEnd(name) {
        console.groupEnd();
    }

    onComplete(results) {
        const duration = (performance.now() - this.startTime).toFixed(2);
        console.log('\n📊 Test Results:');
        console.log(`  ✅ Passed: ${results.passed}`);
        console.log(`  ❌ Failed: ${results.failed}`);
        console.log(`  ⏭️  Skipped: ${results.skipped}`);
        console.log(`  ⏱️  Duration: ${duration}ms\n`);
    }
}
