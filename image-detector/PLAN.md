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

From main app:
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
