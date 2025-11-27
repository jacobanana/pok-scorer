/**
 * Pok Detector - Main detection logic using OpenCV.js
 */

// State
let cvReady = false;
let currentImage = null;
let webcamStream = null;
let webcamActive = false;

// DOM Elements
const imageInput = document.getElementById('imageInput');
const webcamBtn = document.getElementById('webcamBtn');
const captureBtn = document.getElementById('captureBtn');
const detectBtn = document.getElementById('detectBtn');
const webcamVideo = document.getElementById('webcamVideo');
const outputCanvas = document.getElementById('outputCanvas');
const placeholder = document.getElementById('placeholder');
const statusEl = document.getElementById('status');
const algorithmSelect = document.getElementById('algorithm');
const houghParamsEl = document.getElementById('houghParams');
const blobParamsEl = document.getElementById('blobParams');
const versionListEl = document.getElementById('versionList');

// Result counters
const redCountEl = document.getElementById('redCount');
const blueCountEl = document.getElementById('blueCount');
const unknownCountEl = document.getElementById('unknownCount');

// Parameter IDs for each algorithm
const houghParamIds = [
    'dp', 'minDist', 'param1', 'param2', 'minRadius', 'maxRadius'
];

const blobParamIds = [
    'blobMinArea', 'blobMaxArea', 'blobMinCircularity', 'blobMinConvexity'
];

const colorParamIds = [
    'redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
    'blueH1Low', 'blueH1High', 'blueH2Low', 'blueH2High', 'blueSMin', 'blueVMin'
];

const allParamIds = [...houghParamIds, ...blobParamIds, ...colorParamIds];

// Default parameter values
const defaultParams = {
    algorithm: 'hough',
    // Hough params
    dp: 1,
    minDist: 20,
    param1: 100,
    param2: 30,
    minRadius: 10,
    maxRadius: 50,
    // Blob params
    blobMinArea: 100,
    blobMaxArea: 5000,
    blobMinCircularity: 0.7,
    blobMinConvexity: 0.8,
    // Color params
    redH1Low: 0,
    redH1High: 10,
    redH2Low: 160,
    redH2High: 180,
    redSMin: 100,
    redVMin: 100,
    blueH1Low: 100,
    blueH1High: 130,
    blueH2Low: 0,
    blueH2High: 0,
    blueSMin: 100,
    blueVMin: 100
};

const STORAGE_KEY = 'pokDetectorParams';
const VERSIONS_KEY = 'pokDetectorVersions';
const SOURCE_KEY = 'pokDetectorParamsSource';

// Parameter source types
const PARAM_SOURCE = {
    DEFAULT: 'default',
    CALIBRATED: 'calibrated',
    IMPORTED: 'imported',
    CUSTOM: 'custom'
};

/**
 * Called when OpenCV.js is loaded
 */
function onOpenCvReady() {
    cv['onRuntimeInitialized'] = () => {
        cvReady = true;
        setStatus('OpenCV.js ready', 'ready');
        updateDetectButton();
    };
}

/**
 * Update status display
 */
function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
}

/**
 * Enable/disable detect button based on state
 */
function updateDetectButton() {
    detectBtn.disabled = !cvReady || !currentImage;
}

/**
 * Get current parameter values from UI
 */
function getParams() {
    const params = {
        algorithm: algorithmSelect.value
    };
    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            params[id] = parseFloat(el.value);
        }
    });
    return params;
}

/**
 * Save parameters to localStorage
 */
function saveParams(markAsCustom = true) {
    const params = getParams();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    updateColorPreviews();

    // Mark as custom if user manually changed params (unless explicitly disabled)
    if (markAsCustom) {
        const currentSource = getParamSource();
        // Only mark as custom if not currently being set programmatically
        if (currentSource !== PARAM_SOURCE.CALIBRATED &&
            currentSource !== PARAM_SOURCE.IMPORTED) {
            // Don't change source here - let specific actions set it
        }
    }
}

/**
 * Load parameters from localStorage
 */
function loadParams() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const params = saved ? JSON.parse(saved) : defaultParams;

    // Set algorithm
    algorithmSelect.value = params.algorithm || 'hough';
    updateAlgorithmUI();

    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const value = params[id] !== undefined ? params[id] : defaultParams[id];
            el.value = value;
            updateParamDisplay(id, value);
        }
    });

    updateColorPreviews();
}

