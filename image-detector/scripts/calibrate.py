#!/usr/bin/env python3
"""
POK Detector Calibration Script
Optimizes detection parameters using Bayesian optimization
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import cv2
import numpy as np
from skopt import gp_minimize, forest_minimize
from skopt.space import Real, Integer
from tqdm import tqdm

from models import DetectorParams, DetectorParamsWithMetadata, TrainingMetadata


class ColorClassifier:
    """Python port of color-classifier.js"""

    @staticmethod
    def classify_circle(hsv_image: np.ndarray, center_x: int, center_y: int,
                       radius: int, params: Dict) -> str:
        """
        Classify circle color by sampling outer ring (50%-90% radius)
        Poks have metallic centers - color is in outer plastic ring
        """
        inner_radius = max(2, int(radius * 0.5))
        outer_radius = max(3, int(radius * 0.9))

        red_count = 0
        blue_count = 0
        total_samples = 0

        # Sample pixels in annular region
        for dy in range(-outer_radius, outer_radius + 1):
            for dx in range(-outer_radius, outer_radius + 1):
                dist_sq = dx * dx + dy * dy
                inner_radius_sq = inner_radius * inner_radius
                outer_radius_sq = outer_radius * outer_radius

                # Only sample within ring
                if dist_sq < inner_radius_sq or dist_sq > outer_radius_sq:
                    continue

                px = int(center_x + dx)
                py = int(center_y + dy)

                # Bounds check
                if px < 0 or px >= hsv_image.shape[1] or py < 0 or py >= hsv_image.shape[0]:
                    continue

                h, s, v = hsv_image[py, px]
                total_samples += 1

                if ColorClassifier.is_red(h, s, v, params):
                    red_count += 1
                elif ColorClassifier.is_blue(h, s, v, params):
                    blue_count += 1

        if total_samples == 0:
            return 'unknown'

        red_ratio = red_count / total_samples
        blue_ratio = blue_count / total_samples
        threshold = 0.3

        if red_ratio > threshold and red_ratio > blue_ratio:
            return 'red'
        elif blue_ratio > threshold and blue_ratio > red_ratio:
            return 'blue'

        return 'unknown'

    @staticmethod
    def is_red(h: int, s: int, v: int, params: Dict) -> bool:
        """Check if HSV matches red (wraps around 0/180)"""
        s_ok = s >= params['redSMin']
        v_ok = v >= params['redVMin']
        h_low_range = params['redH1Low'] <= h <= params['redH1High']
        h_high_range = params['redH2Low'] <= h <= params['redH2High']
        return (h_low_range or h_high_range) and s_ok and v_ok

    @staticmethod
    def is_blue(h: int, s: int, v: int, params: Dict) -> bool:
        """Check if HSV matches blue"""
        s_ok = s >= params['blueSMin']
        v_ok = v >= params['blueVMin']
        h_range1 = params['blueH1Low'] <= h <= params['blueH1High']
        h_range2 = (params['blueH2Low'] != params['blueH2High'] and
                   params['blueH2Low'] <= h <= params['blueH2High'])
        return (h_range1 or h_range2) and s_ok and v_ok


class PokDetectorCalibrator:
    """Calibrates POK detector parameters using Bayesian optimization"""

    def __init__(self, dataset_path: Path, images_dir: Path, match_threshold: int = 50):
        self.dataset_path = dataset_path
        self.images_dir = images_dir
        self.match_threshold = match_threshold

        # Load dataset
        self.dataset = self.load_dataset()

        # Split train/val
        self.train_set, self.val_set = self.split_dataset(train_ratio=0.7)

        # Track best parameters for hybrid model
        self.best_params = None
        self.best_score = float('-inf')
        self.best_detection_params = None
        self.best_detection_score = float('-inf')
        self.best_color_params = None
        self.best_color_score = float('-inf')

        # Parameter space (matching calibrator.js)
        self.param_space = [
            Real(1.0, 2.5, name='dp'),
            Integer(10, 80, name='minDist'),
            Integer(30, 200, name='param1'),
            Integer(10, 60, name='param2'),
            Integer(5, 50, name='minRadius'),
            Integer(20, 100, name='maxRadius'),
            # Red color params
            Integer(0, 10, name='redH1Low'),
            Integer(5, 20, name='redH1High'),
            Integer(150, 175, name='redH2Low'),
            Integer(170, 180, name='redH2High'),
            Integer(50, 180, name='redSMin'),
            Integer(50, 180, name='redVMin'),
            # Blue color params
            Integer(90, 115, name='blueH1Low'),
            Integer(115, 140, name='blueH1High'),
            Integer(50, 180, name='blueSMin'),
            Integer(50, 180, name='blueVMin'),
        ]

        print(f"📊 Dataset loaded: {len(self.dataset['images'])} images")
        print(f"   Training: {len(self.train_set)} images")
        print(f"   Validation: {len(self.val_set)} images")

    def load_dataset(self) -> Dict:
        """Load and validate dataset JSON"""
        with open(self.dataset_path) as f:
            dataset = json.load(f)

        if dataset.get('version') != '1.0':
            raise ValueError(f"Unsupported dataset version: {dataset.get('version')}")

        if not dataset.get('images'):
            raise ValueError("Dataset must contain at least one image")

        print(f"\n📦 Loading dataset...")

        # Load and optionally resize images for faster processing
        target_size = 1280  # Resize longest edge to this size
        total_poks = 0
        resized_count = 0

        for img_data in dataset['images']:
            img_path = self.images_dir / img_data['filename']
            if not img_path.exists():
                raise FileNotFoundError(f"Image not found: {img_path}")

            img = cv2.imread(str(img_path))
            if img is None:
                raise ValueError(f"Failed to load image: {img_path}")

            orig_height, orig_width = img.shape[:2]

            # Resize large images for faster processing (resize longest edge)
            max_dim = max(orig_width, orig_height)
            if max_dim > target_size:
                scale = target_size / max_dim
                new_width = int(orig_width * scale)
                new_height = int(orig_height * scale)
                img_resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
                img_data['_scale'] = scale
                resized_count += 1
                print(f"   📷 {img_data['filename']}: {orig_width}×{orig_height} → {new_width}×{new_height} ({len(img_data['poks'])} poks)")
            else:
                img_resized = img
                img_data['_scale'] = 1.0
                print(f"   📷 {img_data['filename']}: {orig_width}×{orig_height} (original, {len(img_data['poks'])} poks)")

            img_data['_image'] = img_resized
            img_data['_orig_size'] = (orig_width, orig_height)
            total_poks += len(img_data['poks'])

        if resized_count > 0:
            print(f"\n   ✓ Resized {resized_count}/{len(dataset['images'])} images (longest edge → {target_size}px) for faster processing")
        print(f"   ✓ Total: {len(dataset['images'])} images, {total_poks} annotated poks\n")

        return dataset

    def split_dataset(self, train_ratio: float = 0.7) -> Tuple[List, List]:
        """Split dataset into train/validation sets"""
        images = self.dataset['images'].copy()
        np.random.seed(42)  # Reproducible split
        np.random.shuffle(images)

        split_idx = int(len(images) * train_ratio)
        return images[:split_idx], images[split_idx:]

    def detect_poks(self, image: np.ndarray, params: Dict, scale: float = 1.0, max_circles: int = 20) -> List[Dict]:
        """Run HoughCircles + color classification (image should be pre-resized)

        Args:
            image: Pre-resized image to detect poks in
            params: Detection parameters (optimized for resized images)
            scale: Scale factor that was used to resize the image (resized_width / original_width)
            max_circles: Maximum number of circles to detect

        Note: params['minRadius'] and params['maxRadius'] are already optimized for
        the resized image scale, so we use them directly without scaling.
        """
        # Image is already resized during load, no need to resize again
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Gaussian blur
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        # HoughCircles detection
        # NOTE: minRadius and maxRadius are already optimized for the resized image
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=params['dp'],
            minDist=params['minDist'],
            param1=params['param1'],
            param2=params['param2'],
            minRadius=params['minRadius'],
            maxRadius=params['maxRadius']
        )

        if circles is None:
            return []

        # Limit circles to prevent runaway computation on bad parameters
        num_circles = circles.shape[1]
        if num_circles > max_circles:
            # Keep only the strongest circles (first N returned by HoughCircles)
            circles = circles[:, :max_circles]

        # Convert image to HSV for color classification
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # Process detections and scale back to original coordinates
        detections = []
        circles = np.round(circles[0, :]).astype(int)

        for (x, y, radius) in circles:
            # Classify color on resized image
            color = ColorClassifier.classify_circle(hsv, x, y, radius, params)

            # Scale coordinates back to original image size
            detections.append({
                'x': int(x / scale),
                'y': int(y / scale),
                'radius': int(radius / scale),
                'color': color
            })

        return detections

    def calculate_score(self, detections: List[Dict], annotations: List[Dict]) -> Dict:
        """Calculate F1, precision, recall, color accuracy"""
        threshold = self.match_threshold

        # Greedy matching
        matched = []
        unmatched_detections = detections.copy()
        unmatched_annotations = annotations.copy()

        for ann in annotations:
            best_idx = -1
            best_dist = float('inf')

            for j, det in enumerate(unmatched_detections):
                dist = np.sqrt((det['x'] - ann['x'])**2 + (det['y'] - ann['y'])**2)
                if dist < threshold and dist < best_dist:
                    best_dist = dist
                    best_idx = j

            if best_idx != -1:
                det = unmatched_detections.pop(best_idx)
                color_match = ann['color'] == det['color']
                matched.append({
                    'distance': best_dist,
                    'color_match': color_match
                })
                unmatched_annotations.remove(ann)

        # Calculate metrics
        tp = len(matched)
        fp = len(unmatched_detections)
        fn = len(unmatched_annotations)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

        color_correct = sum(1 for m in matched if m['color_match'])
        color_accuracy = color_correct / tp if tp > 0 else 0

        avg_pos_error = np.mean([m['distance'] for m in matched]) if matched else threshold

        # Combined score (matching calibrator.js formula)
        combined_score = (f1 * 50) + (color_accuracy * 40) - (avg_pos_error / threshold * 10)

        return {
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'color_accuracy': color_accuracy,
            'avg_position_error': avg_pos_error,
            'true_positives': tp,
            'false_positives': fp,
            'false_negatives': fn,
            'combined_score': combined_score
        }

    def evaluate_params(self, params: Dict | DetectorParams, dataset: List = None) -> Dict:
        """Evaluate parameters on dataset"""
        if dataset is None:
            dataset = self.train_set

        # Convert Pydantic model to dict if needed
        if isinstance(params, DetectorParams):
            params = params.model_dump()

        total_score = 0
        results = []

        for img_data in dataset:
            detections = self.detect_poks(img_data['_image'], params, scale=img_data['_scale'])
            score = self.calculate_score(detections, img_data['poks'])
            results.append({
                'filename': img_data['filename'],
                **score
            })
            total_score += score['combined_score']

        return {
            'avg_score': total_score / len(dataset),
            'per_image': results
        }

    def _params_to_model(self, params: Dict) -> DetectorParams:
        """Convert params dict to Pydantic model (handles type conversion automatically)"""
        return DetectorParams(**params)

    def objective_function(self, param_values: List) -> float:
        """Objective function for Bayesian optimization (to be minimized)"""
        # Convert param_values list to dict
        params = {
            'algorithm': 'hough',
            'dp': param_values[0],
            'minDist': param_values[1],
            'param1': param_values[2],
            'param2': param_values[3],
            'minRadius': param_values[4],
            'maxRadius': param_values[5],
            'redH1Low': param_values[6],
            'redH1High': param_values[7],
            'redH2Low': param_values[8],
            'redH2High': param_values[9],
            'redSMin': param_values[10],
            'redVMin': param_values[11],
            'blueH1Low': param_values[12],
            'blueH1High': param_values[13],
            'blueH2Low': 0,  # Fixed
            'blueH2High': 0,  # Fixed
            'blueSMin': param_values[14],
            'blueVMin': param_values[15],
        }

        result = self.evaluate_params(params)

        # Calculate average metrics for logging
        avg_f1 = np.mean([r['f1'] for r in result['per_image']])
        avg_color = np.mean([r['color_accuracy'] for r in result['per_image']])
        avg_precision = np.mean([r['precision'] for r in result['per_image']])
        avg_recall = np.mean([r['recall'] for r in result['per_image']])

        # Calculate detection score (F1 based) and color score separately
        # Detection score: heavily weighted toward F1, precision, recall
        detection_score = (avg_f1 * 70) + (avg_precision * 15) + (avg_recall * 15)

        # Color score: purely color accuracy
        color_score = avg_color * 100

        # Track best overall score
        if result['avg_score'] > self.best_score:
            self.best_score = result['avg_score']
            self.best_params = params.copy()

        # Track best detection parameters
        if detection_score > self.best_detection_score:
            self.best_detection_score = detection_score
            self.best_detection_params = params.copy()

        # Track best color parameters
        if color_score > self.best_color_score:
            self.best_color_score = color_score
            self.best_color_params = params.copy()

        # Log detailed metrics (will appear after scikit-optimize's own logging)
        print(f"    → Score: {result['avg_score']:.2f} | F1: {avg_f1*100:.1f}% | Color: {avg_color*100:.1f}% | P: {avg_precision*100:.1f}% | R: {avg_recall*100:.1f}%")

        # Return negative score (gp_minimize minimizes)
        return -result['avg_score']

    def neighbor_params(self, base_params: Dict) -> Dict:
        """Generate neighbor parameters (small mutations for local search)"""
        params = base_params.copy()

        # Mutate 1-3 random parameters
        num_mutations = np.random.randint(1, 4)

        # Define step sizes for each parameter
        step_sizes = {
            'dp': 0.1,
            'minDist': 5,
            'param1': 10,
            'param2': 5,
            'minRadius': 5,
            'maxRadius': 5,
            'redH1Low': 1,
            'redH1High': 1,
            'redH2Low': 1,
            'redH2High': 1,
            'redSMin': 10,
            'redVMin': 10,
            'blueH1Low': 1,
            'blueH1High': 1,
            'blueSMin': 10,
            'blueVMin': 10,
        }

        # Get parameter ranges from param_space
        param_names = ['dp', 'minDist', 'param1', 'param2', 'minRadius', 'maxRadius',
                      'redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
                      'blueH1Low', 'blueH1High', 'blueSMin', 'blueVMin']

        for _ in range(num_mutations):
            # Select random parameter to mutate
            param_name = np.random.choice(param_names)

            # Get current value and step size
            current_val = params[param_name]
            step = step_sizes[param_name]

            # Move up or down by 1-2 steps
            step_change = np.random.choice([-1, 1]) * step * np.random.randint(1, 3)

            # Get bounds from param_space
            param_idx = param_names.index(param_name)
            space_def = self.param_space[param_idx]

            if hasattr(space_def, 'low') and hasattr(space_def, 'high'):
                # For Real and Integer spaces
                new_val = current_val + step_change
                new_val = np.clip(new_val, space_def.low, space_def.high)
                params[param_name] = type(current_val)(new_val)  # Keep original type

        return params

    def optimize(self, n_calls: int = 500, starting_params: Dict = None, use_forest: bool = False, local_iterations: int = 100) -> Dict:
        """Run Bayesian optimization followed by local hill-climbing refinement"""
        print("\n╔══════════════════════════════════════════════════════════════╗")
        print("║              POK DETECTOR CALIBRATION (Python)               ║")
        print("╚══════════════════════════════════════════════════════════════╝\n")

        optimizer_name = "Random Forest" if use_forest else "Gaussian Process"
        print(f"🔧 Configuration:")
        print(f"   - Optimization calls: {n_calls}")
        print(f"   - Local refinement: {local_iterations} iterations")
        print(f"   - Algorithm: Bayesian Optimization ({optimizer_name})")
        print(f"   - Training set: {len(self.train_set)} images")
        print(f"   - Validation set: {len(self.val_set)} images\n")

        # Initial point from starting params if provided
        x0 = None
        if starting_params:
            print("🎯 Using provided starting parameters\n")
            x0 = [
                starting_params.get('dp', 1.0),
                starting_params.get('minDist', 20),
                starting_params.get('param1', 100),
                starting_params.get('param2', 30),
                starting_params.get('minRadius', 10),
                starting_params.get('maxRadius', 50),
                starting_params.get('redH1Low', 0),
                starting_params.get('redH1High', 10),
                starting_params.get('redH2Low', 160),
                starting_params.get('redH2High', 180),
                starting_params.get('redSMin', 100),
                starting_params.get('redVMin', 100),
                starting_params.get('blueH1Low', 100),
                starting_params.get('blueH1High', 130),
                starting_params.get('blueSMin', 100),
                starting_params.get('blueVMin', 100),
            ]

        print("🚀 Starting Bayesian Optimization...\n")

        # Track total time
        import time
        start_time = time.time()

        # Run optimization with performance tuning
        # Wrap in try/except to handle keyboard interrupts gracefully
        interrupted = False
        result = None

        try:
            if use_forest:
                # Random Forest is MUCH faster and scales better (O(n log n) vs O(n³))
                result = forest_minimize(
                    self.objective_function,
                    self.param_space,
                    n_calls=n_calls,
                    x0=x0,
                    random_state=42,
                    verbose=True,
                    n_jobs=-1,  # Use all CPU cores for forest
                    n_random_starts=20,  # Random points before forest fitting
                )
            else:
                # Gaussian Process (more accurate but slower)
                result = gp_minimize(
                    self.objective_function,
                    self.param_space,
                    n_calls=n_calls,
                    x0=x0,
                    random_state=42,
                    verbose=True,
                    n_jobs=1,  # Single thread for reproducibility
                    n_initial_points=20,  # Use 20 random points before GP fitting
                    acq_func='EI',  # Expected Improvement (faster than default)
                    acq_optimizer='sampling',  # Sampling is faster than 'lbfgs'
                    n_points=1000,  # Number of points to sample when optimizing acquisition
                )
        except KeyboardInterrupt:
            print("\n\n⚠️  Keyboard interrupt detected! Exporting best parameters found so far...\n")
            interrupted = True

        # If interrupted, use the best parameters we tracked during optimization
        if interrupted:
            if not self.best_params:
                print("❌ No parameters found yet - optimization was interrupted too early.")
                print("   Try running for at least a few iterations before interrupting.\n")
                raise ValueError("No parameters found - interrupted too early")

            # Use the tracked best parameters
            print("Using tracked best parameters from optimization:")
            print(f"  Best score so far: {self.best_score:.2f}\n")

            best_params_raw = self.best_params
            best_score = self.best_score
            best_source = "Interrupted - Tracked Best"

        else:
            # Normal completion - extract best parameters from optimizer result
            optimizer_best_params = {
                'algorithm': 'hough',
                'dp': float(result.x[0]),
                'minDist': int(result.x[1]),
                'param1': int(result.x[2]),
                'param2': int(result.x[3]),
                'minRadius': int(result.x[4]),
                'maxRadius': int(result.x[5]),
                'redH1Low': int(result.x[6]),
                'redH1High': int(result.x[7]),
                'redH2Low': int(result.x[8]),
                'redH2High': int(result.x[9]),
                'redSMin': int(result.x[10]),
                'redVMin': int(result.x[11]),
                'blueH1Low': int(result.x[12]),
                'blueH1High': int(result.x[13]),
                'blueH2Low': 0,
                'blueH2High': 0,
                'blueSMin': int(result.x[14]),
                'blueVMin': int(result.x[15]),
            }

            # Test hybrid model (best detection params + best color params)
            print("\n" + "━" * 64)
            print("✅ PHASE: Hybrid Model Testing")
            print("━" * 64 + "\n")

            print("Testing three candidate parameter sets:")
            print("  1️⃣  Best Overall (from optimizer)")
            print("  2️⃣  Best Detection (best F1) + Best Color (best color accuracy)")
            print("  3️⃣  Tracked Best (highest combined score during optimization)\n")

            # Candidate 1: Optimizer's best
            candidate_1 = optimizer_best_params
            candidate_1_result = self.evaluate_params(candidate_1, self.train_set)
            print(f"  1️⃣  Optimizer Best Score: {candidate_1_result['avg_score']:.2f}")

            # Candidate 2: Hybrid (detection params from best detection + color params from best color)
            if self.best_detection_params and self.best_color_params:
                candidate_2 = self.best_detection_params.copy()
                # Replace color params with best color params
                for key in ['redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
                           'blueH1Low', 'blueH1High', 'blueH2Low', 'blueH2High', 'blueSMin', 'blueVMin']:
                    candidate_2[key] = self.best_color_params[key]
                candidate_2_result = self.evaluate_params(candidate_2, self.train_set)
                print(f"  2️⃣  Hybrid (Best Det + Best Color) Score: {candidate_2_result['avg_score']:.2f}")
            else:
                candidate_2 = None
                candidate_2_result = {'avg_score': float('-inf')}
                print(f"  2️⃣  Hybrid: N/A (no separate detection/color params tracked)")

            # Candidate 3: Tracked best during optimization
            if self.best_params:
                candidate_3 = self.best_params
                candidate_3_result = self.evaluate_params(candidate_3, self.train_set)
                print(f"  3️⃣  Tracked Best Score: {candidate_3_result['avg_score']:.2f}")
            else:
                candidate_3 = None
                candidate_3_result = {'avg_score': float('-inf')}
                print(f"  3️⃣  Tracked Best: N/A")

            # Select best of the three
            candidates = [
                (candidate_1, candidate_1_result['avg_score'], "Optimizer Best"),
                (candidate_2, candidate_2_result['avg_score'], "Hybrid (Best Det + Best Color)"),
                (candidate_3, candidate_3_result['avg_score'], "Tracked Best")
            ]
            best_params_raw, best_score, best_source = max(candidates, key=lambda x: x[1])

        # Phase 3: Local hill-climbing refinement
        if local_iterations > 0 and best_params_raw:
            print("\n" + "━" * 64)
            print("🔍 PHASE: Local Search (Hill Climbing)")
            print("━" * 64 + "\n")

            print(f"Starting refinement with {local_iterations} iterations...")
            print(f"  Current best: {best_score:.2f} ({best_source})\n")

            current_params = best_params_raw.copy()
            current_score = best_score
            no_improvement_count = 0
            improvements = 0

            for i in range(local_iterations):
                # Generate neighbor parameters
                neighbor = self.neighbor_params(current_params)
                result = self.evaluate_params(neighbor, self.train_set)

                if result['avg_score'] > current_score:
                    current_score = result['avg_score']
                    current_params = neighbor
                    no_improvement_count = 0
                    improvements += 1

                    if result['avg_score'] > best_score:
                        best_score = result['avg_score']
                        best_params_raw = neighbor
                        # Only append "+ Local Search" once
                        if "+ Local Search" not in best_source:
                            best_source = f"{best_source} + Local Search"
                        print(f"  ⬆️  Improvement #{improvements}: {result['avg_score']:.2f} (+{(result['avg_score'] - current_score):.2f})")
                else:
                    no_improvement_count += 1
                    # If stuck, jump to random neighbor of best to escape local optima
                    if no_improvement_count > 10:
                        current_params = self.neighbor_params(best_params_raw)
                        current_score = best_score
                        no_improvement_count = 0
                        print(f"   🔄 Stuck at local optimum, jumping to random neighbor...")

                if (i + 1) % 20 == 0:
                    print(f"   Progress: {i + 1}/{local_iterations} | Best: {best_score:.2f} | Improvements: {improvements}")

            print(f"\n  ✅ Local search complete. Total improvements: {improvements}")
            if improvements > 0:
                print(f"  📈 Score improved from initial to {best_score:.2f} (+{(best_score - (best_score - improvements * 0.1)):.2f})\n")
            else:
                print(f"  📊 No improvements found (already at local optimum)\n")

        # Calculate average scale factor from training data
        # Parameters were optimized on resized images, need to scale them back to original resolution
        scales = [img['_scale'] for img in self.train_set]
        avg_scale = np.mean(scales)

        print(f"\n  📏 Scaling parameters to original resolution:")
        print(f"     Average training scale: {avg_scale:.3f}")
        print(f"     Scale factor to apply: {1/avg_scale:.3f}\n")

        # Scale spatial parameters back to original image resolution
        # These parameters are resolution-dependent: minDist, minRadius, maxRadius
        best_params_scaled = best_params_raw.copy()
        best_params_scaled['minDist'] = int(best_params_raw['minDist'] / avg_scale)
        best_params_scaled['minRadius'] = int(best_params_raw['minRadius'] / avg_scale)
        best_params_scaled['maxRadius'] = int(best_params_raw['maxRadius'] / avg_scale)

        print(f"     Original (resized):  minDist={best_params_raw['minDist']}, minRadius={best_params_raw['minRadius']}, maxRadius={best_params_raw['maxRadius']}")
        print(f"     Scaled (original):   minDist={best_params_scaled['minDist']}, minRadius={best_params_scaled['minRadius']}, maxRadius={best_params_scaled['maxRadius']}\n")

        # Convert numpy types to Python natives to avoid serialization warnings
        best_params_native = {
            k: (int(v) if isinstance(v, (np.integer, np.int64)) else
                float(v) if isinstance(v, (np.floating, np.float64)) else v)
            for k, v in best_params_scaled.items()
        }

        # Convert to Pydantic model, bypassing validation for scaled spatial parameters
        # The validation ranges in models.py are for resized images, but we're exporting for original resolution
        best_params = DetectorParams.model_construct(**best_params_native)

        print(f"  ✅ Selected: {best_source} (Score: {best_score:.2f})\n")

        # Evaluate on training and validation sets
        print("\n" + "━" * 64)
        print("✅ PHASE: Validation Set Testing")
        print("━" * 64 + "\n")

        train_result = self.evaluate_params(best_params, self.train_set)
        val_result = self.evaluate_params(best_params, self.val_set)

        print("📊 FINAL RESULTS:")
        print("┌─────────────────────────────────────────────────────────────┐")
        print(f"│ Training Score:   {train_result['avg_score']:.2f}".ljust(63) + "│")
        print(f"│ Validation Score: {val_result['avg_score']:.2f}".ljust(63) + "│")
        print("├─────────────────────────────────────────────────────────────┤")

        # Calculate averages
        val_metrics = val_result['per_image']
        avg_f1 = np.mean([r['f1'] for r in val_metrics])
        avg_color = np.mean([r['color_accuracy'] for r in val_metrics])
        avg_precision = np.mean([r['precision'] for r in val_metrics])
        avg_recall = np.mean([r['recall'] for r in val_metrics])
        avg_pos_error = np.mean([r['avg_position_error'] for r in val_metrics])

        print(f"│ F1 Score:         {avg_f1*100:.1f}%".ljust(63) + "│")
        print(f"│ Color Accuracy:   {avg_color*100:.1f}%".ljust(63) + "│")
        print(f"│ Precision:        {avg_precision*100:.1f}%".ljust(63) + "│")
        print(f"│ Recall:           {avg_recall*100:.1f}%".ljust(63) + "│")
        print(f"│ Avg Pos Error:    {avg_pos_error:.1f}px".ljust(63) + "│")
        print("└─────────────────────────────────────────────────────────────┘\n")

        # Calculate and display total time
        total_time = time.time() - start_time
        minutes = int(total_time // 60)
        seconds = int(total_time % 60)
        print(f"⏱️  Total training time: {minutes}m {seconds}s ({total_time:.1f}s)")
        print(f"📊 Average time per iteration: {total_time/n_calls:.2f}s\n")

        return {
            'best_params': best_params,
            'train_score': train_result['avg_score'],
            'val_score': val_result['avg_score'],
            'train_result': train_result,
            'val_result': val_result,
            'iterations': n_calls,
            'total_time_seconds': total_time,
            'param_source': best_source  # Track which parameter set was selected
        }


def main():
    parser = argparse.ArgumentParser(description='Calibrate POK detector parameters')
    parser.add_argument('--dataset', type=Path, required=True,
                       help='Path to dataset JSON file')
    parser.add_argument('--images', type=Path, required=True,
                       help='Path to images directory')
    parser.add_argument('--output', type=Path, default=Path('detector-params.json'),
                       help='Output path for optimized parameters')
    parser.add_argument('--iterations', type=int, default=500,
                       help='Number of optimization iterations')
    parser.add_argument('--starting-params', type=Path, default=None,
                       help='Optional starting parameters JSON')
    parser.add_argument('--match-threshold', type=int, default=50,
                       help='Distance threshold for matching detections to annotations (px)')
    parser.add_argument('--use-forest', action='store_true',
                       help='Use Random Forest optimizer (faster, scales better for 500+ iterations)')
    parser.add_argument('--local-iterations', type=int, default=100,
                       help='Number of local hill-climbing iterations for refinement (default: 100, 0 to disable)')

    args = parser.parse_args()

    # Load starting params if provided
    starting_params = None
    if args.starting_params:
        with open(args.starting_params) as f:
            starting_params = json.load(f)

    # Run calibration
    calibrator = PokDetectorCalibrator(args.dataset, args.images, args.match_threshold)
    results = calibrator.optimize(
        n_calls=args.iterations,
        starting_params=starting_params,
        use_forest=args.use_forest,
        local_iterations=args.local_iterations
    )

    # Save results using Pydantic model (handles type conversion automatically)
    # Create metadata
    metadata = TrainingMetadata(
        training_score=results['train_score'],
        validation_score=results['val_score'],
        dataset=str(args.dataset),
        iterations=args.iterations,
        train_images=len(calibrator.train_set),
        val_images=len(calibrator.val_set),
        param_source=results['param_source']
    )

    # Create params with metadata (best_params is already a DetectorParams from Pydantic)
    # Use model_construct to bypass validation since parameters are already scaled to original resolution
    output_model = DetectorParamsWithMetadata.model_construct(
        **results['best_params'].model_dump(),
        metadata=metadata  # Will be serialized as '_metadata'
    )

    # Write JSON (Pydantic handles serialization automatically)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, 'w') as f:
        f.write(output_model.model_dump_json(by_alias=True, indent=2))

    print(f"\n✅ Parameters saved to: {args.output}")

    if "Interrupted" in results['param_source']:
        print("\n╔══════════════════════════════════════════════════════════════╗")
        print("║            CALIBRATION INTERRUPTED (PARTIAL RESULTS)         ║")
        print("╚══════════════════════════════════════════════════════════════╝\n")
        print("⚠️  Training was interrupted before completion.")
        print("   Parameters saved represent the best model found so far.")
        print("   Consider running longer for potentially better results.\n")
    else:
        print("\n╔══════════════════════════════════════════════════════════════╗")
        print("║                    CALIBRATION COMPLETE                      ║")
        print("╚══════════════════════════════════════════════════════════════╝\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
