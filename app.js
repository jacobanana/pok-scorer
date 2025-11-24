// Constants
// ============================================

// Game Configuration
const GAME_CONFIG = {
    WINNING_SCORE: 21,
    POKS_PER_PLAYER: 5,
    INITIAL_ROUND_NUMBER: 0
};

// UI Configuration
const UI_CONFIG = {
    BOUNDARY_THRESHOLD_PX: 15,
    AUTO_END_ROUND_DELAY_MS: 5000,
    PLAYER_TURN_NOTIFICATION_DURATION_MS: 1000,
    DEFAULT_POSITION_PERCENT: 50,
    HISTORY_RESTORE_DELAY_MS: 300,
    TOUCH_DRAG_COOLDOWN_MS: 100,
    TOUCH_DRAG_MOVE_THRESHOLD_PX: 5
};

// Zone Scoring Configuration
const ZONE_SCORES = {
    'outer': { points: 0, boundary: null },
    '0': { points: 0, boundary: null },
    '1': { points: 1, boundary: '0' },
    '2': { points: 2, boundary: '1' },
    '3': { points: 3, boundary: '2' },
    '4': { points: 4, boundary: '1' },
    '5': { points: 5, boundary: '1' }
};

// Player Configuration
const PLAYER_ID = {
        RED: 'red',
    BLUE: 'blue'
};

const PLAYER_NAME = {
    [PLAYER_ID.RED]: 'Red',
    [PLAYER_ID.BLUE]: 'Blue'
};

// Utility Functions
// ============================================

/**
 * Get a player-specific class name by suffix
 * @param {string} playerId - The player ID (PLAYER_ID.RED or PLAYER_ID.BLUE)
 * @param {string} suffix - The class suffix (e.g., 'bg', 'turn', 'circle')
 * @returns {string} The constructed class name (e.g., 'red-bg', 'blue-turn')
 */
function getPlayerClass(playerId, suffix) {
    return `${playerId}-${suffix}`;
}

const PLAYER_CLASS = {
    [PLAYER_ID.RED]: getPlayerClass(PLAYER_ID.RED, 'turn'),
    [PLAYER_ID.BLUE]: getPlayerClass(PLAYER_ID.BLUE, 'turn')
};

const PLAYER_BG_CLASS = {
    [PLAYER_ID.RED]: getPlayerClass(PLAYER_ID.RED, 'bg'),
    [PLAYER_ID.BLUE]: getPlayerClass(PLAYER_ID.BLUE, 'bg'),
    TIE: 'tie-bg'
};

// Event Types
const EVENT_TYPES = {
    GAME_STARTED: 'GAME_STARTED',
    GAME_RESET: 'GAME_RESET',
    ROUND_STARTED: 'ROUND_STARTED',
    ROUND_ENDED: 'ROUND_ENDED',
    POK_PLACED: 'POK_PLACED',
    POK_MOVED: 'POK_MOVED',
    POK_REMOVED: 'POK_REMOVED',
    PLAYER_SWITCHED: 'PLAYER_SWITCHED'
};

// ============================================
// Event System Classes
// ============================================

class GameEvent {
    constructor(type, data) {
        this.type = type;
        this.timestamp = Date.now();
        this.data = data;
    }
}

class EventLog {
    constructor() {
        this.events = [];
    }

    record(event) {
        this.events.push(event);
        const time = new Date(event.timestamp).toLocaleTimeString();
        console.log(`[${time}] ${event.type}:`, event.data);
    }

    getAll() {
        return [...this.events];
    }

    clear() {
        this.events = [];
        console.log('Event log cleared');
    }

    export() {
        return JSON.stringify(this.events, null, 2);
    }

    printSummary() {
        console.log('=== Event Log Summary ===');
        console.log(`Total events: ${this.events.length}`);
        const eventCounts = {};
        this.events.forEach(e => {
            eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
        });
        console.table(eventCounts);
    }
}

// ============================================
// State Machine
// ============================================

class GameStateMachine {
    constructor() {
        this.currentState = 'GAME_NOT_STARTED';

        this.transitions = {
            'GAME_NOT_STARTED': ['GAME_STARTED'],
            'GAME_STARTED': ['PLAYER_TURN'],
            'PLAYER_TURN': ['POK_PLACED', 'ROUND_COMPLETE'],
            'POK_PLACED': ['PLAYER_TURN', 'ROUND_COMPLETE'],
            'ROUND_COMPLETE': ['ROUND_ENDED'],
            'ROUND_ENDED': ['PLAYER_TURN', 'GAME_COMPLETE'],
            'GAME_COMPLETE': ['GAME_NOT_STARTED']
        };
    }

    canTransition(eventType) {
        return this.transitions[this.currentState]?.includes(eventType) || false;
    }

    transition(newState) {
        console.log(`State: ${this.currentState} → ${newState}`);
        this.currentState = newState;
    }

    setState(state) {
        this.currentState = state;
    }

    getState() {
        return this.currentState;
    }
}

// ============================================
// Service Classes
// ============================================

class RulesEngine {
    canPlacePok(round, playerId) {
        if (!round) return false;
        if (round.currentPlayerId !== playerId) return false;

        const remaining = playerId === PLAYER_ID.RED
            ? round.redPoksRemaining
            : round.bluePoksRemaining;

        return remaining > 0;
    }

    getNextPlayer(round) {
        if (round.redPoksRemaining === 0 && round.bluePoksRemaining > 0) {
            return PLAYER_ID.BLUE;
        }
        if (round.bluePoksRemaining === 0 && round.redPoksRemaining > 0) {
            return PLAYER_ID.RED;
        }

        if (round.redPoksRemaining > 0 && round.bluePoksRemaining > 0) {
            if (round.scores.red < round.scores.blue) {
                return PLAYER_ID.RED;
            } else if (round.scores.blue < round.scores.red) {
                return PLAYER_ID.BLUE;
            } else {
                return round.currentPlayerId === PLAYER_ID.RED
                    ? PLAYER_ID.BLUE
                    : PLAYER_ID.RED;
            }
        }

        return round.currentPlayerId;
    }

    getRoundStarter(previousRound) {
        if (!previousRound) return null;

        if (previousRound.scores.winner === 'tie') {
            return previousRound.startingPlayerId === PLAYER_ID.RED
                ? PLAYER_ID.BLUE
                : PLAYER_ID.RED;
        }

        return previousRound.scores.winner;
    }

    shouldEndGame(game) {
        return game.players.red.totalScore >= game.winningScore ||
                game.players.blue.totalScore >= game.winningScore;
    }

    calculateRoundWinner(round) {
        const diff = Math.abs(round.scores.red - round.scores.blue);

        if (round.scores.red > round.scores.blue) {
            return { winner: PLAYER_ID.RED, pointsEarned: diff };
        } else if (round.scores.blue > round.scores.red) {
            return { winner: PLAYER_ID.BLUE, pointsEarned: diff };
        } else {
            return { winner: 'tie', pointsEarned: 0 };
        }
    }
}

class ScoringService {
    constructor() {
        this.boundaryThresholdPercent = 2; // 2% threshold for boundary detection

        // Define zone boundaries as percentages of table dimensions
        // The table layout: left side has 4 columns with flex: 3(1), 2(1), 1(1), 0(2)
        // Total flex units = 5, so each unit = 100% / 5 = 20%
        // Zone 3: 0-20%, Zone 2: 20-40%, Zone 1: 40-60%, Zone 0: 60-100%
        this.zoneBoundaries = {
            // Horizontal boundaries (X axis, from left to right)
            zone3Right: 20,   // Zone 3: 0-20%
            zone2Right: 40,   // Zone 2: 20-40%
            zone1Right: 60,   // Zone 1: 40-60%
            zone0Right: 100,  // Zone 0: 60-100%

            // Circle zones (zone 4 and 5) - positioned within zone 1 area (40-60%)
            // Zone 1 center is at 50% of table width
            // Circles are centered horizontally (left:50%, transform:translateX(-50%)) = 50% of table
            // Circle width is 60% of zone 1 column width = 60% of 20% = 12% of table width
            // Radius in X dimension = 6% of table width
            // But with aspect ratio 1.5:1, the same visual circle has radius of 9% in Y dimension
            circle4Center: { x: 50, y: 19 },  // Top circle: top:10% of table + radius in Y(9%) = 19%
            circle5Center: { x: 50, y: 81 },  // Bottom circle: bottom:10% = 90%, minus radius in Y(9%) = 81%
            circleRadius: 6  // Circle radius as percentage of table width (will be scaled by aspect ratio in Y)
        };
    }