/**
 * Reset parameters to defaults
 */
function resetParameters() {
    algorithmSelect.value = defaultParams.algorithm;
    updateAlgorithmUI();

    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = defaultParams[id];
            updateParamDisplay(id, defaultParams[id]);
        }
    });
    saveParams(false);
    setParamSource(PARAM_SOURCE.DEFAULT);
    setStatus('Parameters reset to defaults', 'ready');
}

/**
 * Update parameter value display
 */
function updateParamDisplay(id, value) {
    const displayEl = document.getElementById(id + 'Value');
    if (displayEl) {
        displayEl.textContent = value;
    }
}

/**
 * Update color preview swatches based on current HSV values
 */
function updateColorPreviews() {
    // Red preview 1 (low hue range)
    const redH1 = (parseFloat(document.getElementById('redH1Low').value) +
                   parseFloat(document.getElementById('redH1High').value)) / 2;
    const redS = parseFloat(document.getElementById('redSMin').value);
    const redV = parseFloat(document.getElementById('redVMin').value);
    const red1Rgb = ColorClassifier.hsvToRgb(redH1, Math.min(255, redS + 50), Math.min(255, redV + 50));
    document.getElementById('redPreview1').style.background =
        `rgb(${red1Rgb.r}, ${red1Rgb.g}, ${red1Rgb.b})`;

    // Red preview 2 (high hue range)
    const redH2 = (parseFloat(document.getElementById('redH2Low').value) +
                   parseFloat(document.getElementById('redH2High').value)) / 2;
    const red2Rgb = ColorClassifier.hsvToRgb(redH2, Math.min(255, redS + 50), Math.min(255, redV + 50));
    document.getElementById('redPreview2').style.background =
        `rgb(${red2Rgb.r}, ${red2Rgb.g}, ${red2Rgb.b})`;

    // Blue preview 1 (primary hue range)
    const blueH1 = (parseFloat(document.getElementById('blueH1Low').value) +
                    parseFloat(document.getElementById('blueH1High').value)) / 2;
    const blueS = parseFloat(document.getElementById('blueSMin').value);
    const blueV = parseFloat(document.getElementById('blueVMin').value);
    const blue1Rgb = ColorClassifier.hsvToRgb(blueH1, Math.min(255, blueS + 50), Math.min(255, blueV + 50));
    document.getElementById('bluePreview1').style.background =
        `rgb(${blue1Rgb.r}, ${blue1Rgb.g}, ${blue1Rgb.b})`;

    // Blue preview 2 (secondary hue range)
    const blueH2 = (parseFloat(document.getElementById('blueH2Low').value) +
                    parseFloat(document.getElementById('blueH2High').value)) / 2;
    const blue2Rgb = ColorClassifier.hsvToRgb(blueH2, Math.min(255, blueS + 50), Math.min(255, blueV + 50));
    document.getElementById('bluePreview2').style.background =
        `rgb(${blue2Rgb.r}, ${blue2Rgb.g}, ${blue2Rgb.b})`;
}

/**
 * Apply color from color picker to HSV sliders
 */
function applyColorPicker(colorType, hexColor) {
    // Parse hex color
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);

    // Convert to HSV
    const hsv = ColorClassifier.rgbToHsv(r, g, b);

    if (colorType === 'red') {
        // Determine which red range to use based on hue
        if (hsv.h <= 15) {
            // Low red range
            document.getElementById('redH1Low').value = Math.max(0, hsv.h - 10);
            document.getElementById('redH1High').value = Math.min(30, hsv.h + 10);
            updateParamDisplay('redH1Low', document.getElementById('redH1Low').value);
            updateParamDisplay('redH1High', document.getElementById('redH1High').value);
        } else if (hsv.h >= 160) {
            // High red range
            document.getElementById('redH2Low').value = Math.max(140, hsv.h - 10);
            document.getElementById('redH2High').value = Math.min(180, hsv.h + 10);
            updateParamDisplay('redH2Low', document.getElementById('redH2Low').value);
            updateParamDisplay('redH2High', document.getElementById('redH2High').value);
        }
        document.getElementById('redSMin').value = Math.max(0, hsv.s - 50);
        document.getElementById('redVMin').value = Math.max(0, hsv.v - 50);
        updateParamDisplay('redSMin', document.getElementById('redSMin').value);
        updateParamDisplay('redVMin', document.getElementById('redVMin').value);
    } else if (colorType === 'blue') {
        // Set primary blue hue range
        document.getElementById('blueH1Low').value = Math.max(80, hsv.h - 15);
        document.getElementById('blueH1High').value = Math.min(150, hsv.h + 15);
        document.getElementById('blueSMin').value = Math.max(0, hsv.s - 50);
        document.getElementById('blueVMin').value = Math.max(0, hsv.v - 50);
        updateParamDisplay('blueH1Low', document.getElementById('blueH1Low').value);
        updateParamDisplay('blueH1High', document.getElementById('blueH1High').value);
        updateParamDisplay('blueSMin', document.getElementById('blueSMin').value);
        updateParamDisplay('blueVMin', document.getElementById('blueVMin').value);
    }

    saveParams();
}

