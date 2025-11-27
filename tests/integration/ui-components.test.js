// ============================================
// UI COMPONENTS INTEGRATION TESTS
// ============================================

import {
    Component,
    Button,
    PrimaryButton,
    FlipButton,
    Modal,
    ScoreCircle,
    ModalScoreCircle,
    ScoreMarkers,
    ModalScoreMarkers,
    ScoreDifference,
    ModalScoreDifference,
    Pok,
    HistoryTable,
    Notification,
    LoadingBar
} from '../../js/components/index.js';
import { PLAYERS } from '../../js/config.js';

const { assert } = window;
const runner = window.testRunner;

// Test container for DOM operations
let testContainer;

function createTestContainer() {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
}

function cleanupTestContainer() {
    if (testContainer && testContainer.parentNode) {
        testContainer.parentNode.removeChild(testContainer);
    }
    testContainer = null;
}

// ============================================
// BUTTON COMPONENT TESTS
// ============================================

runner.describe('Button Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render PrimaryButton with correct class', () => {
        const button = new PrimaryButton({ text: 'Click Me' });
        button.mount(testContainer);

        const btnEl = testContainer.querySelector('button');
        assert.ok(btnEl);
        assert.equal(btnEl.textContent, 'Click Me');
        assert.ok(btnEl.classList.contains('primary-button'));
    });

    runner.it('should render FlipButton with correct class', () => {
        const button = new FlipButton({ text: 'Flip' });
        button.mount(testContainer);

        const btnEl = testContainer.querySelector('button');
        assert.ok(btnEl.classList.contains('flip-table-button'));
    });

    runner.it('should handle click events via onClick()', () => {
        let clicked = false;
        const button = new Button({ text: 'Test' });
        button.onClick(() => { clicked = true; });
        button.mount(testContainer);

        testContainer.querySelector('button').click();
        assert.ok(clicked);
    });

    runner.it('should enable and disable', () => {
        const button = new Button({ text: 'Test', disabled: true });
        button.mount(testContainer);

        assert.ok(testContainer.querySelector('button').disabled);

        button.enable();
        assert.notOk(testContainer.querySelector('button').disabled);

        button.disable();
        assert.ok(testContainer.querySelector('button').disabled);
    });

    runner.it('should update button text', () => {
        const button = new Button({ text: 'Original' });
        button.mount(testContainer);

        button.setButtonText('Updated');
        assert.equal(testContainer.querySelector('button').textContent, 'Updated');
    });
});

// ============================================
// MODAL COMPONENT TESTS
// ============================================

runner.describe('Modal Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render modal structure', () => {
        const modal = new Modal({ id: 'test-modal', content: '<p>Hello</p>' });
        modal.mount(testContainer);

        const modalEl = testContainer.querySelector('.modal');
        assert.ok(modalEl);
        assert.equal(modalEl.id, 'test-modal');
        assert.ok(modal.find('.modal-content'));
    });

    runner.it('should open and close', () => {
        const modal = new Modal({ content: 'Test' });
        modal.mount(testContainer);

        assert.notOk(modal.hasClass('show'));

        modal.open();
        assert.ok(modal.hasClass('show'));
        assert.ok(modal.isOpen());

        modal.close();
        assert.notOk(modal.hasClass('show'));
        assert.notOk(modal.isOpen());
    });

    runner.it('should toggle visibility', () => {
        const modal = new Modal({ content: 'Test' });
        modal.mount(testContainer);

        modal.toggleModal();
        assert.ok(modal.isOpen());

        modal.toggleModal();
        assert.notOk(modal.isOpen());

        modal.toggleModal(true);
        assert.ok(modal.isOpen());

        modal.toggleModal(false);
        assert.notOk(modal.isOpen());
    });

    runner.it('should emit events on open/close', () => {
        const modal = new Modal({ content: 'Test' });
        modal.mount(testContainer);

        let openFired = false;
        let closeFired = false;

        modal.el.addEventListener('modal:open', () => { openFired = true; });
        modal.el.addEventListener('modal:close', () => { closeFired = true; });

        modal.open();
        assert.ok(openFired);

        modal.close();
        assert.ok(closeFired);
    });

    runner.it('should set content dynamically', () => {
        const modal = new Modal({ content: '<p>Original</p>' });
        modal.mount(testContainer);

        modal.setContent('<p>Updated</p>');
        assert.ok(modal.find('.modal-content').innerHTML.includes('Updated'));
    });
});