    // Get zone and scoring info from table-relative percentage coordinates
    getZoneAtPosition(tableXPercent, tableYPercent) {
        const x = tableXPercent;
        const y = tableYPercent;

        // Outer zone is valid (POKs can be placed outside table)
        if (x < 0 || x > 100 || y < 0 || y > 100) {
            return { zoneId: 'outer', points: 0, isHigh: true, boundaryZone: null };
        }

        // Check circular zones (4 and 5) within zone 1 area first
        const circle4Result = this.checkCircularZone(x, y, this.zoneBoundaries.circle4Center, this.zoneBoundaries.circleRadius, '4', '1');
        if (circle4Result) return circle4Result;

        const circle5Result = this.checkCircularZone(x, y, this.zoneBoundaries.circle5Center, this.zoneBoundaries.circleRadius, '5', '1');
        if (circle5Result) return circle5Result;

        // Check rectangular zones from left to right
        if (x < this.zoneBoundaries.zone3Right) {
            // Zone 3: leftmost zone, boundary with zone 2 on right
            return this.checkRectangularZone(x, this.zoneBoundaries.zone3Right, '3', '2');
        } else if (x < this.zoneBoundaries.zone2Right) {
            // Zone 2: boundary with zone 3 on left, zone 1 on right
            return this.checkRectangularZone(x, this.zoneBoundaries.zone2Right, '2', '1');
        } else if (x < this.zoneBoundaries.zone1Right) {
            // Zone 1: boundary with zone 2 on left, zone 0 on right
            return this.checkRectangularZone(x, this.zoneBoundaries.zone1Right, '1', '0');
        } else {
            // Zone 0: rightmost zone, no boundary on right
            return this.checkRectangularZone(x, this.zoneBoundaries.zone0Right, '0', null);
        }
    }

    checkCircularZone(x, y, center, radius, zoneId, boundaryZone) {
        // Calculate distance accounting for table aspect ratio (1.5:1)
        // The table is 1.5x wider than tall, so Y percentages represent smaller physical distances
        // To make a perfect circle, we need to scale Y by the aspect ratio
        const aspectRatio = 1.5;
        const dx = x - center.x;
        const dy = (y - center.y) / aspectRatio; // Scale Y to match X proportions
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
            const config = ZONE_SCORES[zoneId];
            // For circles, boundary is near the outer edge (circumference)
            // Check if distance from center is within the boundary threshold from the radius
            // Example: radius=6%, threshold=2% -> boundary when distance >= 4% (i.e., 6%-2%)
            const boundaryStartDistance = radius - this.boundaryThresholdPercent;
            const isNearBoundary = distance >= boundaryStartDistance;

            if (isNearBoundary && boundaryZone) {
                const boundaryConfig = ZONE_SCORES[boundaryZone];
                return {
                    zoneId: zoneId,
                    points: boundaryConfig.points,
                    isHigh: false,
                    boundaryZone: boundaryZone
                };
            }

            return {
                zoneId: zoneId,
                points: config.points,
                isHigh: true,
                boundaryZone: null
            };
        }

        return null;
    }

    checkRectangularZone(x, rightBoundary, zoneId, boundaryZone) {
        const config = ZONE_SCORES[zoneId];
        // For rectangles, boundary is near the right edge (intersection with next zone)
        const isNearBoundary = boundaryZone && x >= rightBoundary - this.boundaryThresholdPercent;

        if (isNearBoundary) {
            const boundaryConfig = ZONE_SCORES[boundaryZone];
            return {
                zoneId: zoneId,
                points: boundaryConfig.points,
                isHigh: false,
                boundaryZone: boundaryZone
            };
        }

        return {
            zoneId: zoneId,
            points: config.points,
            isHigh: true,
            boundaryZone: null
        };
    }

    // Get the DOM element for a given zone ID (for highlighting)
    getZoneElement(zoneId) {
        return document.querySelector(`[data-zone="${zoneId}"]`) || document.getElementById(zoneId);
    }
}

class PokService {
    constructor() {
        this.pokIdCounter = 0;
        this.pokElements = new Map();
        this.tableElement = null; // Reference to the table element
    }

    setTableElement(element) {
        this.tableElement = element;
    }

    generatePokId() {
        return `pok-${this.pokIdCounter++}`;
    }

    createPok(playerId, points, tableXPercent, tableYPercent, zoneId, isHighScore) {
        const pokId = this.generatePokId();
        const pok = new Pok(pokId, playerId, points, tableXPercent, tableYPercent, zoneId, isHighScore);
        return pok;
    }

    createPokElement(pok) {
        const el = document.createElement('div');
        el.className = `pok ${pok.playerId}`;
        if (!pok.isHighScore) {
            el.classList.add('low-score');
        }
        el.textContent = pok.points;
        el.style.left = `${pok.position.tableXPercent}%`;
        el.style.top = `${pok.position.tableYPercent}%`;
        el.style.transform = 'translate(-50%, -50%)';
        return el;
    }

    attachPokToTable(pokElement) {
        if (!this.tableElement) {
            console.error('Table element not set in PokService');
            return;
        }
        this.tableElement.appendChild(pokElement);
    }

    removePokElement(pokId) {
        const pokElement = this.pokElements.get(pokId);
        if (pokElement) {
            pokElement.remove();
            this.pokElements.delete(pokId);
        }
    }

    setPokElement(pokId, element) {
        this.pokElements.set(pokId, element);
    }

    getPokElement(pokId) {
        return this.pokElements.get(pokId);
    }

    // Convert event (mouse or touch) to table-relative percentage coordinates
    calculateTablePositionFromEvent(event) {
        if (!this.tableElement) {
            console.error('Table element not set in PokService');
            return { tableXPercent: 50, tableYPercent: 50 };
        }

        const rect = this.tableElement.getBoundingClientRect();

        // Get client coordinates - handle both mouse and touch events
        const clientX = event.clientX !== undefined ? event.clientX : (event.touches?.[0]?.clientX || event.changedTouches?.[0]?.clientX);
        const clientY = event.clientY !== undefined ? event.clientY : (event.touches?.[0]?.clientY || event.changedTouches?.[0]?.clientY);

        let x = clientX - rect.left;
        const y = clientY - rect.top;

        // Check if table is flipped - if so, invert x coordinate
        const tableContainer = document.getElementById('gameBoardContainer');
        const isFlipped = tableContainer && tableContainer.classList.contains('flipped');

        if (isFlipped) {
            // Invert x coordinate for flipped table
            x = rect.width - x;
        }

        // Allow coordinates outside the table (0-100% range)
        // This enables placing POKs in the "outer" zone
        return {
            tableXPercent: (x / rect.width) * 100,
            tableYPercent: (y / rect.height) * 100
        };
    }

    makePokDraggable(pokElement, callbacks) {
        pokElement.draggable = true;

        // Desktop drag and drop
        pokElement.addEventListener('dragstart', (e) => {
            pokElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            if (callbacks.onDragStart) {
                callbacks.onDragStart();
            }
        });

        pokElement.addEventListener('dragend', () => {
            pokElement.classList.remove('dragging');
            if (callbacks.onDragEnd) {
                callbacks.onDragEnd();
            }
        });

        // Mobile touch events
        let touchStartX, touchStartY, initialLeft, initialTop;
        let isDragging = false;
        let hasMoved = false;

        pokElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            hasMoved = false;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            const rect = pokElement.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            pokElement.classList.add('dragging');
            pokElement.style.position = 'fixed';
            pokElement.style.zIndex = '1000';
            pokElement.style.left = `${initialLeft}px`;
            pokElement.style.top = `${initialTop}px`;
            pokElement.style.transform = 'translate(0, 0)';

            // Only call onDragStart when we actually start moving (called from touchmove)
            // Don't call it here to avoid setting isTouchDragging for taps
        }, { passive: false });

        pokElement.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            // Mark as moved if the touch has moved more than a small threshold
            if (Math.abs(deltaX) > UI_CONFIG.TOUCH_DRAG_MOVE_THRESHOLD_PX || Math.abs(deltaY) > UI_CONFIG.TOUCH_DRAG_MOVE_THRESHOLD_PX) {
                // First time we actually move - call onDragStart to set the isTouchDragging flag
                if (!hasMoved && callbacks.onDragStart) {
                    callbacks.onDragStart();
                }
                hasMoved = true;
            }

            pokElement.style.left = `${initialLeft + deltaX}px`;
            pokElement.style.top = `${initialTop + deltaY}px`;

            // Trigger boundary highlighting (no longer need to track zone)
            if (callbacks.onTouchMove) {
                callbacks.onTouchMove(touch);
            }
        }, { passive: false });

        pokElement.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;

            const touch = e.changedTouches[0];

            pokElement.classList.remove('dragging');
            pokElement.style.position = '';
            pokElement.style.zIndex = '';
            pokElement.style.left = '';
            pokElement.style.top = '';
            pokElement.style.transform = 'translate(-50%, -50%)'; // Restore original centering transform

            // Only call onDragEnd if we actually moved (onDragStart was called)
            if (hasMoved && callbacks.onDragEnd) {
                callbacks.onDragEnd();
            }

            // Only drop if we actually moved the POK
            if (hasMoved && callbacks.onTouchDrop) {
                callbacks.onTouchDrop(touch);
            } else if (!hasMoved && callbacks.onTap) {
                // If we didn't move, this is a tap - call the tap handler
                callbacks.onTap();
            }

            hasMoved = false;
        }, { passive: false });
    }

    clearLastPlacedHighlight() {
        document.querySelectorAll('.pok.last-placed').forEach(pok => {
            pok.classList.remove('last-placed');
        });
    }

    highlightAsLastPlaced(pokElement) {
        this.clearLastPlacedHighlight();
        pokElement.classList.add('last-placed');
    }

    clearAllPokElements() {
        document.querySelectorAll('.pok').forEach(pok => pok.remove());
        this.pokElements.clear();
    }

    reset() {
        this.pokIdCounter = 0;
        this.clearAllPokElements();
    }
}

