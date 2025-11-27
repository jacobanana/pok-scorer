// ============================================
// INTERACTION MANAGER
// Handles all user input: clicks, drags, touches
// ============================================

import { ScoringService } from '../../scoring-service.js';

/**
 * Manages all user interactions with the game table
 * Emits events: placePok, movePok, removePok
 */
export class InteractionManager {
    constructor(gameState, containers) {
        this.gameState = gameState;
        this.containers = containers;

        // Event handlers (set via setHandlers)
        this.handlers = {
            onPlacePok: null,
            onMovePok: null,
            onRemovePok: null
        };

        // Drag/drop state
        this.isDragging = false;
        this.draggedPokId = null;
        this._dragImage = null;

        // POK components map (shared reference from PokRenderer)
        this.pokComponents = null;

        // Edit mode - allows only pok movement, no placing/removing
        this.editMode = false;
        this.onExitEditMode = null;
    }

    /**
     * Set edit mode - only allow moving poks, not placing/removing
     * @param {boolean} enabled - Whether edit mode is enabled
     */
    setEditMode(enabled) {
        this.editMode = enabled;
    }

    /**
     * Set callback for exiting edit mode
     * @param {Function} callback - Callback to run when edit mode exits
     */
    setExitEditModeCallback(callback) {
        this.onExitEditMode = callback;
    }

    /**
     * Set the POK components map (shared with PokRenderer)
     */
    setPokComponents(pokComponents) {
        this.pokComponents = pokComponents;
    }