// ============================================
// SCORE CIRCLE COMPONENT TESTS
// ============================================

runner.describe('ScoreCircle Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render with color and score', () => {
        const circle = new ScoreCircle({ color: PLAYERS.RED, score: 15 });
        circle.mount(testContainer);

        assert.ok(testContainer.querySelector('.score-circle.red-circle'));
        assert.equal(testContainer.querySelector('span').textContent, '15');
    });

    runner.it('should render blue variant', () => {
        const circle = new ScoreCircle({ color: PLAYERS.BLUE, score: 10 });
        circle.mount(testContainer);

        assert.ok(testContainer.querySelector('.score-circle.blue-circle'));
    });

    runner.it('should render ModalScoreCircle with correct class', () => {
        const circle = new ModalScoreCircle({ color: PLAYERS.RED, score: 5 });
        circle.mount(testContainer);

        assert.ok(testContainer.querySelector('.modal-score-circle'));
    });

    runner.it('should update score', () => {
        const circle = new ScoreCircle({ color: PLAYERS.RED, score: 0 });
        circle.mount(testContainer);

        circle.setScore(25);
        assert.equal(circle.getScore(), 25);
        assert.equal(testContainer.querySelector('span').textContent, '25');
    });
});

// ============================================
// SCORE MARKERS COMPONENT TESTS
// ============================================

runner.describe('ScoreMarkers Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render with 21 markers', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.RED });
        markers.mount(testContainer);

        const markerEls = testContainer.querySelectorAll('.score-marker');
        assert.equal(markerEls.length, 21);
    });

    runner.it('should render red variant', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.RED });
        markers.mount(testContainer);

        assert.ok(testContainer.querySelector('.red-visualizer'));
    });

    runner.it('should render blue variant', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.BLUE });
        markers.mount(testContainer);

        assert.ok(testContainer.querySelector('.blue-visualizer'));
    });

    runner.it('should update score and mark scored markers', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.RED, score: 0 });
        markers.mount(testContainer);

        markers.setScore(5);

        const scoredMarkers = testContainer.querySelectorAll('.score-marker.scored');
        assert.equal(scoredMarkers.length, 5);
    });

    runner.it('should clamp score between 0 and 21', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.BLUE });
        markers.mount(testContainer);

        markers.setScore(25); // Over max
        let scoredMarkers = testContainer.querySelectorAll('.score-marker.scored');
        assert.equal(scoredMarkers.length, 21);

        markers.setScore(-5); // Under min
        scoredMarkers = testContainer.querySelectorAll('.score-marker.scored');
        assert.equal(scoredMarkers.length, 0);
    });

    runner.it('should reset to zero', () => {
        const markers = new ScoreMarkers({ color: PLAYERS.RED, score: 10 });
        markers.mount(testContainer);

        markers.reset();
        assert.equal(markers.getScore(), 0);
        assert.equal(testContainer.querySelectorAll('.score-marker.scored').length, 0);
    });
});

// ============================================
// SCORE DIFFERENCE COMPONENT TESTS
// ============================================

runner.describe('ScoreDifference Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render with initial difference', () => {
        const diff = new ScoreDifference({ difference: 5 });
        diff.mount(testContainer);

        assert.ok(testContainer.querySelector('.score-difference'));
        assert.equal(testContainer.querySelector('.score-difference').textContent, '5');
    });

    runner.it('should update difference', () => {
        const diff = new ScoreDifference({ difference: 0 });
        diff.mount(testContainer);

        diff.setDifference(10);
        assert.equal(diff.getDifference(), 10);
        assert.equal(testContainer.querySelector('.score-difference').textContent, '10');
    });

    runner.it('should update from scores', () => {
        const diff = new ScoreDifference();
        diff.mount(testContainer);

        diff.updateFromScores(15, 10);
        assert.equal(diff.getDifference(), 5);

        diff.updateFromScores(5, 12);
        assert.equal(diff.getDifference(), 7);
    });

    runner.it('should render ModalScoreDifference with correct class', () => {
        const diff = new ModalScoreDifference();
        diff.mount(testContainer);

        assert.ok(testContainer.querySelector('.modal-score-difference'));
    });
});