class PersistenceService {
    constructor() {
        this.storageKey = 'pok-scorer-game-state';
    }

    saveGameState(game, orchestrator) {
        const state = {
            isStarted: game.isStarted,
            players: {
                red: { totalScore: game.players.red.totalScore },
                blue: { totalScore: game.players.blue.totalScore }
            },
            rounds: game.rounds.map(round => ({
                roundNumber: round.roundNumber,
                startingPlayerId: round.startingPlayerId,
                currentPlayerId: round.currentPlayerId,
                redPoksRemaining: round.redPoksRemaining,
                bluePoksRemaining: round.bluePoksRemaining,
                isComplete: round.isComplete,
                lastPlacedPokId: round.lastPlacedPokId,
                tableOrientation: round.tableOrientation,
                scores: {
                    red: round.scores.red,
                    blue: round.scores.blue,
                    winner: round.scores.winner,
                    pointDifference: round.scores.pointDifference
                },
                poksPlaced: round.poksPlaced.map(pok => ({
                    id: pok.id,
                    playerId: pok.playerId,
                    points: pok.points,
                    position: {
                        tableXPercent: pok.position.tableXPercent,
                        tableYPercent: pok.position.tableYPercent
                    },
                    zoneId: pok.zoneId,
                    isHighScore: pok.isHighScore
                }))
            })),
            currentRoundIndex: game.currentRoundIndex,
            pokIdCounter: orchestrator.services.pok.pokIdCounter
        };

        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }

    loadGameState() {
        const savedState = localStorage.getItem(this.storageKey);
        return savedState ? JSON.parse(savedState) : null;
    }

    clearGameState() {
        localStorage.removeItem(this.storageKey);
    }

    hasGameState() {
        return localStorage.getItem(this.storageKey) !== null;
    }
}

class UIService {
    constructor() {
        this.domElements = null;
    }

    init() {
        this.domElements = {
            startSelector: document.getElementById('gameStartSelector'),
            continueButton: document.getElementById('continueGameButton'),
            nextPlayer: document.getElementById('nextPlayerIndicator'),
            tableContainer: document.getElementById('gameBoardContainer'),
            mainRedTotal: document.getElementById('totalScoreRed'),
            mainBlueTotal: document.getElementById('totalScoreBlue'),
            redRound: document.getElementById('currentRoundScoreRed'),
            blueRound: document.getElementById('currentRoundScoreBlue'),
            roundModal: document.getElementById('roundEndModal'),
            modalWinner: document.getElementById('roundEndModalWinner'),
            modalRoundScores: document.getElementById('roundEndModalRoundScores'),
            modalTotalScores: document.getElementById('roundEndModalTotalScores'),
            historyTableBody: document.getElementById('roundsHistoryTableBody'),
            currentRoundScore: document.getElementById('currentRoundScoreDisplay'),
            scoreDifference: document.getElementById('currentRoundScoreDifference'),
            redPoksInfo: document.getElementById('remainingPoksRed'),
            bluePoksInfo: document.getElementById('remainingPoksBlue'),
            turnNotification: document.getElementById('playerTurnNotification')
        };
    }

    updateScores(game) {
        const round = game.getCurrentRound();

        this.domElements.mainRedTotal.textContent = game.players.red.totalScore;
        this.domElements.mainBlueTotal.textContent = game.players.blue.totalScore;

        if (round) {
            this.domElements.redRound.textContent = round.scores.red;
            this.domElements.blueRound.textContent = round.scores.blue;

            // Update poks remaining info
            if (this.domElements.redPoksInfo) {
                this.domElements.redPoksInfo.textContent = round.redPoksRemaining;
            }
            if (this.domElements.bluePoksInfo) {
                this.domElements.bluePoksInfo.textContent = round.bluePoksRemaining;
            }

            // Update current round score background and difference based on leader
            const diff = Math.abs(round.scores.red - round.scores.blue);
            if (this.domElements.currentRoundScore) {
                this.domElements.currentRoundScore.classList.remove('red-leading', 'blue-leading', 'tied');
                if (round.scores.red > round.scores.blue) {
                    this.domElements.currentRoundScore.classList.add('red-leading');
                } else if (round.scores.blue > round.scores.red) {
                    this.domElements.currentRoundScore.classList.add('blue-leading');
                } else {
                    this.domElements.currentRoundScore.classList.add('tied');
                }
            }

            // Update difference display
            if (this.domElements.scoreDifference) {
                this.domElements.scoreDifference.textContent = diff > 0 ? '+' + diff : '0';
            }
        } else {
            this.domElements.redRound.textContent = 0;
            this.domElements.blueRound.textContent = 0;

            if (this.domElements.redPoksInfo) {
                this.domElements.redPoksInfo.textContent = game.poksPerPlayer;
            }
            if (this.domElements.bluePoksInfo) {
                this.domElements.bluePoksInfo.textContent = game.poksPerPlayer;
            }

            if (this.domElements.currentRoundScore) {
                this.domElements.currentRoundScore.classList.remove('red-leading', 'blue-leading', 'tied');
                this.domElements.currentRoundScore.classList.add('tied');
            }
            if (this.domElements.scoreDifference) {
                this.domElements.scoreDifference.textContent = '0';
            }
        }

        // Update rounds history to show current round
        this.updateRoundsHistory(game);
    }

    updateCurrentPlayer(round) {
        if (!round) return;

        const currentPlayerId = round.currentPlayerId;

        document.body.classList.remove(PLAYER_CLASS[PLAYER_ID.RED], PLAYER_CLASS[PLAYER_ID.BLUE]);
        document.body.classList.add(PLAYER_CLASS[currentPlayerId]);

        if (this.domElements.nextPlayer) {
            this.domElements.nextPlayer.textContent = `Next player: ${PLAYER_NAME[currentPlayerId]}`;
            this.domElements.nextPlayer.classList.remove(PLAYER_BG_CLASS[PLAYER_ID.RED], PLAYER_BG_CLASS[PLAYER_ID.BLUE]);
            this.domElements.nextPlayer.classList.add(PLAYER_BG_CLASS[currentPlayerId]);
        }
    }

    showStartSelector() {
        this.domElements.startSelector.classList.remove('hidden');
    }

    hideStartSelector() {
        this.domElements.startSelector.classList.add('hidden');
    }

    showContinueButton() {
        if (this.domElements.continueButton) {
            this.domElements.continueButton.classList.add('show');
        }
    }

    hideContinueButton() {
        if (this.domElements.continueButton) {
            this.domElements.continueButton.classList.remove('show');
        }
    }

    showRoundModal(winnerText, redScore, blueScore, redTotal, blueTotal, bgClass, roundNumber) {
        // Update round number
        const modalRoundNumber = document.getElementById('roundEndModalRoundNumber');
        if (modalRoundNumber) {
            modalRoundNumber.textContent = `Round ${roundNumber + 1}`;
        }

        // Update winner text
        this.domElements.modalWinner.textContent = winnerText;

        // Update score circles
        const modalRedScore = document.getElementById('roundEndModalRedScore');
        const modalBlueScore = document.getElementById('roundEndModalBlueScore');
        const modalScoreDiff = document.getElementById('roundEndModalScoreDiff');

        if (modalRedScore) modalRedScore.textContent = redScore;
        if (modalBlueScore) modalBlueScore.textContent = blueScore;
        if (modalScoreDiff) {
            const diff = Math.abs(redScore - blueScore);
            modalScoreDiff.textContent = diff > 0 ? '+' + diff : '0';
        }

        // Update total scores
        this.domElements.modalTotalScores.textContent = `Total: Red ${redTotal} - Blue ${blueTotal}`;

        this.domElements.roundModal.classList.remove(
            PLAYER_BG_CLASS[PLAYER_ID.RED],
            PLAYER_BG_CLASS[PLAYER_ID.BLUE],
            PLAYER_BG_CLASS.TIE
        );
        this.domElements.roundModal.classList.add(bgClass, 'show');
    }

    hideRoundModal() {
        this.domElements.roundModal.classList.remove('show');
    }

