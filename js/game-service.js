// ============================================
// GAME SERVICE (Event-Sourced Game Logic)
// ============================================
// This service calculates game state on-demand from events rather than caching.
// Benefits:
// - State always matches event log (no synchronization issues)
// - Pure functions (no mutations)
// - True time-travel debugging
// - Simpler to reason about

import { CONFIG, PLAYERS } from './config.js';
import { ScoringService } from './scoring-service.js';

export class GameService {
    constructor(eventStore) {
        this.eventStore = eventStore;
        // NO cached state - we calculate on demand!
    }

    initState() {
        return {
            isStarted: false,
            players: {
                [PLAYERS.RED]: { totalScore: 0 },
                [PLAYERS.BLUE]: { totalScore: 0 }
            },
            playerNames: {
                [PLAYERS.RED]: PLAYERS.RED,
                [PLAYERS.BLUE]: PLAYERS.BLUE
            },
            rounds: [],
            currentRoundIndex: -1,
            isFlipped: false
        };
    }

    // Factory function to create a new round object
    createRound(roundNumber, startingPlayerId, isFlipped) {
        return {
            roundNumber,
            startingPlayerId,
            currentPlayerId: startingPlayerId,
            poks: [],
            lastPlacedPokId: null,
            isFlipped
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
        const newRound = this.createRound(0, event.data.startingPlayerId, state.isFlipped);

        return {
            ...state,
            isStarted: true,
            playerNames: {
                [PLAYERS.RED]: event.data.redName || PLAYERS.RED,
                [PLAYERS.BLUE]: event.data.blueName || PLAYERS.BLUE
            },
            rounds: [...state.rounds, newRound],
            currentRoundIndex: 0
        };
    }

    applyPokPlaced(state, event) {
        if (state.currentRoundIndex === -1) return state;

        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound) return state;

        const newPok = {
            id: event.data.pokId,
            playerId: event.data.playerId,
            x: event.data.x,
            y: event.data.y
        };

        const updatedRound = {
            ...currentRound,
            poks: [...currentRound.poks, newPok],
            currentPlayerId: event.data.playerId,
            lastPlacedPokId: event.data.pokId
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

        const updatedPok = {
            ...pok,
            x: event.data.x,
            y: event.data.y
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

        // Remove pok from array (immutably)
        const newPoks = [
            ...currentRound.poks.slice(0, pokIndex),
            ...currentRound.poks.slice(pokIndex + 1)
        ];

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
            lastPlacedPokId,
            currentPlayerId
        };

        const newRounds = [...state.rounds];
        newRounds[state.currentRoundIndex] = updatedRound;

        return {
            ...state,
            rounds: newRounds
        };
    }

    applyRoundEnded(state, event) {
        // Find the round that ended
        const round = state.rounds[event.data.roundNumber];
        if (!round) return state;

        // Calculate outcome from poks using ScoringService
        const outcome = ScoringService.calculateRoundOutcome(round.poks, round.isFlipped);

        return {
            ...state,
            players: {
                [PLAYERS.RED]: { totalScore: state.players[PLAYERS.RED].totalScore + outcome.redPointsAwarded },
                [PLAYERS.BLUE]: { totalScore: state.players[PLAYERS.BLUE].totalScore + outcome.bluePointsAwarded }
            }
        };
    }

    applyRoundStarted(state, event) {
        const newRound = this.createRound(
            event.data.roundNumber,
            event.data.startingPlayerId,
            state.isFlipped
        );

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
        if (!currentRound || this.isRoundComplete(currentRound)) {
            return {
                ...state,
                isFlipped: newIsFlipped
            };
        }

        // No need to recalculate POK zones - they will be calculated on-demand from x, y
        const updatedRound = {
            ...currentRound,
            isFlipped: newIsFlipped
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

    // Helper: Calculate zone info for a pok
    getPokZoneInfo(pok, isFlipped) {
        return ScoringService.getZoneInfo(pok.x, pok.y, isFlipped);
    }

    // Helper: Get POKs remaining for a player in a round
    getPoksRemaining(round, playerId) {
        const placed = round.poks.filter(p => p.playerId === playerId).length;
        return CONFIG.POKS_PER_PLAYER - placed;
    }

    // Helper: Check if round is complete
    isRoundComplete(round) {
        const redRemaining = this.getPoksRemaining(round, PLAYERS.RED);
        const blueRemaining = this.getPoksRemaining(round, PLAYERS.BLUE);
        return redRemaining === 0 && blueRemaining === 0;
    }

    getRoundScores(round = null) {
        const targetRound = round || this.getCurrentRound();
        if (!targetRound) return { red: 0, blue: 0 };

        const redScore = ScoringService.getPlayerScore(PLAYERS.RED, targetRound.poks, targetRound.isFlipped);
        const blueScore = ScoringService.getPlayerScore(PLAYERS.BLUE, targetRound.poks, targetRound.isFlipped);

        return { red: redScore, blue: blueScore };
    }

    getNextPlayer() {
        const round = this.getCurrentRound();
        if (!round) return null;

        const redRemaining = this.getPoksRemaining(round, PLAYERS.RED);
        const blueRemaining = this.getPoksRemaining(round, PLAYERS.BLUE);

        // If one player out of POKs, other continues
        if (redRemaining === 0 && blueRemaining > 0) {
            return PLAYERS.BLUE;
        }
        if (blueRemaining === 0 && redRemaining > 0) {
            return PLAYERS.RED;
        }

        // Both have POKs: lower score goes first
        const scores = this.getRoundScores(round);
        if (scores.red < scores.blue) return PLAYERS.RED;
        if (scores.blue < scores.red) return PLAYERS.BLUE;

        // Tied scores: if no POKs placed yet, start with starting player
        // Otherwise alternate from last player
        if (round.poks.length === 0) {
            return round.startingPlayerId;
        }

        // Tied: alternate
        return round.currentPlayerId === PLAYERS.RED ? PLAYERS.BLUE : PLAYERS.RED;
    }
}