// ============================================
// POK COMPONENT TESTS
// ============================================

runner.describe('Pok Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render with player color and points', () => {
        const pok = new Pok({
            id: 'pok-1',
            playerId: PLAYERS.RED,
            points: 3,
            x: 50,
            y: 50
        });
        pok.mount(testContainer);

        const pokEl = testContainer.querySelector('.pok');
        assert.ok(pokEl);
        assert.ok(pokEl.classList.contains(PLAYERS.RED));
        assert.equal(pokEl.textContent, '3');
    });

    runner.it('should render blue player variant', () => {
        const pok = new Pok({ playerId: PLAYERS.BLUE, points: 2, x: 30, y: 30 });
        pok.mount(testContainer);

        assert.ok(testContainer.querySelector('.pok.blue'));
    });

    runner.it('should set position', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 1, x: 25, y: 75 });
        pok.mount(testContainer);

        assert.equal(pok.el.style.left, '25%');
        assert.equal(pok.el.style.top, '75%');
    });

    runner.it('should update position', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 1, x: 0, y: 0 });
        pok.mount(testContainer);

        pok.setPosition(50, 60);
        assert.equal(pok.el.style.left, '50%');
        assert.equal(pok.el.style.top, '60%');

        const pos = pok.getPosition();
        assert.equal(pos.x, 50);
        assert.equal(pos.y, 60);
    });

    runner.it('should add low-score class for low scoring POKs', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 1, isHigh: false, x: 0, y: 0 });
        pok.mount(testContainer);

        assert.ok(pok.el.classList.contains('low-score'));
    });

    runner.it('should add boundary-zone class', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 2, boundaryZone: '4', x: 0, y: 0 });
        pok.mount(testContainer);

        assert.ok(pok.el.classList.contains('boundary-zone'));
    });

    runner.it('should set and clear last-placed highlight', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 3, x: 0, y: 0 });
        pok.mount(testContainer);

        pok.setLastPlaced();
        assert.ok(pok.el.classList.contains('last-placed'));

        pok.clearLastPlaced();
        assert.notOk(pok.el.classList.contains('last-placed'));
    });

    runner.it('should set dragging state', () => {
        const pok = new Pok({ playerId: PLAYERS.BLUE, points: 4, x: 0, y: 0 });
        pok.mount(testContainer);

        pok.setDragging(true);
        assert.ok(pok.isDragging());
        assert.ok(pok.el.classList.contains('dragging'));

        pok.setDragging(false);
        assert.notOk(pok.isDragging());
    });

    runner.it('should update from data object', () => {
        const pok = new Pok({ playerId: PLAYERS.RED, points: 1, isHigh: true, x: 0, y: 0 });
        pok.mount(testContainer);

        pok.updateFromData({
            x: 40,
            y: 60,
            points: 5,
            isHigh: false,
            boundaryZone: '3'
        });

        assert.equal(pok.el.style.left, '40%');
        assert.equal(pok.el.style.top, '60%');
        assert.equal(pok.el.textContent, '5');
        assert.ok(pok.el.classList.contains('low-score'));
        assert.ok(pok.el.classList.contains('boundary-zone'));
    });

    runner.it('should return id and player info', () => {
        const pok = new Pok({ id: 'test-pok', playerId: PLAYERS.BLUE, points: 3, x: 0, y: 0 });

        assert.equal(pok.getId(), 'test-pok');
        assert.equal(pok.getPlayerId(), PLAYERS.BLUE);
        assert.equal(pok.getPoints(), 3);
    });
});

// ============================================
// HISTORY TABLE COMPONENT TESTS
// ============================================

