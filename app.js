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
    BOUNDARY_THRESHOLD_PX: 10,
    AUTO_END_ROUND_DELAY_MS: 1500,
    PLAYER_TURN_NOTIFICATION_DURATION_MS: 1000,
    DEFAULT_POSITION_PERCENT: 50
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
        this.boundaryThreshold = UI_CONFIG.BOUNDARY_THRESHOLD_PX;
    }

    calculateZoneScore(zone, clickPosition, zoneRect) {
        const low = parseInt(zone.dataset.low);
        const high = parseInt(zone.dataset.high);

        if (low === high) {
            return { points: high, isHigh: true };
        }

        const isCircularZone = zone.classList.contains('circle-zone');
        const isNearBoundary = isCircularZone
            ? this.isNearCircularBoundary(clickPosition, zoneRect)
            : this.isNearRectangularBoundary(clickPosition, zoneRect);

        return {
            points: isNearBoundary ? low : high,
            isHigh: !isNearBoundary
        };
    }

    isNearCircularBoundary(clickPosition, zoneRect) {
        const centerX = zoneRect.width / 2;
        const centerY = zoneRect.height / 2;
        const radius = zoneRect.width / 2;

        const dx = clickPosition.x - centerX;
        const dy = clickPosition.y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

        return distanceFromCenter >= radius - this.boundaryThreshold;
    }

    isNearRectangularBoundary(clickPosition, zoneRect) {
        return clickPosition.x >= zoneRect.width - this.boundaryThreshold;
    }
}

class PokService {
    constructor() {
        this.pokIdCounter = 0;
        this.pokElements = new Map();
    }

    generatePokId() {
        return `pok-${this.pokIdCounter++}`;
    }

    createPok(playerId, points, position, zoneId, isHighScore, zoneRect) {
        const pokId = this.generatePokId();
        const xPercent = zoneRect ? (position.x / zoneRect.width) * 100 : UI_CONFIG.DEFAULT_POSITION_PERCENT;
        const yPercent = zoneRect ? (position.y / zoneRect.height) * 100 : UI_CONFIG.DEFAULT_POSITION_PERCENT;
        const pok = new Pok(pokId, playerId, points, position.x, position.y, zoneId, isHighScore, xPercent, yPercent);
        return pok;
    }

    createPokElement(pok) {
        const el = document.createElement('div');
        el.className = `pok ${pok.playerId}`;
        if (!pok.isHighScore) {
            el.classList.add('low-score');
        }
        el.textContent = pok.points;
        el.style.left = `${pok.position.xPercent}%`;
        el.style.top = `${pok.position.yPercent}%`;
        el.style.transform = 'translate(-50%, -50%)';
        return el;
    }

