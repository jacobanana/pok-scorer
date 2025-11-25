// ============================================
// GAME STATE PROJECTION (Calculated State)
// ============================================
// This projection calculates state on-demand from events rather than caching.
// Benefits:
// - State always matches event log (no synchronization issues)
// - Pure functions (no mutations)
// - True time-travel debugging
// - Simpler to reason about

import { CONFIG } from './config.js';
import { ScoringService } from './scoring-service.js';

export class GameStateProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        // NO cached state - we calculate on demand!
    }

    initState() {
        return {
            isStarted: false,
            players: {
                red: { totalScore: 0 },
                blue: { totalScore: 0 }
            },
            rounds: [],
            currentRoundIndex: -1,
            isFlipped: false
        };
    }

    // Calculate state from all events (pure function)
    calculateStateFromEvents(events) {
        let state = this.initState();

        for (const event of events) {
            state = this.applyEventToState(state, event);
        }

        return state;
    }

    // Pure function: (state, event) → new state
    applyEventToState(state, event) {
        switch (event.type) {
            case 'GAME_STARTED':
                return this.applyGameStarted(state, event);
            case 'POK_PLACED':
                return this.applyPokPlaced(state, event);
            case 'POK_MOVED':
                return this.applyPokMoved(state, event);
            case 'POK_REMOVED':
                return this.applyPokRemoved(state, event);
            case 'ROUND_ENDED':
                return this.applyRoundEnded(state, event);
            case 'ROUND_STARTED':
                return this.applyRoundStarted(state, event);
            case 'TABLE_FLIPPED':
                return this.applyTableFlipped(state, event);
            case 'GAME_RESET':
                return this.initState();
            default:
                return state;
        }
    }

    // Pure event handlers (return new state, no mutations)

    applyGameStarted(state, event) {
        const newRound = {
            roundNumber: 0,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null,
            isFlipped: state.isFlipped
        };

        return {
            ...state,
            isStarted: true,
            rounds: [...state.rounds, newRound],
            currentRoundIndex: 0
        };
    }

    applyPokPlaced(state, event) {
        if (state.currentRoundIndex === -1) return state;

        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound) return state;

        // Calculate derived data from position
        const zoneInfo = ScoringService.getZoneInfo(event.data.x, event.data.y, currentRound.isFlipped);

        const newPok = {
            id: event.data.pokId,
            playerId: event.data.playerId,
            x: event.data.x,
            y: event.data.y,
            zoneId: zoneInfo.zoneId,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        };

        const newRedRemaining = event.data.playerId === 'red'
            ? currentRound.redPoksRemaining - 1
            : currentRound.redPoksRemaining;

        const newBlueRemaining = event.data.playerId === 'blue'
            ? currentRound.bluePoksRemaining - 1
            : currentRound.bluePoksRemaining;

        const updatedRound = {
            ...currentRound,
            poks: [...currentRound.poks, newPok],
            redPoksRemaining: newRedRemaining,
            bluePoksRemaining: newBlueRemaining,
            currentPlayerId: event.data.playerId,
            lastPlacedPokId: event.data.pokId,
            isComplete: newRedRemaining === 0 && newBlueRemaining === 0
        };

        const newRounds = [...state.rounds];
        newRounds[state.currentRoundIndex] = updatedRound;

        return {
            ...state,
            rounds: newRounds
        };
    }

    applyPokMoved(state, event) {
        if (state.currentRoundIndex === -1) return state;

        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound) return state;

        const pokIndex = currentRound.poks.findIndex(p => p.id === event.data.pokId);
        if (pokIndex === -1) return state;

        const pok = currentRound.poks[pokIndex];

        // Recalculate derived data
        const zoneInfo = ScoringService.getZoneInfo(event.data.x, event.data.y, currentRound.isFlipped);

        const updatedPok = {
            ...pok,
            x: event.data.x,
            y: event.data.y,
            zoneId: zoneInfo.zoneId,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        };

        const newPoks = [...currentRound.poks];
        newPoks[pokIndex] = updatedPok;

        const updatedRound = {
            ...currentRound,
            poks: newPoks
        };

        const newRounds = [...state.rounds];
        newRounds[state.currentRoundIndex] = updatedRound;

        return {
            ...state,
            rounds: newRounds
        };
    }

    applyPokRemoved(state, event) {
        if (state.currentRoundIndex === -1) return state;

        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound) return state;

        const pokIndex = currentRound.poks.findIndex(p => p.id === event.data.pokId);
        if (pokIndex === -1) return state;

        const pok = currentRound.poks[pokIndex];

        // Remove pok from array (immutably)
        const newPoks = [
            ...currentRound.poks.slice(0, pokIndex),
            ...currentRound.poks.slice(pokIndex + 1)
        ];

        // Increment POKs remaining
        const newRedRemaining = pok.playerId === 'red'
            ? currentRound.redPoksRemaining + 1
            : currentRound.redPoksRemaining;

        const newBlueRemaining = pok.playerId === 'blue'
            ? currentRound.bluePoksRemaining + 1
            : currentRound.bluePoksRemaining;

        // Update last placed and current player
        let lastPlacedPokId = null;
        let currentPlayerId = currentRound.startingPlayerId;

        if (newPoks.length > 0) {
            const lastPok = newPoks[newPoks.length - 1];
            lastPlacedPokId = lastPok.id;
            currentPlayerId = lastPok.playerId;
        }

        const updatedRound = {
            ...currentRound,
            poks: newPoks,
            redPoksRemaining: newRedRemaining,
            bluePoksRemaining: newBlueRemaining,
            lastPlacedPokId,
            currentPlayerId,
            isComplete: false
        };

        const newRounds = [...state.rounds];
        newRounds[state.currentRoundIndex] = updatedRound;

        return {
            ...state,
            rounds: newRounds
        };
    }

    applyRoundEnded(state, event) {
        const redScore = event.data.redScore;
        const blueScore = event.data.blueScore;
        const diff = Math.abs(redScore - blueScore);

        let newRedTotal = state.players.red.totalScore;
        let newBlueTotal = state.players.blue.totalScore;

        if (redScore > blueScore) {
            newRedTotal += diff;
        } else if (blueScore > redScore) {
            newBlueTotal += diff;
        }
        // Tie: no points awarded

        return {
            ...state,
            players: {
                red: { totalScore: newRedTotal },
                blue: { totalScore: newBlueTotal }
            }
        };
    }

    applyRoundStarted(state, event) {
        const newRound = {
            roundNumber: event.data.roundNumber,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null,
            isFlipped: state.isFlipped
        };

        return {
            ...state,
            rounds: [...state.rounds, newRound],
            currentRoundIndex: event.data.roundNumber
        };
    }

    applyTableFlipped(state, event) {
        const newIsFlipped = event.data.isFlipped;

        // Update the current round's isFlipped state ONLY if it's not complete
        if (state.currentRoundIndex === -1) {
            return {
                ...state,
                isFlipped: newIsFlipped
            };
        }

        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound || currentRound.isComplete) {
            return {
                ...state,
                isFlipped: newIsFlipped
            };
        }

        // Recalculate all POK zones with the new flip state
        const updatedPoks = currentRound.poks.map(pok => {
            const zoneInfo = ScoringService.getZoneInfo(pok.x, pok.y, newIsFlipped);
            return {
                ...pok,
                zoneId: zoneInfo.zoneId,
                points: zoneInfo.points,
                isHigh: zoneInfo.isHigh,
                boundaryZone: zoneInfo.boundaryZone
            };
        });

        const updatedRound = {
            ...currentRound,
            isFlipped: newIsFlipped,
            poks: updatedPoks
        };

        const newRounds = [...state.rounds];
        newRounds[state.currentRoundIndex] = updatedRound;

        return {
            ...state,
            isFlipped: newIsFlipped,
            rounds: newRounds
        };
    }

    // Query methods - calculate state on demand

    getState() {
        return this.calculateStateFromEvents(this.eventStore.getAllEvents());
    }

    getCurrentRound() {
        const state = this.getState();
        if (state.currentRoundIndex === -1) return null;
        return state.rounds[state.currentRoundIndex];
    }

    getRoundScores() {
        const round = this.getCurrentRound();
        if (!round) return { red: 0, blue: 0 };

        const redScore = round.poks
            .filter(p => p.playerId === 'red')
            .reduce((sum, p) => sum + p.points, 0);

        const blueScore = round.poks
            .filter(p => p.playerId === 'blue')
            .reduce((sum, p) => sum + p.points, 0);

        return { red: redScore, blue: blueScore };
    }

    getNextPlayer() {
        const round = this.getCurrentRound();
        if (!round) return null;

        // If one player out of POKs, other continues
        if (round.redPoksRemaining === 0 && round.bluePoksRemaining > 0) {
            return 'blue';
        }
        if (round.bluePoksRemaining === 0 && round.redPoksRemaining > 0) {
            return 'red';
        }

        // Both have POKs: lower score goes first
        const scores = this.getRoundScores();
        if (scores.red < scores.blue) return 'red';
        if (scores.blue < scores.red) return 'blue';

        // Tied scores: if no POKs placed yet, start with starting player
        // Otherwise alternate from last player
        if (round.poks.length === 0) {
            return round.startingPlayerId;
        }

        // Tied: alternate
        return round.currentPlayerId === 'red' ? 'blue' : 'red';
    }

    hasWinner() {
        const state = this.getState();
        return state.players.red.totalScore >= CONFIG.WINNING_SCORE ||
               state.players.blue.totalScore >= CONFIG.WINNING_SCORE;
    }
}
