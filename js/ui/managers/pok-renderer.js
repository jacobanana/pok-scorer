// ============================================
// POK RENDERER
// Manages POK component lifecycle on the table
// ============================================

import { Pok } from '../../components/index.js';

/**
 * Manages the rendering and lifecycle of POK components
 */
export class PokRenderer {
    constructor(gameState, containers) {
        this.gameState = gameState;
        this.containers = containers;

        // POK components map (pokId -> Pok component)
        this.pokComponents = new Map();
    }

    /**
     * Get the POK components map (shared with InteractionManager)
     */
    getPokComponents() {
        return this.pokComponents;
    }

    /**
     * Handle POK_PLACED event
     */
    onPokPlaced(event) {
        const pok = this._findPok(event.data.pokId);
        if (!pok) return;

        // Check if POK already exists
        if (this.pokComponents.has(pok.id)) return;

        // Calculate zone info on-demand
        const round = this.gameState.getCurrentRound();
        const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);

        // Create POK component
        const pokComponent = new Pok({
            id: pok.id,
            playerId: pok.playerId,
            points: zoneInfo.points,
            x: pok.x,
            y: pok.y,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone,
            isLastPlaced: true
        });

        // Clear previous last-placed highlights
        this._clearLastPlacedHighlight();

        // Mount and track
        if (this.containers.table) {
            pokComponent.mount(this.containers.table);
        }
        this.pokComponents.set(pok.id, pokComponent);
    }

    /**
     * Handle POK_MOVED event
     */
    onPokMoved(event) {
        const pok = this._findPok(event.data.pokId);
        const pokComponent = this.pokComponents.get(event.data.pokId);

        if (!pok || !pokComponent) return;

        // Calculate zone info on-demand
        const round = this.gameState.getCurrentRound();
        const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);

        // Update component with new data
        pokComponent.updateFromData({
            x: pok.x,
            y: pok.y,
            points: zoneInfo.points,
            isHigh: zoneInfo.isHigh,
            boundaryZone: zoneInfo.boundaryZone
        });
    }

    /**
     * Handle POK_REMOVED event
     */
    onPokRemoved(event) {
        const pokComponent = this.pokComponents.get(event.data.pokId);
        if (!pokComponent) return;

        pokComponent.unmount();
        this.pokComponents.delete(event.data.pokId);

        // Highlight new last placed
        this._updateLastPlacedHighlight();
    }

    /**
     * Handle TABLE_FLIPPED event - update all POK zone info
     */
    onTableFlipped(isFlipped) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        round.poks.forEach(pok => {
            const pokComponent = this.pokComponents.get(pok.id);
            if (pokComponent) {
                const zoneInfo = this.gameState.getPokZoneInfo(pok, isFlipped);
                pokComponent.updateFromData({
                    points: zoneInfo.points,
                    isHigh: zoneInfo.isHigh,
                    boundaryZone: zoneInfo.boundaryZone
                });
            }
        });
    }

    /**
     * Render POKs for a specific round (used for preview)
     */
    renderRoundPoks(round) {
        this.clearTable();

        if (round && round.poks) {
            round.poks.forEach(pok => {
                const zoneInfo = this.gameState.getPokZoneInfo(pok, round.isFlipped);
                const pokComponent = new Pok({
                    id: pok.id,
                    playerId: pok.playerId,
                    points: zoneInfo.points,
                    x: pok.x,
                    y: pok.y,
                    isHigh: zoneInfo.isHigh,
                    boundaryZone: zoneInfo.boundaryZone
                });

                if (this.containers.table) {
                    pokComponent.mount(this.containers.table);
                }
                this.pokComponents.set(pok.id, pokComponent);
            });
        }
    }

    /**
     * Clear all POKs from the table
     */
    clearTable() {
        this.pokComponents.forEach(component => component.unmount());
        this.pokComponents.clear();
    }

    /**
     * Update last-placed POK highlight
     */
    updateLastPlacedHighlight() {
        this._updateLastPlacedHighlight();
    }

    /**
     * Find POK by ID in current round
     * @private
     */
    _findPok(pokId) {
        const round = this.gameState.getCurrentRound();
        if (!round) return null;
        return round.poks.find(p => p.id === pokId);
    }

    /**
     * Clear last-placed highlight from all POKs
     * @private
     */
    _clearLastPlacedHighlight() {
        this.pokComponents.forEach(component => {
            component.clearLastPlaced();
        });
    }

    /**
     * Update last-placed highlight to current last POK
     * @private
     */
    _updateLastPlacedHighlight() {
        this._clearLastPlacedHighlight();
        const round = this.gameState.getCurrentRound();
        if (round && round.lastPlacedPokId) {
            const lastComponent = this.pokComponents.get(round.lastPlacedPokId);
            lastComponent?.setLastPlaced();
        }
    }
}
