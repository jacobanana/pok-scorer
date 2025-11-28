/**
 * Pok Detector Calibrator
 * Auto-tunes detection parameters using annotated dataset
 */

const Calibrator = {
    // Current state
    // States: NOT_READY, READY, RUNNING, CALIBRATED, STOPPED
    state: 'NOT_READY',
    dataset: null,
    loadedImages: [],
    trainingSet: [],
    validationSet: [],
    isRunning: false,
    shouldStop: false,
    bestParams: null,
    bestScore: -Infinity,

    // Separate tracking for best detection and color params
    bestDetectionParams: null,
    bestDetectionScore: -Infinity,
    bestColorParams: null,
    bestColorScore: -Infinity,

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
     * Split loaded images into training and validation sets
     */
    splitDataset(trainRatio = 0.7) {
        const shuffled = [...this.loadedImages].sort(() => Math.random() - 0.5);
        const trainCount = Math.floor(shuffled.length * trainRatio);

        this.trainingSet = shuffled.slice(0, trainCount);
        this.validationSet = shuffled.slice(trainCount);

        console.log(`📊 Dataset split: ${this.trainingSet.length} training, ${this.validationSet.length} validation`);

        return {
            trainingCount: this.trainingSet.length,
            validationCount: this.validationSet.length
        };
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

        // Detection score: focuses on F1 and position accuracy
        const detectionScore = (f1 * 70) - (avgPositionError / threshold * 30);

        // Color score: focuses on color classification accuracy
        const colorScore = (colorAccuracy * 100);

        return {
            precision,
            recall,
            f1,
            colorAccuracy,
            avgPositionError,
            truePositives,
            falsePositives,
            falseNegatives,
            combinedScore,
            detectionScore,
            colorScore
        };
    },

    /**
     * Evaluate parameters across a dataset (training or validation)
     */
    evaluateParams(params, dataset = null) {
        const datasetToUse = dataset || this.trainingSet;
        let totalCombinedScore = 0;
        let totalDetectionScore = 0;
        let totalColorScore = 0;
        const results = [];

        for (const entry of datasetToUse) {
            const detections = this.detectWithParams(entry.image, params);
            const score = this.calculateScore(detections, entry.annotations);
            results.push({
                filename: entry.filename,
                ...score
            });
            totalCombinedScore += score.combinedScore;
            totalDetectionScore += score.detectionScore;
            totalColorScore += score.colorScore;
        }

        const count = datasetToUse.length;

        return {
            avgScore: totalCombinedScore / count,
            avgDetectionScore: totalDetectionScore / count,
            avgColorScore: totalColorScore / count,
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
     * Uses random search followed by hybrid combination and local refinement
     */
    async optimize(options = {}) {
        const {
            randomIterations = 50,
            localIterations = 100,
            trainRatio = 0.7,
            startingParams = null,
            onProgress = () => {},
            onBestFound = () => {}
        } = options;

        this.state = 'RUNNING';
        this.isRunning = true;
        this.shouldStop = false;
        this.history = [];
        this.bestScore = -Infinity;
        this.bestParams = null;
        this.bestDetectionScore = -Infinity;
        this.bestDetectionParams = null;
        this.bestColorScore = -Infinity;
        this.bestColorParams = null;

        // Split dataset into training and validation
        this.splitDataset(trainRatio);

        let iteration = 0;

        // Evaluate starting parameters if provided
        if (startingParams) {
            console.log('🎯 Starting from provided parameters...');
            const result = this.evaluateParams(startingParams);
            this.bestScore = result.avgScore;
            this.bestParams = startingParams;
            this.bestDetectionScore = result.avgDetectionScore;
            this.bestDetectionParams = { ...startingParams };
            this.bestColorScore = result.avgColorScore;
            this.bestColorParams = { ...startingParams };

            console.log(`   Initial score: ${result.avgScore.toFixed(2)}`);
            console.log(`   Detection: ${result.avgDetectionScore.toFixed(2)}, Color: ${result.avgColorScore.toFixed(2)}\n`);

            onBestFound({ params: startingParams, score: result.avgScore, details: result });
        }

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║              POK DETECTOR CALIBRATION PROCESS                ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        console.log(`🔧 Configuration:`);
        console.log(`   - Random iterations: ${startingParams ? 0 : randomIterations} ${startingParams ? '(skipped - using starting params)' : ''}`);
        console.log(`   - Local iterations: ${localIterations}`);
        console.log(`   - Train/Validation split: ${(trainRatio * 100).toFixed(0)}% / ${((1 - trainRatio) * 100).toFixed(0)}%`);
        console.log(`   - Training set: ${this.trainingSet.length} images`);
        console.log(`   - Validation set: ${this.validationSet.length} images\n`);

        // Phase 1: Random search (skip if starting params provided)
        if (!startingParams) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎲 PHASE 1: Random Search');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            onProgress({ phase: 'random', iteration: 0, total: randomIterations, bestScore: this.bestScore });

            for (let i = 0; i < randomIterations && !this.shouldStop; i++) {
            const params = this.randomParams();
            const result = this.evaluateParams(params);

            this.history.push({
                params,
                score: result.avgScore,
                detectionScore: result.avgDetectionScore,
                colorScore: result.avgColorScore,
                phase: 'random'
            });

            // Track best combined score
            if (result.avgScore > this.bestScore) {
                this.bestScore = result.avgScore;
                this.bestParams = params;
                console.log(`✨ New best COMBINED: ${result.avgScore.toFixed(2)} (F1: ${(result.perImage[0]?.f1 * 100 || 0).toFixed(1)}%, Color: ${(result.perImage[0]?.colorAccuracy * 100 || 0).toFixed(1)}%)`);
                onBestFound({ params, score: result.avgScore, details: result });
            }

            // Track best detection score
            if (result.avgDetectionScore > this.bestDetectionScore) {
                this.bestDetectionScore = result.avgDetectionScore;
                this.bestDetectionParams = { ...params };
                console.log(`🎯 New best DETECTION: ${result.avgDetectionScore.toFixed(2)}`);
            }

            // Track best color score
            if (result.avgColorScore > this.bestColorScore) {
                this.bestColorScore = result.avgColorScore;
                this.bestColorParams = { ...params };
                console.log(`🎨 New best COLOR: ${result.avgColorScore.toFixed(2)}`);
            }

            if ((i + 1) % 10 === 0) {
                console.log(`   Progress: ${i + 1}/${randomIterations} | Best: ${this.bestScore.toFixed(2)}`);
            }

            iteration++;
            onProgress({
                phase: 'random',
                iteration: i + 1,
                total: randomIterations,
                bestScore: this.bestScore,
                currentScore: result.avgScore,
                currentResult: result
            });

                // Yield to UI
                await new Promise(r => setTimeout(r, 0));
            }

            console.log(`\n✅ Random search complete. Best combined: ${this.bestScore.toFixed(2)}\n`);
        } else {
            console.log('⏩ Skipping random search - using provided starting parameters\n');
        }

        // Phase 1.5: Test hybrid combination
        if (!this.shouldStop && this.bestDetectionParams && this.bestColorParams) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔬 PHASE 1.5: Hybrid Parameter Combination');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // Combine detection params with color params
            const hybridParams = { ...this.bestDetectionParams };

            // Replace color parameters with best color params
            const colorKeys = ['redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
                              'blueH1Low', 'blueH1High', 'blueH2Low', 'blueH2High', 'blueSMin', 'blueVMin'];
            colorKeys.forEach(key => {
                if (this.bestColorParams[key] !== undefined) {
                    hybridParams[key] = this.bestColorParams[key];
                }
            });

            console.log('🧬 Testing hybrid: Best detection params + Best color params');
            const hybridResult = this.evaluateParams(hybridParams);

            console.log(`   Hybrid score: ${hybridResult.avgScore.toFixed(2)}`);
            console.log(`   Current best: ${this.bestScore.toFixed(2)}`);
            console.log(`   Detection: ${hybridResult.avgDetectionScore.toFixed(2)}, Color: ${hybridResult.avgColorScore.toFixed(2)}`);

            if (hybridResult.avgScore > this.bestScore) {
                console.log('\n🎉 Hybrid combination is BETTER! Using as starting point for local search.\n');
                this.bestScore = hybridResult.avgScore;
                this.bestParams = hybridParams;
                onBestFound({ params: hybridParams, score: hybridResult.avgScore, details: hybridResult });
            } else {
                console.log('\n📊 Hybrid not better. Continuing with original best.\n');
            }

            iteration++;
            await new Promise(r => setTimeout(r, 0));
        }

        // Phase 2: Local search (hill climbing from best found)
        if (!this.shouldStop && this.bestParams) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔍 PHASE 2: Local Search (Hill Climbing)');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            onProgress({ phase: 'local', iteration: 0, total: localIterations, bestScore: this.bestScore });

            let currentParams = { ...this.bestParams };
            let currentScore = this.bestScore;
            let noImprovementCount = 0;
            let improvements = 0;

            for (let i = 0; i < localIterations && !this.shouldStop; i++) {
                const neighborP = this.neighborParams(currentParams);
                const result = this.evaluateParams(neighborP);

                this.history.push({
                    params: neighborP,
                    score: result.avgScore,
                    detectionScore: result.avgDetectionScore,
                    colorScore: result.avgColorScore,
                    phase: 'local'
                });

                if (result.avgScore > currentScore) {
                    currentScore = result.avgScore;
                    currentParams = neighborP;
                    noImprovementCount = 0;
                    improvements++;

                    if (result.avgScore > this.bestScore) {
                        this.bestScore = result.avgScore;
                        this.bestParams = neighborP;
                        console.log(`⬆️  Improvement #${improvements}: ${result.avgScore.toFixed(2)} (+${(result.avgScore - currentScore).toFixed(2)})`);
                        onBestFound({ params: neighborP, score: result.avgScore, details: result });
                    }
                } else {
                    noImprovementCount++;
                    // If stuck, occasionally jump to a random neighbor of the best
                    if (noImprovementCount > 10) {
                        currentParams = this.neighborParams(this.bestParams);
                        noImprovementCount = 0;
                        console.log(`   🔄 Stuck at local optimum, jumping to random neighbor...`);
                    }
                }

                if ((i + 1) % 20 === 0) {
                    console.log(`   Progress: ${i + 1}/${localIterations} | Best: ${this.bestScore.toFixed(2)} | Improvements: ${improvements}`);
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

            console.log(`\n✅ Local search complete. Total improvements: ${improvements}\n`);
        }

        this.isRunning = false;

        // Check if stopped early
        if (this.shouldStop) {
            this.state = 'STOPPED';
        }

        // Phase 3: Validation
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ PHASE 3: Validation Set Testing');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        let validationResult = null;
        if (this.validationSet.length > 0 && this.bestParams) {
            validationResult = this.evaluateParams(this.bestParams, this.validationSet);

            console.log('📊 FINAL RESULTS:');
            console.log('┌─────────────────────────────────────────────────────────────┐');
            console.log(`│ Training Score:   ${this.bestScore.toFixed(2).padEnd(43)} │`);
            console.log(`│ Validation Score: ${validationResult.avgScore.toFixed(2).padEnd(43)} │`);
            console.log('├─────────────────────────────────────────────────────────────┤');

            const avgF1 = validationResult.perImage.reduce((s, r) => s + r.f1, 0) / validationResult.perImage.length;
            const avgColorAcc = validationResult.perImage.reduce((s, r) => s + r.colorAccuracy, 0) / validationResult.perImage.length;
            const avgPrecision = validationResult.perImage.reduce((s, r) => s + r.precision, 0) / validationResult.perImage.length;
            const avgRecall = validationResult.perImage.reduce((s, r) => s + r.recall, 0) / validationResult.perImage.length;
            const avgPosError = validationResult.perImage.reduce((s, r) => s + r.avgPositionError, 0) / validationResult.perImage.length;

            console.log(`│ F1 Score:         ${(avgF1 * 100).toFixed(1)}%`.padEnd(62) + '│');
            console.log(`│ Color Accuracy:   ${(avgColorAcc * 100).toFixed(1)}%`.padEnd(62) + '│');
            console.log(`│ Precision:        ${(avgPrecision * 100).toFixed(1)}%`.padEnd(62) + '│');
            console.log(`│ Recall:           ${(avgRecall * 100).toFixed(1)}%`.padEnd(62) + '│');
            console.log(`│ Avg Pos Error:    ${avgPosError.toFixed(1)}px`.padEnd(62) + '│');
            console.log('└─────────────────────────────────────────────────────────────┘\n');

            console.log('📋 Per-Image Validation Results:');
            console.table(validationResult.perImage.map(img => ({
                'File': img.filename,
                'F1': (img.f1 * 100).toFixed(1) + '%',
                'Color': (img.colorAccuracy * 100).toFixed(1) + '%',
                'TP': img.truePositives,
                'FP': img.falsePositives,
                'FN': img.falseNegatives,
                'Pos Err': img.avgPositionError.toFixed(1) + 'px'
            })));
        } else {
            console.log('⚠️  No validation set available (need more images)\n');
        }

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    CALIBRATION COMPLETE                      ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        // Set final state
        if (!this.shouldStop) {
            this.state = 'CALIBRATED';
        }

        return {
            bestParams: this.bestParams,
            bestScore: this.bestScore,
            validationScore: validationResult?.avgScore,
            validationResult: validationResult,
            iterations: iteration,
            history: this.history
        };
    },

    /**
     * Stop the optimization process
     */
    stop() {
        this.shouldStop = true;
        this.state = 'STOPPED';
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