    /**
     * Register event handlers
     */
    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    }

    /**
     * Initialize all interaction handlers
     */
    init() {
        this._setupClickToPlace();
        this._setupDragAndDrop();
        this._setupTouchEvents();
        this._setupBoundaryHighlight();
    }

    /**
     * Set up click-to-place POK functionality
     * @private
     */
    _setupClickToPlace() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        tableContainer.addEventListener('click', (event) => {
            if (this.isDragging) return;

            // Don't place POK if we clicked on an existing POK element
            if (event.target.classList.contains('pok')) {
                return;
            }

            // In edit mode, clicking anywhere (except on poks) exits edit mode
            if (this.editMode) {
                this.onExitEditMode?.();
                return;
            }

            const round = this.gameState.getCurrentRound();
            if (!round || this.gameState.isRoundComplete(round)) return;

            const pos = this._calculateTablePosition(event);
            this.handlers.onPlacePok?.(pos.x, pos.y);
        });
    }

    /**
     * Set up drag and drop for POKs
     * @private
     */
    _setupDragAndDrop() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        // Drag start
        tableContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('pok')) {
                this.isDragging = true;
                this.draggedPokId = this._findPokIdByElement(e.target);
                e.target.classList.add('dragging');

                // Create a custom drag image (clone positioned off-screen)
                this._dragImage = e.target.cloneNode(true);
                this._dragImage.style.opacity = '0.8';
                this._dragImage.style.position = 'absolute';
                this._dragImage.style.top = '-1000px';
                document.body.appendChild(this._dragImage);
                e.dataTransfer.setDragImage(this._dragImage,
                    e.target.offsetWidth / 2,
                    e.target.offsetHeight / 2);

                e.dataTransfer.effectAllowed = 'move';
            }
        });

        // Drag end
        tableContainer.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('pok')) {
                e.target.classList.remove('dragging');
                this.isDragging = false;
                this.draggedPokId = null;

                // Clean up drag image
                this._dragImage?.remove();
                this._dragImage = null;

                // Clear boundary highlights
                this._clearBoundaryHighlights();
            }
        });

        // Drag over
        tableContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move'; // Show move cursor, not copy

            // Show boundary highlighting while dragging
            if (this.isDragging) {
                const pos = this._calculateTablePosition(e);
                this._highlightBoundaryZone(pos.x, pos.y);
            }
        });

        // Drop
        tableContainer.addEventListener('drop', (e) => {
            e.preventDefault();

            if (this.draggedPokId) {
                const pos = this._calculateTablePosition(e);
                this.handlers.onMovePok?.(this.draggedPokId, pos.x, pos.y);
            }
        });

        // Click on POK (undo) - only allow clicking on last-placed POK (not in edit mode)
        tableContainer.addEventListener('click', (e) => {
            // Don't allow removing poks in edit mode
            if (this.editMode) return;

            if (e.target.classList.contains('pok') && e.target.classList.contains('last-placed')) {
                e.stopPropagation(); // Prevent placePok from firing
                const pokId = this._findPokIdByElement(e.target);
                this.handlers.onRemovePok?.(pokId);
            }
        });
    }

    /**
     * Set up touch events for mobile
     * @private
     */
    _setupTouchEvents() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        let touchStartPos = null;
        let touchedPokId = null;
        let touchedElement = null;
        let hasMoved = false;

        tableContainer.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.pok');
            if (target) {
                e.preventDefault();
                touchedPokId = this._findPokIdByElement(target);
                touchedElement = target;
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });

        tableContainer.addEventListener('touchmove', (e) => {
            if (touchedPokId && touchedElement) {
                e.preventDefault();

                const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);

                if (dx > 5 || dy > 5) {
                    hasMoved = true;
                    this.isDragging = true;
                    touchedElement.classList.add('dragging');

                    // Update POK visual position during drag
                    const pos = this._calculateTablePosition(e.touches[0]);
                    touchedElement.style.left = `${pos.x}%`;
                    touchedElement.style.top = `${pos.y}%`;

                    // Show boundary zone highlighting
                    this._highlightBoundaryZone(pos.x, pos.y);
                }
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (touchedPokId) {
                e.preventDefault();

                if (hasMoved) {
                    // Drag: move POK to final position
                    const pos = this._calculateTablePosition(e.changedTouches[0]);
                    touchedElement.classList.remove('dragging');
                    this.handlers.onMovePok?.(touchedPokId, pos.x, pos.y);
                } else if (!this.editMode) {
                    // Tap: undo if last placed (not in edit mode)
                    const target = e.target.closest('.pok');
                    if (target && target.classList.contains('last-placed')) {
                        e.stopPropagation(); // Prevent placePok from firing
                        this.handlers.onRemovePok?.(touchedPokId);
                    }
                }

                // Clear boundary highlights
                this._clearBoundaryHighlights();

                touchedPokId = null;
                touchedElement = null;
                touchStartPos = null;
                hasMoved = false;
                this.isDragging = false;
            }
        }, { passive: false });
    }

    /**
     * Set up boundary zone highlighting on mouse move
     * @private
     */
    _setupBoundaryHighlight() {
        const tableContainer = this.containers.gameBoard;
        if (!tableContainer) return;

        tableContainer.addEventListener('mousemove', (e) => {
            // Don't show boundary highlight if dragging (handled in dragover)
            if (this.isDragging) return;

            // Don't show boundary highlight if clicking on existing POK
            if (e.target.classList.contains('pok')) return;

            const round = this.gameState.getCurrentRound();
            if (!round || round.isComplete) return;

            // Calculate position
            const pos = this._calculateTablePosition(e);

            // Highlight boundary zone
            this._highlightBoundaryZone(pos.x, pos.y);
        });

        tableContainer.addEventListener('mouseleave', () => {
            // Remove all boundary highlights when mouse leaves table
            this._clearBoundaryHighlights();
        });
    }

    /**
     * Highlight the boundary zone at a given position
     * @private
     */
    _highlightBoundaryZone(x, y) {
        const round = this.gameState.getCurrentRound();
        if (!round) return;

        const isFlipped = round.isFlipped;
        const zoneInfo = ScoringService.getZoneInfo(x, y, isFlipped);

        const zones = document.querySelectorAll('.zone, .circle-zone');
        zones.forEach(zone => {
            const zoneId = zone.getAttribute('data-zone');
            zone.classList.remove('boundary-highlight');

            if (zoneInfo.boundaryZone && zoneId === zoneInfo.boundaryZone) {
                zone.classList.add('boundary-highlight');
            }
        });
    }

    /**
     * Clear all boundary zone highlights
     * @private
     */
    _clearBoundaryHighlights() {
        const zones = document.querySelectorAll('.zone, .circle-zone');
        zones.forEach(zone => {
            zone.classList.remove('boundary-highlight');
        });
    }

    /**
     * Calculate table position from event
     * @private
     */
    _calculateTablePosition(event) {
        const tableElement = this.containers.table;
        if (!tableElement) return { x: 0, y: 0 };

        const rect = tableElement.getBoundingClientRect();

        const clientX = event.clientX !== undefined ? event.clientX : event.changedTouches?.[0]?.clientX;
        const clientY = event.clientY !== undefined ? event.clientY : event.changedTouches?.[0]?.clientY;

        let x = clientX - rect.left;
        const y = clientY - rect.top;

        // Account for table flip
        const state = this.gameState.getState();
        if (state.isFlipped) {
            x = rect.width - x;
        }

        return {
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100
        };
    }

    /**
     * Find POK ID by DOM element
     * @private
     */
    _findPokIdByElement(element) {
        // Find pokId by matching position (hacky but works)
        const left = parseFloat(element.style.left);
        const top = parseFloat(element.style.top);

        const round = this.gameState.getCurrentRound();
        if (!round) return null;

        const pok = round.poks.find(p =>
            Math.abs(p.x - left) < 0.1 && Math.abs(p.y - top) < 0.1
        );

        return pok?.id;
    }

    /**
     * Reset drag state (useful for cleanup)
     */
    reset() {
        this.isDragging = false;
        this.draggedPokId = null;
        this._dragImage?.remove();
        this._dragImage = null;
    }
}
