// ============================================
// AUTO-END MANAGER
// Manages auto-end countdown for completed rounds
// ============================================

import { CONFIG } from '../../config.js';

/**
 * Manages the auto-end countdown timer for rounds
 */
export class AutoEndManager {
    constructor(eventStore, gameState, components) {
        this.eventStore = eventStore;
        this.gameState = gameState;
        this.components = components;

        // Auto-end timer state
        this._autoEndTimer = null;

        // Loading state (to prevent auto-end timers during event replay)
        this.isLoading = false;

        // DOM reference for end round button
        this.endRoundButton = null;

        // Event handler
        this.handlers = {
            onAutoEndRound: null
        };
    }

    /**
     * Set event handlers
     */
    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    }

    /**
     * Initialize the end round button
     */
    initEndRoundButton() {
        this.endRoundButton = document.getElementById('endRoundButton');
        if (this.endRoundButton) {
            this.endRoundButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._handleEndRoundClick();
            });
        }
    }

    /**
     * Handle end round button click
     * @private
     */
    _handleEndRoundClick() {
        if (this.hasAutoEndTimer()) {
            this.clearAutoEndTimer();
            this.handlers.onAutoEndRound?.();
        }
    }

    /**
     * Show the end round button
     * @private
     */
    _showEndRoundButton() {
        if (this.endRoundButton) {
            this.endRoundButton.classList.add('show');
        }
    }

    /**
     * Hide the end round button
     * @private
     */
    _hideEndRoundButton() {
        if (this.endRoundButton) {
            this.endRoundButton.classList.remove('show');
        }
    }

    /**
     * Subscribe to events that affect auto-end timer
     */
    subscribeToEvents() {
        // Check round completion after any event (except ROUND_ENDED which already ended)
        this.eventStore.subscribe('*', (event) => {
            if (!this.isLoading && event.type !== 'ROUND_ENDED') {
                this.checkRoundComplete();
            }
        });

        // Reset countdown timer when a POK is moved during round completion
        this.eventStore.subscribe('POK_MOVED', () => {
            if (!this.isLoading && this.hasAutoEndTimer()) {
                // Clear and restart the countdown to allow adjustments
                this.clearAutoEndTimer();
                this.checkRoundComplete();
            }
        });

        // Handle game reset to clear auto-end timer and loading state
        this.eventStore.subscribe('GAME_RESET', () => {
            this.clearAutoEndTimer();
            this.isLoading = false;
        });

        // Handle game loaded to clear auto-end timers and check round state
        this.eventStore.subscribe('GAME_LOADED', () => {
            this.clearAutoEndTimer();
            this.isLoading = false;
            // Now that loading is complete, check if we need to start countdown
            this.checkRoundComplete();
        });
    }

    /**
     * Check if round is complete and start countdown if needed
     */
    checkRoundComplete() {
        const round = this.gameState.getCurrentRound();
        if (!round || !this.gameState.isRoundComplete(round)) {
            this.clearAutoEndTimer();
            return;
        }

        // Check if this round has already been ended (ROUND_ENDED event exists)
        const events = this.eventStore.getAllEvents();
        const roundAlreadyEnded = events.some(e =>
            e.type === 'ROUND_ENDED' && e.data.roundNumber === round.roundNumber
        );
        if (roundAlreadyEnded) {
            return; // Don't start countdown for already-ended round
        }

        // Round just completed: start countdown
        if (!this._autoEndTimer) {
            this.startAutoEndCountdown();
        }
    }

    /**
     * Start the auto-end countdown with loading bar animation
     */
    startAutoEndCountdown() {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        // Calculate winner for styling
        const scores = this.gameState.getRoundScores(round);

        const winnerClass = scores.red > scores.blue ? 'red-winner' :
                           scores.blue > scores.red ? 'blue-winner' : 'tie-game';

        // Show end round button
        this._showEndRoundButton();

        // Start loading bar animation
        const loadingBar = this.components.loadingBar;
        if (loadingBar) {
            loadingBar.setWinnerClass(winnerClass);
            loadingBar.props.duration = CONFIG.AUTO_END_DELAY_MS;
            loadingBar.start(() => {
                // Animation complete - trigger auto-end
                this._autoEndTimer = null;
                this._hideEndRoundButton();
                this.handlers.onAutoEndRound?.();
            });
            // Track that we've started (the LoadingBar handles its own timeout)
            this._autoEndTimer = true;
        }
    }

    /**
     * Clear the auto-end countdown timer
     */
    clearAutoEndTimer() {
        if (this._autoEndTimer) {
            this._autoEndTimer = null;
        }
        this._hideEndRoundButton();
        this.components.loadingBar?.reset();
    }

    /**
     * Check if auto-end timer is currently running
     * @returns {boolean}
     */
    hasAutoEndTimer() {
        return !!this._autoEndTimer;
    }

    /**
     * Set loading state (used during game load/import)
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
    }
}
