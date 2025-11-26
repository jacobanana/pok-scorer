// ============================================
// SCORE VISUALIZER SERVICE
// ============================================
// Manages the marble scoreboard visualization

export class ScoreVisualizerService {
    constructor(redMarkersContainer, blueMarkersContainer) {
        this.redMarkersContainer = redMarkersContainer;
        this.blueMarkersContainer = blueMarkersContainer;
        this.totalMarkers = 21;

        this.init();
    }

    init() {
        this.createMarkers(this.redMarkersContainer, 'red');
        this.createMarkers(this.blueMarkersContainer, 'blue');
    }

    createMarkers(container, color) {
        if (!container) return;

        container.innerHTML = '';
        for (let i = 0; i < this.totalMarkers; i++) {
            const marker = document.createElement('div');
            marker.className = 'score-marker';
            marker.dataset.position = i;
            marker.dataset.color = color;

            // Position evenly across the bar
            // Red: start from right (100%) and go left (towards center)
            // Blue: start from left (0%) and go right (towards center)
            let position;
            if (color === 'red') {
                position = 100 - (i / (this.totalMarkers - 1)) * 100;
            } else {
                position = (i / (this.totalMarkers - 1)) * 100;
            }
            marker.style.left = `${position}%`;

            container.appendChild(marker);
        }
    }

    updateScores(redScore, blueScore) {
        this.updateMarkers(this.redMarkersContainer, redScore, 'red');
        this.updateMarkers(this.blueMarkersContainer, blueScore, 'blue');
    }

    updateMarkers(container, score, color) {
        if (!container) return;

        const markers = container.querySelectorAll('.score-marker');

        // Clamp score between 0 and 21
        const clampedScore = Math.max(0, Math.min(this.totalMarkers, score));

        markers.forEach((marker, index) => {
            // Mark scored marbles (CSS handles the colors)
            if (index < clampedScore) {
                marker.classList.add('scored');
            } else {
                marker.classList.remove('scored');
            }
        });
    }

    reset() {
        this.updateScores(0, 0);
    }
}