runner.describe('HistoryTable Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render table structure', () => {
        const table = new HistoryTable({
            redPlayerName: 'Alice',
            bluePlayerName: 'Bob'
        });
        table.mount(testContainer);

        assert.ok(testContainer.querySelector('table'));
        assert.ok(testContainer.querySelector('thead'));
        assert.ok(testContainer.querySelector('tbody'));
    });

    runner.it('should render player names in headers', () => {
        const table = new HistoryTable({
            redPlayerName: 'Alice',
            bluePlayerName: 'Bob'
        });
        table.mount(testContainer);

        const headers = testContainer.querySelectorAll('th');
        // Headers: #, Red Name, Blue Name, Winner, Diff
        assert.ok(Array.from(headers).some(h => h.textContent === 'Alice'));
        assert.ok(Array.from(headers).some(h => h.textContent === 'Bob'));
    });

    runner.it('should update player names', () => {
        const table = new HistoryTable({
            redPlayerName: PLAYERS.RED,
            bluePlayerName: PLAYERS.BLUE
        });
        table.mount(testContainer);

        table.setPlayerNames('Charlie', 'Diana');

        const headers = testContainer.querySelectorAll('th');
        assert.ok(Array.from(headers).some(h => h.textContent === 'Charlie'));
        assert.ok(Array.from(headers).some(h => h.textContent === 'Diana'));
    });

    runner.it('should render rounds data', () => {
        const table = new HistoryTable({
            redPlayerName: PLAYERS.RED,
            bluePlayerName: PLAYERS.BLUE
        });
        table.mount(testContainer);

        const rounds = [
            { poks: [{ playerId: PLAYERS.RED, points: 10 }, { playerId: PLAYERS.BLUE, points: 8 }], isComplete: true },
            { poks: [{ playerId: PLAYERS.RED, points: 5 }, { playerId: PLAYERS.BLUE, points: 5 }], isComplete: true },
            { poks: [{ playerId: PLAYERS.RED, points: 3 }], isComplete: false }
        ];

        table.setRounds(rounds, (round) => {
            const red = round.poks.filter(p => p.playerId === PLAYERS.RED).reduce((s, p) => s + p.points, 0);
            const blue = round.poks.filter(p => p.playerId === PLAYERS.BLUE).reduce((s, p) => s + p.points, 0);
            return { red, blue };
        });

        const rows = testContainer.querySelectorAll('tbody tr');
        assert.equal(rows.length, 3);
    });

    runner.it('should clear rounds', () => {
        const table = new HistoryTable({ redPlayerName: 'R', bluePlayerName: 'B' });
        table.mount(testContainer);

        table.setRounds([{ poks: [], isComplete: true }], () => ({ red: 0, blue: 0 }));
        assert.equal(testContainer.querySelectorAll('tbody tr').length, 1);

        table.clearRounds();
        assert.equal(testContainer.querySelectorAll('tbody tr').length, 0);
    });

    runner.it('should emit hover events', () => {
        let hoveredIndex = null;
        let leaveCallCount = 0;

        const table = new HistoryTable({
            redPlayerName: 'R',
            bluePlayerName: 'B'
        });
        table.mount(testContainer);

        // Listen to events using the component's on() method
        table.on('rowHover', (e) => { hoveredIndex = e.detail.index; });
        table.on('rowLeave', () => { leaveCallCount++; });

        table.setRounds([
            { poks: [], isComplete: true }
        ], () => ({ red: 0, blue: 0 }));

        const row = testContainer.querySelector('tbody tr');
        row.dispatchEvent(new MouseEvent('mouseenter'));
        assert.equal(hoveredIndex, 0);

        row.dispatchEvent(new MouseEvent('mouseleave'));
        assert.equal(leaveCallCount, 1);
    });
});

// ============================================
// NOTIFICATION COMPONENT TESTS
// ============================================

runner.describe('Notification Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render notification element', () => {
        const notification = new Notification({ id: 'turn-notif' });
        notification.mount(testContainer);

        assert.ok(testContainer.querySelector('.player-turn-notification'));
        assert.equal(testContainer.querySelector('.player-turn-notification').id, 'turn-notif');
    });

    runner.it('should show message with player class', () => {
        const notification = new Notification();
        notification.mount(testContainer);

        notification.showMessage("Red's turn", 'red-player');

        assert.equal(notification.el.textContent, "Red's turn");
        assert.ok(notification.el.classList.contains('red-player'));
        assert.ok(notification.el.classList.contains('fade-in'));
    });

    runner.it('should switch player classes', () => {
        const notification = new Notification();
        notification.mount(testContainer);

        notification.showMessage(PLAYERS.RED, 'red-player');
        assert.ok(notification.hasClass('red-player'));

        notification.showMessage(PLAYERS.BLUE, 'blue-player');
        assert.ok(notification.hasClass('blue-player'));
        assert.notOk(notification.hasClass('red-player'));
    });
});

// ============================================
// LOADING BAR COMPONENT TESTS
// ============================================

