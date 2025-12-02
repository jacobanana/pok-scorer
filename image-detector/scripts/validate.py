#!/usr/bin/env python3
"""
POK Detector Validation Script
Validates detector parameters against a test dataset
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict

from calibrate import PokDetectorCalibrator
from models import DetectorParams, DetectorParamsWithMetadata


def main():
    parser = argparse.ArgumentParser(description='Validate POK detector parameters')
    parser.add_argument('--params', type=Path, required=True,
                       help='Path to parameters JSON file')
    parser.add_argument('--dataset', type=Path, required=True,
                       help='Path to test dataset JSON file')
    parser.add_argument('--images', type=Path, required=True,
                       help='Path to images directory')
    parser.add_argument('--match-threshold', type=int, default=50,
                       help='Distance threshold for matching (px)')
    parser.add_argument('--min-f1', type=float, default=0.7,
                       help='Minimum required F1 score')
    parser.add_argument('--min-color-accuracy', type=float, default=0.7,
                       help='Minimum required color accuracy')

    args = parser.parse_args()

    # Load parameters using Pydantic (validates and handles both formats)
    with open(args.params) as f:
        params_data = json.load(f)

    # Try to parse as DetectorParamsWithMetadata first, fallback to DetectorParams
    try:
        params_model = DetectorParamsWithMetadata(**params_data)
    except Exception:
        # Try without metadata
        try:
            params_model = DetectorParams(**params_data)
        except Exception:
            # Legacy format with 'params' key
            if 'params' in params_data:
                params_model = DetectorParams(**params_data['params'])
            else:
                raise ValueError("Invalid parameter file format")

    params = params_model.model_dump()

    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║              POK DETECTOR VALIDATION (Python)                ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")

    # Load calibrator (just for evaluation methods)
    calibrator = PokDetectorCalibrator(args.dataset, args.images, args.match_threshold)

    # Use all images for validation
    all_images = calibrator.dataset['images']
    print(f"📊 Validating on {len(all_images)} images\n")

    # Evaluate
    result = calibrator.evaluate_params(params, all_images)

    # Print results
    print("━" * 64)
    print("📊 VALIDATION RESULTS")
    print("━" * 64 + "\n")

    avg_metrics = result['per_image']
    avg_f1 = sum(r['f1'] for r in avg_metrics) / len(avg_metrics)
    avg_color = sum(r['color_accuracy'] for r in avg_metrics) / len(avg_metrics)
    avg_precision = sum(r['precision'] for r in avg_metrics) / len(avg_metrics)
    avg_recall = sum(r['recall'] for r in avg_metrics) / len(avg_metrics)
    avg_pos_error = sum(r['avg_position_error'] for r in avg_metrics) / len(avg_metrics)

    print(f"Overall Score:     {result['avg_score']:.2f}")
    print(f"F1 Score:          {avg_f1*100:.1f}%")
    print(f"Color Accuracy:    {avg_color*100:.1f}%")
    print(f"Precision:         {avg_precision*100:.1f}%")
    print(f"Recall:            {avg_recall*100:.1f}%")
    print(f"Avg Position Err:  {avg_pos_error:.1f}px\n")

    # Per-image breakdown
    print("Per-Image Results:")
    print("─" * 64)
    for img_result in avg_metrics:
        status = "✓" if img_result['f1'] >= args.min_f1 and img_result['color_accuracy'] >= args.min_color_accuracy else "✗"
        print(f"{status} {img_result['filename']:30s} | F1: {img_result['f1']*100:5.1f}% | Color: {img_result['color_accuracy']*100:5.1f}% | TP: {img_result['true_positives']} FP: {img_result['false_positives']} FN: {img_result['false_negatives']}")

    # Check thresholds
    print("\n" + "━" * 64)
    passed = True

    if avg_f1 < args.min_f1:
        print(f"❌ F1 score {avg_f1*100:.1f}% below threshold {args.min_f1*100:.1f}%")
        passed = False
    else:
        print(f"✅ F1 score {avg_f1*100:.1f}% meets threshold {args.min_f1*100:.1f}%")

    if avg_color < args.min_color_accuracy:
        print(f"❌ Color accuracy {avg_color*100:.1f}% below threshold {args.min_color_accuracy*100:.1f}%")
        passed = False
    else:
        print(f"✅ Color accuracy {avg_color*100:.1f}% meets threshold {args.min_color_accuracy*100:.1f}%")

    print("━" * 64 + "\n")

    if passed:
        print("✅ VALIDATION PASSED\n")
        return 0
    else:
        print("❌ VALIDATION FAILED\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
