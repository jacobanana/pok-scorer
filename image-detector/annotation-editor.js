/**
 * Pok Dataset Annotation Editor
 * Create and edit annotated datasets for training the detector
 */

// State
let cvReady = false;
let images = []; // Array of { id, filename, image, poks: [{x, y, radius, color}] }
let currentImageIndex = -1;
let defaultRadius = 25;
let detectionResults = null;
let isDragging = false;
let dragPokIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let isResizing = false;
let resizeStartRadius = 0;

// DOM elements
const canvas = document.getElementById('annotationCanvas');
const detectionCanvas = document.getElementById('detectionCanvas');
const ctx = canvas.getContext('2d');
const detectionCtx = detectionCanvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');
const placeholder = document.getElementById('placeholder');
const imageTabs = document.getElementById('imageTabs');
const pokList = document.getElementById('pokList');
const redCountEl = document.getElementById('redCount');
const blueCountEl = document.getElementById('blueCount');
const defaultRadiusSlider = document.getElementById('defaultRadius');
const defaultRadiusValue = document.getElementById('defaultRadiusValue');
const runDetectionBtn = document.getElementById('runDetectionBtn');
const clearDetectionBtn = document.getElementById('clearDetectionBtn');
const detectionPanel = document.getElementById('detectionPanel');
const detectionResultsEl = document.getElementById('detectionResults');

const STORAGE_KEY = 'pokDatasetEditor';
const CLICK_THRESHOLD = 15; // Pixels to consider a click on a pok

// OpenCV ready callback
function onOpenCvReady() {
    cv['onRuntimeInitialized'] = () => {
        cvReady = true;
        updateDetectionButton();
    };
}

// Initialize
function init() {
    // Default radius slider
    defaultRadiusSlider.addEventListener('input', (e) => {
        defaultRadius = parseInt(e.target.value);
        defaultRadiusValue.textContent = defaultRadius;
    });

    // Canvas click handler
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // File inputs
    document.getElementById('addImages').addEventListener('change', handleAddImages);
    document.getElementById('importDataset').addEventListener('change', handleImportDataset);

    // Try to auto-load from storage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        // Don't auto-load, but indicate it's available
        console.log('Dataset available in localStorage');
    }
}

// Handle adding images
async function handleAddImages(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        const img = await loadImageFile(file);
        images.push({
            id: Date.now() + Math.random(),
            filename: file.name,
            image: img,
            poks: []
        });
    }

    renderTabs();
    if (currentImageIndex === -1 && images.length > 0) {
        selectImage(0);
    }

    e.target.value = ''; // Reset input
}

// Load image file
function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Render image tabs
function renderTabs() {
    imageTabs.innerHTML = images.map((img, idx) => `
        <button class="image-tab ${idx === currentImageIndex ? 'active' : ''}"
                onclick="selectImage(${idx})">
            ${img.filename}
            <button class="close-btn" onclick="event.stopPropagation(); removeImage(${idx})">×</button>
        </button>
    `).join('');

    updateDetectionButton();
}

// Select image
function selectImage(index) {
    if (index < 0 || index >= images.length) return;

    currentImageIndex = index;
    clearDetection();
    renderTabs();
    renderCanvas();
    renderPokList();
    updateStats();
}

// Remove image
function removeImage(index) {
    images.splice(index, 1);

    if (currentImageIndex >= images.length) {
        currentImageIndex = images.length - 1;
    }

    renderTabs();

    if (currentImageIndex >= 0) {
        selectImage(currentImageIndex);
    } else {
        canvas.style.display = 'none';
        detectionCanvas.style.display = 'none';
        placeholder.style.display = 'block';
        pokList.innerHTML = '<p class="info-text" style="text-align: center; padding: 20px;">No poks annotated yet.<br>Click on the image to add poks.</p>';
        updateStats();
    }
}

// Render canvas with current image and annotations
function renderCanvas() {
    if (currentImageIndex < 0) {
        canvas.style.display = 'none';
        detectionCanvas.style.display = 'none';
        placeholder.style.display = 'block';
        return;
    }

    const imgData = images[currentImageIndex];
    const img = imgData.image;

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.display = 'block';

    detectionCanvas.width = img.width;
    detectionCanvas.height = img.height;
    detectionCanvas.style.display = 'block';

    placeholder.style.display = 'none';

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw annotations
    imgData.poks.forEach((pok, idx) => {
        drawPok(ctx, pok, idx);
    });
}

// Draw a single pok annotation
function drawPok(context, pok, index) {
    const color = pok.color === 'red' ? '#d32f2f' : '#1976d2';

    // Fill
    context.beginPath();
    context.arc(pok.x, pok.y, pok.radius, 0, 2 * Math.PI);
    context.fillStyle = color + '66'; // Semi-transparent
    context.fill();

    // Border
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.stroke();

    // Index label
    context.fillStyle = 'white';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(index + 1, pok.x, pok.y);
}