/**
 * Update UI when algorithm changes
 */
function updateAlgorithmUI() {
    const algo = algorithmSelect.value;
    houghParamsEl.style.display = algo === 'hough' ? 'block' : 'none';
    blobParamsEl.style.display = algo === 'blob' ? 'block' : 'none';
}

/**
 * Initialize parameter sliders
 */
function initParams() {
    loadParams();

    // Algorithm selector
    algorithmSelect.addEventListener('change', () => {
        updateAlgorithmUI();
        saveParams();
    });

    // All parameter sliders
    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                updateParamDisplay(id, e.target.value);
                saveParams(false);
                // Mark as custom when user manually adjusts
                setParamSource(PARAM_SOURCE.CUSTOM);
            });
        }
    });

    // Load and render version history
    renderVersionList();
}

/**
 * Handle image file upload
 */
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Stop webcam if active
    if (webcamActive) {
        stopWebcam();
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            displayImage(img);
            updateDetectButton();
            setStatus('Image loaded - click Detect to find poks', 'ready');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

/**
 * Display image on canvas
 */
function displayImage(img) {
    placeholder.style.display = 'none';
    webcamVideo.style.display = 'none';
    outputCanvas.style.display = 'block';

    outputCanvas.width = img.width;
    outputCanvas.height = img.height;

    const ctx = outputCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
}

/**
 * Toggle webcam on/off
 */
async function toggleWebcam() {
    if (webcamActive) {
        stopWebcam();
    } else {
        await startWebcam();
    }
}

/**
 * Start webcam stream
 */
async function startWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        webcamVideo.srcObject = webcamStream;
        webcamVideo.style.display = 'block';
        outputCanvas.style.display = 'none';
        placeholder.style.display = 'none';

        webcamActive = true;
        webcamBtn.textContent = 'Stop Webcam';
        webcamBtn.classList.add('active');
        captureBtn.disabled = false;
        currentImage = null;
        updateDetectButton();

        setStatus('Webcam active - position the table and click Capture', 'ready');
    } catch (err) {
        setStatus('Webcam error: ' + err.message, 'error');
    }
}

/**
 * Stop webcam stream
 */
function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }

    webcamActive = false;
    webcamBtn.textContent = 'Start Webcam';
    webcamBtn.classList.remove('active');
    captureBtn.disabled = true;
    webcamVideo.style.display = 'none';

    if (!currentImage) {
        placeholder.style.display = 'flex';
    }
}

/**
 * Capture frame from webcam
 */
function captureWebcam() {
    if (!webcamActive) return;

    // Create image from video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = webcamVideo.videoWidth;
    tempCanvas.height = webcamVideo.videoHeight;

    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0);

    const img = new Image();
    img.onload = () => {
        currentImage = img;
        stopWebcam();
        displayImage(img);
        updateDetectButton();
        setStatus('Frame captured - click Detect to find poks', 'ready');
    };
    img.src = tempCanvas.toDataURL('image/png');
}

/**
 * Run pok detection on current image
 */