    attachPokToZone(pokElement, zoneElement) {
        zoneElement.appendChild(pokElement);
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

    calculatePositionFromEvent(zone, event) {
        const rect = zone.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return {
            x,
            y,
            xPercent: (x / rect.width) * 100,
            yPercent: (y / rect.height) * 100,
            rect
        };
    }

    makePokDraggable(pokElement, callbacks) {
        pokElement.draggable = true;

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
                        x: pok.position.x,
                        y: pok.position.y,
                        xPercent: pok.position.xPercent,
                        yPercent: pok.position.yPercent
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

    showRoundModal(winnerText, redScore, blueScore, redTotal, blueTotal, bgClass) {
        this.domElements.modalWinner.textContent = winnerText;
        this.domElements.modalRoundScores.textContent = `Round: Red ${redScore} - Blue ${blueScore}`;
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
    constructor(id, playerId, points, x, y, zoneId, isHighScore, xPercent, yPercent) {
        this.id = id;
        this.playerId = playerId;
        this.points = points;
        this.position = {
            x,
            y,
            xPercent: xPercent !== undefined ? xPercent : UI_CONFIG.DEFAULT_POSITION_PERCENT,
            yPercent: yPercent !== undefined ? yPercent : UI_CONFIG.DEFAULT_POSITION_PERCENT
        };
        this.zoneId = zoneId;
        this.isHighScore = isHighScore;
    }

    updatePosition(x, y, xPercent, yPercent) {
        this.position.x = x;
        this.position.y = y;
        if (xPercent !== undefined) this.position.xPercent = xPercent;
        if (yPercent !== undefined) this.position.yPercent = yPercent;
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
    constructor(roundNumber, startingPlayerId, poksPerPlayer) {
        this.roundNumber = roundNumber;
        this.startingPlayerId = startingPlayerId;
        this.currentPlayerId = startingPlayerId;
        this.poksPlaced = [];
        this.redPoksRemaining = poksPerPlayer;
        this.bluePoksRemaining = poksPerPlayer;
        this.scores = new RoundScore(0, 0);
        this.isComplete = false;
        this.lastPlacedPokId = null;
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

    startNewRound(startingPlayerId) {
        const newRoundNumber = this.rounds.length;
        const round = new Round(newRoundNumber, startingPlayerId, this.poksPerPlayer);
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
        this.autoEndTimeout = null;
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
        this.autoEndTimeout = setTimeout(callback, delay);
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
        this.loadSavedGame();
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
                this.game.poksPerPlayer
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
                return new Pok(
                    pokData.id,
                    pokData.playerId,
                    pokData.points,
                    pokData.position.x,
                    pokData.position.y,
                    pokData.zoneId,
                    pokData.isHighScore,
                    pokData.position.xPercent,
                    pokData.position.yPercent
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
                this.saveGameState();
            } else {
                // Round is in progress, restore POKs and player state
                // Recalculate the next player using the rules engine
                const nextPlayer = this.services.rules.getNextPlayer(currentRound);
                currentRound.currentPlayerId = nextPlayer;
                this.services.ui.updateCurrentPlayer(currentRound);
                this.restorePokElements(currentRound);
            }
        }
    }

    restorePokElements(round) {
        round.poksPlaced.forEach(pok => {
            const zoneElement = document.querySelector(`[data-zone="${pok.zoneId}"]`) ||
                               document.getElementById(pok.zoneId);

            if (zoneElement) {
                const pokElement = this.services.pok.createPokElement(pok);
                this.services.pok.attachPokToZone(pokElement, zoneElement);
                this.services.pok.setPokElement(pok.id, pokElement);
                this.setupPokHandlers(pokElement, pok.id);

                // Highlight last placed pok
                if (pok.id === round.lastPlacedPokId) {
                    this.services.pok.highlightAsLastPlaced(pokElement);
                }
            }
        });
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
        this.saveGameState();
    }

    placePok(zone, clickPosition) {
        const round = this.game.getCurrentRound();
        if (!round) return;

        if (!this.services.rules.canPlacePok(round, round.currentPlayerId)) {
            return;
        }

        const positionData = this.services.pok.calculatePositionFromEvent(zone, clickPosition);
        const scoreResult = this.services.scoring.calculateZoneScore(zone, positionData, positionData.rect);
        const zoneId = zone.dataset.zone || zone.id;

        const pok = this.services.pok.createPok(
            round.currentPlayerId,
            scoreResult.points,
            positionData,
            zoneId,
            scoreResult.isHigh,
            positionData.rect
        );

        round.addPok(pok);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.POK_PLACED, {
            pokId: pok.id,
            playerId: pok.playerId,
            zoneId: pok.zoneId,
            position: { x: positionData.x, y: positionData.y },
            points: pok.points,
            isHighScore: pok.isHighScore,
            roundNumber: round.roundNumber,
            redPoksRemaining: round.redPoksRemaining,
            bluePoksRemaining: round.bluePoksRemaining
        }));

        const pokElement = this.services.pok.createPokElement(pok);
        this.services.pok.attachPokToZone(pokElement, zone);
        this.services.pok.setPokElement(pok.id, pokElement);
        this.setupPokHandlers(pokElement, pok.id);
        this.services.pok.highlightAsLastPlaced(pokElement);

        this.services.ui.updateScores(this.game);
        this.saveGameState();

        if (round.isRoundComplete()) {
            this.uiState.setAutoEndTimer(this.uiState.autoEndDelayMs, () => this.endRound());
            return;
        }

        this.switchPlayer();
    }

    movePok(pokId, targetZone, dropEvent) {
        const round = this.game.getCurrentRound();
        if (!round) return;

        const pok = round.getPokById(pokId);
        const pokElement = this.services.pok.getPokElement(pokId);
        if (!pok || !pokElement) return;

        this.uiState.clearAutoEndTimer();

        // Calculate new position and score
        const positionData = this.services.pok.calculatePositionFromEvent(targetZone, dropEvent);
        const scoreResult = this.services.scoring.calculateZoneScore(targetZone, positionData, positionData.rect);
        const zoneId = targetZone.dataset.zone || targetZone.id;

        // Store old values for event logging
        const oldPosition = { x: pok.position.x, y: pok.position.y };
        const oldPoints = pok.points;
        const oldZoneId = pok.zoneId;

        // Update POK data
        console.log(`Moving pok ${pokId}: old points=${oldPoints}, new points=${scoreResult.points}`);
        pok.updatePosition(positionData.x, positionData.y, positionData.xPercent, positionData.yPercent);
        pok.updateScore(scoreResult.points, scoreResult.isHigh);
        pok.updateZone(zoneId);
        console.log(`After update, pok.points=${pok.points}`);

        // Move POK element to new zone
        if (pokElement.parentElement !== targetZone) {
            targetZone.appendChild(pokElement);
        }

        // Update POK element visuals
        pokElement.style.left = `${positionData.xPercent}%`;
        pokElement.style.top = `${positionData.yPercent}%`;
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
            toZone: zoneId,
            oldPosition: oldPosition,
            newPosition: { x: positionData.x, y: positionData.y },
            oldPoints: oldPoints,
            newPoints: scoreResult.points,
            roundNumber: round.roundNumber
        }));

