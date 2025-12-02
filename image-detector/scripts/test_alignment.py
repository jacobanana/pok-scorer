#!/usr/bin/env python3
"""
Test script to validate Python/JavaScript implementation alignment.
Ensures calibrate.py output is compatible with detector.js
"""

import json
import sys
from pathlib import Path


def test_param_format(params_file: Path) -> bool:
    """Test that output format matches detector.js expectations"""
    print("🧪 Testing parameter file format...")

    with open(params_file) as f:
        data = json.load(f)

    # Test 1: Must have 'algorithm' field at root level
    if 'algorithm' not in data:
        print("  ❌ FAIL: Missing 'algorithm' field at root level")
        return False
    print("  ✅ PASS: 'algorithm' field present")

    # Test 2: Algorithm must be 'hough' (only supported by Python)
    if data['algorithm'] != 'hough':
        print(f"  ❌ FAIL: algorithm={data['algorithm']}, expected 'hough'")
        return False
    print("  ✅ PASS: algorithm='hough'")

    # Test 3: All required Hough parameters present
    required_hough = ['dp', 'minDist', 'param1', 'param2', 'minRadius', 'maxRadius']
    missing_hough = [p for p in required_hough if p not in data]
    if missing_hough:
        print(f"  ❌ FAIL: Missing Hough params: {missing_hough}")
        return False
    print(f"  ✅ PASS: All Hough params present ({len(required_hough)})")

    # Test 4: All required color parameters present
    required_color = [
        'redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
        'blueH1Low', 'blueH1High', 'blueH2Low', 'blueH2High', 'blueSMin', 'blueVMin'
    ]
    missing_color = [p for p in required_color if p not in data]
    if missing_color:
        print(f"  ❌ FAIL: Missing color params: {missing_color}")
        return False
    print(f"  ✅ PASS: All color params present ({len(required_color)})")

    # Test 5: Parameter value ranges (basic sanity checks)
    checks = [
        ('dp', 1.0, 2.5),
        ('minDist', 10, 80),
        ('param1', 30, 200),
        ('param2', 10, 60),
        ('minRadius', 5, 50),
        ('maxRadius', 20, 100),
        ('redH1Low', 0, 10),
        ('redH1High', 5, 20),
        ('redH2Low', 150, 175),
        ('redH2High', 170, 180),
        ('redSMin', 50, 180),
        ('redVMin', 50, 180),
        ('blueH1Low', 90, 115),
        ('blueH1High', 115, 140),
        ('blueH2Low', 0, 0),  # Fixed
        ('blueH2High', 0, 0),  # Fixed
        ('blueSMin', 50, 180),
        ('blueVMin', 50, 180),
    ]

    range_failures = []
    for param, min_val, max_val in checks:
        val = data[param]
        if not (min_val <= val <= max_val):
            range_failures.append(f"{param}={val} (expected {min_val}-{max_val})")

    if range_failures:
        print(f"  ⚠️  WARNING: Parameters out of expected range:")
        for failure in range_failures:
            print(f"      - {failure}")
        print("  ℹ️  This may be OK if optimizer found better values")
    else:
        print("  ✅ PASS: All parameters in expected ranges")

    # Test 6: Metadata present (optional)
    if '_metadata' in data:
        meta = data['_metadata']
        print(f"  ✅ INFO: Metadata present:")
        print(f"      - param_source: {meta.get('param_source', 'N/A')}")
        print(f"      - training_score: {meta.get('training_score', 'N/A')}")
        print(f"      - validation_score: {meta.get('validation_score', 'N/A')}")
        print(f"      - iterations: {meta.get('iterations', 'N/A')}")

    return True


def test_detector_compatibility(params_file: Path) -> bool:
    """Simulate detector.js import logic"""
    print("\n🧪 Testing detector.js compatibility...")

    with open(params_file) as f:
        data = json.load(f)

    # Simulate detector.js import logic (detector.js:886-894)
    params = None
    if 'parameters' in data:
        params = data['parameters']
        print("  ℹ️  Format: Exported format (data.parameters)")
    elif 'algorithm' in data:
        params = data
        print("  ✅ Format: Calibrator format (data.algorithm)")
    else:
        print("  ❌ FAIL: Would throw 'Invalid parameter file format'")
        return False

    # Simulate applyParams (detector.js:913-930)
    all_param_ids = [
        'dp', 'minDist', 'param1', 'param2', 'minRadius', 'maxRadius',
        'blobMinArea', 'blobMaxArea', 'blobMinCircularity', 'blobMinConvexity',
        'redH1Low', 'redH1High', 'redH2Low', 'redH2High', 'redSMin', 'redVMin',
        'blueH1Low', 'blueH1High', 'blueH2Low', 'blueH2High', 'blueSMin', 'blueVMin'
    ]

    applied_count = 0
    for param_id in all_param_ids:
        if param_id in params and params[param_id] is not None:
            applied_count += 1

    print(f"  ✅ PASS: Would apply {applied_count}/{len(all_param_ids)} parameters")

    return True


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_alignment.py <params-file.json>")
        print("\nExample:")
        print("  python test_alignment.py ../models/detector-params.json")
        return 1

    params_file = Path(sys.argv[1])

    if not params_file.exists():
        print(f"❌ File not found: {params_file}")
        return 1

    print(f"\n{'='*64}")
    print(f"Testing: {params_file}")
    print(f"{'='*64}\n")

    # Run tests
    format_ok = test_param_format(params_file)
    compat_ok = test_detector_compatibility(params_file)

    print("\n" + "="*64)
    if format_ok and compat_ok:
        print("✅ ALL TESTS PASSED")
        print("="*64 + "\n")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("="*64 + "\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