function runDetection() {
    if (!cvReady || !currentImage) return;

    setStatus('Detecting poks...', 'loading');

    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            const params = getParams();
            let results;

            if (params.algorithm === 'blob') {
                results = detectPoksBlob(currentImage, params);
            } else {
                results = detectPoksHough(currentImage, params);
            }

            drawResults(currentImage, results);
            updateCounts(results);
            setStatus(`Found ${results.length} circles`, 'ready');
        } catch (err) {
            setStatus('Detection error: ' + err.message, 'error');
            console.error(err);
        }
    }, 50);
}

/**
 * Detect poks using OpenCV HoughCircles
 */
function detectPoksHough(img, params) {
    // Create cv.Mat from image
    const src = cv.imread(outputCanvas);

    // Convert to grayscale for circle detection
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2);

    // Detect circles using Hough Transform
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

    // Process each detected circle
    const results = [];
    for (let i = 0; i < circles.cols; i++) {
        const x = circles.data32F[i * 3];
        const y = circles.data32F[i * 3 + 1];
        const radius = circles.data32F[i * 3 + 2];

        // Classify color
        const color = ColorClassifier.classifyCircle(hsvFinal, x, y, radius, params);

        results.push({ x, y, radius, color });
    }

    // Cleanup
    src.delete();
    gray.delete();
    blurred.delete();
    circles.delete();
    hsv.delete();
    hsvFinal.delete();

    return results;
}

/**
 * Detect poks using SimpleBlobDetector
 */
function detectPoksBlob(img, params) {
    // Create cv.Mat from image
    const src = cv.imread(outputCanvas);

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // SimpleBlobDetector is not directly available in OpenCV.js
    // We'll use contour detection as an alternative approach

    // Apply threshold
    const thresh = new cv.Mat();
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Convert to HSV for color classification
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    const hsvFinal = new cv.Mat();
    cv.cvtColor(hsv, hsvFinal, cv.COLOR_RGB2HSV);

    // Process each contour
    const results = [];
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        // Filter by area
        if (area < params.blobMinArea || area > params.blobMaxArea) continue;

        // Calculate circularity
        const perimeter = cv.arcLength(contour, true);
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        if (circularity < params.blobMinCircularity) continue;

        // Calculate convexity
        const hull = new cv.Mat();
        cv.convexHull(contour, hull);
        const hullArea = cv.contourArea(hull);
        const convexity = area / hullArea;
        hull.delete();
        if (convexity < params.blobMinConvexity) continue;

        // Get bounding circle
        const circle = cv.minEnclosingCircle(contour);
        const x = circle.center.x;
        const y = circle.center.y;
        const radius = circle.radius;

        // Classify color
        const color = ColorClassifier.classifyCircle(hsvFinal, x, y, radius, params);

        results.push({ x, y, radius, color });
    }

    // Cleanup
    src.delete();
    gray.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
    hsv.delete();
    hsvFinal.delete();

    return results;
}

/**
 * Draw detection results on canvas
 */
function drawResults(img, results) {
    const ctx = outputCanvas.getContext('2d');

    // Redraw original image
    ctx.drawImage(img, 0, 0);

    // Draw each detected circle
    results.forEach(circle => {
        const displayColor = ColorClassifier.getDisplayColor(circle.color);

        // Semi-transparent fill
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${displayColor.r}, ${displayColor.g}, ${displayColor.b}, ${displayColor.a})`;
        ctx.fill();

        // Solid border
        ctx.strokeStyle = `rgb(${displayColor.r}, ${displayColor.g}, ${displayColor.b})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    });
}

/**
 * Update result counts
 */
function updateCounts(results) {
    let red = 0, blue = 0, unknown = 0;

    results.forEach(r => {
        if (r.color === 'red') red++;
        else if (r.color === 'blue') blue++;
        else unknown++;
    });

    redCountEl.textContent = red;
    blueCountEl.textContent = blue;
    unknownCountEl.textContent = unknown;
}

// ==================== Version History ====================

/**
 * Get saved versions from localStorage
 */
function getVersions() {
    const saved = localStorage.getItem(VERSIONS_KEY);
    return saved ? JSON.parse(saved) : [];
}

/**
 * Save versions to localStorage
 */
function setVersions(versions) {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
}

/**
 * Save current settings as a new version
 */
