# Pok Image Detection - Development Plan

## Overview
A proof-of-concept tool using OpenCV.js to detect pok game pieces from uploaded images, classify them by player color, and eventually map their positions to game coordinates.

---

## Phase 1: Basic Pok Detection (Current)
**Goal:** Detect circular poks, classify by color, count totals

### Features
- [ ] Image upload interface
- [ ] Webcam capture support
- [ ] OpenCV.js integration
- [ ] Circle detection using Hough Transform
- [ ] Color classification (red vs blue)
- [ ] Display detected poks overlaid on image (semi-transparent fills)
- [ ] Show count per player
- [ ] Tweakable parameters UI with sliders
- [ ] Save/load parameters to localStorage
- [ ] Manual "Detect" button (no auto-run on parameter change)

### Technical Approach

#### Circle Detection (HoughCircles)
Parameters to expose:
- `dp` - Inverse ratio of accumulator resolution (default: 1)
- `minDist` - Minimum distance between detected circle centers
- `param1` - Higher Canny edge threshold (default: 100)
- `param2` - Accumulator threshold for circle detection (default: 30)
- `minRadius` - Minimum circle radius in pixels
- `maxRadius` - Maximum circle radius in pixels

#### Color Classification (HSV)
Parameters to expose:
- Red HSV range (note: red wraps around 0/180 in OpenCV)
  - Lower red: H=0-10, S=100-255, V=100-255
  - Upper red: H=160-180, S=100-255, V=100-255
- Blue HSV range:
  - H=100-130, S=100-255, V=100-255
- Minimum color match percentage threshold

### Files
- `index.html` - UI with image upload, parameter controls, results display
- `detector.js` - OpenCV detection logic
- `color-classifier.js` - HSV-based color classification
- `calibrator.html` - Auto-calibration UI
- `calibrator.js` - Optimization algorithm
- `dataset-schema.json` - JSON schema for annotated datasets
- `example-dataset.json` - Example dataset format

---

## Phase 1.5: Auto-Calibration (Current)
**Goal:** Automatically tune detection parameters using annotated training data

### Features
- [x] Dataset format definition (JSON schema)
- [x] Image annotation format (x, y, color per pok)
- [x] Optimization algorithm (random search + local refinement)
- [x] Scoring metrics (F1, precision, recall, color accuracy, position error)
- [x] UI for loading dataset and running calibration
- [x] Export optimized parameters to detector

### Dataset Format
```json
{
  "version": "1.0",
  "images": [
    {
      "filename": "game1.jpg",
      "poks": [
        { "x": 450, "y": 320, "radius": 28, "color": "red" },
        { "x": 890, "y": 290, "radius": 27, "color": "blue" }
      ]
    }
  ]
}
```

### Optimization Algorithm
1. **Random Search Phase**: Sample random parameter combinations to explore the space
2. **Local Refinement Phase**: Hill-climbing from best found, mutating 1-3 params at a time
3. **Scoring**: Combined score = (F1 × 50) + (ColorAccuracy × 40) - (PositionError penalty)

### Metrics
- **Precision**: Detected poks that match annotations / Total detections
- **Recall**: Annotations matched / Total annotations
- **F1 Score**: Harmonic mean of precision and recall
- **Color Accuracy**: Correctly classified colors / Matched poks
- **Position Error**: Average distance between matched detection and annotation

---

## Phase 2: Table Detection & Region of Interest
**Goal:** Automatically detect the game table boundaries

### Features
- [ ] Edge detection to find table rectangle
- [ ] Contour detection for table boundary
- [ ] Crop/mask to table region only
- [ ] Visual feedback showing detected table area

### Technical Approach
- Canny edge detection
- findContours with area filtering
- approxPolyDP to find rectangular shape
- User adjustment controls if auto-detection fails

---

## Phase 3: Perspective Correction
**Goal:** Transform angled photos to top-down view

### Features
- [ ] Detect table corners (4 points)
- [ ] Perspective warp to rectangular output
- [ ] Maintain aspect ratio (1.5:1 as per game config)

### Technical Approach
- getPerspectiveTransform
- warpPerspective
- Corner detection or manual corner selection

---

## Phase 4: Position Mapping
**Goal:** Map detected pok positions to game coordinates (0-100%)

### Features
- [ ] Convert pixel positions to percentage coordinates
- [ ] Account for table boundaries
- [ ] Determine which zone each pok is in
- [ ] Calculate scores based on position

### Technical Approach
- Use transformed table dimensions as reference
- Map (pixelX, pixelY) → (percentX, percentY)
- Use existing scoring-service.js zone logic

---

## Phase 5: Main App Integration
**Goal:** Allow importing detected game state into the scorer

### Features
- [ ] Export detected poks as game events
- [ ] Import into main pok-scorer app
- [ ] Pre-fill a new round with detected positions
- [ ] Handle conflicts and manual corrections

---

## Reference: Pok Visual Properties

### Physical Pok Structure
**Important:** Poks are NOT solid colored circles!
- **Center:** Metallic/chrome marble (reflective, grayish)
- **Outer ring:** Colored plastic ring (red or blue)
- **Detection implication:** Must sample the OUTER RING, not the center, for color classification

### Digital representation (main app):
- Red poks: `#d32f2f` (HSV approximately: H=0, S=78%, V=83%)
- Blue poks: `#1976d2` (HSV approximately: H=210, S=88%, V=82%)
- Pok size: `clamp(20px, 2vw, 30px)` with 2-3px border
- Shape: Perfect circles with dark border

---

## Notes & Decisions Log

### 2025-11-27 - Initial Planning
- Starting with Phase 1 only - minimal proof of concept
- All detection parameters exposed in UI for tuning
- Standalone page, no integration with main app yet
- Focus on detection accuracy before position mapping

### 2025-11-27 - UI/UX Decisions
- **Parameter persistence**: Save to localStorage so tuning isn't lost on refresh
- **Detection trigger**: Manual "Detect" button click required (no live update on slider change)
- **Visual feedback**: Semi-transparent colored fills for detected circles
- **Input sources**: Support both file upload AND webcam capture

### 2025-11-27 - Phase 1 Enhancements
- **Pok structure discovery**: Poks have metal marble center with colored plastic ring
  - Color sampling must target outer ring (annular region), not center
- **Parameter UX improvements**:
  - Add help text tooltips for unclear parameters
  - Add color preview swatches showing current HSV range
  - Add color picker to set target colors visually
- **Algorithm comparison**: Support multiple detection algorithms
  - HoughCircles (current)
  - SimpleBlobDetector (alternative)
- **Settings versioning**: Save snapshots of settings with timestamps, allow reverting to previous versions

### 2025-11-27 - Auto-Calibration System
- **Dataset format**: JSON with version, array of images, each with filename and poks array
- **Pok annotation**: x, y coordinates (pixels), optional radius, required color (red/blue)
- **Optimization approach**:
  - Two-phase: random search for exploration, local refinement for fine-tuning
  - Combined score balances detection accuracy (F1), color classification, and position error
  - Greedy matching algorithm pairs detections to annotations
- **Match threshold**: Configurable distance (default 50px) for considering detection/annotation as match
- **UI workflow**: Load dataset JSON → Load image files → Configure iterations → Run → Export params
