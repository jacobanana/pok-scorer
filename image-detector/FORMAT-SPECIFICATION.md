# POK Detector Parameter Format Specification

**Python is the source of truth.** This document defines the single, canonical format for POK detector parameters.

## Format Version: 1.0

### JSON Structure

```json
{
  "algorithm": "hough",
  "dp": 1.5,
  "minDist": 30,
  "param1": 100,
  "param2": 30,
  "minRadius": 10,
  "maxRadius": 50,
  "redH1Low": 0,
  "redH1High": 10,
  "redH2Low": 160,
  "redH2High": 180,
  "redSMin": 100,
  "redVMin": 100,
  "blueH1Low": 100,
  "blueH1High": 130,
  "blueH2Low": 0,
  "blueH2High": 0,
  "blueSMin": 100,
  "blueVMin": 100,
  "_metadata": {
    "training_score": 53.2,
    "validation_score": 51.8,
    "dataset": "image-detector/datasets/pok-training.json",
    "iterations": 500,
    "train_images": 5,
    "val_images": 2,
    "param_source": "Hybrid (Best Det + Best Color)"
  }
}
```

## Field Specifications

### Required Parameters

All parameters must be present at the root level (flat structure, not nested).

#### Algorithm

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `algorithm` | string (literal) | `"hough"` | Detection algorithm (only 'hough' supported in Python) |

#### Hough Circle Detection

**Note**: The ranges below are for training (on resized images). Output files contain parameters scaled to original resolution, so `minDist`, `minRadius`, and `maxRadius` may exceed these ranges.

| Field | Type | Range (Training) | Description |
|-------|------|------------------|-------------|
| `dp` | float | 1.0 - 2.5 | Inverse ratio of accumulator resolution |
| `minDist` | int | 10 - 80 | Minimum distance between circle centers (pixels) |
| `param1` | int | 30 - 200 | Canny edge detector high threshold |
| `param2` | int | 10 - 60 | Accumulator threshold for circle centers |
| `minRadius` | int | 5 - 50 | Minimum circle radius (pixels) |
| `maxRadius` | int | 20 - 100 | Maximum circle radius (pixels) |

#### Red Color (HSV)

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `redH1Low` | int | 0 - 10 | Red hue range 1 low (wraps at 0) |
| `redH1High` | int | 5 - 20 | Red hue range 1 high |
| `redH2Low` | int | 150 - 175 | Red hue range 2 low (wraps at 180) |
| `redH2High` | int | 170 - 180 | Red hue range 2 high |
| `redSMin` | int | 50 - 180 | Red saturation minimum |
| `redVMin` | int | 50 - 180 | Red value/brightness minimum |

#### Blue Color (HSV)

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `blueH1Low` | int | 90 - 115 | Blue hue range 1 low |
| `blueH1High` | int | 115 - 140 | Blue hue range 1 high |
| `blueH2Low` | int | 0 (fixed) | Blue hue range 2 low (unused) |
| `blueH2High` | int | 0 (fixed) | Blue hue range 2 high (unused) |
| `blueSMin` | int | 50 - 180 | Blue saturation minimum |
| `blueVMin` | int | 50 - 180 | Blue value/brightness minimum |

### Optional Metadata

The `_metadata` field is optional and should be ignored when applying parameters to the detector.

| Field | Type | Description |
|-------|------|-------------|
| `_metadata.training_score` | float | Training set score |
| `_metadata.validation_score` | float | Validation set score |
| `_metadata.dataset` | string | Path to training dataset |
| `_metadata.iterations` | int | Number of optimization iterations |
| `_metadata.train_images` | int | Number of training images |
| `_metadata.val_images` | int | Number of validation images |
| `_metadata.param_source` | string | Which parameter set was selected (e.g., "Hybrid (Best Det + Best Color)", "Optimizer Best", "Tracked Best") |

## Implementation Guidelines

### Python (Source of Truth)

Use Pydantic models defined in `scripts/models.py`:

```python
from models import DetectorParamsWithMetadata, TrainingMetadata

# Create params
params = DetectorParamsWithMetadata(
    algorithm='hough',
    dp=1.5,
    minDist=30,
    # ... all params ...
    metadata=TrainingMetadata(
        training_score=53.2,
        validation_score=51.8,
        # ... all metadata ...
    )
)

# Serialize
json_str = params.model_dump_json(by_alias=True, indent=2)
```

**Key Points:**
- Field name is `metadata` in Python
- Serialized as `_metadata` in JSON (via `serialization_alias`)
- Must use `by_alias=True` when serializing
- Pydantic handles type conversion (numpy → Python natives)
- Pydantic validates all ranges automatically

### JavaScript

Import and apply parameters in `detector.js`:

```javascript
// Load JSON
const data = JSON.parse(jsonString);

// Validate
if (!data.algorithm) {
    throw new Error('Invalid parameter file format: missing algorithm field');
}

// Extract params (ignoring _metadata)
const params = {...data};
delete params._metadata;

// Log metadata for debugging (optional)
if (data._metadata) {
    console.log('Training metadata:', data._metadata);
}

// Apply to detector
applyParams(params);
```

**Key Points:**
- Expect flat structure with `algorithm` at root
- `_metadata` field is ignored when applying parameters
- Can display `_metadata.param_source` in UI for user info

## Validation Rules

### Structural Validation

1. ✅ Root object must be a JSON object (not array)
2. ✅ `algorithm` field must be present and equal to `"hough"`
3. ✅ All 18 parameter fields must be present
4. ✅ `_metadata` field is optional

### Type Validation

1. ✅ All integer fields must be JSON numbers (not strings)
2. ✅ `dp` must be a JSON number (float)
3. ✅ `algorithm` must be a JSON string
4. ✅ No `null` values allowed for required fields

### Range Validation

All parameters must be within specified ranges (see tables above).

Python automatically validates ranges via Pydantic:
- Raises `ValidationError` if out of range
- Coerces types when safe (e.g., int → float for `dp`)

JavaScript should trust Python-generated files:
- Range validation not required (Python is source of truth)
- Type checking recommended for user-provided files

## Migration from Legacy Formats

### Old Format (nested params)

```json
{
  "params": { "algorithm": "hough", ... },
  "metadata": { ... }
}
```

**Migration:** Extract `params` to root level, rename `metadata` to `_metadata`

### Old Format (calibrator export)

```json
{
  "algorithm": "hough",
  "dp": 1.5,
  ...
}
```

**Migration:** Already compatible! Just add optional `_metadata` field.

## Examples

### Minimal Valid File

```json
{
  "algorithm": "hough",
  "dp": 1.5,
  "minDist": 30,
  "param1": 100,
  "param2": 30,
  "minRadius": 10,
  "maxRadius": 50,
  "redH1Low": 0,
  "redH1High": 10,
  "redH2Low": 160,
  "redH2High": 180,
  "redSMin": 100,
  "redVMin": 100,
  "blueH1Low": 100,
  "blueH1High": 130,
  "blueH2Low": 0,
  "blueH2High": 0,
  "blueSMin": 100,
  "blueVMin": 100
}
```

### Full File with Metadata

See "JSON Structure" section above.

## Testing

### Python

```bash
cd image-detector/scripts
python test_pydantic.py
python test_alignment.py ../models/detector-params.json
```

### JavaScript

```bash
# Generate params in Python
python calibrate.py --dataset ../datasets/pok-training.json \
  --images ../datasets/images \
  --output test-params.json \
  --iterations 100

# Import in browser
# 1. Open image-detector/index.html
# 2. Click "Import" button
# 3. Select test-params.json
# 4. Verify: "Parameters imported from JSON file (trained: ...)"
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-02 | Initial specification. Python as source of truth. Flat structure with _metadata. |

## References

- Python implementation: `image-detector/scripts/models.py`
- JavaScript implementation: `image-detector/detector.js` (lines 880-920)
- Validation tests: `image-detector/scripts/test_pydantic.py`
- Alignment tests: `image-detector/scripts/test_alignment.py`