// Handle canvas click
function handleCanvasClick(e) {
    if (currentImageIndex < 0 || isDragging || isResizing) return;

    // Skip if Shift or Ctrl was pressed (dragging/resizing operations)
    if (e.shiftKey || e.ctrlKey) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const imgData = images[currentImageIndex];

    // Check if clicked on existing pok
    const clickedPokIndex = findPokAtPosition(x, y);

    if (clickedPokIndex !== -1) {
        // Cycle: red -> blue -> delete
        const pok = imgData.poks[clickedPokIndex];
        if (pok.color === 'red') {
            pok.color = 'blue';
        } else {
            // Delete
            imgData.poks.splice(clickedPokIndex, 1);
        }
    } else {
        // Add new pok
        imgData.poks.push({
            x: Math.round(x),
            y: Math.round(y),
            radius: defaultRadius,
            color: 'red'
        });
    }

    clearDetection();
    renderCanvas();
    renderPokList();
    updateStats();
}

// Find pok at position
function findPokAtPosition(x, y) {
    if (currentImageIndex < 0) return -1;

    const poks = images[currentImageIndex].poks;

    for (let i = poks.length - 1; i >= 0; i--) {
        const pok = poks[i];
        const dist = Math.sqrt(Math.pow(x - pok.x, 2) + Math.pow(y - pok.y, 2));
        if (dist <= pok.radius + CLICK_THRESHOLD) {
            return i;
        }
    }

    return -1;
}

