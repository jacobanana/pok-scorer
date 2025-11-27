/**
 * Pok Detector Calibrator
 * Auto-tunes detection parameters using annotated dataset
 */

const Calibrator = {
    // Current state
    dataset: null,
    loadedImages: [],
    isRunning: false,
    shouldStop: false,
    bestParams: null,
    bestScore: -Infinity,

    // Results history
    history: [],

    // Parameter space definition - ranges for each parameter
    parameterSpace: {
        // HoughCircles parameters
        dp: { min: 1, max: 2.5, step: 0.1, default: 1 },
        minDist: { min: 10, max: 80, step: 5, default: 20 },
        param1: { min: 30, max: 200, step: 10, default: 100 },
        param2: { min: 10, max: 60, step: 5, default: 30 },
        minRadius: { min: 5, max: 50, step: 5, default: 10 },
        maxRadius: { min: 20, max: 100, step: 5, default: 50 },

        // Color parameters - Red
        redH1Low: { min: 0, max: 10, step: 1, default: 0 },
        redH1High: { min: 5, max: 20, step: 1, default: 10 },
        redH2Low: { min: 150, max: 175, step: 1, default: 160 },
        redH2High: { min: 170, max: 180, step: 1, default: 180 },
        redSMin: { min: 50, max: 180, step: 10, default: 100 },
        redVMin: { min: 50, max: 180, step: 10, default: 100 },

        // Color parameters - Blue
        blueH1Low: { min: 90, max: 115, step: 1, default: 100 },
        blueH1High: { min: 115, max: 140, step: 1, default: 130 },
        blueSMin: { min: 50, max: 180, step: 10, default: 100 },
        blueVMin: { min: 50, max: 180, step: 10, default: 100 }
    },

    // Matching distance threshold (pixels) - detected pok must be within this distance of annotation
    matchDistanceThreshold: 50,

    /**
     * Load and validate dataset JSON
     */
    loadDataset(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            if (data.version !== '1.0') {
                throw new Error('Unsupported dataset version: ' + data.version);
            }

            if (!Array.isArray(data.images) || data.images.length === 0) {
                throw new Error('Dataset must contain at least one image');
            }

            // Validate each image entry
            data.images.forEach((img, idx) => {
                if (!img.filename) {
                    throw new Error(`Image ${idx} missing filename`);
                }
                if (!Array.isArray(img.poks)) {
                    throw new Error(`Image ${idx} missing poks array`);
                }
                img.poks.forEach((pok, pokIdx) => {
                    if (typeof pok.x !== 'number' || typeof pok.y !== 'number') {
                        throw new Error(`Image ${idx}, pok ${pokIdx}: missing x/y coordinates`);
                    }
                    if (!['red', 'blue'].includes(pok.color)) {
                        throw new Error(`Image ${idx}, pok ${pokIdx}: invalid color (must be 'red' or 'blue')`);
                    }
                });
            });

            this.dataset = data;
            this.loadedImages = [];
            return { success: true, imageCount: data.images.length };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Load actual image files
     */
    async loadImages(imageFiles) {
        this.loadedImages = [];

        for (const entry of this.dataset.images) {
            const file = imageFiles.find(f => f.name === entry.filename);
            if (!file) {
                throw new Error(`Image file not found: ${entry.filename}`);
            }

            const img = await this.loadImageFile(file);
            this.loadedImages.push({
                image: img,
                annotations: entry.poks,
                filename: entry.filename
            });
        }

        return this.loadedImages.length;
    },

    /**
     * Load single image file as Image object
     */
    loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image: ' + file.name));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
            reader.readAsDataURL(file);
        });
    },

    /**
     * Load images from data URLs (from localStorage)
     */
    async loadImagesFromDataUrls(imageDataUrls) {
        this.loadedImages = [];

        for (const entry of this.dataset.images) {
            const dataUrlEntry = imageDataUrls.find(d => d.filename === entry.filename);
            if (!dataUrlEntry) {
                throw new Error(`Image data URL not found: ${entry.filename}`);
            }

            const img = await this.loadImageFromDataUrl(dataUrlEntry.dataUrl, entry.filename);
            this.loadedImages.push({
                image: img,
                annotations: entry.poks,
                filename: entry.filename
            });
        }

        return this.loadedImages.length;
    },

    /**
     * Load single image from data URL
     */
    loadImageFromDataUrl(dataUrl, filename) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + filename));
            img.src = dataUrl;
        });
    },

    /**
     * Run detection on an image with given parameters
     */
    detectWithParams(image, params) {
        // Create canvas for OpenCV
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // Run OpenCV detection
        const src = cv.imread(canvas);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2);

        const circles = new cv.Mat();
        cv.HoughCircles(
            blurred,
            circles,
            cv.HOUGH_GRADIENT,
            params.dp,
            params.minDist,
            params.param1,
            params.param2,
            params.minRadius,
            params.maxRadius
        );

        // Convert to HSV for color classification
        const hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        const hsvFinal = new cv.Mat();
        cv.cvtColor(hsv, hsvFinal, cv.COLOR_RGB2HSV);

        // Process detected circles
        const detections = [];
        for (let i = 0; i < circles.cols; i++) {
            const x = circles.data32F[i * 3];
            const y = circles.data32F[i * 3 + 1];
            const radius = circles.data32F[i * 3 + 2];

            const color = ColorClassifier.classifyCircle(hsvFinal, x, y, radius, params);
            detections.push({ x, y, radius, color });
        }

        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        circles.delete();
        hsv.delete();
        hsvFinal.delete();

        return detections;
    },

    /**
     * Calculate score for a set of detections vs annotations
     * Returns object with precision, recall, F1, color accuracy, avg position error
     */
    calculateScore(detections, annotations) {
        const threshold = this.matchDistanceThreshold;

        // Match detections to annotations using Hungarian-style greedy matching
        const matched = [];
        const unmatchedDetections = [...detections];
        const unmatchedAnnotations = [...annotations];

        // Greedy matching: for each annotation, find closest unmatched detection
        for (let i = unmatchedAnnotations.length - 1; i >= 0; i--) {
            const ann = unmatchedAnnotations[i];
            let bestIdx = -1;
            let bestDist = Infinity;

            for (let j = 0; j < unmatchedDetections.length; j++) {
                const det = unmatchedDetections[j];
                const dist = Math.sqrt(Math.pow(det.x - ann.x, 2) + Math.pow(det.y - ann.y, 2));

                if (dist < threshold && dist < bestDist) {
                    bestDist = dist;
                    bestIdx = j;
                }
            }

            if (bestIdx !== -1) {
                matched.push({
                    annotation: ann,
                    detection: unmatchedDetections[bestIdx],
                    distance: bestDist,
                    colorMatch: ann.color === unmatchedDetections[bestIdx].color
                });
                unmatchedDetections.splice(bestIdx, 1);
                unmatchedAnnotations.splice(i, 1);
            }
        }

        // Calculate metrics
        const truePositives = matched.length;
        const falsePositives = unmatchedDetections.length;
        const falseNegatives = unmatchedAnnotations.length;

        const precision = truePositives / (truePositives + falsePositives) || 0;
        const recall = truePositives / (truePositives + falseNegatives) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;

        const colorCorrect = matched.filter(m => m.colorMatch).length;
        const colorAccuracy = truePositives > 0 ? colorCorrect / truePositives : 0;

        const avgPositionError = matched.length > 0
            ? matched.reduce((sum, m) => sum + m.distance, 0) / matched.length
            : threshold; // Penalize if no matches

        // Combined score: prioritize F1, then color accuracy, penalize position error
        // Score range: 0-100
        const combinedScore = (f1 * 50) + (colorAccuracy * 40) - (avgPositionError / threshold * 10);

        return {
            precision,
            recall,
            f1,
            colorAccuracy,
            avgPositionError,
            truePositives,
            falsePositives,
            falseNegatives,
            combinedScore
        };
    },

    /**
     * Evaluate parameters across all loaded images
     */
    evaluateParams(params) {
        let totalScore = 0;
        const results = [];

        for (const entry of this.loadedImages) {
            const detections = this.detectWithParams(entry.image, params);
            const score = this.calculateScore(detections, entry.annotations);
            results.push({
                filename: entry.filename,
                ...score
            });
            totalScore += score.combinedScore;
        }

        return {
            avgScore: totalScore / this.loadedImages.length,
            perImage: results
        };
    },

    /**
     * Generate random parameters within the parameter space
     */
    randomParams() {
        const params = { algorithm: 'hough' };

        for (const [key, range] of Object.entries(this.parameterSpace)) {
            const steps = Math.floor((range.max - range.min) / range.step);
            const randomStep = Math.floor(Math.random() * (steps + 1));
            params[key] = range.min + (randomStep * range.step);
        }

        // Add fixed blue secondary range (not optimized)
        params.blueH2Low = 0;
        params.blueH2High = 0;

        return params;
    },

    /**
     * Generate neighbor parameters (small mutations for local search)
     */
    neighborParams(baseParams) {
        const params = { ...baseParams };

        // Mutate 1-3 random parameters
        const numMutations = Math.floor(Math.random() * 3) + 1;
        const keys = Object.keys(this.parameterSpace);

        for (let i = 0; i < numMutations; i++) {
            const key = keys[Math.floor(Math.random() * keys.length)];
            const range = this.parameterSpace[key];

            // Move up or down by 1-2 steps
            const currentVal = params[key];
            const stepChange = (Math.random() < 0.5 ? -1 : 1) * range.step * (Math.floor(Math.random() * 2) + 1);
            params[key] = Math.max(range.min, Math.min(range.max, currentVal + stepChange));
        }

        return params;
    },

    /**
     * Main optimization loop
     * Uses random search followed by local refinement
     */
    async optimize(options = {}) {
        const {
            randomIterations = 50,
            localIterations = 100,
            onProgress = () => {},
            onBestFound = () => {}
        } = options;

        this.isRunning = true;
        this.shouldStop = false;
        this.history = [];
        this.bestScore = -Infinity;
        this.bestParams = null;

        const totalIterations = randomIterations + localIterations;
        let iteration = 0;

        // Phase 1: Random search
        onProgress({ phase: 'random', iteration: 0, total: randomIterations, bestScore: this.bestScore });

        for (let i = 0; i < randomIterations && !this.shouldStop; i++) {
            const params = this.randomParams();
            const result = this.evaluateParams(params);

            this.history.push({ params, score: result.avgScore, phase: 'random' });

            if (result.avgScore > this.bestScore) {
                this.bestScore = result.avgScore;
                this.bestParams = params;
                onBestFound({ params, score: result.avgScore, details: result });
            }

            iteration++;
            onProgress({
                phase: 'random',
                iteration: i + 1,
                total: randomIterations,
                bestScore: this.bestScore,
                currentScore: result.avgScore
            });

            // Yield to UI
            await new Promise(r => setTimeout(r, 0));
        }

        // Phase 2: Local search (hill climbing from best found)
        if (!this.shouldStop && this.bestParams) {
            onProgress({ phase: 'local', iteration: 0, total: localIterations, bestScore: this.bestScore });

            let currentParams = { ...this.bestParams };
            let currentScore = this.bestScore;
            let noImprovementCount = 0;

            for (let i = 0; i < localIterations && !this.shouldStop; i++) {
                const neighborP = this.neighborParams(currentParams);
                const result = this.evaluateParams(neighborP);

                this.history.push({ params: neighborP, score: result.avgScore, phase: 'local' });

                if (result.avgScore > currentScore) {
                    currentScore = result.avgScore;
                    currentParams = neighborP;
                    noImprovementCount = 0;

                    if (result.avgScore > this.bestScore) {
                        this.bestScore = result.avgScore;
                        this.bestParams = neighborP;
                        onBestFound({ params: neighborP, score: result.avgScore, details: result });
                    }
                } else {
                    noImprovementCount++;
                    // If stuck, occasionally jump to a random neighbor of the best
                    if (noImprovementCount > 10) {
                        currentParams = this.neighborParams(this.bestParams);
                        noImprovementCount = 0;
                    }
                }

                iteration++;
                onProgress({
                    phase: 'local',
                    iteration: i + 1,
                    total: localIterations,
                    bestScore: this.bestScore,
                    currentScore: result.avgScore
                });

                // Yield to UI
                await new Promise(r => setTimeout(r, 0));
            }
        }

        this.isRunning = false;

        return {
            bestParams: this.bestParams,
            bestScore: this.bestScore,
            iterations: iteration,
            history: this.history
        };
    },

    /**
     * Stop the optimization process
     */
    stop() {
        this.shouldStop = true;
    },

    /**
     * Export best parameters in format compatible with detector.js
     */
    exportParams() {
        if (!this.bestParams) return null;

        return {
            algorithm: 'hough',
            ...this.bestParams
        };
    },

    /**
     * Get statistics about the optimization history
     */
    getHistoryStats() {
        if (this.history.length === 0) return null;

        const scores = this.history.map(h => h.score);
        return {
            iterations: this.history.length,
            minScore: Math.min(...scores),
            maxScore: Math.max(...scores),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            bestParams: this.bestParams,
            bestScore: this.bestScore
        };
    }
};