runner.describe('LoadingBar Component - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should render loading bar structure', () => {
        const bar = new LoadingBar({ id: 'load-bar' });
        bar.mount(testContainer);

        assert.ok(testContainer.querySelector('.round-end-loading-bar'));
        assert.ok(testContainer.querySelector('.loading-bar-fill'));
    });

    runner.it('should reset to zero', () => {
        const bar = new LoadingBar();
        bar.mount(testContainer);

        bar.reset();
        const fill = bar.getFill();
        assert.equal(fill.style.width, '0%');
    });

    runner.it('should set progress manually', () => {
        const bar = new LoadingBar();
        bar.mount(testContainer);

        bar.setProgress(50);
        const fill = bar.getFill();
        assert.equal(fill.style.width, '50%');
    });

    runner.it('should clamp progress between 0 and 100', () => {
        const bar = new LoadingBar();
        bar.mount(testContainer);

        bar.setProgress(150);
        assert.equal(bar.getFill().style.width, '100%');

        bar.setProgress(-50);
        assert.equal(bar.getFill().style.width, '0%');
    });
});

// ============================================
// COMPOSITE COMPONENT TESTS
// ============================================

runner.describe('Composite Components - Integration', () => {
    runner.beforeEach(() => {
        createTestContainer();
    });

    runner.afterEach(() => {
        cleanupTestContainer();
    });

    runner.it('should compose multiple score components', () => {
        // Simulate a score display with circles and difference
        const container = document.createElement('div');
        container.className = 'score-display';
        testContainer.appendChild(container);

        const redScore = new ScoreCircle({ color: PLAYERS.RED, score: 12 });
        const blueScore = new ScoreCircle({ color: PLAYERS.BLUE, score: 8 });
        const diff = new ScoreDifference({ difference: 4 });

        redScore.mount(container);
        diff.mount(container);
        blueScore.mount(container);

        assert.equal(container.children.length, 3);
        assert.ok(container.querySelector('.red-circle'));
        assert.ok(container.querySelector('.blue-circle'));
        assert.ok(container.querySelector('.score-difference'));
    });

    runner.it('should update composed score display', () => {
        const container = document.createElement('div');
        testContainer.appendChild(container);

        const redScore = new ScoreCircle({ color: PLAYERS.RED, score: 0 });
        const blueScore = new ScoreCircle({ color: PLAYERS.BLUE, score: 0 });
        const diff = new ScoreDifference({ difference: 0 });

        redScore.mount(container);
        diff.mount(container);
        blueScore.mount(container);

        // Simulate score update
        const newRed = 15;
        const newBlue = 10;

        redScore.setScore(newRed);
        blueScore.setScore(newBlue);
        diff.updateFromScores(newRed, newBlue);

        assert.equal(redScore.getScore(), 15);
        assert.equal(blueScore.getScore(), 10);
        assert.equal(diff.getDifference(), 5);
    });

    runner.it('should manage POK collection for a round', () => {
        const pokMap = new Map();
        const pokData = [
            { id: 'p1', playerId: PLAYERS.RED, points: 3, x: 10, y: 10, isHigh: true },
            { id: 'p2', playerId: PLAYERS.BLUE, points: 2, x: 20, y: 20, isHigh: true },
            { id: 'p3', playerId: PLAYERS.RED, points: 4, x: 30, y: 30, isHigh: true },
            { id: 'p4', playerId: PLAYERS.BLUE, points: 1, x: 40, y: 40, isHigh: false }
        ];

        // Create POKs
        pokData.forEach(data => {
            const pok = new Pok(data);
            pok.mount(testContainer);
            pokMap.set(data.id, pok);
        });

        assert.equal(pokMap.size, 4);
        assert.equal(testContainer.querySelectorAll('.pok').length, 4);
        assert.equal(testContainer.querySelectorAll('.pok.red').length, 2);
        assert.equal(testContainer.querySelectorAll('.pok.blue').length, 2);

        // Remove a POK
        const pokToRemove = pokMap.get('p2');
        pokToRemove.unmount();
        pokMap.delete('p2');

        assert.equal(pokMap.size, 3);
        assert.equal(testContainer.querySelectorAll('.pok').length, 3);

        // Clear all
        pokMap.forEach(pok => pok.unmount());
        pokMap.clear();

        assert.equal(testContainer.querySelectorAll('.pok').length, 0);
    });
});
