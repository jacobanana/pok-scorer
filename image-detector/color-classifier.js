/**
 * Color Classifier - Classifies detected circles as red, blue, or unknown
 * Uses HSV color space for more robust color detection
 */

const ColorClassifier = {
    /**
     * Classify a circle's color by sampling pixels in its center region
     * @param {cv.Mat} hsvImage - Image in HSV color space
     * @param {number} centerX - Circle center X coordinate
     * @param {number} centerY - Circle center Y coordinate
     * @param {number} radius - Circle radius
     * @param {Object} params - Color threshold parameters
     * @returns {string} 'red', 'blue', or 'unknown'
     */
    classifyCircle(hsvImage, centerX, centerY, radius, params) {
        // Sample from the inner 50% of the circle to avoid edge artifacts
        const sampleRadius = Math.max(2, Math.floor(radius * 0.5));

        let redCount = 0;
        let blueCount = 0;
        let totalSamples = 0;

        // Sample pixels in a grid within the circle center
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
            for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
                // Only sample within circular region
                if (dx * dx + dy * dy > sampleRadius * sampleRadius) continue;

                const px = Math.round(centerX + dx);
                const py = Math.round(centerY + dy);

                // Bounds check
                if (px < 0 || px >= hsvImage.cols || py < 0 || py >= hsvImage.rows) continue;

                const pixel = hsvImage.ucharPtr(py, px);
                const h = pixel[0];
                const s = pixel[1];
                const v = pixel[2];

                totalSamples++;

                // Check if red (red wraps around in HSV)
                if (this.isRed(h, s, v, params)) {
                    redCount++;
                }
                // Check if blue
                else if (this.isBlue(h, s, v, params)) {
                    blueCount++;
                }
            }
        }

        if (totalSamples === 0) return 'unknown';

        const redRatio = redCount / totalSamples;
        const blueRatio = blueCount / totalSamples;

        // Require at least 30% of samples to match
        const threshold = 0.3;

        if (redRatio > threshold && redRatio > blueRatio) {
            return 'red';
        } else if (blueRatio > threshold && blueRatio > redRatio) {
            return 'blue';
        }

        return 'unknown';
    },

    /**
     * Check if HSV values match red color range
     * Red wraps around 0/180 in OpenCV's HSV (0-180 scale for H)
     */
    isRed(h, s, v, params) {
        const sOk = s >= params.redSMin;
        const vOk = v >= params.redVMin;

        // Red can be in low range (0-10) or high range (160-180)
        const hLowRange = h >= params.redH1Low && h <= params.redH1High;
        const hHighRange = h >= params.redH2Low && h <= params.redH2High;

        return (hLowRange || hHighRange) && sOk && vOk;
    },

    /**
     * Check if HSV values match blue color range
     */
    isBlue(h, s, v, params) {
        const hOk = h >= params.blueHLow && h <= params.blueHHigh;
        const sOk = s >= params.blueSMin;
        const vOk = v >= params.blueVMin;

        return hOk && sOk && vOk;
    },

    /**
     * Get an HSV color for visualization
     * @param {string} classification - 'red', 'blue', or 'unknown'
     * @returns {Object} {r, g, b, a} color values
     */
    getDisplayColor(classification) {
        switch (classification) {
            case 'red':
                return { r: 211, g: 47, b: 47, a: 0.6 }; // #d32f2f
            case 'blue':
                return { r: 25, g: 118, b: 210, a: 0.6 }; // #1976d2
            default:
                return { r: 136, g: 136, b: 136, a: 0.6 }; // #888
        }
    }
};
