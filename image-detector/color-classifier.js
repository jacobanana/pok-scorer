/**
 * Color Classifier - Classifies detected circles as red, blue, or unknown
 * Uses HSV color space for more robust color detection
 *
 * IMPORTANT: Physical poks have a metallic marble CENTER and colored plastic OUTER RING.
 * We must sample from the outer ring, not the center, for accurate color detection.
 */

const ColorClassifier = {
    /**
     * Classify a circle's color by sampling pixels in its OUTER RING region
     * Poks have metallic centers - the color is in the outer plastic ring
     * @param {cv.Mat} hsvImage - Image in HSV color space
     * @param {number} centerX - Circle center X coordinate
     * @param {number} centerY - Circle center Y coordinate
     * @param {number} radius - Circle radius
     * @param {Object} params - Color threshold parameters
     * @returns {string} 'red', 'blue', or 'unknown'
     */
    classifyCircle(hsvImage, centerX, centerY, radius, params) {
        // Sample from OUTER RING only (between 50% and 90% of radius)
        // This avoids the metallic center marble and the edge artifacts
        const innerRadius = Math.max(2, Math.floor(radius * 0.5));
        const outerRadius = Math.max(3, Math.floor(radius * 0.9));

        let redCount = 0;
        let blueCount = 0;
        let totalSamples = 0;

        // Sample pixels in a grid, but only keep those in the annular (ring) region
        for (let dy = -outerRadius; dy <= outerRadius; dy++) {
            for (let dx = -outerRadius; dx <= outerRadius; dx++) {
                const distSq = dx * dx + dy * dy;
                const innerRadiusSq = innerRadius * innerRadius;
                const outerRadiusSq = outerRadius * outerRadius;

                // Only sample within the annular region (ring between inner and outer)
                if (distSq < innerRadiusSq || distSq > outerRadiusSq) continue;

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
     * Supports two hue ranges for consistency with red
     */
    isBlue(h, s, v, params) {
        const sOk = s >= params.blueSMin;
        const vOk = v >= params.blueVMin;

        // Blue primary range
        const hRange1 = h >= params.blueH1Low && h <= params.blueH1High;

        // Blue secondary range (optional, usually set to 0-0)
        const hRange2 = params.blueH2Low !== params.blueH2High &&
                        h >= params.blueH2Low && h <= params.blueH2High;

        return (hRange1 || hRange2) && sOk && vOk;
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
    },

    /**
     * Convert HSV (OpenCV scale: H=0-180, S=0-255, V=0-255) to RGB
     * @param {number} h - Hue (0-180)
     * @param {number} s - Saturation (0-255)
     * @param {number} v - Value (0-255)
     * @returns {Object} {r, g, b} values (0-255)
     */
    hsvToRgb(h, s, v) {
        // Convert from OpenCV scale to standard scale
        const hNorm = (h / 180) * 360; // 0-360
        const sNorm = s / 255;         // 0-1
        const vNorm = v / 255;         // 0-1

        const c = vNorm * sNorm;
        const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
        const m = vNorm - c;

        let r, g, b;
        if (hNorm < 60) {
            [r, g, b] = [c, x, 0];
        } else if (hNorm < 120) {
            [r, g, b] = [x, c, 0];
        } else if (hNorm < 180) {
            [r, g, b] = [0, c, x];
        } else if (hNorm < 240) {
            [r, g, b] = [0, x, c];
        } else if (hNorm < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    },

    /**
     * Convert RGB to HSV (OpenCV scale: H=0-180, S=0-255, V=0-255)
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {Object} {h, s, v} values in OpenCV scale
     */
    rgbToHsv(r, g, b) {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const delta = max - min;

        let h = 0;
        if (delta !== 0) {
            if (max === rNorm) {
                h = 60 * (((gNorm - bNorm) / delta) % 6);
            } else if (max === gNorm) {
                h = 60 * (((bNorm - rNorm) / delta) + 2);
            } else {
                h = 60 * (((rNorm - gNorm) / delta) + 4);
            }
        }
        if (h < 0) h += 360;

        const s = max === 0 ? 0 : delta / max;
        const v = max;

        // Convert to OpenCV scale
        return {
            h: Math.round((h / 360) * 180),
            s: Math.round(s * 255),
            v: Math.round(v * 255)
        };
    }
};