    updateRoundsHistory(game) {
        if (!this.domElements.historyTableBody) return;

        this.domElements.historyTableBody.innerHTML = '';

        game.rounds.forEach((round, index) => {
            const row = document.createElement('tr');
            row.dataset.roundIndex = index;

            const roundNum = document.createElement('td');
            roundNum.textContent = index + 1;
            roundNum.className = 'round-number';

            const redScore = document.createElement('td');
            redScore.textContent = round.scores.red;

            const blueScore = document.createElement('td');
            blueScore.textContent = round.scores.blue;

            const winner = document.createElement('td');
            const diff = document.createElement('td');

            if (round.isComplete) {
                // Completed round - show winner and diff
                if (round.scores.winner === PLAYER_ID.RED) {
                    winner.textContent = PLAYER_NAME[PLAYER_ID.RED];
                    winner.className = getPlayerClass(PLAYER_ID.RED, 'winner');
                    row.className = getPlayerClass(PLAYER_ID.RED, 'round-row');
                } else if (round.scores.winner === PLAYER_ID.BLUE) {
                    winner.textContent = PLAYER_NAME[PLAYER_ID.BLUE];
                    winner.className = getPlayerClass(PLAYER_ID.BLUE, 'winner');
                    row.className = getPlayerClass(PLAYER_ID.BLUE, 'round-row');
                } else {
                    winner.textContent = 'Tie';
                    winner.className = 'winner-tie';
                }
                diff.textContent = round.scores.pointDifference;
            } else {
                // Current round - show in progress
                winner.textContent = 'In progress';
                winner.className = 'winner-current';
                diff.textContent = '-';
                row.className = 'round-row-current';
            }

            row.appendChild(roundNum);
            row.appendChild(redScore);
            row.appendChild(blueScore);
            row.appendChild(winner);
            row.appendChild(diff);

            this.domElements.historyTableBody.appendChild(row);
        });
    }

    clearRoundsHistory() {
        if (!this.domElements.historyTableBody) return;
        this.domElements.historyTableBody.innerHTML = '';
    }

    showPlayerTurnNotification(playerId) {
        if (!this.domElements.turnNotification) return;

        const playerName = PLAYER_NAME[playerId];
        this.domElements.turnNotification.textContent = `${playerName}'s turn`;

        // Reset animation by removing classes
        this.domElements.turnNotification.classList.remove(
            'show',
            'fade-out',
            'round-complete',
            getPlayerClass(PLAYER_ID.RED, 'player'),
            getPlayerClass(PLAYER_ID.BLUE, 'player')
        );

        // Add player color class
        this.domElements.turnNotification.classList.add(getPlayerClass(playerId, 'player'));

        // Hide the current round score display
        if (this.domElements.currentRoundScore) {
            this.domElements.currentRoundScore.classList.add('hidden');
        }

        // Force reflow to restart animation
        void this.domElements.turnNotification.offsetWidth;

        // Fade in
        this.domElements.turnNotification.classList.add('show');

        // Fade out after configured duration
        setTimeout(() => {
            this.domElements.turnNotification.classList.remove('show');
            this.domElements.turnNotification.classList.add('fade-out');

            // Show the current round score display again
            setTimeout(() => {
                if (this.domElements.currentRoundScore) {
                    this.domElements.currentRoundScore.classList.remove('hidden');
                }
            }, 300); // Wait for fade-out transition
        }, UI_CONFIG.PLAYER_TURN_NOTIFICATION_DURATION_MS);
    }

    showRoundCompleteNotification(secondsRemaining) {
        if (!this.domElements.turnNotification) return;

        const seconds = Math.max(0, Math.ceil(secondsRemaining));
        this.domElements.turnNotification.textContent = `All POKs played! Round ending in ${seconds}s...`;

        // Reset animation by removing classes and add round-complete class
        this.domElements.turnNotification.classList.remove(
            'fade-out',
            getPlayerClass(PLAYER_ID.RED, 'player'),
            getPlayerClass(PLAYER_ID.BLUE, 'player')
        );
        this.domElements.turnNotification.classList.add('show', 'round-complete');

        // Force reflow to ensure the element is visible
        void this.domElements.turnNotification.offsetWidth;

        // Hide the current round score display
        if (this.domElements.currentRoundScore) {
            this.domElements.currentRoundScore.classList.add('hidden');
        }
    }

    hideRoundCompleteNotification() {
        if (!this.domElements.turnNotification) return;

        this.domElements.turnNotification.classList.remove('show', 'round-complete');

        // Show the current round score display again
        if (this.domElements.currentRoundScore) {
            this.domElements.currentRoundScore.classList.remove('hidden');
        }
    }

    disableZoneInteractions() {
        // Prevent new POK placement via clicks, but still allow drag-and-drop editing
        document.body.classList.add('round-ending');
    }

    enableZoneInteractions() {
        // Re-enable new POK placement
        document.body.classList.remove('round-ending');
    }

    highlightZoneBoundary(zoneElement) {
        zoneElement.classList.add('boundary-highlight');
    }

    clearZoneBoundaryHighlight(zoneElement) {
        zoneElement.classList.remove('boundary-highlight');
    }

    clearAllZoneBoundaryHighlights() {
        document.querySelectorAll('.zone.boundary-highlight, .circle-zone.boundary-highlight').forEach(zone => {
            zone.classList.remove('boundary-highlight');
        });
    }

    displayHistoricalRound(round, pokService, uiState) {
        // Clear all existing POKs
        document.querySelectorAll('.pok').forEach(pok => pok.remove());

        // Display historical POKs (starting invisible)
        round.poksPlaced.forEach(pok => {
            const pokElement = pokService.createPokElement(pok);
            pokElement.classList.add('fade-ready');
            pokElement.style.pointerEvents = 'none'; // Disable interactions for historical POKs
            pokService.attachPokToTable(pokElement);
        });

        // Trigger fade-in animation after the restore delay
        uiState.setHistoryFadeInTimer(UI_CONFIG.HISTORY_RESTORE_DELAY_MS, () => {
            document.querySelectorAll('.pok.fade-ready').forEach(pok => {
                pok.classList.remove('fade-ready');
                pok.classList.add('historical-fade-in');
            });
        });
    }
}

// ============================================
// Classes
// ============================================

class Player {
    constructor(id) {
        this.id = id;
        this.totalScore = 0;
    }

    addScore(points) {
        this.totalScore += points;
    }

    resetScore() {
        this.totalScore = 0;
    }
}

class Pok {
    constructor(id, playerId, points, tableXPercent, tableYPercent, zoneId, isHighScore) {
        this.id = id;
        this.playerId = playerId;
        this.points = points;
        this.position = {
            tableXPercent: tableXPercent !== undefined ? tableXPercent : UI_CONFIG.DEFAULT_POSITION_PERCENT,
            tableYPercent: tableYPercent !== undefined ? tableYPercent : UI_CONFIG.DEFAULT_POSITION_PERCENT
        };
        this.zoneId = zoneId;
        this.isHighScore = isHighScore;
    }

    updatePosition(tableXPercent, tableYPercent) {
        this.position.tableXPercent = tableXPercent;
        this.position.tableYPercent = tableYPercent;
    }

    updateScore(points, isHighScore) {
        this.points = points;
        this.isHighScore = isHighScore;
    }

    updateZone(zoneId) {
        this.zoneId = zoneId;
    }
}

class RoundScore {
    constructor(red = 0, blue = 0) {
        this.red = red;
        this.blue = blue;
        this.winner = 'tie';
        this.pointDifference = 0;
        this.updateWinner();
    }

    updateWinner() {
        const diff = Math.abs(this.red - this.blue);
        this.pointDifference = diff;

        if (this.red > this.blue) {
            this.winner = 'red';
        } else if (this.blue > this.red) {
            this.winner = 'blue';
        } else {
            this.winner = 'tie';
        }
    }

    addPoints(playerId, points) {
        if (playerId === PLAYER_ID.RED) {
            this.red += points;
        } else if (playerId === PLAYER_ID.BLUE) {
            this.blue += points;
        }
        this.updateWinner();
    }
}

class Round {
    constructor(roundNumber, startingPlayerId, poksPerPlayer, tableOrientation = 'normal') {
        this.roundNumber = roundNumber;
        this.startingPlayerId = startingPlayerId;
        this.currentPlayerId = startingPlayerId;
        this.poksPlaced = [];
        this.redPoksRemaining = poksPerPlayer;
        this.bluePoksRemaining = poksPerPlayer;
        this.scores = new RoundScore(0, 0);
        this.isComplete = false;
        this.lastPlacedPokId = null;
        this.tableOrientation = tableOrientation;
    }

    addPok(pok) {
        this.poksPlaced.push(pok);
        this.scores.addPoints(pok.playerId, pok.points);
        this.decrementPoksRemaining(pok.playerId);
        this.lastPlacedPokId = pok.id;
    }

    removePok(pokId) {
        const index = this.poksPlaced.findIndex(p => p.id === pokId);
        if (index === -1) return null;

        const pok = this.poksPlaced[index];
        this.scores.addPoints(pok.playerId, -pok.points);
        this.incrementPoksRemaining(pok.playerId);
        this.poksPlaced.splice(index, 1);

        if (pokId === this.lastPlacedPokId) {
            // Set lastPlacedPokId to the new last POK in the array (undo behavior)
            this.lastPlacedPokId = this.poksPlaced.length > 0
                ? this.poksPlaced[this.poksPlaced.length - 1].id
                : null;
        }

        return pok;
    }

    getPokById(pokId) {
        return this.poksPlaced.find(p => p.id === pokId);
    }

    decrementPoksRemaining(playerId) {
        if (playerId === PLAYER_ID.RED) {
            this.redPoksRemaining--;
        } else if (playerId === PLAYER_ID.BLUE) {
            this.bluePoksRemaining--;
        }
    }

