// ============================================
// COMMAND HANDLERS
// ============================================

import {
    GameStartedEvent,
    PokPlacedEvent,
    PokMovedEvent,
    PokRemovedEvent,
    RoundEndedEvent,
    RoundStartedEvent,
    TableFlippedEvent,
    GameResetEvent
} from './events.js';

export class CommandHandler {
    constructor(eventStore, gameStateProjection) {
        this.eventStore = eventStore;
        this.gameState = gameStateProjection;
        this.pokIdCounter = 0;
    }

    startGame(startingPlayerId) {
        const state = this.gameState.getState();
        if (state.isStarted) {
            throw new Error('Game already started');
        }

        this.eventStore.append(new GameStartedEvent(startingPlayerId));
    }

    placePok(playerId, x, y) {
        const round = this.gameState.getCurrentRound();
        if (!round) {
            throw new Error('No active round');
        }

        if (round.isComplete) {
            throw new Error('Round is complete');
        }

        // Check if player has POKs remaining
        const poksRemaining = playerId === 'red'
            ? round.redPoksRemaining
            : round.bluePoksRemaining;

        if (poksRemaining === 0) {
            throw new Error('No POKs remaining for player');
        }

        // Check if it's the correct player's turn
        const nextPlayer = this.gameState.getNextPlayer();
        if (playerId !== nextPlayer) {
            throw new Error(`Not ${playerId}'s turn`);
        }

        const pokId = `pok-${this.pokIdCounter++}`;
        this.eventStore.append(new PokPlacedEvent(pokId, playerId, x, y));
    }

    movePok(pokId, newX, newY) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        const pok = round.poks.find(p => p.id === pokId);
        if (!pok) return;

        this.eventStore.append(new PokMovedEvent(pokId, newX, newY));
    }

    removePok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        // Only allow removing last placed POK
        if (pokId !== round.lastPlacedPokId) {
            throw new Error('Can only remove last placed POK');
        }

        this.eventStore.append(new PokRemovedEvent(pokId));
    }

    endRound() {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        if (!round.isComplete) {
            throw new Error('Round not complete');
        }

        const scores = this.gameState.getRoundScores();
        this.eventStore.append(new RoundEndedEvent(
            round.roundNumber,
            scores.red,
            scores.blue
        ));
    }

    startNextRound() {
        const state = this.gameState.getState();
        const prevRound = this.gameState.getCurrentRound();

        if (!prevRound || !prevRound.isComplete) {
            throw new Error('Cannot start next round');
        }

        // Determine starter: winner of previous round, or alternate if tie
        const scores = this.gameState.getRoundScores();
        let starter;
        if (scores.red > scores.blue) {
            starter = 'red';
        } else if (scores.blue > scores.red) {
            starter = 'blue';
        } else {
            // Tie: alternate
            starter = prevRound.startingPlayerId === 'red' ? 'blue' : 'red';
        }

        // Start the next round first (inherits current flip state)
        const nextRoundNumber = state.rounds.length;
        this.eventStore.append(new RoundStartedEvent(nextRoundNumber, starter));

        // Then flip the table for the new round
        this.eventStore.append(new TableFlippedEvent(!state.isFlipped));
    }

    flipTable(isFlipped) {
        this.eventStore.append(new TableFlippedEvent(isFlipped));
    }

    resetGame() {
        // Clear all events and localStorage to completely reset the game
        this.eventStore.clear();
        localStorage.removeItem('pok-event-store');

        // Manually trigger a special reset event that won't be stored
        // This allows projections to reset their state properly
        this.eventStore.publish(new GameResetEvent());
    }
}
