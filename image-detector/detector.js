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

// Result counters
const redCountEl = document.getElementById('redCount');
const blueCountEl = document.getElementById('blueCount');
const unknownCountEl = document.getElementById('unknownCount');

// Parameter elements
const paramIds = [
    'dp', 'minDist', 'param1', 'param2', 'minRadius', 'maxRadius',
    'redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
    'blueHLow', 'blueHHigh', 'blueSMin', 'blueVMin'
];

// Default parameter values
const defaultParams = {
    dp: 1,
    minDist: 20,
    param1: 100,
    param2: 30,
    minRadius: 10,
    maxRadius: 50,
    redH1Low: 0,
    redH1High: 10,
    redH2Low: 160,
    redH2High: 180,
    redSMin: 100,
    redVMin: 100,
    blueHLow: 100,
    blueHHigh: 130,
    blueSMin: 100,
    blueVMin: 100
};

const STORAGE_KEY = 'pokDetectorParams';

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
    const params = {};
    paramIds.forEach(id => {
        params[id] = parseFloat(document.getElementById(id).value);
    });
    return params;
}

/**
 * Save parameters to localStorage
 */
function saveParams() {
    const params = getParams();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
}

/**
 * Load parameters from localStorage
 */
function loadParams() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const params = saved ? JSON.parse(saved) : defaultParams;

    paramIds.forEach(id => {
        const el = document.getElementById(id);
        const value = params[id] !== undefined ? params[id] : defaultParams[id];
        el.value = value;
        updateParamDisplay(id, value);
    });
}

/**
 * Reset parameters to defaults
 */
function resetParameters() {
    paramIds.forEach(id => {
        const el = document.getElementById(id);
        el.value = defaultParams[id];
        updateParamDisplay(id, defaultParams[id]);
    });
    saveParams();
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
 * Initialize parameter sliders
 */
function initParams() {
    loadParams();

    paramIds.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', (e) => {
            updateParamDisplay(id, e.target.value);
            saveParams();
        });
    });
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
            const results = detectPoks(currentImage, getParams());
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
function detectPoks(img, params) {
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

// Initialize on load
initParams();