    incrementPoksRemaining(playerId) {
        if (playerId === PLAYER_ID.RED) {
            this.redPoksRemaining++;
        } else if (playerId === PLAYER_ID.BLUE) {
            this.bluePoksRemaining++;
        }
    }

    isRoundComplete() {
        return this.redPoksRemaining === 0 && this.bluePoksRemaining === 0;
    }

    recalculateScores() {
        // Reset scores to zero
        this.scores.red = 0;
        this.scores.blue = 0;

        // Sum up all pok scores
        this.poksPlaced.forEach(pok => {
            console.log(`Recalculating: Pok ${pok.id} (${pok.playerId}) has ${pok.points} points`);
            if (pok.playerId === PLAYER_ID.RED) {
                this.scores.red += pok.points;
            } else if (pok.playerId === PLAYER_ID.BLUE) {
                this.scores.blue += pok.points;
            }
        });

        console.log(`Recalculated scores: Red=${this.scores.red}, Blue=${this.scores.blue}`);

        // Update winner and point difference
        this.scores.updateWinner();
    }

    switchPlayer() {
        if (this.redPoksRemaining === 0 && this.bluePoksRemaining > 0) {
            this.currentPlayerId = PLAYER_ID.BLUE;
        } else if (this.bluePoksRemaining === 0 && this.redPoksRemaining > 0) {
            this.currentPlayerId = PLAYER_ID.RED;
        } else if (this.redPoksRemaining > 0 && this.bluePoksRemaining > 0) {
            if (this.scores.red < this.scores.blue) {
                this.currentPlayerId = PLAYER_ID.RED;
            } else if (this.scores.blue < this.scores.red) {
                this.currentPlayerId = PLAYER_ID.BLUE;
            } else {
                this.currentPlayerId = this.currentPlayerId === PLAYER_ID.RED ? PLAYER_ID.BLUE : PLAYER_ID.RED;
            }
        }
    }
}

class Game {
    constructor() {
        this.isStarted = false;
        this.winningScore = GAME_CONFIG.WINNING_SCORE;
        this.poksPerPlayer = GAME_CONFIG.POKS_PER_PLAYER;
        this.players = {
            red: new Player(PLAYER_ID.RED),
            blue: new Player(PLAYER_ID.BLUE)
        };
        this.rounds = [];
        this.currentRoundIndex = -1;
    }

    startNewGame(startingPlayerId) {
        this.isStarted = true;
        const round = new Round(GAME_CONFIG.INITIAL_ROUND_NUMBER, startingPlayerId, this.poksPerPlayer);
        this.rounds.push(round);
        this.currentRoundIndex = GAME_CONFIG.INITIAL_ROUND_NUMBER;
    }

    getCurrentRound() {
        if (this.currentRoundIndex === -1) return null;
        return this.rounds[this.currentRoundIndex];
    }

    startNewRound(startingPlayerId, tableOrientation = 'normal') {
        const newRoundNumber = this.rounds.length;
        const round = new Round(newRoundNumber, startingPlayerId, this.poksPerPlayer, tableOrientation);
        this.rounds.push(round);
        this.currentRoundIndex = newRoundNumber;
    }

    reset() {
        this.isStarted = false;
        this.players.red.resetScore();
        this.players.blue.resetScore();
        this.rounds = [];
        this.currentRoundIndex = -1;
    }

    hasWinner() {
        return this.players.red.totalScore >= this.winningScore ||
                this.players.blue.totalScore >= this.winningScore;
    }
}

class UIState {
    constructor() {
        this.lowScoreZoneThresholdPx = UI_CONFIG.BOUNDARY_THRESHOLD_PX;
        this.autoEndDelayMs = UI_CONFIG.AUTO_END_ROUND_DELAY_MS;
        this.draggedPokId = null;
        this.isTouchDragging = false;
        this.autoEndTimeout = null;
        this.historyRestoreTimeout = null;
        this.historyFadeInTimeout = null;
        this.countdownInterval = null;
        this.countdownEndTime = null;
        // Track the period when round is complete but result modal hasn't been shown yet
        // During this time: countdown is shown, new POKs can't be placed, but POKs can be moved/edited
        this.isRoundEnding = false;
        this.domElements = {
            startSelector: null,
            nextPlayer: null,
            tableContainer: null,
            mainRedTotal: null,
            mainBlueTotal: null,
            redRound: null,
            blueRound: null,
            roundModal: null,
            modalWinner: null,
            modalRoundScores: null,
            modalTotalScores: null
        };
        this.pokElements = new Map();
    }

    initDOMCache() {
        const dom = this.domElements;
        dom.startSelector = document.getElementById('gameStartSelector');
        dom.nextPlayer = document.getElementById('nextPlayerIndicator');
        dom.tableContainer = document.getElementById('gameBoardContainer');
        dom.mainRedTotal = document.getElementById('totalScoreRed');
        dom.mainBlueTotal = document.getElementById('totalScoreBlue');
        dom.redRound = document.getElementById('currentRoundScoreRed');
        dom.blueRound = document.getElementById('currentRoundScoreBlue');
        dom.roundModal = document.getElementById('roundEndModal');
        dom.modalWinner = document.getElementById('roundEndModalWinner');
        dom.modalRoundScores = document.getElementById('roundEndModalRoundScores');
        dom.modalTotalScores = document.getElementById('roundEndModalTotalScores');
    }

    clearAutoEndTimer() {
        if (this.autoEndTimeout) {
            clearTimeout(this.autoEndTimeout);
            this.autoEndTimeout = null;
        }
    }

    setAutoEndTimer(delay, callback) {
        this.clearAutoEndTimer();
        this.countdownEndTime = Date.now() + delay;
        this.autoEndTimeout = setTimeout(callback, delay);
    }

    clearCountdownInterval() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdownEndTime = null;
    }

    setCountdownInterval(callback) {
        this.clearCountdownInterval();
        this.countdownInterval = setInterval(callback, 100); // Update every 100ms for smooth countdown
    }

    clearHistoryRestoreTimer() {
        if (this.historyRestoreTimeout) {
            clearTimeout(this.historyRestoreTimeout);
            this.historyRestoreTimeout = null;
        }
    }

    setHistoryRestoreTimer(delay, callback) {
        this.clearHistoryRestoreTimer();
        this.historyRestoreTimeout = setTimeout(callback, delay);
    }

    clearHistoryFadeInTimer() {
        if (this.historyFadeInTimeout) {
            clearTimeout(this.historyFadeInTimeout);
            this.historyFadeInTimeout = null;
        }
    }

    setHistoryFadeInTimer(delay, callback) {
        this.clearHistoryFadeInTimer();
        this.historyFadeInTimeout = setTimeout(callback, delay);
    }

    clearPokElements() {
        this.pokElements.clear();
    }

    getPokElement(pokId) {
        return this.pokElements.get(pokId);
    }

    setPokElement(pokId, element) {
        this.pokElements.set(pokId, element);
    }

    deletePokElement(pokId) {
        this.pokElements.delete(pokId);
    }
}

// ============================================
// Event Processor & Orchestrator
// ============================================

class EventProcessor {
    constructor(game, eventLog, stateMachine, services) {
        this.game = game;
        this.eventLog = eventLog;
        this.stateMachine = stateMachine;
        this.services = services;
    }

    process(event) {
        this.eventLog.record(event);

        const result = this.applyEvent(event);
        if (!result.success) {
            console.warn(`Event ${event.type} failed:`, result.reason);
            return result;
        }

        return result;
    }

    applyEvent(event) {
        switch(event.type) {
            case EVENT_TYPES.GAME_STARTED:
                return this.handleGameStarted(event);
            case EVENT_TYPES.POK_PLACED:
                return this.handlePokPlaced(event);
            case EVENT_TYPES.POK_MOVED:
                return this.handlePokMoved(event);
            case EVENT_TYPES.POK_REMOVED:
                return this.handlePokRemoved(event);
            case EVENT_TYPES.PLAYER_SWITCHED:
                return this.handlePlayerSwitched(event);
            case EVENT_TYPES.ROUND_ENDED:
                return this.handleRoundEnded(event);
            case EVENT_TYPES.ROUND_STARTED:
                return this.handleRoundStarted(event);
            case EVENT_TYPES.GAME_RESET:
                return this.handleGameReset(event);
            default:
                return { success: true };
        }
    }

    handleGameStarted(event) {
        this.stateMachine.transition('GAME_STARTED');
        this.stateMachine.transition('PLAYER_TURN');
        return { success: true };
    }

    handlePokPlaced(event) {
        const round = this.game.getCurrentRound();
        if (round.isRoundComplete()) {
            this.stateMachine.transition('ROUND_COMPLETE');
        } else {
            this.stateMachine.transition('POK_PLACED');
        }
        return { success: true };
    }

    handlePokMoved(event) {
        return { success: true };
    }

    handlePokRemoved(event) {
        return { success: true };
    }

    handlePlayerSwitched(event) {
        if (this.stateMachine.getState() !== 'ROUND_COMPLETE') {
            this.stateMachine.transition('PLAYER_TURN');
        }
        return { success: true };
    }

    handleRoundEnded(event) {
        this.stateMachine.transition('ROUND_ENDED');
        if (event.data.gameComplete) {
            this.stateMachine.transition('GAME_COMPLETE');
        }
        return { success: true };
    }

