// ============================================
// GAME STATE PROJECTION
// ============================================

import { CONFIG } from './config.js';
import { ScoringService } from './scoring-service.js';

export class GameStateProjection {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.state = this.initState();

        // Subscribe to events
        eventStore.subscribe('*', (e) => this.apply(e));
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

    apply(event) {
        switch (event.type) {
            case 'GAME_STARTED':
                this.onGameStarted(event);
                break;
            case 'POK_PLACED':
                this.onPokPlaced(event);
                break;
            case 'POK_MOVED':
                this.onPokMoved(event);
                break;
            case 'POK_REMOVED':
                this.onPokRemoved(event);
                break;
            case 'ROUND_ENDED':
                this.onRoundEnded(event);
                break;
            case 'ROUND_STARTED':
                this.onRoundStarted(event);
                break;
            case 'TABLE_FLIPPED':
                this.onTableFlipped(event);
                break;
            case 'GAME_RESET':
                this.onGameReset(event);
                break;
        }
    }

    onGameStarted(event) {
        this.state.isStarted = true;
        this.state.rounds.push({
            roundNumber: 0,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null,
            isFlipped: this.state.isFlipped
        });
        this.state.currentRoundIndex = 0;
    }

    onPokPlaced(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        // Calculate derived data from position
        const zoneInfo = ScoringService.getZoneInfo(event.data.x, event.data.y);

        round.poks.push({
            id: event.data.pokId,
            playerId: event.data.playerId,
            x: event.data.x,
            y: event.data.y,
            zoneId: zoneInfo.zoneId,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        });

        // Decrement POKs remaining
        if (event.data.playerId === 'red') {
            round.redPoksRemaining--;
        } else {
            round.bluePoksRemaining--;
        }

        // Update current player to track who placed last
        round.currentPlayerId = event.data.playerId;
        round.lastPlacedPokId = event.data.pokId;

        // Mark complete if all POKs placed
        if (round.redPoksRemaining === 0 && round.bluePoksRemaining === 0) {
            round.isComplete = true;
        }
    }

    onPokMoved(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        const pok = round.poks.find(p => p.id === event.data.pokId);
        if (!pok) return;

        // Update position
        pok.x = event.data.x;
        pok.y = event.data.y;

        // Recalculate derived data
        const zoneInfo = ScoringService.getZoneInfo(pok.x, pok.y);
        pok.zoneId = zoneInfo.zoneId;
        pok.points = zoneInfo.points;
        pok.isHigh = zoneInfo.isHigh;
        pok.boundaryZone = zoneInfo.boundaryZone;
    }

    onPokRemoved(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        const index = round.poks.findIndex(p => p.id === event.data.pokId);
        if (index === -1) return;

        const pok = round.poks[index];
        round.poks.splice(index, 1);

        // Increment POKs remaining
        if (pok.playerId === 'red') {
            round.redPoksRemaining++;
        } else {
            round.bluePoksRemaining++;
        }

        // Update last placed and current player
        if (round.poks.length > 0) {
            round.lastPlacedPokId = round.poks[round.poks.length - 1].id;
            round.currentPlayerId = round.poks[round.poks.length - 1].playerId;
        } else {
            // No POKs left: reset to starting player
            round.lastPlacedPokId = null;
            round.currentPlayerId = round.startingPlayerId;
        }

        // Mark incomplete
        round.isComplete = false;
    }

    onRoundEnded(event) {
        const round = this.getCurrentRound();
        if (!round) return;

        // Calculate winner and points
        const redScore = event.data.redScore;
        const blueScore = event.data.blueScore;
        const diff = Math.abs(redScore - blueScore);

        if (redScore > blueScore) {
            this.state.players.red.totalScore += diff;
        } else if (blueScore > redScore) {
            this.state.players.blue.totalScore += diff;
        }
        // Tie: no points awarded
    }

    onRoundStarted(event) {
        this.state.rounds.push({
            roundNumber: event.data.roundNumber,
            startingPlayerId: event.data.startingPlayerId,
            currentPlayerId: event.data.startingPlayerId,
            poks: [],
            redPoksRemaining: CONFIG.POKS_PER_PLAYER,
            bluePoksRemaining: CONFIG.POKS_PER_PLAYER,
            isComplete: false,
            lastPlacedPokId: null,
            isFlipped: this.state.isFlipped
        });
        this.state.currentRoundIndex = event.data.roundNumber;
    }

    onTableFlipped(event) {
        this.state.isFlipped = event.data.isFlipped;
    }

    onGameReset(event) {
        this.state = this.initState();
    }

    // Query methods
    getState() {
        return this.state;
    }

    getCurrentRound() {
        if (this.state.currentRoundIndex === -1) return null;
        return this.state.rounds[this.state.currentRoundIndex];
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
        return this.state.players.red.totalScore >= CONFIG.WINNING_SCORE ||
               this.state.players.blue.totalScore >= CONFIG.WINNING_SCORE;
    }
}