function saveVersion() {
    const versions = getVersions();
    const params = getParams();

    const version = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        params: params
    };

    versions.unshift(version); // Add to beginning

    // Keep only last 20 versions
    if (versions.length > 20) {
        versions.pop();
    }

    setVersions(versions);
    renderVersionList();
    setStatus('Settings version saved', 'ready');
}

/**
 * Load a saved version
 */
function loadVersion(versionId) {
    const versions = getVersions();
    const version = versions.find(v => v.id === versionId);

    if (!version) return;

    const params = version.params;

    // Set algorithm
    algorithmSelect.value = params.algorithm || 'hough';
    updateAlgorithmUI();

    // Set all parameters
    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && params[id] !== undefined) {
            el.value = params[id];
            updateParamDisplay(id, params[id]);
        }
    });

    saveParams();
    setStatus('Settings version loaded', 'ready');
}

/**
 * Delete a saved version
 */
function deleteVersion(versionId, event) {
    event.stopPropagation(); // Prevent loading the version

    const versions = getVersions();
    const filtered = versions.filter(v => v.id !== versionId);
    setVersions(filtered);
    renderVersionList();
}

/**
 * Render the version history list
 */
function renderVersionList() {
    const versions = getVersions();

    if (versions.length === 0) {
        versionListEl.innerHTML = '<div class="no-versions">No saved versions yet</div>';
        return;
    }

    versionListEl.innerHTML = versions.map(v => {
        const date = new Date(v.timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="version-item" onclick="loadVersion(${v.id})">
                <span class="version-time">${timeStr}</span>
                <button class="version-delete" onclick="deleteVersion(${v.id}, event)">×</button>
            </div>
        `;
    }).join('');
}

// ==================== Import/Export ====================

/**
 * Get/set parameter source
 */
function getParamSource() {
    return localStorage.getItem(SOURCE_KEY) || PARAM_SOURCE.DEFAULT;
}

function setParamSource(source) {
    localStorage.setItem(SOURCE_KEY, source);
    updateParamSourceDisplay();
}

/**
 * Update the parameter source display in UI
 */
function updateParamSourceDisplay() {
    const sourceEl = document.getElementById('paramSourceValue');
    if (!sourceEl) return;

    const source = getParamSource();
    sourceEl.className = 'source-value ' + source;

    const labels = {
        [PARAM_SOURCE.DEFAULT]: 'Default',
        [PARAM_SOURCE.CALIBRATED]: 'Calibrated',
        [PARAM_SOURCE.IMPORTED]: 'Imported',
        [PARAM_SOURCE.CUSTOM]: 'Custom'
    };
    sourceEl.textContent = labels[source] || 'Unknown';
}

/**
 * Export current parameters to JSON file
 */
function exportParamsToJson() {
    const params = getParams();
    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: getParamSource(),
        parameters: params
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pok-detector-params-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus('Parameters exported to JSON file', 'ready');
}

/**
 * Import parameters from JSON file
 */
function importParamsFromJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            let params;

            // Handle both exported format and calibrator output format
            if (data.parameters) {
                params = data.parameters;
            } else if (data.algorithm) {
                // Direct params object (calibrator format)
                params = data;
            } else {
                throw new Error('Invalid parameter file format');
            }

            applyParams(params);
            setParamSource(PARAM_SOURCE.IMPORTED);
            setStatus('Parameters imported from JSON file', 'ready');
        } catch (err) {
            setStatus('Import error: ' + err.message, 'error');
            console.error('Import error:', err);
        }
    };
    reader.onerror = () => {
        setStatus('Failed to read file', 'error');
    };
    reader.readAsText(file);
}

/**
 * Apply parameters object to UI and save
 */
function applyParams(params) {
    // Set algorithm
    if (params.algorithm) {
        algorithmSelect.value = params.algorithm;
        updateAlgorithmUI();
    }

    // Set all parameters
    allParamIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && params[id] !== undefined) {
            el.value = params[id];
            updateParamDisplay(id, params[id]);
        }
    });

    saveParams();
}

/**
 * Initialize import file handler
 */
function initImportHandler() {
    const importInput = document.getElementById('importParamsFile');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importParamsFromJson(file);
                // Reset input so same file can be selected again
                e.target.value = '';
            }
        });
    }
}

// Initialize on load
initParams();
initImportHandler();
updateParamSourceDisplay();