    handleRoundStarted(event) {
        this.stateMachine.transition('PLAYER_TURN');
        return { success: true };
    }

    handleGameReset(event) {
        this.stateMachine.transition('GAME_NOT_STARTED');
        return { success: true };
    }
}

class GameOrchestrator {
    constructor() {
        this.game = new Game();
        this.eventLog = new EventLog();
        this.stateMachine = new GameStateMachine();

        this.services = {
            rules: new RulesEngine(),
            scoring: new ScoringService(),
            pok: new PokService(),
            ui: new UIService(),
            persistence: new PersistenceService()
        };

        this.eventProcessor = new EventProcessor(
            this.game,
            this.eventLog,
            this.stateMachine,
            this.services
        );

        this.uiState = new UIState();
    }

    init() {
        this.services.ui.init();
        this.uiState.initDOMCache();

        // Set the table element reference for POK positioning
        const tableElement = document.querySelector('.table');
        if (tableElement) {
            this.services.pok.setTableElement(tableElement);
        }

        this.loadSavedGame();
        this.setupHistoryHoverHandlers();
    }

    setupHistoryHoverHandlers() {
        const historyTableBody = document.getElementById('roundsHistoryTableBody');
        if (!historyTableBody) return;

        // Use event delegation for dynamically created rows
        historyTableBody.addEventListener('mouseenter', (event) => {
            const row = event.target.closest('tr');
            if (row && row.dataset.roundIndex !== undefined) {
                const roundIndex = parseInt(row.dataset.roundIndex);
                this.previewHistoricalRound(roundIndex);
            }
        }, true);

        historyTableBody.addEventListener('mouseleave', (event) => {
            const row = event.target.closest('tr');
            if (row && row.dataset.roundIndex !== undefined) {
                const roundIndex = parseInt(row.dataset.roundIndex);
                // Don't restore if leaving the current round (it was never changed)
                if (roundIndex !== this.game.currentRoundIndex) {
                    // Set a timer before restoring the current round
                    this.uiState.setHistoryRestoreTimer(
                        UI_CONFIG.HISTORY_RESTORE_DELAY_MS,
                        () => this.restoreCurrentRound()
                    );
                }
            }
        }, true);
    }

    previewHistoricalRound(roundIndex) {
        if (!this.game.isStarted || roundIndex < 0 || roundIndex >= this.game.rounds.length) {
            return;
        }

        // Don't reload if hovering over the current round
        if (roundIndex === this.game.currentRoundIndex) {
            return;
        }

        // Clear any pending timers when entering a new historical round
        this.uiState.clearHistoryRestoreTimer();
        this.uiState.clearHistoryFadeInTimer();

        const historicalRound = this.game.rounds[roundIndex];

        // Add fade-out class to all poks
        document.querySelectorAll('.pok').forEach(pok => {
            pok.classList.add('historical-fade-out');
        });

        // Wait for fade-out to complete, then apply table orientation and display POKs
        setTimeout(() => {
            // Apply the table orientation first (while POKs are invisible)
            this.applyTableOrientation(historicalRound.tableOrientation);

            // Then display the historical round POKs
            this.services.ui.displayHistoricalRound(historicalRound, this.services.pok, this.uiState);
        }, 200); // Match CSS fade-out transition time
    }

    restoreCurrentRound() {
        if (!this.game.isStarted) return;

        const currentRound = this.game.getCurrentRound();
        if (!currentRound) return;

        // Add fade-out class to all poks
        document.querySelectorAll('.pok').forEach(pok => {
            pok.classList.add('historical-fade-out');
        });

        // Wait for fade-out to complete, then restore current round
        setTimeout(() => {
            // Apply table orientation first (while POKs are invisible)
            this.applyTableOrientation(currentRound.tableOrientation);

            // Clear all existing POKs
            document.querySelectorAll('.pok').forEach(pok => pok.remove());

            // Restore current round POKs with fade-in
            this.restorePokElements(currentRound, true);
        }, 200); // Match CSS transition time
    }

    loadSavedGame() {
        const savedState = this.services.persistence.loadGameState();
        if (!savedState || !savedState.isStarted) {
            this.services.ui.hideContinueButton();
            return;
        }

        // Show continue button on the start selector
        this.services.ui.showContinueButton();
    }

    continueLastGame() {
        const savedState = this.services.persistence.loadGameState();
        if (savedState && savedState.isStarted) {
            this.services.ui.hideContinueButton();
            this.services.ui.hideStartSelector();
            this.restoreGameFromState(savedState);
        }
    }

    restoreGameFromState(savedState) {
        // Restore game state
        this.game.isStarted = savedState.isStarted;
        this.game.players.red.totalScore = savedState.players.red.totalScore;
        this.game.players.blue.totalScore = savedState.players.blue.totalScore;
        this.game.currentRoundIndex = savedState.currentRoundIndex;
        this.services.pok.pokIdCounter = savedState.pokIdCounter;

        // Restore rounds
        this.game.rounds = savedState.rounds.map(roundData => {
            const round = new Round(
                roundData.roundNumber,
                roundData.startingPlayerId,
                this.game.poksPerPlayer,
                roundData.tableOrientation || 'normal'
            );

            round.currentPlayerId = roundData.currentPlayerId;
            round.redPoksRemaining = roundData.redPoksRemaining;
            round.bluePoksRemaining = roundData.bluePoksRemaining;
            round.isComplete = roundData.isComplete;
            round.lastPlacedPokId = roundData.lastPlacedPokId;

            round.scores.red = roundData.scores.red;
            round.scores.blue = roundData.scores.blue;
            round.scores.winner = roundData.scores.winner;
            round.scores.pointDifference = roundData.scores.pointDifference;

            // Restore poks
            round.poksPlaced = roundData.poksPlaced.map(pokData => {
                // Handle both old format (x, y, xPercent, yPercent) and new format (tableXPercent, tableYPercent)
                const tableXPercent = pokData.position.tableXPercent !== undefined
                    ? pokData.position.tableXPercent
                    : pokData.position.xPercent;
                const tableYPercent = pokData.position.tableYPercent !== undefined
                    ? pokData.position.tableYPercent
                    : pokData.position.yPercent;

                return new Pok(
                    pokData.id,
                    pokData.playerId,
                    pokData.points,
                    tableXPercent,
                    tableYPercent,
                    pokData.zoneId,
                    pokData.isHighScore
                );
            });

            return round;
        });

        // Update UI and state machine
        this.stateMachine.setState('PLAYER_TURN');
        this.services.ui.hideStartSelector();
        this.services.ui.updateScores(this.game);

        const currentRound = this.game.getCurrentRound();
        if (currentRound) {
            // Check if the current round is complete - if so, start a new round
            if (currentRound.isComplete) {
                // Check if game should end
                if (this.services.rules.shouldEndGame(this.game)) {
                    this.resetGame();
                    return;
                }

                // Clear the board and start a new round
                const nextStarter = this.services.rules.getRoundStarter(currentRound);
                this.services.pok.clearAllPokElements();
                this.game.startNewRound(nextStarter);

                const newRound = this.game.getCurrentRound();
                this.services.ui.updateCurrentPlayer(newRound);
                this.services.ui.updateScores(this.game);
                this.applyTableOrientation(newRound.tableOrientation);
                this.saveGameState();
            } else {
                // Round is in progress, restore POKs and player state
                // Recalculate the next player using the rules engine
                const nextPlayer = this.services.rules.getNextPlayer(currentRound);
                currentRound.currentPlayerId = nextPlayer;
                this.services.ui.updateCurrentPlayer(currentRound);
                this.applyTableOrientation(currentRound.tableOrientation);
                this.restorePokElements(currentRound, true); // Fade in POKs when loading
            }
        }
    }

    restorePokElements(round, fadeIn = false) {
        round.poksPlaced.forEach(pok => {
            const pokElement = this.services.pok.createPokElement(pok);

            // If fadeIn is requested, start invisible
            if (fadeIn) {
                pokElement.classList.add('fade-ready');
            }

            this.services.pok.attachPokToTable(pokElement);
            this.services.pok.setPokElement(pok.id, pokElement);
            this.setupPokHandlers(pokElement, pok.id);

            // Highlight last placed pok
            if (pok.id === round.lastPlacedPokId) {
                this.services.pok.highlightAsLastPlaced(pokElement);
            }
        });

        // Trigger fade-in animation for all POKs at once after a small delay
        if (fadeIn) {
            setTimeout(() => {
                round.poksPlaced.forEach(pok => {
                    const pokElement = this.services.pok.getPokElement(pok.id);
                    if (pokElement) {
                        pokElement.classList.remove('fade-ready');
                        pokElement.classList.add('historical-fade-in');
                    }
                });
            }, 10);
        }
    }

    saveGameState() {
        if (this.game.isStarted) {
            this.services.persistence.saveGameState(this.game, this);
        }
    }

