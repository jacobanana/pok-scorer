#!/usr/bin/env python3
"""
Quick test to verify Pydantic models work correctly
"""

import json
import sys
import numpy as np

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from models import DetectorParams, DetectorParamsWithMetadata, TrainingMetadata


def test_basic_params():
    """Test basic DetectorParams creation and serialization"""
    print("Test 1: Basic DetectorParams")

    # Create params with numpy types (simulating optimizer output)
    params = DetectorParams(
        algorithm='hough',
        dp=np.float64(1.5),
        minDist=np.int64(30),
        param1=np.int64(100),
        param2=np.int64(30),
        minRadius=np.int64(10),
        maxRadius=np.int64(50),
        redH1Low=np.int64(0),
        redH1High=np.int64(10),
        redH2Low=np.int64(160),
        redH2High=np.int64(180),
        redSMin=np.int64(100),
        redVMin=np.int64(100),
        blueH1Low=np.int64(100),
        blueH1High=np.int64(130),
        blueH2Low=0,
        blueH2High=0,
        blueSMin=np.int64(100),
        blueVMin=np.int64(100),
    )

    # Serialize to JSON
    json_str = params.model_dump_json(by_alias=True, indent=2)
    print(f" JSON serialization successful ({len(json_str)} bytes)")

    # Verify it's valid JSON
    parsed = json.loads(json_str)
    assert parsed['algorithm'] == 'hough'
    assert parsed['dp'] == 1.5
    assert parsed['minDist'] == 30
    print(" JSON structure correct")

    # Verify types are Python natives, not numpy
    assert isinstance(parsed['dp'], float)
    assert isinstance(parsed['minDist'], int)
    print(" Types are Python natives (not numpy)")

    return params


def test_params_with_metadata():
    """Test DetectorParamsWithMetadata"""
    print("\n Test 2: DetectorParamsWithMetadata")

    # Create metadata
    metadata = TrainingMetadata(
        training_score=53.2,
        validation_score=51.8,
        dataset="test.json",
        iterations=500,
        train_images=5,
        val_images=2,
        param_source="Hybrid (Best Det + Best Color)"
    )

    # Create params with metadata
    params = DetectorParamsWithMetadata(
        algorithm='hough',
        dp=1.5,
        minDist=30,
        param1=100,
        param2=30,
        minRadius=10,
        maxRadius=50,
        redH1Low=0,
        redH1High=10,
        redH2Low=160,
        redH2High=180,
        redSMin=100,
        redVMin=100,
        blueH1Low=100,
        blueH1High=130,
        blueH2Low=0,
        blueH2High=0,
        blueSMin=100,
        blueVMin=100,
        metadata=metadata
    )

    # Serialize
    json_str = params.model_dump_json(by_alias=True, indent=2)
    print(f" JSON serialization successful ({len(json_str)} bytes)")

    # Verify structure
    parsed = json.loads(json_str)
    assert '_metadata' in parsed
    assert parsed['_metadata']['param_source'] == "Hybrid (Best Det + Best Color)"
    print(" Metadata included with _ prefix")

    # Verify it matches detector.js expected format
    assert 'algorithm' in parsed
    assert 'dp' in parsed
    assert 'params' not in parsed  # Should NOT be nested
    print(" Format compatible with detector.js (flat structure)")

    return params


def test_validation():
    """Test Pydantic validation"""
    print("\n Test 3: Validation")

    # Test invalid dp (out of range)
    try:
        DetectorParams(
            algorithm='hough',
            dp=3.0,  # Invalid: must be 1.0-2.5
            minDist=30,
            param1=100,
            param2=30,
            minRadius=10,
            maxRadius=50,
            redH1Low=0,
            redH1High=10,
            redH2Low=160,
            redH2High=180,
            redSMin=100,
            redVMin=100,
            blueH1Low=100,
            blueH1High=130,
            blueH2Low=0,
            blueH2High=0,
            blueSMin=100,
            blueVMin=100,
        )
        print(" Validation should have failed for dp=3.0")
        return False
    except Exception as e:
        print(f" Validation correctly rejected dp=3.0")

    # Test invalid algorithm
    try:
        DetectorParams(
            algorithm='blob',  # Invalid: only 'hough' allowed
            dp=1.5,
            minDist=30,
            param1=100,
            param2=30,
            minRadius=10,
            maxRadius=50,
            redH1Low=0,
            redH1High=10,
            redH2Low=160,
            redH2High=180,
            redSMin=100,
            redVMin=100,
            blueH1Low=100,
            blueH1High=130,
            blueH2Low=0,
            blueH2High=0,
            blueSMin=100,
            blueVMin=100,
        )
        print(" Validation should have failed for algorithm='blob'")
        return False
    except Exception as e:
        print(f" Validation correctly rejected algorithm='blob'")

    return True


def main():
    print("\n" + "="*64)
    print("Pydantic Models Test Suite")
    print("="*64 + "\n")

    try:
        test_basic_params()
        test_params_with_metadata()
        test_validation()

        print("\n" + "="*64)
        print(" ALL TESTS PASSED")
        print("="*64 + "\n")
        return 0
    except Exception as e:
        print(f"\n TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