        // Update UI
        this.services.ui.updateScores(this.game);
        this.saveGameState();

        // Check if round is complete
        if (round.isRoundComplete()) {
            this.uiState.setAutoEndTimer(this.uiState.autoEndDelayMs, () => this.endRound());
        }
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
        this.uiState.clearAutoEndTimer();

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
            bgClass
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
        this.uiState.clearAutoEndTimer();

        const prevRound = this.game.getCurrentRound();
        if (!prevRound) return;

        const nextStarter = this.services.rules.getRoundStarter(prevRound);

        this.services.pok.clearAllPokElements();

        this.game.startNewRound(nextStarter);

        this.eventProcessor.process(new GameEvent(EVENT_TYPES.ROUND_STARTED, {
            roundNumber: this.game.rounds.length - 1,
            startingPlayer: nextStarter
        }));

        this.services.ui.updateScores(this.game);
        this.services.ui.updateCurrentPlayer(this.game.getCurrentRound());
        this.saveGameState();
    }

    resetGame() {
        this.uiState.clearAutoEndTimer();

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

    setupPokHandlers(pokElement, pokId) {
        pokElement.onclick = (e) => {
            e.stopPropagation();
            const round = this.game.getCurrentRound();
            if (round && pokId === round.lastPlacedPokId) {
                this.removePok(pokId);
            }
        };

        this.services.pok.makePokDraggable(pokElement, {
            onDragStart: () => {
                this.uiState.draggedPokId = pokId;
            },
            onDragEnd: () => {
                this.uiState.draggedPokId = null;
            }
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

function placePok(zone, event) {
    orchestrator.placePok(zone, event);
}

function handlePokDrop(event, targetZone) {
    event.preventDefault();
    event.stopPropagation();

    if (!orchestrator.uiState.draggedPokId) return;

    orchestrator.movePok(orchestrator.uiState.draggedPokId, targetZone, event);
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