    startGame(startingPlayerId) {
        // Clear any previous saved game state when starting a new game
        this.services.persistence.clearGameState();

        this.game.startNewGame(startingPlayerId);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.GAME_STARTED, {
            startingPlayer: startingPlayerId
        }));

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.ROUND_STARTED, {
            roundNumber: GAME_CONFIG.INITIAL_ROUND_NUMBER,
            startingPlayer: startingPlayerId
        }));

        this.services.ui.hideStartSelector();
        this.services.ui.hideContinueButton();
        this.services.ui.updateScores(this.game);
        this.services.ui.updateCurrentPlayer(this.game.getCurrentRound());

        // Apply initial table orientation (normal)
        const currentRound = this.game.getCurrentRound();
        if (currentRound) {
            this.applyTableOrientation(currentRound.tableOrientation);
        }

        this.saveGameState();
    }

    placePok(event) {
        const round = this.game.getCurrentRound();
        if (!round) return;

        // Prevent placing POKs when round is ending
        if (this.uiState.isRoundEnding) {
            return;
        }

        if (!this.services.rules.canPlacePok(round, round.currentPlayerId)) {
            return;
        }

        // Get table-relative position from event
        const position = this.services.pok.calculateTablePositionFromEvent(event);

        // Determine zone and score from position
        const scoreResult = this.services.scoring.getZoneAtPosition(position.tableXPercent, position.tableYPercent);

        const pok = this.services.pok.createPok(
            round.currentPlayerId,
            scoreResult.points,
            position.tableXPercent,
            position.tableYPercent,
            scoreResult.zoneId,
            scoreResult.isHigh
        );

        round.addPok(pok);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.POK_PLACED, {
            pokId: pok.id,
            playerId: pok.playerId,
            zoneId: pok.zoneId,
            position: { tableXPercent: position.tableXPercent, tableYPercent: position.tableYPercent },
            points: pok.points,
            isHighScore: pok.isHighScore,
            roundNumber: round.roundNumber,
            redPoksRemaining: round.redPoksRemaining,
            bluePoksRemaining: round.bluePoksRemaining
        }));

        const pokElement = this.services.pok.createPokElement(pok);
        this.services.pok.attachPokToTable(pokElement);
        this.services.pok.setPokElement(pok.id, pokElement);
        this.setupPokHandlers(pokElement, pok.id);
        this.services.pok.highlightAsLastPlaced(pokElement);

        this.services.ui.updateScores(this.game);
        this.saveGameState();

        if (round.isRoundComplete()) {
            this.startRoundEndCountdown();
            return;
        }

        this.switchPlayer();
    }

    movePok(pokId, dropEvent) {
        const round = this.game.getCurrentRound();
        if (!round) return;

        const pok = round.getPokById(pokId);
        const pokElement = this.services.pok.getPokElement(pokId);
        if (!pok || !pokElement) return;

        this.uiState.clearAutoEndTimer();

        // Get table-relative position from event
        const position = this.services.pok.calculateTablePositionFromEvent(dropEvent);

        // Determine zone and score from position
        const scoreResult = this.services.scoring.getZoneAtPosition(position.tableXPercent, position.tableYPercent);

        // Store old values for event logging
        const oldPosition = { tableXPercent: pok.position.tableXPercent, tableYPercent: pok.position.tableYPercent };
        const oldPoints = pok.points;
        const oldZoneId = pok.zoneId;

        // Clear any boundary highlights when dropping
        this.services.ui.clearAllZoneBoundaryHighlights();

        // Update POK data
        console.log(`Moving pok ${pokId}: old points=${oldPoints}, new points=${scoreResult.points}`);
        pok.updatePosition(position.tableXPercent, position.tableYPercent);
        pok.updateScore(scoreResult.points, scoreResult.isHigh);
        pok.updateZone(scoreResult.zoneId);
        console.log(`After update, pok.points=${pok.points}`);

        // Update POK element visuals (position is already on table, just update style)
        pokElement.style.left = `${position.tableXPercent}%`;
        pokElement.style.top = `${position.tableYPercent}%`;
        pokElement.style.transform = 'translate(-50%, -50%)';
        pokElement.textContent = scoreResult.points;

        // Update low-score visual indicator
        if (scoreResult.isHigh) {
            pokElement.classList.remove('low-score');
        } else {
            pokElement.classList.add('low-score');
        }

        // Recalculate round scores from all placed poks
        round.recalculateScores();

        // Log the move event
        this.eventProcessor.process(new GameEvent(EVENT_TYPES.POK_MOVED, {
            pokId: pok.id,
            playerId: pok.playerId,
            fromZone: oldZoneId,
            toZone: scoreResult.zoneId,
            oldPosition: oldPosition,
            newPosition: { tableXPercent: position.tableXPercent, tableYPercent: position.tableYPercent },
            oldPoints: oldPoints,
            newPoints: scoreResult.points,
            roundNumber: round.roundNumber
        }));

        // Update UI
        this.services.ui.updateScores(this.game);
        this.saveGameState();

        // Check if round is complete
        if (round.isRoundComplete()) {
            this.startRoundEndCountdown();
        }
    }

    startRoundEndCountdown() {
        const round = this.game.getCurrentRound();
        if (!round || !round.isRoundComplete()) return;

        // Enter the "round ending" state:
        // - Countdown notification is shown with time remaining
        // - New POKs cannot be placed (clicks on zones are blocked)
        // - POKs can still be dragged and repositioned (allows final edits)
        // - Timer resets if any edits are made (moving/removing POKs)
        this.uiState.isRoundEnding = true;

        // Prevent new POK placement but allow drag-and-drop
        this.services.ui.disableZoneInteractions();

        // Set the auto-end timer
        this.uiState.setAutoEndTimer(this.uiState.autoEndDelayMs, () => this.endRound());

        // Start the countdown display
        this.updateCountdownDisplay();
        this.uiState.setCountdownInterval(() => this.updateCountdownDisplay());
    }

    updateCountdownDisplay() {
        if (!this.uiState.countdownEndTime) return;

        const remaining = (this.uiState.countdownEndTime - Date.now()) / 1000;

        if (remaining <= 0) {
            this.uiState.clearCountdownInterval();
            return;
        }

        this.services.ui.showRoundCompleteNotification(remaining);
    }

    stopRoundEndCountdown() {
        // Exit the "round ending" state - called when:
        // - User edits the board (drag/remove POK) - allows more time for edits
        // - Round actually ends and modal is shown
        // - New round starts or game resets
        this.uiState.isRoundEnding = false;
        this.uiState.clearAutoEndTimer();
        this.uiState.clearCountdownInterval();
        this.services.ui.hideRoundCompleteNotification();
        this.services.ui.enableZoneInteractions();
    }

    handleTableDragOver(event) {
        event.preventDefault();

        if (!this.uiState.draggedPokId) return;

        // Get table-relative position
        const position = this.services.pok.calculateTablePositionFromEvent(event);

        // Get zone and score from position
        const scoreResult = this.services.scoring.getZoneAtPosition(position.tableXPercent, position.tableYPercent);

        // Clear all highlights first
        this.services.ui.clearAllZoneBoundaryHighlights();

        // Highlight the boundary zone if position is near boundary
        if (scoreResult.boundaryZone) {
            const boundaryZoneElement = this.services.scoring.getZoneElement(scoreResult.boundaryZone);
            if (boundaryZoneElement) {
                this.services.ui.highlightZoneBoundary(boundaryZoneElement);
            }
        }
    }

    handleTableMouseMove(event) {
        // Don't show hover highlight if we're dragging a pok
        if (this.uiState.draggedPokId) return;

        // Get table-relative position
        const position = this.services.pok.calculateTablePositionFromEvent(event);

        // Get zone and score from position
        const scoreResult = this.services.scoring.getZoneAtPosition(position.tableXPercent, position.tableYPercent);

        // Clear all highlights first
        this.services.ui.clearAllZoneBoundaryHighlights();

        // Highlight the boundary zone if position is near boundary
        if (scoreResult.boundaryZone) {
            const boundaryZoneElement = this.services.scoring.getZoneElement(scoreResult.boundaryZone);
            if (boundaryZoneElement) {
                this.services.ui.highlightZoneBoundary(boundaryZoneElement);
            }
        }
    }

    handleTableMouseLeave() {
        // Don't clear if we're dragging a pok (let dragover handle it)
        if (this.uiState.draggedPokId) return;

        this.services.ui.clearAllZoneBoundaryHighlights();
    }

    switchPlayer() {
        const round = this.game.getCurrentRound();
        if (!round) return;

        const previousPlayer = round.currentPlayerId;
        const nextPlayer = this.services.rules.getNextPlayer(round);
        round.currentPlayerId = nextPlayer;

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.PLAYER_SWITCHED, {
            from: previousPlayer,
            to: nextPlayer,
            roundNumber: round.roundNumber,
            redScore: round.scores.red,
            blueScore: round.scores.blue
        }));

        this.services.ui.updateCurrentPlayer(round);
        this.services.ui.showPlayerTurnNotification(nextPlayer);
    }

    removePok(pokId) {
        this.stopRoundEndCountdown();

        const round = this.game.getCurrentRound();
        if (!round) return;

        const pok = round.removePok(pokId);
        if (!pok) return;

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.POK_REMOVED, {
            pokId: pok.id,
            playerId: pok.playerId,
            zoneId: pok.zoneId,
            points: pok.points,
            roundNumber: round.roundNumber
        }));

        this.services.pok.removePokElement(pokId);

        // Highlight the new last placed POK (undo behavior)
        if (round.lastPlacedPokId) {
            const lastPokElement = this.services.pok.getPokElement(round.lastPlacedPokId);
            if (lastPokElement) {
                this.services.pok.highlightAsLastPlaced(lastPokElement);
            }
        } else {
            this.services.pok.clearLastPlacedHighlight();
        }

        if (round.redPoksRemaining > 0 || round.bluePoksRemaining > 0) {
            round.currentPlayerId = pok.playerId;
            this.services.ui.updateCurrentPlayer(round);
        }
        this.services.ui.updateScores(this.game);
        this.saveGameState();
    }

    endRound() {
        const round = this.game.getCurrentRound();
        if (!round) return;

        // Clear countdown when ending round
        this.stopRoundEndCountdown();

        if (!round.isRoundComplete()) {
            if (!confirm('Not all poks have been placed. Continue anyway?')) {
                return;
            }
        }

        round.isComplete = true;

        const result = this.services.rules.calculateRoundWinner(round);
        let roundWinner = result.winner;
        const difference = result.pointsEarned;

        let winnerText = '';
        let bgClass = '';

        if (result.winner === PLAYER_ID.RED) {
            this.game.players.red.addScore(difference);
            winnerText = `${PLAYER_NAME[PLAYER_ID.RED]} Wins!`;
            bgClass = PLAYER_BG_CLASS[PLAYER_ID.RED];
        } else if (result.winner === PLAYER_ID.BLUE) {
            this.game.players.blue.addScore(difference);
            winnerText = `${PLAYER_NAME[PLAYER_ID.BLUE]} Wins!`;
            bgClass = PLAYER_BG_CLASS[PLAYER_ID.BLUE];
        } else {
            winnerText = 'Round Tied!';
            bgClass = PLAYER_BG_CLASS.TIE;
            roundWinner = round.startingPlayerId === PLAYER_ID.RED ? PLAYER_ID.BLUE : PLAYER_ID.RED;
        }

        this.services.ui.updateScores(this.game);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.ROUND_ENDED, {
            roundNumber: round.roundNumber,
            redScore: round.scores.red,
            blueScore: round.scores.blue,
            winner: roundWinner,
            pointsEarned: difference,
            redTotalScore: this.game.players.red.totalScore,
            blueTotalScore: this.game.players.blue.totalScore,
            gameComplete: this.services.rules.shouldEndGame(this.game)
        }));

        if (this.services.rules.shouldEndGame(this.game)) {
            if (this.game.players.red.totalScore >= this.game.winningScore) {
                winnerText = `${PLAYER_NAME[PLAYER_ID.RED]} Wins the Game!`;
            } else {
                winnerText = `${PLAYER_NAME[PLAYER_ID.BLUE]} Wins the Game!`;
            }
        }

        this.services.ui.showRoundModal(
            winnerText,
            round.scores.red,
            round.scores.blue,
            this.game.players.red.totalScore,
            this.game.players.blue.totalScore,
            bgClass,
            round.roundNumber
        );

        this.services.ui.updateRoundsHistory(this.game);

        round.currentPlayerId = roundWinner;
        this.saveGameState();
    }

    continueToNextRound() {
        this.services.ui.hideRoundModal();

        if (this.services.rules.shouldEndGame(this.game)) {
            this.resetGame();
            return;
        }

        this.startNewRound();
    }

    startNewRound() {
        this.stopRoundEndCountdown();

        const prevRound = this.game.getCurrentRound();
        if (!prevRound) return;

        const nextStarter = this.services.rules.getRoundStarter(prevRound);

        // Alternate table orientation
        const nextOrientation = prevRound.tableOrientation === 'normal' ? 'flipped' : 'normal';

        this.services.pok.clearAllPokElements();

        this.game.startNewRound(nextStarter, nextOrientation);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.ROUND_STARTED, {
            roundNumber: this.game.rounds.length - 1,
            startingPlayer: nextStarter
        }));

        const newRound = this.game.getCurrentRound();
        this.services.ui.updateScores(this.game);
        this.services.ui.updateCurrentPlayer(newRound);
        this.applyTableOrientation(newRound.tableOrientation);
        this.saveGameState();
    }

    resetGame() {
        this.stopRoundEndCountdown();

        this.services.pok.reset();

        this.game.reset();

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.GAME_RESET, {
            totalEvents: this.eventLog.events.length
        }));

        this.eventLog.printSummary();

        this.services.ui.showStartSelector();

        // Show continue button if there's a saved game to restore
        if (this.services.persistence.hasGameState()) {
            this.services.ui.showContinueButton();
        }

        document.body.classList.remove(PLAYER_CLASS[PLAYER_ID.RED], PLAYER_CLASS[PLAYER_ID.BLUE]);

        this.services.ui.updateScores(this.game);
        this.services.ui.clearRoundsHistory();

        // Don't clear saved state here - keep it so user can restore if they change their mind
        // It will be cleared when they start a new game
    }

    flipTable() {
        const round = this.game.getCurrentRound();
        if (!round) return;

        // Toggle orientation
        round.tableOrientation = round.tableOrientation === 'normal' ? 'flipped' : 'normal';

        // Update UI
        this.applyTableOrientation(round.tableOrientation);
        this.saveGameState();
    }

    applyTableOrientation(orientation) {
        const tableContainer = document.getElementById('gameBoardContainer');
        if (!tableContainer) return;

        if (orientation === 'flipped') {
            tableContainer.classList.add('flipped');
        } else {
            tableContainer.classList.remove('flipped');
        }
    }

    handlePokClick(pokId) {
        // Single source of truth for pok click/tap behavior
        const round = this.game.getCurrentRound();
        if (round && pokId === round.lastPlacedPokId) {
            this.removePok(pokId);
        }
    }

    handlePokDragStart(pokId) {
        this.uiState.draggedPokId = pokId;
        this.uiState.isTouchDragging = true;

        // Stop the countdown when dragging starts (allows final edits after game finishes)
        this.stopRoundEndCountdown();
    }

    handlePokDragEnd() {
        this.uiState.draggedPokId = null;
        // Delay clearing the flag to prevent zone touchend from firing
        setTimeout(() => {
            this.uiState.isTouchDragging = false;
        }, UI_CONFIG.TOUCH_DRAG_COOLDOWN_MS);
    }

    handlePokDragMove(touch) {
        // Create a synthetic event for boundary highlighting
        const syntheticEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        this.handleTableDragOver(syntheticEvent);
    }

    handlePokDrop(pokId, touch) {
        // Create a synthetic event for the drop with proper touch structure
        const syntheticEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            changedTouches: [touch],
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        this.movePok(pokId, syntheticEvent);
        this.services.ui.clearAllZoneBoundaryHighlights();
    }

    setupPokHandlers(pokElement, pokId) {
        // Desktop click handler
        pokElement.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePokClick(pokId);
        };

        // Desktop drag and touch handlers
        this.services.pok.makePokDraggable(pokElement, {
            onDragStart: () => this.handlePokDragStart(pokId),
            onDragEnd: () => this.handlePokDragEnd(),
            onTouchMove: (touch) => this.handlePokDragMove(touch),
            onTouchDrop: (touch) => this.handlePokDrop(pokId, touch),
            onTap: () => this.handlePokClick(pokId)
        });
    }
}

