// ============================================
// DOM HELPER TESTS
// ============================================

import { DOMHelper } from '../../js/utils/dom-helper.js';
import { createTestContainer, cleanupTestContainer } from '../lib/fixtures.js';

const { assert } = window;
const runner = window.testRunner;

// Test container for DOM tests
let testContainer;

runner.describe('DOMHelper - Element Selection', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = `
                <div id="test-element" class="test-class">Test Content</div>
                <div id="another-element">Another</div>
                <div class="shared-class">Shared 1</div>
                <div class="shared-class">Shared 2</div>
            `;
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should get element by ID', () => {
            const el = DOMHelper.getElementById('test-element');
            assert.notEqual(el, null);
            assert.equal(el.textContent, 'Test Content');
        });

        runner.it('should return null for non-existent ID', () => {
            const el = DOMHelper.getElementById('non-existent');
            assert.equal(el, null);
        });

        runner.it('should query selector', () => {
            const el = DOMHelper.querySelector('.test-class');
            assert.notEqual(el, null);
            assert.equal(el.id, 'test-element');
        });

        runner.it('should query selector all', () => {
            const elements = DOMHelper.querySelectorAll('.shared-class');
            assert.equal(elements.length, 2);
        });
    });

    runner.describe('DOMHelper - Class Manipulation', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element" class="initial-class"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should add class', () => {
            const el = DOMHelper.addClass('test-element', 'new-class');
            assert.notEqual(el, null);
            assert.equal(el.classList.contains('new-class'), true);
            assert.equal(el.classList.contains('initial-class'), true);
        });

        runner.it('should add multiple classes', () => {
            const el = DOMHelper.addClass('test-element', 'class1', 'class2', 'class3');
            assert.equal(el.classList.contains('class1'), true);
            assert.equal(el.classList.contains('class2'), true);
            assert.equal(el.classList.contains('class3'), true);
        });

        runner.it('should remove class', () => {
            const el = DOMHelper.removeClass('test-element', 'initial-class');
            assert.notEqual(el, null);
            assert.equal(el.classList.contains('initial-class'), false);
        });

        runner.it('should remove multiple classes', () => {
            DOMHelper.addClass('test-element', 'class1', 'class2', 'class3');
            const el = DOMHelper.removeClass('test-element', 'class1', 'class3');
            assert.equal(el.classList.contains('class1'), false);
            assert.equal(el.classList.contains('class2'), true);
            assert.equal(el.classList.contains('class3'), false);
        });

        runner.it('should toggle class', () => {
            let el = DOMHelper.toggleClass('test-element', 'toggle-class');
            assert.equal(el.classList.contains('toggle-class'), true);

            el = DOMHelper.toggleClass('test-element', 'toggle-class');
            assert.equal(el.classList.contains('toggle-class'), false);
        });

        runner.it('should force toggle class', () => {
            let el = DOMHelper.toggleClass('test-element', 'forced-class', true);
            assert.equal(el.classList.contains('forced-class'), true);

            el = DOMHelper.toggleClass('test-element', 'forced-class', true);
            assert.equal(el.classList.contains('forced-class'), true);

            el = DOMHelper.toggleClass('test-element', 'forced-class', false);
            assert.equal(el.classList.contains('forced-class'), false);
        });

        runner.it('should check if element has class', () => {
            assert.equal(DOMHelper.hasClass('test-element', 'initial-class'), true);
            assert.equal(DOMHelper.hasClass('test-element', 'non-existent'), false);
        });

        runner.it('should return null for non-existent element', () => {
            const el = DOMHelper.addClass('non-existent', 'some-class');
            assert.equal(el, null);
        });
    });

    runner.describe('DOMHelper - Content Manipulation', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element">Initial</div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should set text content', () => {
            const el = DOMHelper.setText('test-element', 'New Text');
            assert.notEqual(el, null);
            assert.equal(el.textContent, 'New Text');
        });

        runner.it('should set HTML content', () => {
            const el = DOMHelper.setHTML('test-element', '<span>HTML Content</span>');
            assert.notEqual(el, null);
            assert.equal(el.innerHTML, '<span>HTML Content</span>');
            assert.equal(el.querySelector('span').textContent, 'HTML Content');
        });

        runner.it('should handle empty text', () => {
            const el = DOMHelper.setText('test-element', '');
            assert.equal(el.textContent, '');
        });
    });

    runner.describe('DOMHelper - Visibility Helpers', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should show element by adding show class', () => {
            const el = DOMHelper.show('test-element');
            assert.notEqual(el, null);
            assert.equal(el.classList.contains('show'), true);
        });

        runner.it('should hide element by removing show class', () => {
            DOMHelper.addClass('test-element', 'show');
            const el = DOMHelper.hide('test-element');
            assert.notEqual(el, null);
            assert.equal(el.classList.contains('show'), false);
        });

        runner.it('should show element by reference', () => {
            const element = document.getElementById('test-element');
            const el = DOMHelper.showElement(element);
            assert.equal(el.classList.contains('show'), true);
        });

        runner.it('should hide element by reference', () => {
            const element = document.getElementById('test-element');
            element.classList.add('show');
            const el = DOMHelper.hideElement(element);
            assert.equal(el.classList.contains('show'), false);
        });

        runner.it('should handle null element reference gracefully', () => {
            const el = DOMHelper.showElement(null);
            assert.equal(el, null);
        });
    });

    runner.describe('DOMHelper - Event Handling', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should add event listener', () => {
            let clicked = false;
            DOMHelper.on('test-element', 'click', () => {
                clicked = true;
            });

            const el = document.getElementById('test-element');
            el.click();
            assert.equal(clicked, true);
        });

        runner.it('should pass event to handler', () => {
            let eventReceived = null;
            DOMHelper.on('test-element', 'click', (e) => {
                eventReceived = e;
            });

            const el = document.getElementById('test-element');
            el.click();
            assert.notEqual(eventReceived, null);
            assert.equal(eventReceived.type, 'click');
        });

        runner.it('should stop propagation when requested', () => {
            let parentClicked = false;
            let childClicked = false;

            testContainer.innerHTML = `
                <div id="parent">
                    <div id="child"></div>
                </div>
            `;

            document.getElementById('parent').addEventListener('click', () => {
                parentClicked = true;
            });

            DOMHelper.on('child', 'click', () => {
                childClicked = true;
            }, true); // stopPropagation = true

            document.getElementById('child').click();

            assert.equal(childClicked, true);
            assert.equal(parentClicked, false);
        });

        runner.it('should not stop propagation by default', () => {
            let parentClicked = false;
            let childClicked = false;

            testContainer.innerHTML = `
                <div id="parent">
                    <div id="child"></div>
                </div>
            `;

            document.getElementById('parent').addEventListener('click', () => {
                parentClicked = true;
            });

            DOMHelper.on('child', 'click', () => {
                childClicked = true;
            }, false); // stopPropagation = false

            document.getElementById('child').click();

            assert.equal(childClicked, true);
            assert.equal(parentClicked, true);
        });
    });

    runner.describe('DOMHelper - Attribute Manipulation', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element" data-value="initial"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should get attribute value', () => {
            const value = DOMHelper.getAttribute('test-element', 'data-value');
            assert.equal(value, 'initial');
        });

        runner.it('should return null for non-existent attribute', () => {
            const value = DOMHelper.getAttribute('test-element', 'data-missing');
            assert.equal(value, null);
        });

        runner.it('should set attribute value', () => {
            const el = DOMHelper.setAttribute('test-element', 'data-value', 'updated');
            assert.notEqual(el, null);
            assert.equal(el.getAttribute('data-value'), 'updated');
        });

        runner.it('should set new attribute', () => {
            const el = DOMHelper.setAttribute('test-element', 'data-new', 'new-value');
            assert.equal(el.getAttribute('data-new'), 'new-value');
        });

        runner.it('should return null for non-existent element', () => {
            const value = DOMHelper.getAttribute('non-existent', 'data-value');
            assert.equal(value, null);
        });
    });

    runner.describe('DOMHelper - Chaining and Return Values', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should return element for chaining', () => {
            const el = DOMHelper.addClass('test-element', 'class1');
            assert.notEqual(el, null);
            assert.equal(el.id, 'test-element');
        });

        runner.it('should allow method chaining through element reference', () => {
            const el = DOMHelper.addClass('test-element', 'class1');
            if (el) {
                el.classList.add('class2');
                el.classList.add('class3');
            }
            assert.equal(el.classList.contains('class1'), true);
            assert.equal(el.classList.contains('class2'), true);
            assert.equal(el.classList.contains('class3'), true);
        });

        runner.it('should return null consistently for missing elements', () => {
            assert.equal(DOMHelper.addClass('missing', 'class'), null);
            assert.equal(DOMHelper.removeClass('missing', 'class'), null);
            assert.equal(DOMHelper.setText('missing', 'text'), null);
            assert.equal(DOMHelper.show('missing'), null);
        });
    });

    runner.describe('DOMHelper - Edge Cases', () => {
        runner.beforeEach(() => {
            testContainer = createTestContainer('dom-test-container');
            testContainer.innerHTML = '<div id="test-element"></div>';
        });

        runner.afterEach(() => {
            cleanupTestContainer('dom-test-container');
        });

        runner.it('should handle adding empty class gracefully', () => {
            const el = DOMHelper.addClass('test-element');
            assert.notEqual(el, null);
        });

        runner.it('should handle removing empty class gracefully', () => {
            const el = DOMHelper.removeClass('test-element');
            assert.notEqual(el, null);
        });

        runner.it('should handle hasClass for non-existent element', () => {
            const result = DOMHelper.hasClass('non-existent', 'some-class');
            assert.equal(result, false);
        });

        runner.it('should handle setAttribute on null element', () => {
            const el = DOMHelper.setAttribute('non-existent', 'attr', 'value');
            assert.equal(el, null);
        });
    });