// Mouse handlers for dragging
function handleMouseDown(e) {
    if (currentImageIndex < 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const pokIndex = findPokAtPosition(x, y);

    // Ctrl+drag for resizing
    if (e.ctrlKey && pokIndex !== -1) {
        isResizing = true;
        dragPokIndex = pokIndex;
        dragStartY = y;
        const pok = images[currentImageIndex].poks[pokIndex];
        resizeStartRadius = pok.radius;
        canvas.style.cursor = 'ns-resize';
        e.preventDefault();
        return;
    }

    // Shift+drag for moving
    if (e.shiftKey && pokIndex !== -1) {
        isDragging = true;
        dragPokIndex = pokIndex;
        dragStartX = x;
        dragStartY = y;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if ((!isDragging && !isResizing) || dragPokIndex === -1) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const pok = images[currentImageIndex].poks[dragPokIndex];

    if (isResizing) {
        // Calculate new radius based on vertical drag
        // Drag up (y decreases) = increase radius
        // Drag down (y increases) = decrease radius
        const deltaY = dragStartY - y;  // Positive when dragging up
        const newRadius = Math.round(Math.max(5, Math.min(100, resizeStartRadius + deltaY)));
        pok.radius = newRadius;
    } else if (isDragging) {
        // Position dragging
        pok.x = Math.round(Math.max(0, Math.min(canvas.width, x)));
        pok.y = Math.round(Math.max(0, Math.min(canvas.height, y)));
    }

    renderCanvas();
    renderPokList();
}

function handleMouseUp() {
    if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        dragPokIndex = -1;
        canvas.style.cursor = 'crosshair';
    }
}

// Render pok list in sidebar
function renderPokList() {
    if (currentImageIndex < 0) {
        pokList.innerHTML = '<p class="info-text" style="text-align: center; padding: 20px;">No poks annotated yet.<br>Click on the image to add poks.</p>';
        return;
    }

    const poks = images[currentImageIndex].poks;

    if (poks.length === 0) {
        pokList.innerHTML = '<p class="info-text" style="text-align: center; padding: 20px;">No poks annotated yet.<br>Click on the image to add poks.</p>';
        return;
    }

    pokList.innerHTML = poks.map((pok, idx) => `
        <div class="pok-item ${pok.color}">
            <div class="pok-item-header">
                <span class="pok-item-title">
                    <span class="pok-color-dot ${pok.color}"></span>
                    Pok #${idx + 1}
                </span>
                <div class="pok-item-actions">
                    <button onclick="togglePokColor(${idx})">${pok.color === 'red' ? '→ Blue' : '→ Red'}</button>
                    <button class="delete" onclick="deletePok(${idx})">Delete</button>
                </div>
            </div>
            <div class="pok-item-fields">
                <div class="pok-field">
                    <label>X</label>
                    <input type="number" value="${pok.x}" onchange="updatePok(${idx}, 'x', this.value)">
                </div>
                <div class="pok-field">
                    <label>Y</label>
                    <input type="number" value="${pok.y}" onchange="updatePok(${idx}, 'y', this.value)">
                </div>
                <div class="pok-field">
                    <label>Radius</label>
                    <input type="number" value="${pok.radius}" onchange="updatePok(${idx}, 'radius', this.value)">
                </div>
                <div class="pok-field">
                    <label>Color</label>
                    <select onchange="updatePok(${idx}, 'color', this.value)">
                        <option value="red" ${pok.color === 'red' ? 'selected' : ''}>Red</option>
                        <option value="blue" ${pok.color === 'blue' ? 'selected' : ''}>Blue</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
}

// Update pok property
function updatePok(index, prop, value) {
    if (currentImageIndex < 0) return;

    const pok = images[currentImageIndex].poks[index];
    if (prop === 'color') {
        pok[prop] = value;
    } else {
        pok[prop] = parseInt(value) || 0;
    }

    clearDetection();
    renderCanvas();
    renderPokList();
    updateStats();
}

// Toggle pok color
function togglePokColor(index) {
    if (currentImageIndex < 0) return;

    const pok = images[currentImageIndex].poks[index];
    pok.color = pok.color === 'red' ? 'blue' : 'red';

    clearDetection();
    renderCanvas();
    renderPokList();
    updateStats();
}

// Delete pok
function deletePok(index) {
    if (currentImageIndex < 0) return;

    images[currentImageIndex].poks.splice(index, 1);

    clearDetection();
    renderCanvas();
    renderPokList();
    updateStats();
}

// Update stats
function updateStats() {
    if (currentImageIndex < 0) {
        redCountEl.textContent = '0';
        blueCountEl.textContent = '0';
        return;
    }

    const poks = images[currentImageIndex].poks;
    const redCount = poks.filter(p => p.color === 'red').length;
    const blueCount = poks.filter(p => p.color === 'blue').length;

    redCountEl.textContent = redCount;
    blueCountEl.textContent = blueCount;
}

// Update detection button state
function updateDetectionButton() {
    runDetectionBtn.disabled = !cvReady || images.length === 0 || currentImageIndex < 0;
}

// Save to localStorage
function saveToStorage() {
    const dataset = buildDataset();

    // Store dataset structure (without actual image data)
    const storageData = {
        dataset: dataset,
        imageDataUrls: images.map(img => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.image.width;
            tempCanvas.height = img.image.height;
            tempCanvas.getContext('2d').drawImage(img.image, 0, 0);
            return {
                filename: img.filename,
                dataUrl: tempCanvas.toDataURL('image/jpeg', 0.8)
            };
        })
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        alert('Dataset saved to browser storage!');
    } catch (err) {
        alert('Failed to save: ' + err.message + '\n\nDataset may be too large. Try downloading as JSON instead.');
    }
}

// Load from localStorage
async function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        alert('No saved dataset found in browser storage.');
        return;
    }

    try {
        const storageData = JSON.parse(saved);

        // Clear current images
        images = [];
        currentImageIndex = -1;

        // Load images from data URLs
        for (const imgData of storageData.imageDataUrls) {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imgData.dataUrl;
            });

            const datasetImg = storageData.dataset.images.find(i => i.filename === imgData.filename);

            images.push({
                id: Date.now() + Math.random(),
                filename: imgData.filename,
                image: img,
                poks: datasetImg ? datasetImg.poks : []
            });
        }

        renderTabs();
        if (images.length > 0) {
            selectImage(0);
        }

        alert('Dataset loaded from browser storage!');
    } catch (err) {
        alert('Failed to load: ' + err.message);
    }
}

// Build dataset JSON
function buildDataset() {
    return {
        version: '1.0',
        name: 'Pok Dataset',
        createdAt: new Date().toISOString(),
        images: images.map(img => ({
            filename: img.filename,
            width: img.image.width,
            height: img.image.height,
            poks: img.poks.map(p => ({
                x: p.x,
                y: p.y,
                radius: p.radius,
                color: p.color
            }))
        }))
    };
}

// Download dataset as JSON
function downloadDataset() {
    const dataset = buildDataset();
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pok-dataset.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Import dataset from JSON
async function handleImportDataset(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const dataset = JSON.parse(text);

        if (dataset.version !== '1.0') {
            throw new Error('Unsupported dataset version');
        }

        // Merge with existing images or require image files
        alert(`Dataset loaded with ${dataset.images.length} image(s).\n\nNow add the corresponding image files.`);

        // Store pending annotations
        window.pendingAnnotations = dataset.images;

    } catch (err) {
        alert('Failed to import dataset: ' + err.message);
    }

    e.target.value = '';
}

// When images are added, check for pending annotations
const originalHandleAddImages = handleAddImages;
handleAddImages = async function(e) {
    await originalHandleAddImages.call(this, e);

    // Check for pending annotations
    if (window.pendingAnnotations) {
        for (const imgData of images) {
            const pending = window.pendingAnnotations.find(p => p.filename === imgData.filename);
            if (pending) {
                imgData.poks = pending.poks || [];
            }
        }
        window.pendingAnnotations = null;

        renderTabs();
        if (currentImageIndex >= 0) {
            selectImage(currentImageIndex);
        }
    }
};

// Run detection on current image
function runDetection() {
    if (!cvReady || currentImageIndex < 0) return;

    const imgData = images[currentImageIndex];

    // Get detection params from localStorage (if available)
    const savedParams = localStorage.getItem('pokDetectorParams');
    const params = savedParams ? JSON.parse(savedParams) : getDefaultParams();

    // Run detection
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
        params.dp || 1,
        params.minDist || 20,
        params.param1 || 100,
        params.param2 || 30,
        params.minRadius || 10,
        params.maxRadius || 50
    );

    // Convert to HSV for color classification
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    const hsvFinal = new cv.Mat();
    cv.cvtColor(hsv, hsvFinal, cv.COLOR_RGB2HSV);

    // Process detections
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

    // Draw detections
    drawDetections(detections);

    // Calculate comparison metrics
    detectionResults = compareDetections(detections, imgData.poks);
    showDetectionResults();

    clearDetectionBtn.disabled = false;
}

// Get default params
function getDefaultParams() {
    return {
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
        blueH1Low: 100,
        blueH1High: 130,
        blueH2Low: 0,
        blueH2High: 0,
        blueSMin: 100,
        blueVMin: 100
    };
}

// Draw detections overlay
function drawDetections(detections) {
    detectionCtx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);

    detections.forEach((det, idx) => {
        // Dashed circle for detection
        detectionCtx.beginPath();
        detectionCtx.arc(det.x, det.y, det.radius, 0, 2 * Math.PI);
        detectionCtx.setLineDash([5, 5]);
        detectionCtx.strokeStyle = det.color === 'red' ? '#ff6b6b' :
                                   det.color === 'blue' ? '#6b9fff' : '#888';
        detectionCtx.lineWidth = 2;
        detectionCtx.stroke();
        detectionCtx.setLineDash([]);

        // Small marker at center
        detectionCtx.beginPath();
        detectionCtx.arc(det.x, det.y, 4, 0, 2 * Math.PI);
        detectionCtx.fillStyle = detectionCtx.strokeStyle;
        detectionCtx.fill();
    });
}

// Compare detections with annotations
function compareDetections(detections, annotations) {
    const threshold = 50; // Match distance threshold

    const matched = [];
    const unmatchedDetections = [...detections];
    const unmatchedAnnotations = [...annotations];

    // Greedy matching
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

    const tp = matched.length;
    const fp = unmatchedDetections.length;
    const fn = unmatchedAnnotations.length;

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    const colorCorrect = matched.filter(m => m.colorMatch).length;
    const colorAccuracy = tp > 0 ? colorCorrect / tp : 0;

    return {
        truePositives: tp,
        falsePositives: fp,
        falseNegatives: fn,
        precision,
        recall,
        f1,
        colorAccuracy,
        matched,
        unmatchedDetections,
        unmatchedAnnotations
    };
}

// Show detection results
function showDetectionResults() {
    if (!detectionResults) return;

    detectionPanel.style.display = 'block';

    const r = detectionResults;
    detectionResultsEl.innerHTML = `
        <div class="detection-stat">
            <span>True Positives</span>
            <span class="value">${r.truePositives}</span>
        </div>
        <div class="detection-stat">
            <span>False Positives</span>
            <span class="value ${r.falsePositives > 0 ? 'bad' : ''}">${r.falsePositives}</span>
        </div>
        <div class="detection-stat">
            <span>False Negatives</span>
            <span class="value ${r.falseNegatives > 0 ? 'bad' : ''}">${r.falseNegatives}</span>
        </div>
        <div class="detection-stat">
            <span>Precision</span>
            <span class="value">${(r.precision * 100).toFixed(1)}%</span>
        </div>
        <div class="detection-stat">
            <span>Recall</span>
            <span class="value">${(r.recall * 100).toFixed(1)}%</span>
        </div>
        <div class="detection-stat">
            <span>F1 Score</span>
            <span class="value ${r.f1 > 0.8 ? 'good' : r.f1 < 0.5 ? 'bad' : ''}">${(r.f1 * 100).toFixed(1)}%</span>
        </div>
        <div class="detection-stat">
            <span>Color Accuracy</span>
            <span class="value ${r.colorAccuracy > 0.8 ? 'good' : r.colorAccuracy < 0.5 ? 'bad' : ''}">${(r.colorAccuracy * 100).toFixed(1)}%</span>
        </div>
    `;
}

// Clear detection overlay
function clearDetection() {
    detectionCtx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
    detectionResults = null;
    detectionPanel.style.display = 'none';
    clearDetectionBtn.disabled = true;
}

// Initialize on load
init();