// ============================================
// Global State
// ============================================

let orchestrator = new GameOrchestrator();

// ============================================
// Initialization
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => orchestrator.init());
} else {
    orchestrator.init();
}

// ============================================
// Global Functions (HTML Event Handlers)
// ============================================

function startGame(startingPlayerId) {
    orchestrator.startGame(startingPlayerId);
}

function placePok(event) {
    // Prevent default to avoid double-firing on touch devices
    if (event.type === 'touchend') {
        event.preventDefault();
        // Don't place a new POK if we were just dragging one
        if (orchestrator.uiState.isTouchDragging) {
            return;
        }
    }
    orchestrator.placePok(event);
}

function handleTableDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!orchestrator.uiState.draggedPokId) return;

    orchestrator.movePok(orchestrator.uiState.draggedPokId, event);
}

function handleTableDragOver(event) {
    orchestrator.handleTableDragOver(event);
}

function handleTableMouseMove(event) {
    orchestrator.handleTableMouseMove(event);
}

function handleTableMouseLeave(event) {
    orchestrator.handleTableMouseLeave(event);
}

function continueToNextRound() {
    orchestrator.continueToNextRound();
}

function confirmNewGame() {
    orchestrator.resetGame();
}

function continueLastGame() {
    orchestrator.continueLastGame();
}

function flipTable() {
    orchestrator.flipTable();
}

function scrollToScoreDisplay(event) {
    // Only respond if the round-complete notification is showing
    const notification = event.target;
    if (notification.classList.contains('round-complete')) {
        // Stop the countdown and immediately end the round
        orchestrator.stopRoundEndCountdown();
        orchestrator.endRound();
    }
}

