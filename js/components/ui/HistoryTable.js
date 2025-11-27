import { Component } from '../core/Component.js';
import { PLAYERS } from '../../config.js';

/**
 * HistoryTable component - Rounds history table
 *
 * Events emitted:
 * - 'rowHover' - When mouse enters a row, detail: { index }
 * - 'rowLeave' - When mouse leaves a row
 *
 * Props:
 * - id: string - Table ID
 * - bodyId: string - Table body ID
 * - redHeaderId: string - Red header ID
 * - blueHeaderId: string - Blue header ID
 * - redPlayerName: string - Red player display name
 * - bluePlayerName: string - Blue player display name
 */
export class HistoryTable extends Component {
    template() {
        const {
            id,
            bodyId,
            redHeaderId,
            blueHeaderId,
            redPlayerName = PLAYERS.RED,
            bluePlayerName = PLAYERS.BLUE
        } = this.props;

        const tableId = id ? `id="${id}"` : '';
        const tbodyId = bodyId ? `id="${bodyId}"` : '';
        const redHdrId = redHeaderId ? `id="${redHeaderId}"` : '';
        const blueHdrId = blueHeaderId ? `id="${blueHeaderId}"` : '';

        return `
            <table ${tableId}>
                <thead>
                    <tr>
                        <th>#</th>
                        <th ${redHdrId}>${redPlayerName}</th>
                        <th ${blueHdrId}>${bluePlayerName}</th>
                        <th>Winner</th>
                        <th>Diff</th>
                    </tr>
                </thead>
                <tbody ${tbodyId}></tbody>
            </table>
        `.trim();
    }

    /**
     * Get the table body element
     * @returns {HTMLTableSectionElement|null}
     */
    getBody() {
        return this.find('tbody');
    }

    /**
     * Update player name headers
     * @param {string} redName
     * @param {string} blueName
     * @returns {HistoryTable} this for chaining
     */
    setPlayerNames(redName, blueName) {
        const redHeader = this.find(`#${this.props.redHeaderId}`) || this.findAll('th')[1];
        const blueHeader = this.find(`#${this.props.blueHeaderId}`) || this.findAll('th')[2];

        if (redHeader) redHeader.textContent = redName;
        if (blueHeader) blueHeader.textContent = blueName;

        this.props.redPlayerName = redName;
        this.props.bluePlayerName = blueName;

        return this;
    }

    /**
     * Update rounds data and re-render table body
     * @param {Array} rounds - Array of round data objects
     * @param {Function} calculateScores - Function to calculate scores for a round
     * @param {Function} isRoundComplete - Function to check if round is complete
     * @returns {HistoryTable} this for chaining
     */
    setRounds(rounds, calculateScores, isRoundComplete = null) {
        const tbody = this.getBody();
        if (!tbody) return this;

        tbody.innerHTML = '';
        this.props.rounds = rounds;

        rounds.forEach((round, index) => {
            const row = this._createRow(round, index, calculateScores, isRoundComplete);
            tbody.appendChild(row);
        });

        return this;
    }

    /**
     * Create a table row for a round
     * @private
     */
    _createRow(round, index, calculateScores, isRoundComplete = null) {
        const scores = calculateScores ? calculateScores(round) : { red: 0, blue: 0 };
        const isComplete = isRoundComplete ? isRoundComplete(round) : (round.isComplete ?? false);
        const winner = this._determineWinner(scores, isComplete);
        const diff = isComplete ? Math.abs(scores.red - scores.blue) : '-';

        const row = document.createElement('tr');
        row.className = this._getRowClass(isComplete, winner);
        row.dataset.roundIndex = index;

        // Determine winner cell class
        const winnerClass = winner ? `winner-${winner}` : (isComplete ? '' : 'winner-current');

        row.innerHTML = `
            <td class="round-number">${index + 1}</td>
            <td>${scores.red}</td>
            <td>${scores.blue}</td>
            <td class="${winnerClass}">${winner ? winner.charAt(0).toUpperCase() + winner.slice(1) : '-'}</td>
            <td>${diff}</td>
        `;

        // Emit events on hover
        row.addEventListener('mouseenter', () => this.emit('rowHover', { index }));
        row.addEventListener('mouseleave', () => this.emit('rowLeave'));

        return row;
    }

    /**
     * Determine the winner from scores
     * @private
     */
    _determineWinner(scores, isComplete) {
        if (!isComplete) return null;
        if (scores.red > scores.blue) return PLAYERS.RED;
        if (scores.blue > scores.red) return PLAYERS.BLUE;
        return 'tie';
    }

    /**
     * Get CSS class for a row
     * @private
     */
    _getRowClass(isComplete, winner) {
        const classes = [];

        if (!isComplete) {
            classes.push('round-row-current');
        } else if (winner === PLAYERS.RED) {
            classes.push('red-round-row');
        } else if (winner === PLAYERS.BLUE) {
            classes.push('blue-round-row');
        } else {
            classes.push('tie-round-row');
        }

        return classes.join(' ');
    }

    /**
     * Add a new round row
     * @param {Object} round - Round data
     * @param {number} index - Round index
     * @param {Function} calculateScores - Score calculation function
     * @param {Function} isRoundComplete - Function to check if round is complete
     * @returns {HistoryTable} this for chaining
     */
    addRound(round, index, calculateScores, isRoundComplete = null) {
        const tbody = this.getBody();
        if (!tbody) return this;

        const row = this._createRow(round, index, calculateScores, isRoundComplete);
        tbody.appendChild(row);

        return this;
    }

    /**
     * Update a specific round row
     * @param {number} index - Round index
     * @param {Object} round - Round data
     * @param {Function} calculateScores - Score calculation function
     * @param {Function} isRoundComplete - Function to check if round is complete
     * @returns {HistoryTable} this for chaining
     */
    updateRound(index, round, calculateScores, isRoundComplete = null) {
        const tbody = this.getBody();
        if (!tbody) return this;

        const existingRow = tbody.querySelector(`tr[data-round-index="${index}"]`);
        const newRow = this._createRow(round, index, calculateScores, isRoundComplete);

        if (existingRow) {
            existingRow.replaceWith(newRow);
        } else {
            tbody.appendChild(newRow);
        }

        return this;
    }

    /**
     * Clear all rounds
     * @returns {HistoryTable} this for chaining
     */
    clearRounds() {
        const tbody = this.getBody();
        if (tbody) {
            tbody.innerHTML = '';
        }
        this.props.rounds = [];
        return this;
    }

    /**
     * Highlight a specific row
     * @param {number} index - Round index
     * @returns {HistoryTable} this for chaining
     */
    highlightRow(index) {
        const tbody = this.getBody();
        if (!tbody) return this;

        // Remove existing highlights
        tbody.querySelectorAll('tr.highlighted').forEach(row => {
            row.classList.remove('highlighted');
        });

        // Add highlight to target row
        const row = tbody.querySelector(`tr[data-round-index="${index}"]`);
        if (row) {
            row.classList.add('highlighted');
        }

        return this;
    }

    /**
     * Clear all row highlights
     * @returns {HistoryTable} this for chaining
     */
    clearHighlights() {
        const tbody = this.getBody();
        if (tbody) {
            tbody.querySelectorAll('tr.highlighted').forEach(row => {
                row.classList.remove('highlighted');
            });
        }
        return this;
    }
}
